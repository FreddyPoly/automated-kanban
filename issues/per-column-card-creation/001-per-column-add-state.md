---
id: per-column-card-creation-001
title: Replace global add-card state with per-column open/draft tracking
status: open
security: false
owner: agent
depends_on: []
spec_ref: "SPEC.md#feature-per-column-card-creation"
---

## Description

Replace `AppComponent`'s single global `newCardTitle` / `addCard()` with per-column state:
which columns currently have their inline "add card" input open, and each open column's
draft title text. This is the logic half of the feature — no template/CSS changes here
(that's per-column-card-creation-002).

## Acceptance criteria

- `newCardTitle` field and `addCard()` method are removed from `AppComponent`
  (`frontend/src/app/app.component.ts`).
- New state tracks, per column id, whether that column's inline input is open (e.g. a
  `Set<ColumnId>` or `Record<ColumnId, boolean>`), defaulting to closed for every column.
- New state tracks, per column id, a draft title string (e.g. `Record<ColumnId, string>`),
  defaulting to empty.
- `openAdd(column: ColumnId)`: marks that column's input open. Must not affect any other
  column's open state — opening `todo` while `done` is already open leaves both open (per
  SPEC.md's "independent per-column state" decision).
- `cancelAdd(column: ColumnId)`: closes that column's input and clears its draft title,
  without creating a card.
- `submitAdd(column: ColumnId)`: trims that column's draft title. If empty, does nothing
  (same guard as the old `addCard()`). Otherwise calls
  `this.kanban.createCard(title, column)`, appends the returned card to `this.cards` (same
  pattern as the old `addCard()`), and clears that column's draft title. The column's input
  stays open after a successful submit (per SPEC.md's "stays open, cleared, refocused"
  decision) — actual DOM focus is out of scope here, handled in
  per-column-card-creation-002.
- `isAdding(column: ColumnId): boolean` helper for the template to read open state.

## Notes

- No backend or `KanbanService` changes — `createCard(title, column)` already accepts a
  target column.
- SPEC.md explicitly rejected a single global input with a column selector, and explicitly
  rejected limiting to one open column at a time — don't reintroduce either.
