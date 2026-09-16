---
id: drag-drop-cards-002
title: Add position field to frontend Card model, sort by it, extend moveCard with an index param
status: open
security: false
owner: agent
depends_on: [drag-drop-cards-001]
spec_ref: "SPEC.md#feature-drag-and-drop-card-movement"
---

## Description

Wire the frontend's data layer up to the new backend `position` field and extended
`/move` endpoint from drag-drop-cards-001, so the component can render cards in their
correct order and request a specific drop position. No drag interaction or UI changes in
this issue — that's drag-drop-cards-003.

## Acceptance criteria

- `Card` interface in `frontend/src/app/kanban.model.ts` has a new `position: number`
  field.
- `AppComponent.cardsIn(column)` (`frontend/src/app/app.component.ts`) sorts its result
  by `position` ascending before returning it, so cards render in the order the backend
  assigns them.
- `KanbanService.moveCard` (`frontend/src/app/kanban.service.ts`) gains an optional third
  parameter, e.g. `moveCard(id: number, column: ColumnId, index?: number)`, and includes
  `index` in the PATCH body sent to `/api/cards/${id}/move` only when it's provided
  (omitting it when `undefined`, matching the backend's optional `index` field from
  drag-drop-cards-001 and preserving append-to-end behavior for any caller that omits
  it).

## Notes

- This is purely data-layer plumbing — no template/CSS changes, no new drag event
  handlers. `move()`, `isFirst()`, `isLast()`, and the `←`/`→` buttons are removed in
  drag-drop-cards-003, not here.
- Angular's `HttpClient` JSON-serializes the PATCH body via `JSON.stringify`, which
  already drops object keys whose value is `undefined` — no special-casing needed beyond
  not setting the key when `index` isn't passed.
