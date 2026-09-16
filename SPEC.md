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

## Feature: Per-column card creation

The single global "add card" form (which always created into `todo`) is replaced by a
per-column "+" button and inline input, so a card can be created directly in any column.

### Behavior

- **Removed**: the top-level `<form class="add-card">` (title input + "Add card" button)
  above the board.
- **"+" button**: each column header gets a small icon-only "+" button at its right end,
  styled consistently with the existing card action buttons (`←` `→` `⚑` `✕`).
- **Inline input**: clicking a column's "+" reveals an inline text input at the bottom of
  that column's card list (after existing cards).
  - **Enter** creates the card via `kanban.createCard(title, column.id)`. Empty/whitespace-
    only titles don't submit (same guard as the old form).
  - **Escape**, or clicking away (blur), cancels and hides the input without creating a
    card.
  - After a successful add, the input stays open, clears, and refocuses, so the user can
    keep adding cards to that column without re-clicking "+". It only closes via Escape or
    blur.
- **Independent per-column state**: any number of columns can have their input open at
  once — each column tracks its own open/closed state independently (no mutual exclusion
  between columns).
- **Ordering**: new cards are appended to the end of the column's list, matching the
  previous append behavior.

### Data model / API

No backend or API changes. `createCard(title, column)` in `KanbanService` already accepts
a target column; the frontend now just passes the clicked column's id instead of always
`'todo'`.

### Rejected alternatives

- A single global input that only changes its "add to" column via a separate selector —
  rejected in favor of putting the control directly on each column, which needs no extra
  selection step.
- Restricting to one open input at a time across the board — rejected; independent
  per-column state is simpler to reason about and lets the user add to two columns without
  the first input closing.

## Security

No change to the project's existing risk posture: no auth, no persistence beyond the
in-memory store, no sensitive data. The "urgent" toggle adds a boolean flag on an existing
internal card id, and per-column card creation only changes which column a card title
(already free-text, already sent to the backend) is targeted at — neither introduces a new
untrusted-input surface. Stays low-risk, same as the rest of the app (see `README.md`).

## QC approach

No dedicated automated QC harness for these features. The frontend is a small Angular app
with existing unit-test scaffolding (karma/jasmine) and the backend exposes a thin, fully
scriptable REST API — manual QC plus unit tests are sufficient; a GUI-automation harness
would be noise for a surface this small.
