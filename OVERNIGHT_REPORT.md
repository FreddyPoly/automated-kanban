# Overnight Run Report — 2026-09-17

Branch: `overnight-run-inpytd`
Backlog pulled from `overnight/2026-09-16-b` (fast-forward merge, no conflicts).

## Completed

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

## Needs your attention

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

## Waiting on you

None. No `owner: user` issues in the backlog.

## Placeholders built

None. No `owner: placeholder` issues in the backlog.

## Other notes

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
