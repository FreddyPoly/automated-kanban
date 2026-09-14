---
name: qc
description: Before testing anything, gets the project into a known-good running state — runs its test suite and, if it has one, its release build/publish step (commands read from CLAUDE.md, or asked for once and offered back into it), stopping a conflicting running instance first if needed, then launches the built artifact directly (falling back to the run skill only when there's no distinct build output) — hard-stopping and attributing to the relevant issue on any test/build failure. Then guides the user through manually testing a complete feature (issues under issues/<feature-slug>/, all owner:agent/placeholder issues status:done) against SPEC.md, so the user — not the agent — confirms it works. Derives a scenario checklist from the spec and the feature's issues (adding security scenarios when flagged security: true, excluding placeholder details like colors/copy from pass/fail judgment, noting gaps from any open owner:user blocker), drives the already-running app to each scenario, and records verdicts on issues/FEATURES.md. Recommends a full security-review pass once every feature has passed, plus a summary of remaining open issues/placeholders. On any test/build failure or failed scenario, investigates which issue(s) are responsible, writes feedback into them, and reopens them for implement-issue. Use to test/verify a finished feature, or invoke /qc. Requires SPEC.md and a done feature under issues/.
---

# qc

Confirm that a complete feature works, with the user actually trying it — not the agent
self-certifying. The agent's job is to figure out what to test and set it up; judging whether it
works is the user's call.

## Automated checks & build

Before touching `issues/FEATURES.md` or picking a feature, get the project into a known-good,
running state — there's no point walking the user through scenarios against a build that doesn't
even pass its own tests.

### Finding the commands

Look for a documented `## Commands` section (or equivalent) in the project's `CLAUDE.md` for: the
test-suite command, a release/production build-or-publish command (if the project has one), a
command to stop a conflicting running instance (if relaunching could hit a file lock or a busy
port), and how to launch the built artifact. Use exactly what's documented there — don't guess from
`package.json` scripts, `Makefile` targets, or other language-specific conventions.

If a command isn't documented and you need it, ask the user once. Offer — don't force — to write
their answer into CLAUDE.md's Commands section afterward, so future `/qc` runs don't have to ask
again.

If the project genuinely has no automated test suite, no distinct build/publish step, or nothing
that could conflict with a fresh launch, skip that part gracefully — don't block the rest of the
flow demanding a step that doesn't apply to this project.

### Running it

1. If a "stop the running instance" command is documented, run it first — avoids a build/publish
   failing because a previous run is still holding a file lock or a port.
2. Run the test suite, if one exists. A failing suite **hard-stops** the whole `/qc` pass: report
   the failures, then handle each one exactly like a failed manual scenario under "On failure"
   below — investigate which issue is responsible, append feedback, reopen it, update
   `issues/INDEX.md` — except when a failure clearly isn't attributable to any specific issue (a
   missing dependency, a broken environment), in which case report it plainly as a blocker instead
   of forcing an attribution. Either way, stop here — don't proceed to the build step or the manual
   checklist.
3. Run the build/publish step, if one exists. Same hard-stop-and-attribute (or report-as-blocker)
   handling on failure as the test suite.
4. Launch what the build step just produced, using the exact path/command it gave you — don't
   re-derive it through the `run` skill's own detection. Only fall back to the `run` skill if the
   project has no distinct build output to point at (a dev server, an interpreted script, a library
   with no standalone artifact).

Leave this instance running — the manual walkthrough later in this skill drives it directly rather
than launching anything itself.

## Selecting a feature

Read `issues/FEATURES.md`. Recompute each feature's readiness live before doing anything else —
don't trust a stale `Status` column: a feature is `ready-for-qc` once every `owner: agent` and
`owner: placeholder` issue under `issues/<feature-slug>/` has `status: done`. An open `owner: user`
issue doesn't block readiness — note it as a caveat instead (see below) rather than waiting on it
indefinitely; a pending business decision shouldn't stall testing everything else in the feature.

- If the user names a feature, test that one — but still tell them plainly if it's not actually
  ready (some issues not done yet) instead of testing it partially.
- If they don't name one, pick the first feature that's ready-for-qc and hasn't been tested since
  its issues last changed (i.e. not already `qc-passed` with nothing reopened since). If none are
  ready, say what's still outstanding instead of testing something incomplete.

## Run an automated harness first, if this project documents one

Some projects set up an automated QC harness — a script that drives the app end-to-end and reports
pass/fail per scenario, meant to run before any manual walkthrough — specifically to kill the
stale-instance and "did I actually see what I think I saw" failure modes that make manual GUI QC
unreliable. Whether *this* project has one isn't something to guess at or probe the filesystem
for: check `SPEC.md` (and `CLAUDE.md` if `SPEC.md` doesn't mention it) for a section describing
one — the `interview` skill's convention is to document it there, including exactly how to invoke
it and what shape its output takes, when a project decides to build one. If no such section
exists, skip straight to "Building the test script" below — most projects don't have one, and this
skill works fully manually without it. Don't build one yourself here if it's missing; that's a
separate, deliberate undertaking (see `interview`), not something to improvise mid-QC-pass.

If a harness is documented, run it exactly as that documentation describes, then read whatever
report it produces (the documentation should say where and in what shape — don't assume a specific
filename or JSON structure beyond what's actually written down). For the feature being tested, sort
its results into:

- **Passed, in scope** — don't ask the user to manually re-verify these. Note them in the eventual
  summary as harness-verified, but they don't get a row in the manual scenario table.
- **Failed, in scope** — treat exactly like a user flagging "no" on that scenario: skip straight to
  "On failure" below (investigate, attribute, reopen the responsible issue) without waiting on the
  user to reproduce it by hand. Still tell the user what failed and why before moving on.
- **Skipped, marked obsolete/superseded** — the behavior no longer exists (e.g. replaced by a later
  deliberate change); drop it entirely, it's not a gap.
- **Skipped for any other reason** (opt-in flag not passed, precondition not met, etc.) — this is
  still an open gap; carry it into the manual scenario list below, or re-run the harness with
  whatever flag closes it if that's cheap and the user wants full coverage now.

What's left after this — genuinely uncovered functional scenarios, plus anything the harness is
structurally unable to observe (audible playback correctness, a physical key/gesture press, a
tooltip or visual nuance an accessibility tree doesn't capture, a multi-minute real-world
playthrough too slow to script, or any subjective "does this feel right" judgment) — is exactly
what the manual walkthrough below should actually spend the user's time on. Say plainly which
scenarios the harness already cleared so the user knows why they're not being asked about them.

## Building the test script

Don't test issue-by-issue. Read:

- The feature's section in `SPEC.md` — what the feature is supposed to do as a whole, including
  any use cases or edge cases captured there.
- Every issue under `issues/<feature-slug>/` — their acceptance criteria and notes, combined.

From these, write a short scenario list covering the feature end-to-end, including how its pieces
interact (this is the part per-issue testing structurally can't catch — e.g. does the login flow
issue actually compose correctly with the session-handling issue). Order scenarios the way a user
would naturally encounter them, not the order the issues happen to be numbered.

If any issue under the feature is `security: true`, add adversarial scenarios drawn from SPEC.md's
Security section on top of the normal functional ones — e.g. try the flow unauthenticated, try
accessing another user's data, submit malformed/oversized/unexpected input, try an action the spec
says should be forbidden for this role. These aren't edge cases of "does it work," they're "does it
resist misuse" — call them out to the user as security scenarios specifically, so a "looks fine" on
the happy path doesn't get mistaken for a security pass.

Check the feature's issues for two more things before finalizing the script:

- **`owner: placeholder` issues** — note which scenarios touch a flagged placeholder (a color,
  copy, an asset) and exclude those specifics from pass/fail judgment. Don't ask the user to verify
  a placeholder color is "correct" — it was never meant to be final. If a placeholder-covered
  scenario is otherwise broken (the button doesn't work at all, not just "the color isn't final"),
  that's still a real failure — the placeholder exemption only covers the placeholder itself.
- **Open `owner: user` issues** — anything the feature genuinely can't be tested without (e.g. a
  real payment flow needing a real API key) becomes a noted gap, not a scenario: tell the user what
  can't be verified yet and why, rather than skipping it silently or forcing a pass/fail on
  something that structurally can't be checked.

Write the finished scenario list as a table, not prose, with columns `step | action | exact
expected observable state`. "Exact expected observable state" means the literal thing the user
should see or hear at that step — specific label text, an exact count, whether a banner/spinner is
present or absent, audible playback or silence — not a vague "should work correctly." A loose
scenario is exactly what lets a stale-instance or ambiguous-state false pass slip through; a
precise one turns the user's job into a quick match-or-mismatch check instead of a judgment call.
Include at least one negative/edge scenario per feature (e.g. an unavailable resource, a missing
dependency, an empty state, an out-of-range action) with the same exact-expected-state precision —
not just the happy path.

## Running the walkthrough

The project should already be running, launched during the "Automated checks & build" phase above
— drive that instance rather than relaunching it. For web/UI features, drive the shared browser pane
yourself to each scenario — navigate to the right screen, set up any needed state — then tell the
user what to look at or try, and wait for them to confirm what they observe rather than deciding
for them. For CLI/API/non-UI features, run the relevant command/request yourself, show the actual
output, and ask the user to confirm it's what they expect.

For a feature with no interactive surface at all (a library, an internal module, a batch job) —
there's still something to exercise: call the changed function/entry point directly yourself
(a throwaway script or REPL invocation is fine) and show the user the real input/output, rather
than asking them to read code or trust that passing unit tests means the feature works.

Go one scenario at a time. Don't dump the whole script and ask for one blanket "does it all work?"
— that's what leads to missed edge cases. Ask for a verdict per scenario, and let a "no" or "sort
of" prompt follow-up questions about specifically what was wrong before moving on.

## On a full pass

Update `issues/FEATURES.md`: set the feature's `Status` to `qc-passed` and `Last QC` to today's
date.

Then check whether this was the last remaining feature — if every row in `FEATURES.md` is now
`qc-passed`, tell the user the whole project has cleared per-feature QC, and recommend running a
full-project `security-review` (across the whole codebase, not just this feature's diff) before
considering the project release-ready. This is a milestone check for things no single issue or
feature's review would catch on its own — dependency vulnerabilities, misconfigured infra, and
other cross-cutting concerns. Recommend it; don't run it unprompted, since it's a deliberate,
potentially time-consuming pass over the entire codebase rather than a quick per-issue check.

`qc-passed` doesn't mean gap-free, though — a feature can pass with an open `owner: user` issue
still noted as an untested gap, or with `done ⚠️ placeholder` issues inside it. So alongside the
security-review recommendation, scan the whole project (`issues/INDEX.md`) and summarize any
remaining open `owner: user` issues and `⚠️ placeholder` markers across every feature, not just
this one. "Every feature qc-passed" and "actually finished" aren't the same thing here — say so
plainly rather than letting the milestone message read as an all-clear it isn't.

## On failure

For each failed scenario — whether the user flagged it manually or the automated harness reported
it as failed:

- Investigate which issue(s) are responsible. Once a feature has been selected, start with its own
  issues — that's usually right, and if the problem clearly doesn't map to anything in this feature
  (e.g. the root cause is in a shared module or a different feature's work this one depends on),
  widen the search to the rest of `issues/` before asking the user to help narrow it down. Don't
  force an attribution to this feature just because it's the one being tested. A test/build failure
  from the "Automated checks & build" phase happens *before* a feature is selected, so there's no
  "current feature" to start from yet — search `issues/` directly based on what the failure
  actually implicates.
- If it's genuinely ambiguous between two or more issues (in this feature or across features), ask
  the user to help narrow it down rather than guessing.
- Set that issue's `status: in-progress` and append concrete feedback to it (what scenario or
  automated check failed, what was expected per the feature/spec, what actually happened, any
  detail the user gave) — enough that `implement-issue` can pick it back up without re-asking the
  user what went wrong.
- Update `issues/INDEX.md` to reflect the reopened status.

If a feature had already been selected when the failure occurred (a manual scenario, or an
automated check run per-feature), also set that feature's `Status` in `FEATURES.md` to `qc-failed`
and `Last QC` to today's date. A test/build failure from the "Automated checks & build" phase, which
runs before any feature is picked, has no feature row to update — skip that part and just report
the reopened issues.

Report a summary: what failed, which issues were reopened and why. Don't automatically re-invoke
`implement-issue` to fix things — reopening is as far as this skill goes; fixing is a separate,
deliberate next step.
