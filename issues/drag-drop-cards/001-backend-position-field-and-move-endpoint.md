---
id: drag-drop-cards-001
title: Add position field to Card model and extend the move endpoint with reordering
status: done
security: false
owner: agent
depends_on: []
spec_ref: "SPEC.md#feature-drag-and-drop-card-movement"
---

## Description

Backend half of drag-and-drop: give each card an explicit `position` (0-based order
within its column) and extend the existing `PATCH /api/cards/{id}/move` endpoint so a
caller can place a card at a specific index within its target column, not just change
its column. Per SPEC.md, this reuses the existing `/move` endpoint rather than adding a
separate reorder endpoint, since "placing a card at a specific slot" is one conceptual
action whether or not the column changes.

## Acceptance criteria

- `Card` (in `backend/app/main.py`) has a new field `position: int`.
- `CardMove` gets a new optional field `index: int | None = None`.
- `_Store._seed()` assigns `position=0` to each of the three seeded cards (one per
  column, so each is alone in its column at position 0).
- `_Store.add_card()` assigns the new card `position = <count of existing cards in the
  target column>`, i.e. it's appended to the end of that column — matches current
  behavior for card creation (SPEC.md: new cards always start non-urgent and, per this
  feature, at the end of their column).
- `_Store.move_card(card_id, column, index=None)`:
  - Looks up the card; raises `KeyError` on miss (caught by the route as a 404), same
    pattern as today.
  - Builds the target column's card list (excluding this card if it's already in that
    column), sorted by `position`.
  - Clamps `index` into `[0, len(target list)]`; if `index` is `None`, defaults to
    `len(target list)` (append — preserves today's behavior for any caller that doesn't
    pass an index, e.g. non-drag callers).
  - Inserts the card into the target list at the clamped index, then renumbers that
    list's `position` values to consecutive `0..n-1`.
  - If the card's column is changing, also renumbers the *source* column's remaining
    cards to consecutive `0..n-1` so no gap is left behind.
  - Sets `card.column = column` and returns the updated card.
- `move_card` route (`PATCH /api/cards/{card_id}/move`) passes `data.index` through to
  `store.move_card`.
- Existing callers that only send `{"column": ...}` (no `index`) continue to work
  unchanged — card is appended to the end of the target column, same observable
  behavior as the current implementation.
- `GET /api/cards` naturally includes `position` in each returned card (it's a plain
  pydantic field).

## Notes

- Follow the existing `_Store` pattern: lock around the whole read-modify-write, raise
  `KeyError` for the route to translate into a 404, no persistence beyond the process.
- Index values arrive from the frontend as plain integers computed from a drag gesture;
  clamp defensively server-side rather than trusting the client range, but this is not a
  new untrusted-input *security* concern (SPEC.md's Security section: no auth, no
  sensitive data — same posture as the rest of the app).
- Don't renumber a column's positions on `delete_card` — leaving gaps there is fine since
  sort-by-position is stable regardless of gaps; only `move_card` needs to keep its
  touched columns' positions consecutive.

`code-review` note: since `delete_card` can leave gaps and `add_card`'s position is a plain
count of existing cards in the column (per the acceptance criteria above), a card added right
after a delete can land on the same `position` as a surviving card until the column is next
touched by `move_card` (which renumbers it back to consecutive). Frontend sort is stable, so
this only affects tie order between those two cards, never a crash or lost card — not fixed
here since the count-based formula is what the acceptance criteria explicitly specify.
