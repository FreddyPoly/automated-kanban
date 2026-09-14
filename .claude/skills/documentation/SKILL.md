---
name: documentation
description: After finishing a non-trivial code change (new feature, bug fix, refactor, architecture decision), update the project's root documentation files — CLAUDE.md, SPEC.md, README.md, or whatever equivalent already exists — so a future agent or teammate can open the project cold and understand what it does, what changed, and how to continue. Create these files if none exist. Use at the end of a change, not before or during. Do not use for trivial edits (typo fixes, one-line tweaks, formatting) or read-only/exploratory work with no code change. Works in any conversation language, English or French included — write the documentation in whatever language the existing docs use, or the user's language if there's no precedent.
---

# Documentation

When a piece of real work is done — a feature landed, a bug fixed, a decision made about how
something works — leave the project's root documentation in a state where someone with zero
memory of this conversation (a future agent, a future you, a teammate) can read it and pick up
the project without re-deriving what you just learned.

This runs **after** the work is done and verified, not as a substitute for doing it. Don't
document a plan instead of implementing it.

## Which files to update

Look for existing root-level docs first, in this rough order of precedence, and use whichever
already exist and fit the content:

- `CLAUDE.md` (or `AGENTS.md`) — how the project works, conventions, architecture, how to run/test
  it, and a running account of what's been built so an agent can orient itself
- `SPEC.md` — the intended behavior/requirements of the system: what it should do, not just what
  it currently does. Update this when a change alters or clarifies the spec, not for pure
  implementation detail
- `README.md` — user/developer-facing overview, setup, usage. Update only if the change affects
  what a reader of the README needs to know (new setup step, new command, changed usage)

If **none** of these exist at the project root, create `CLAUDE.md` at minimum (and `SPEC.md` too
if the project has real functional requirements worth pinning down). Don't invent an elaborate
doc structure beyond what the project needs — a small script doesn't need the same scaffolding as
a multi-service app.

Check for an existing doc skill or CONTRIBUTING-style convention before inventing your own
structure — if the project already has a documentation pattern, follow it rather than imposing a
new one.

## What to write

For each file you touch, update — don't just append noise to — the relevant section:

- **What changed and why** — the decision or feature in plain terms, plus the reasoning if it
  wasn't obvious (a constraint, a tradeoff, a rejected alternative worth remembering)
- **Current state** — what the project does now, kept accurate. If your change makes an existing
  sentence wrong, fix that sentence rather than leaving it stale next to a new one
- **How to continue** — anything a future agent would need to know to extend this: open questions,
  known gaps, deliberately-deferred work, where the next natural piece would go

Don't:
- Restate what `git log`/`git diff` already shows clearly (file-by-file change lists, line
  counts) — summarize intent and outcome, not the diff
- Duplicate content across files — put architecture in one place, spec in another, and reference
  rather than repeat
- Leave stale information standing next to new information — reconcile, don't just add on
- Write a comprehensive doc for a one-line fix — match the depth of the write-up to the size of
  the change

Keep entries dated (use the actual current date) if the file already tracks changes chronologically
(e.g. a "Changelog" or "Recent changes" section) so future readers can tell what's recent.

## Language

Write the documentation in whichever language the existing docs are already in. If you're
creating the files fresh with no precedent, write in the language the user is working in for this
conversation. This skill's own triggering does not depend on language — recognize the need to
document regardless of whether the surrounding conversation is in English, French, or anything
else.
