"""Kanban demo API — in-memory storage, three fixed columns.

This is a deliberately small demo backend used to exercise the overnight
implement/review pipeline. No auth, no persistence, no external services.
"""
from __future__ import annotations

import itertools
import threading
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

Column = Literal["todo", "in_progress", "done"]
COLUMNS: tuple[Column, ...] = ("todo", "in_progress", "done")

app = FastAPI(title="Kanban Demo API", version="0.1.0")

# Wide-open CORS is fine here: local demo only, no auth, no sensitive data.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class Card(BaseModel):
    id: int
    title: str
    column: Column
    urgent: bool = False
    position: int


class CardCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    column: Column = "todo"


class CardMove(BaseModel):
    column: Column
    index: int | None = None


class CardUrgent(BaseModel):
    urgent: bool


class _Store:
    """Process-local in-memory store. Not thread-safe across processes;
    a lock is enough for uvicorn's single worker in this demo."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._ids = itertools.count(1)
        self._cards: dict[int, Card] = {}
        self._seed()

    def _seed(self) -> None:
        for title, column in [
            ("Set up project skeleton", "done"),
            ("Wire frontend to API", "in_progress"),
            ("Write first automated issue", "todo"),
        ]:
            card_id = next(self._ids)
            self._cards[card_id] = Card(id=card_id, title=title, column=column, position=0)

    def list_cards(self) -> list[Card]:
        with self._lock:
            return list(self._cards.values())

    def add_card(self, data: CardCreate) -> Card:
        with self._lock:
            card_id = next(self._ids)
            position = sum(1 for c in self._cards.values() if c.column == data.column)
            card = Card(id=card_id, title=data.title, column=data.column, position=position)
            self._cards[card_id] = card
            return card

    def _column_cards(self, column: Column, exclude_id: int) -> list[Card]:
        return sorted(
            (c for c in self._cards.values() if c.column == column and c.id != exclude_id),
            key=lambda c: c.position,
        )

    @staticmethod
    def _renumber(cards: list[Card]) -> None:
        for position, c in enumerate(cards):
            c.position = position

    def move_card(self, card_id: int, column: Column, index: int | None = None) -> Card:
        with self._lock:
            card = self._cards.get(card_id)
            if card is None:
                raise KeyError(card_id)

            source_column = card.column
            target_list = self._column_cards(column, card_id)
            clamped_index = len(target_list) if index is None else max(0, min(index, len(target_list)))
            target_list.insert(clamped_index, card)
            self._renumber(target_list)

            card.column = column

            if source_column != column:
                self._renumber(self._column_cards(source_column, card_id))

            return card

    def set_urgent(self, card_id: int, urgent: bool) -> Card:
        with self._lock:
            card = self._cards.get(card_id)
            if card is None:
                raise KeyError(card_id)
            card.urgent = urgent
            return card

    def delete_card(self, card_id: int) -> None:
        with self._lock:
            if card_id not in self._cards:
                raise KeyError(card_id)
            del self._cards[card_id]


store = _Store()


@app.get("/api/columns")
def get_columns() -> list[str]:
    return list(COLUMNS)


@app.get("/api/cards")
def list_cards() -> list[Card]:
    return store.list_cards()


@app.post("/api/cards", status_code=201)
def create_card(data: CardCreate) -> Card:
    return store.add_card(data)


@app.patch("/api/cards/{card_id}/move")
def move_card(card_id: int, data: CardMove) -> Card:
    try:
        return store.move_card(card_id, data.column, data.index)
    except KeyError:
        raise HTTPException(status_code=404, detail="Card not found")


@app.patch("/api/cards/{card_id}/urgent")
def set_card_urgent(card_id: int, data: CardUrgent) -> Card:
    try:
        return store.set_urgent(card_id, data.urgent)
    except KeyError:
        raise HTTPException(status_code=404, detail="Card not found")


@app.delete("/api/cards/{card_id}", status_code=204, response_model=None)
def delete_card(card_id: int) -> None:
    try:
        store.delete_card(card_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Card not found")
