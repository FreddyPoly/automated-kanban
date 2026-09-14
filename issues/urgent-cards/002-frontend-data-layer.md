---
id: urgent-cards-002
title: Add urgent field to frontend Card model and service
status: open
security: false
owner: agent
depends_on: [urgent-cards-001]
spec_ref: "SPEC.md#data-model--api"
---

## Description

Wire the frontend's data layer up to the new backend field and endpoint from
urgent-cards-001, so components can read and set a card's urgent status. No UI changes in
this issue — that's urgent-cards-003.

## Acceptance criteria

- `Card` interface in `frontend/src/app/kanban.model.ts` has a new `urgent: boolean` field.
- `KanbanService` (`frontend/src/app/kanban.service.ts`) has a new method, e.g.
  `setUrgent(id: number, urgent: boolean): Observable<Card>`, that calls
  `PATCH /api/cards/${id}/urgent` with `{ urgent }` and returns the updated card — same
  shape as the existing `moveCard` method.

## Notes

- Matches SPEC.md's decision to always create cards non-urgent — no changes needed to
  `createCard` or the add-card form.
