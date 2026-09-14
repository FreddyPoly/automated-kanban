# SPEC

## Feature: Urgent cards

Cards can be marked "urgent" and are shown with a visual highlight on the board.

### Behavior

- **Toggle control**: each card gets a small icon button (⚑) in its existing action row
  (alongside `←` `→` `✕`), following the app's current unicode-glyph-button convention.
  Clicking it toggles urgent on/off for that card.
- **Highlight**: an urgent card gets a colored left-edge accent stripe plus a subtle
  background tint. Reuses the app's existing accent color (`#b14a3b`, already used for the
  error banner and the delete button) rather than introducing a new color, to stay
  consistent with the current palette.
- **Ordering**: urgent is a pure visual flag. No auto-sorting — cards keep their existing
  order within a column regardless of urgent status.
- **Card creation**: the "add card" form is unchanged. New cards always start non-urgent;
  urgency is set afterward via the toggle.

### Data model / API

- Backend: add `urgent: bool = False` to the `Card` model. New endpoint
  `PATCH /api/cards/{id}/urgent` to toggle/set the flag, mirroring the existing dedicated
  `/move` endpoint pattern (a separate PATCH endpoint per action rather than a generic
  update).
- Frontend: add `urgent: boolean` to the `Card` interface, plus a corresponding call in
  `KanbanService` to hit the new endpoint.
- Storage: in-memory only, same as every other field — lost on backend restart, consistent
  with the rest of this demo project.

### Rejected alternatives

- Auto-sorting urgent cards to the top of their column — rejected in favor of keeping
  urgent purely visual, so card order stays predictable and tied only to explicit moves.
- Letting new cards be created urgent directly (checkbox on the add-card form) — rejected
  to keep the add-card form unchanged and the feature scope minimal; mark urgent after
  creation instead.

## Security

No change to the project's existing risk posture: no auth, no persistence beyond the
in-memory store, no sensitive data. This feature adds a boolean toggle on an existing
internal card id — no new untrusted-input surface. Stays low-risk, same as the rest of the
app (see `README.md`).

## QC approach

No dedicated automated QC harness for this feature. The frontend is a small Angular app
with existing unit-test scaffolding (karma/jasmine) and the backend exposes a thin, fully
scriptable REST API — manual QC plus unit tests are sufficient; a GUI-automation harness
would be noise for a surface this small.
