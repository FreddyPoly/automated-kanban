---
name: report
description: >
  Generate a project status report from SPEC.md, issues/INDEX.md, and issues/FEATURES.md —
  feature-by-feature progress and QC status, what's currently in-progress, what's blocked on the
  user, and concrete next steps. Use this whenever the user asks for a status update, project
  overview, "where are we", "what's left", "how's it going", or invokes /report explicitly —
  including mid-session while running implement-issue or qc, not just once a project is fully
  done. Defaults to a concise text summary in chat; only builds a full visual dashboard artifact
  when the user explicitly asks for "the full report", "a dashboard", or something
  visual/shareable. Requires an existing issues/ folder (from doc-to-issues) — if none exists,
  say so instead of trying to synthesize a report from nothing.
---

# report

A snapshot of where a doc-to-issues project actually stands right now — not a fixed end-of-project
wrap-up, but something you can run at any point (mid-`implement-issue`, mid-`qc`, or cold) and get
an accurate read. The value here is entirely in accuracy: this only earns its keep if it reflects
the files as they are *right now*, not what they were the last time anyone looked.

## Requirements

Needs `issues/` (from `doc-to-issues`) and ideally `SPEC.md`. If `issues/` doesn't exist, don't
improvise a report from the codebase alone — tell the user this project hasn't been broken into
issues yet and point them at `doc-to-issues` (or `interview` first if there's no
`SPEC.md` either).

## Gathering the current state

Always re-read the actual files live, every time — never reuse a previous `/report`'s output or
lean on the conversation's summarized memory of "how things were." The whole reason this is worth
running mid-session is that it catches what's changed since you last looked (an issue that just
flipped to `done`, one `qc` just reopened to `in-progress`, a dependency that just became
unblocked). A report built from stale context defeats its own purpose.

Read:

- **`SPEC.md`**'s `## Goal` section (or nearest equivalent) — one line of real context for the
  report's header. Don't summarize the whole spec.
- **`issues/INDEX.md`** — every issue's `status`/`security`/`owner`/`depends_on`. This table is
  the source of truth for all counts; don't count from `FEATURES.md` alone, since it can lag.
- **`issues/FEATURES.md`** — the recorded per-feature status, to compare against what's actually
  true.

For each feature, recompute its live status the same way the `qc` skill does: `ready-for-qc` once
every `owner: agent`/`owner: placeholder` issue under it is `done` (an open `owner: user` issue
doesn't block this — note it as a caveat instead). Compare that against what `FEATURES.md` has on
file. If they disagree — most commonly `FEATURES.md` still says `qc-passed` but `qc`'s own "On
failure" step has since reopened one of that feature's issues to `in-progress` — that's a stale
row worth calling out explicitly, not something to silently trust or silently fix. Reporting is
this skill's whole job; leave correcting it to `qc`/`implement-issue`.

While reading `INDEX.md`, also collect:

- Every issue with **`status: in-progress`** — this is live, current work. If that issue file has
  a `## QC feedback` section appended (from a failed `qc` pass), pull out what was expected vs.
  what actually broke — that's exactly the context someone resuming it via `implement-issue` needs
  first, and it's easy to miss buried in a long issue file.
- Every open **`owner: user`** issue — a real blocker on a decision only the user can make, not
  something to route around or downplay.
- Every **`owner: placeholder`** issue, done or not — a flagged default (a color, copy, an asset)
  standing in for a real decision, whether or not it's been built yet.
- Every issue with **`security: true`** — and whether a `security-review` has actually been run
  since (check for recent git history or ask, don't assume).
- Whether a git repo exists at all, and whether it has a remote — worth one line, not a section.

## Report structure — text mode (default)

This is what you produce unless the user has asked for something visual. Keep it tight: this is a
status check someone's glancing at mid-task, not a document to read end to end. Use this shape,
adapting the lists to what's actually there — if a section is genuinely empty, say so explicitly
("Blocked on you: none") rather than omitting it, since an omitted section reads as "didn't check"
rather than "nothing found."

```
**<Project name>** — <one-line goal, from SPEC.md>

Progress: <done> / <total> issues done (<percent>%) across <N> features

🟢 <Feature>: <done>/<total> — qc-passed
🔴 <Feature>: <done>/<total> — qc-failed
🟡 <Feature>: <done>/<total> — ready-for-qc
🔵 <Feature>: <done>/<total> — in-progress
⚪ <Feature>: <done>/<total> — not-ready
...

In progress now: <issue id — title>, or "Nothing currently in progress"
  <if QC feedback attached: one line on what broke, so it's actionable immediately>

Blocked on you: <owner:user issue id — title — the one-line reason>, or "None"

Next up (unblocked, ready via implement-issue): <1–3 issue ids — titles>

Flags: <placeholders still open> · <security-flagged issues not yet reviewed> · <stale FEATURES.md rows, if any>
```

**Status color legend** — one fixed emoji per feature-level status, always the same mapping so a
returning reader doesn't have to re-learn it each time:

| Status | Emoji | Meaning |
|---|---|---|
| `qc-passed` | 🟢 | User has verified this feature works |
| `qc-failed` | 🔴 | User tried it and something broke — reopened issue(s), needs a fix pass |
| `ready-for-qc` | 🟡 | Built, not yet verified by the user |
| `in-progress` | 🔵 | Still being built — at least one issue actively in flight |
| `not-ready` | ⚪ | Blocked — dependencies on other issues aren't `done` yet |

Apply the matching emoji as a prefix on every feature line, computed from that feature's *live*
recomputed status (per "Gathering the current state" above), not blindly copied from
`FEATURES.md` — if the two disagree, use the live one for the emoji and still call out the stale
row in `Flags`. Don't invent additional colors/emoji for other states or extend this into the
prose lines below the feature list (`In progress now`, `Blocked on you`, etc.) — keep the color
coding scoped to the feature list, where it's actually scanning a set of parallel rows; a lone
emoji stapled onto a single-line sentence doesn't earn its keep.

No nested headers, no restating full issue descriptions — if the user wants detail on any one
line, they'll ask, and you already have the file open.

If every feature is genuinely `qc-passed` and no security review has been recorded, say so as the
natural next step — same milestone `qc` itself flags at that point, worth repeating here since the
user may be checking status precisely because they've lost track of whether that already happened.

## Report structure — dashboard mode (only on explicit request)

Only build this when asked for "the full report," "a dashboard," or something visual/shareable —
it's slower and produces an artifact, which isn't what a quick mid-`implement-issue` check-in
needs by default.

1. Load the `artifact-design` skill first — this is a UI/status-dashboard treatment (scanned, not
   read top-to-bottom): surface the summary before the detail, encode state in form (chips,
   progress) as well as number, keep the accent restrained.
2. Unlike a finished-project wrap-up, design for partial completion as the normal case, not the
   exception: a feature can be `not-ready` (dependencies unmet), `in-progress`, `ready-for-qc`,
   `qc-failed`, or `qc-passed` — give each a distinct, honest treatment rather than reusing a
   single "done" chip for everything. A progress indicator (bar or ring) reads better than a bare
   fraction when the project is genuinely partway through.
3. Ground the visual identity in the actual subject (what kind of app/project this is, its own
   materials and vernacular) rather than reaching for a generic dashboard template — the same
   principle `artifact-design` asks for on any artifact.
4. Publish via the `Artifact` tool once written.

## Picking "what's next"

For the "Next up" line, look for issues that are `owner: agent` or `owner: placeholder`, not yet
`done`, whose `depends_on` are all `done`, and that aren't sitting behind an open `owner: user`
blocker. List 1–3 of these, in `FEATURES.md`'s feature order. This is a pointer for the user, not
a selection decision — actually picking one up and working it is `implement-issue`'s job, not
this skill's; don't replicate its full selection logic (checking for interrupted in-progress work,
needs-review flags from a security-spec change, etc.) here, just surface what's genuinely
unblocked.
