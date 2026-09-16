# Overnight Run Report — 2026-09-15

Backlog merged from `overnight/2026-09-14`, run via `implement-issue-auto` on branch
`overnight-run-50cn29`. All eligible work processed; nothing left in the queue.

## Completed (first attempt, no retry needed)

- **urgent-cards-001** — Add urgent field to Card model and a toggle endpoint. Backend:
  `Card.urgent: bool = False`, new `PATCH /api/cards/{id}/urgent`, mirroring the existing
  `/move` pattern. Verified manually against a running server (curl) in addition to
  code-review + review-issue-auto (Opus), both clean.
- **urgent-cards-002** — Add urgent field to frontend Card model and service. `Card.urgent`
  interface field, `KanbanService.setUrgent()`. Verified with `ng build` (typecheck — see
  "Pre-existing issue" below for why the karma suite couldn't be used instead). code-review
  + review-issue-auto both clean.
- **urgent-cards-003** — Add urgent toggle button and highlight styling to cards. `⚑` button
  in `card-actions`, `.card.urgent` CSS (left-edge stripe + tint, reusing `#b14a3b`/`#f7e3df`,
  no new color introduced). Verified with `ng build` plus a live Playwright smoke test against
  `ng serve` + the real backend (click → PATCH fires → button title flips to "Unmark urgent" →
  card gets the `.urgent` class and renders the stripe/tint; screenshot confirmed visually,
  other cards unaffected). code-review flagged one real-but-pre-existing race (see below);
  review-issue-auto (Opus) passed clean.

**Feature status: `urgent-cards` is 3/3 done, `ready-for-qc`** (see `issues/FEATURES.md`).

## Completed after retry

None — all three issues passed `review-issue-auto` on the first pass.

## Needs your attention

Nothing blocking. One non-blocking note left in `issues/urgent-cards/003-frontend-toggle-and-highlight.md`:
`code-review` found that `toggleUrgent()` reads the stale local `card.urgent` before its PATCH
resolves, so a very fast double-click could send the same value twice instead of toggling back.
This is the *exact same* pattern already present in `move()` and `remove()` (neither disables
its button or debounces mid-flight either), and the issue's own acceptance criteria explicitly
asked `toggleUrgent` to mirror that pattern — so it wasn't fixed in isolation, only noted. Worth
its own issue later if in-flight-request handling across all three card actions is ever wanted.

No `status: in-progress` or `done ⚠️ needs-review` issues were found at the start of this run —
the backlog started clean.

## Waiting on you

None — no `owner: user` issues in this backlog.

## Placeholders built

None — no `owner: placeholder` issues in this backlog.

## Pre-existing issue found (not introduced by this run)

`frontend/src/app/app.component.spec.ts` (the default Angular CLI scaffold, untouched by any
of these issues) fails to compile: it asserts `app.title` and a "Hello, frontend" heading,
neither of which exists in `AppComponent`. This predates this run (confirmed by running the
suite before making any changes) and blocks the entire karma/jasmine suite from running at all,
including any new spec files. Frontend changes in this run were instead verified via `ng build`
(full typecheck, passed cleanly each time) and, for the UI-facing issue, a live browser smoke
test. Recommend a small follow-up issue to fix or replace this stale spec file so the test
suite is usable again.
