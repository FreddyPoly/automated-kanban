---
name: review-issue
description: Run an OPTIONAL, independent second-opinion review of one already-implemented issue's diff, using a dedicated Opus subagent so the review judgment is always high-quality regardless of what model is driving the current session. This is NOT a required gate — issues.md/qc do not wait on it, and skipping it is completely fine. Use it when the user wants extra scrutiny on a specific done issue before moving on, or invokes /review-issue explicitly. Only picks up issues already marked `done ⚠️ pending-review` by implement-issue (its own code-review/security-review already ran); if none exist, say so and stop. Distinct from the code-review and security-review skills: those run inside the same session that just implemented the issue and check general code quality / security respectively, while review-issue is a deliberately fresh, later, independent pass focused specifically on whether the diff actually conforms to SPEC.md and the issue's acceptance criteria — catching cases where the implementing agent's own self-assessment was wrong. On finding a real conformance failure or bug, reopens the issue with feedback exactly like qc does; nitpicks are reported but don't block. Requires an issues/ folder with at least one done ⚠️ pending-review issue — if none, there's nothing for this skill to do yet.
---

# review-issue

A second, independent opinion on one issue that `implement-issue` already marked done. It exists
because `code-review` and `security-review` — thorough as they are — run *inside* the same agent
session that just wrote the code, checking it against general quality and security bars. Neither
of them is positioned to catch the specific failure mode of "the agent was confident it met the
acceptance criteria, and it was wrong." That needs someone who wasn't in the room for the
implementation, reading the issue and the spec fresh, against the diff as it actually landed.

This skill is **optional and not a pipeline gate**. `qc` doesn't check for or require a
`review-issue` pass, and nothing else in the pipeline blocks on it. Run it when you specifically
want that extra pair of eyes on an issue — a risky one, a complex one, or just as a habit before
moving to `qc` — not because the pipeline forces it.

## Selecting an issue

Read `issues/INDEX.md`. Pick the first row whose `Status` is `done ⚠️ pending-review` (this marker
is set by `implement-issue` once its own code-review/security-review gates pass — see its skill
file). If none exist, report that plainly and stop; there's nothing pending review right now.

If the user names a specific issue directly ("review auth-003"), work on that one instead of
scanning — but only if its status is actually `done ⚠️ pending-review`. If it's still
`in-progress`, plain `done` (already reviewed, or predates this skill), or anything else, tell the
user it isn't awaiting review rather than forcing a review on it anyway.

Process **one issue per invocation** — the same one-at-a-time discipline `implement-issue` uses.
If the user wants several reviewed, run this once per issue rather than trying to sweep the whole
backlog in one pass; each review deserves its own dedicated read of the diff and spec, not a
batched skim.

## What to read

- The issue file in full: description, acceptance criteria, notes. This is the primary yardstick —
  every acceptance criterion needs an explicit yes/no, not a vibe-based skim.
- The relevant section(s) of `SPEC.md` the issue's `spec_ref` points to (or the obviously relevant
  section if `spec_ref` is missing). Read more of the spec if the issue references decisions that
  aren't fully self-contained — same judgment call `implement-issue` makes about when the issue
  file alone isn't enough.
- The diff: plain `git diff` against the working tree's last commit. This pipeline's convention
  (see `implement-issue`) is that issues are never auto-committed, so the uncommitted working-tree
  changes *are* the issue's diff — don't assume a branch or PR exists to diff against.

## Running the review

Spawn a dedicated subagent pinned to **Opus** (`Agent({..., model: "opus"})`) to actually perform
the review, regardless of what model is driving the current session. This is the whole point of
routing this specific check through a subagent instead of reviewing inline: the rest of the
pipeline can run on a cheaper/faster model, and this one deliberately-expensive check still always
gets the strongest available judgment.

Give the subagent the issue file's full content, the relevant `SPEC.md` excerpt, and the diff.
Brief it along these lines (adapt, don't paste verbatim — the subagent needs the actual content
inlined, not placeholders):

```
You are acting as a Senior Staff Engineer conducting a rigorous, independent code review. You did
not write this code and were not involved in implementing it — review it with fresh eyes.

GOAL: Review the given git diff against SPEC.md and the issue file below. Determine whether the
diff fully and correctly implements what the issue and spec actually require, and independently
check for correctness bugs or regressions in the changed code.

SPEC.md (relevant excerpt):
<...>

ISSUE:
<full issue file content>

GIT DIFF:
<diff>
```

Scope the subagent's focus tightly so it isn't redoing work `code-review`/`security-review` already
did:

- **Primary — conformance.** Does the diff fully and correctly implement every acceptance
  criterion in the issue, and match `SPEC.md`? Flag any silent scope deviation, missed edge case
  the spec called out, or quiet reinterpretation of a requirement — these are the things a self-
  assessment is most likely to miss, since the implementing agent graded its own work against its
  own understanding of the criteria.
- **Secondary — a fresh bug pass.** Independently look for correctness bugs or regressions in the
  changed code. Some overlap with what `code-review` already checked is fine and expected — the
  value here is a second, independent read, not strict non-duplication.
- **Out of scope.** General style/`CLAUDE.md` convention adherence (that's `code-review`'s job) and
  security-specific concerns like injection, authz bypass, or secret handling (that's
  `security-review`'s job, already run by `implement-issue` when the issue is `security: true`).
  Don't re-litigate those dimensions here.
- **Avoid false positives** the same way `code-review` does: pre-existing issues, changes that are
  clearly intentional and related to the broader change, anything a linter/build/typechecker would
  catch, and pedantic nitpicks a senior engineer wouldn't actually call out. Nitpicks can be
  mentioned in the findings but should be marked as such, not treated as a failure.

Have the subagent return a clear verdict: **pass** (acceptance criteria met, no real bugs found —
nitpicks noted separately, if any) or **fail** (at least one genuine conformance gap or bug), plus
the specific findings either way.

## On the verdict

**Pass** — clear the `⚠️ pending-review` marker in `issues/INDEX.md`, changing that row's `Status`
back to plain `done`. Nothing else changes: `issues/FEATURES.md` was already updated by
`implement-issue` when it first marked the issue `done ⚠️ pending-review`, and this skill doesn't
touch it.

**Fail** — mirror `qc`'s reopen convention exactly (see `qc`'s "On failure" section for the precise
pattern this follows):

- Set the issue's `status: in-progress`.
- Append concrete feedback to the issue file: which acceptance criterion or spec requirement wasn't
  met, or what the bug is, with enough specificity that `implement-issue` can pick it back up
  without re-deriving what went wrong.
- Update `issues/INDEX.md` to reflect the reopened status (drop the `⚠️ pending-review` marker —
  the issue is `in-progress` again, not done-anything).
- Never fix the finding directly yourself. Reopening is as far as this skill goes, same as `qc` —
  fixing is `implement-issue`'s job on a fresh pass, not something to do inline here. Don't
  auto-re-invoke `implement-issue` either; report and stop.

Either way, report a short summary: which issue was reviewed, the verdict, the findings (or
confirmation there were none beyond nitpicks), and what status change resulted.

## Security

Low risk. This skill only reads local files already inside the project — the git diff, `SPEC.md`,
the issue file, and `issues/INDEX.md` — and writes feedback back into those same markdown files. No
authentication, secrets, network calls, or untrusted external input are involved.
