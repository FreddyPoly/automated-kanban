---
name: review-issue-auto
description: Unattended variant of review-issue — same independent, fresh-eyes Opus subagent conformance check against SPEC.md and the issue's acceptance criteria, but runs automatically (not optionally) and is invoked by implement-issue-auto immediately after each issue it finishes, rather than by a human choosing to request it. Never invoke this interactively or standalone — use review-issue for that. Reports its verdict back to the caller instead of just to chat, so implement-issue-auto can decide whether to retry.
---

# review-issue-auto

`review-issue`'s independent second-opinion pass, made a mandatory, automatic step of the
overnight pipeline instead of an optional one a human requests. Everything about how the review
itself is performed is identical to `review-issue` — same dedicated Opus subagent, same "fresh eyes,
didn't write this code" framing, same conformance-first scope (does the diff actually meet the
issue's acceptance criteria and `SPEC.md`, plus a secondary fresh bug pass), same exclusions
(general style/convention is `code-review`'s job, security specifics are `security-review`'s job —
don't re-litigate either here).

Read `review-issue`'s "What to read" and "Running the review" sections and follow them exactly —
same issue file, same relevant `SPEC.md` excerpt, same diff, same Opus subagent briefing, same
pass/fail scope.

## Differences from review-issue

**Invocation.** This is called by `implement-issue-auto` with a specific issue ID already selected
— the issue it just finished — not chosen by scanning `issues/INDEX.md` for `done ⚠️ pending-review`
rows. Review exactly the issue it's given.

**Verdict handling.** `review-issue` ends by updating `issues/INDEX.md`/the issue file and reporting
to chat. This variant does the same file updates (clear `⚠️ pending-review` on pass; on fail, set
`status: in-progress` and append feedback exactly as `review-issue` does), but the verdict —
**pass** or **fail**, plus the findings — is also handed back explicitly to `implement-issue-auto`,
since it decides what happens next (commit vs. one retry). Don't stop at reporting to chat as the
only output.

**No re-invocation of implement-issue.** Same as `review-issue`: on fail, this skill's job ends at
reopening the issue with feedback. Whether that reopened issue gets retried is
`implement-issue-auto`'s decision (its one-retry rule), not this skill's.

## Security

Same as `review-issue`: low risk, reads and writes only local project files already in the diff —
issue files, `issues/INDEX.md`, `SPEC.md`, the git diff. No network calls, secrets, or untrusted
external input involved.
