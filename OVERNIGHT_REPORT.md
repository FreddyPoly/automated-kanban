# Overnight Run Report — 2026-09-17

## Run: `overnight-run-inpytd`

Branch: `overnight-run-inpytd`
Backlog pulled from `overnight/2026-09-16-b` (fast-forward merge, no conflicts).

### Completed

- **per-column-card-creation-001** — Replace global add-card state with per-column
  open/draft tracking (`frontend/src/app/app.component.ts`). Removed `newCardTitle`/
  `addCard()`; added `openColumns`/`draftTitles` state plus `openAdd`/`cancelAdd`/
  `submitAdd`/`isAdding`. Passed independent review (`review-issue-auto`) on the first
  pass. Commit `ab8f494`.
- **per-column-card-creation-002** — Add per-column "+" button and inline input to the
  board template (`app.component.html`/`app.component.css`). Removed the old global
  add-card form; each column header now has a "+" button and an inline draft input with
  Enter/Escape/blur handling and refocus-on-success. Inline `code-review` also caught and
  fixed two small issues before review: a double-submit race on rapid Enter/key-repeat
  (fixed with a per-column in-flight guard) and duplicated CSS between `.card-actions
  button` and the new `.add-card-btn` (merged into a shared selector). Passed independent
  review (`review-issue-auto`) on the first pass, with a few non-blocking nitpicks (see
  below). Commit `569790f`.

Feature `per-column-card-creation` is now 2/2 done and marked `ready-for-qc` in
`issues/FEATURES.md`.

Both issues built cleanly first attempt — no retries were needed this run.

### Needs your attention

None. No issue was left `in-progress` after a failed review, and no issue was found stuck
`in-progress` or `⚠️ needs-review` at the start of this run.

Non-blocking nitpicks from `review-issue-auto` on per-column-card-creation-002, worth a
look next time you're in that area but not worth reopening the issue for:
- The "+" button's icon and its background are both white (`.card-actions button`'s white
  background sits on the column's own white background), so it currently reads as a bare
  green glyph rather than a visible button chrome. Cards themselves sit on a tinted
  background so their action buttons look fine by contrast; the column header doesn't.
- On narrow/mobile widths (board stacked to one column), opening a second column's input
  while another is focused can require two clicks on the "+" button, because the blur-cancel
  removes the first input and shifts layout before the click resolves. This is a side effect
  of the spec-mandated "blur cancels" rule, not a bug in the implementation.
- `openAdd` doesn't proactively focus the newly-opened input (only post-submit refocus is
  wired up). Not required by the issue's acceptance criteria.

### Waiting on you

None. No `owner: user` issues in the backlog.

### Placeholders built

None. No `owner: placeholder` issues in the backlog.

### Other notes

- **Pre-existing test-suite breakage, unrelated to this run's changes**:
  `frontend/src/app/app.component.spec.ts` fails to even compile
  (`Property 'title' does not exist on type 'AppComponent'`, plus an assertion on
  `"Hello, frontend"` text that has never existed in this project's template). This is
  stale Angular-CLI scaffolding that predates both issues implemented tonight and the
  `urgent-cards` feature before it — none of the prior implementation work maintained it
  either. Left untouched as out of scope for either issue; worth its own cleanup issue if
  you want frontend unit tests to actually run again.
- Verified `ng build` (production, template type-checking on) passes cleanly on the final
  state of the branch.
- No backend changes were needed this run (`per-column-card-creation` is frontend-only per
  `SPEC.md`).

## Run: `overnight-run-7jurkn`

Backlog merged from `overnight/2026-09-16`, run via `implement-issue-auto` on branch
`overnight-run-7jurkn`. All eligible work processed; nothing left in the queue.

### Completed (first attempt, no retry needed)

- **drag-drop-cards-001** — Add position field to Card model and extend the move endpoint
  with reordering. Backend: `Card.position: int`, `CardMove.index: int | None = None`,
  `_Store.move_card` now inserts at a clamped index and renumbers the affected column(s)
  to stay consecutive. Verified manually against a running server (curl): append, index
  clamping (both directions), cross-column renumbering, 404 on a missing card. No backend
  test framework exists to add unit tests to (see "Pre-existing issue" below). `code-review`
  found and fixed one nitpick (duplicated renumber logic extracted into helper methods);
  `review-issue-auto` (Opus) passed clean.
- **drag-drop-cards-002** — Add position field to frontend Card model, sort by it, extend
  `moveCard` with an index param. `Card.position`, `AppComponent.cardsIn()` sorts ascending
  by position, `KanbanService.moveCard` gains an optional `index` param passed through to
  the PATCH body. Verified with `ng build` (typecheck — karma suite still blocked, see
  below). `code-review` found nothing; `review-issue-auto` (Opus) verified the
  `JSON.stringify` drops-`undefined`-keys claim empirically and passed clean.
- **drag-drop-cards-003** — Implement native drag-and-drop for moving/reordering cards,
  remove arrow buttons. Native HTML5 DnD (`draggable`/`dragstart`/`dragover`/`drop`/
  `dragend`) replaces the `←`/`→` buttons entirely: cross-column moves, within-column
  reordering, an empty column as a valid drop target (index 0), optimistic local reorder
  with server reconciliation, and a live insertion-line indicator (green, reusing the
  existing palette). Verified with `ng build` plus a live Playwright smoke test against
  `ng serve` + the real backend: cross-column drag, empty-column drop, and same-column
  reorder were all exercised end-to-end, matched the expected API state and rendered
  order/visual indicators, and produced zero browser console errors. `code-review` found
  and fixed 3 nitpicks (a dead `.card-actions button:disabled` rule left over from the
  removed arrow buttons, a duplicate `.card` CSS selector block, and an O(N²)
  `dropIndicator` recomputation during `dragover`, fixed with a precomputed lookup map).
  `review-issue-auto` (Opus) passed with 2 additional hardening findings, both applied
  before commit: a failed `/move` call wasn't surfacing the `error` banner (fixed — `.
  refresh()` resets `error` to `null` on entry, so the failure message is now set *after*
  calling it instead of before), and drag-state clearing on a cross-column drop was
  correctness-by-timing (relying on Angular's `eventCoalescing` to defer change detection
  past `dragend`) rather than guaranteed — hardened by also calling `onDragEnd()` explicitly
  at the end of `onDrop`.

**Feature status: `drag-drop-cards` is 3/3 done, `ready-for-qc`** (see `issues/FEATURES.md`).
Combined with the already-`ready-for-qc` `urgent-cards` feature from the prior run, both
features in this backlog are now ready for a human QC pass.

### Completed after retry

None — all three issues passed `review-issue-auto` on the first pass (drag-drop-cards-003
passed with hardening findings applied, not a reopen/retry — see above).

### Needs your attention

Nothing blocking. No `status: in-progress` or `done ⚠️ needs-review` issues were found at
the start of this run — the backlog started clean.

One pre-existing note carried forward and still true: `frontend/src/app/app.component.spec.ts`
(the default Angular CLI scaffold) still fails to compile — it asserts `app.title` and a
"Hello, frontend" heading, neither of which exists in `AppComponent`. This predates this run
and blocks the whole karma/jasmine suite, including any new spec files a future issue might
add. All backend and frontend changes in this run were instead verified via direct manual
testing (curl against a running backend; `ng build` typecheck plus live Playwright smoke
tests against `ng serve` + the real backend for the UI-facing issue). Recommend a small
follow-up issue to fix or replace this stale spec file so the test suite is usable again —
this is now the second run in a row blocked from using it.

Similarly, the backend still has no test framework at all (no `pytest` in
`requirements.txt`, no `tests/` directory) — per `implement-issue`'s rule against bolting on
a test framework mid-issue, none was added. Worth a deliberate decision (not an
implicit one made mid-issue) on whether to add one for this project going forward.

### Waiting on you

None — no `owner: user` issues in this backlog.

### Placeholders built

None — no `owner: placeholder` issues in this backlog.
