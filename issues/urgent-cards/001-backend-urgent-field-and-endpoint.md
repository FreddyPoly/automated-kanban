---
id: urgent-cards-001
title: Add urgent field to Card model and a toggle endpoint
status: open
security: false
owner: agent
depends_on: []
spec_ref: "SPEC.md#data-model--api"
---

## Description

Add persistence and an API for marking a card urgent, per SPEC.md's "Data model / API"
section. This is the backend half of the "urgent cards" feature: it does not add any UI.

## Acceptance criteria

- `Card` (in `backend/app/main.py`) has a new field `urgent: bool = False`.
- Existing endpoints (`GET /api/cards`, `POST /api/cards`, `PATCH /api/cards/{id}/move`)
  continue to work unchanged; newly created cards default to `urgent: false`, matching
  SPEC.md's "Card creation" decision (no urgent flag at creation time).
- New endpoint `PATCH /api/cards/{id}/urgent` sets the card's `urgent` flag from the request
  body and returns the updated card, following the same pattern as the existing `/move`
  endpoint (request model, 404 via `HTTPException` if the card id doesn't exist).
- The endpoint accepts an explicit boolean value (set, not just toggle) so the frontend can
  set state idempotently — mirrors how `/move` takes an explicit target column rather than
  "move by one."

## Notes

- In-memory `_Store` only — no persistence beyond the process, consistent with the rest of
  the store (see `_Store.move_card` for the pattern to follow: lock, look up by id, raise
  `KeyError` on miss, caught by the route handler as a 404).
- SPEC.md's Security section marks this feature low-risk (no auth, no new untrusted-input
  surface) — no additional validation beyond the existing boolean/id checks is required.
