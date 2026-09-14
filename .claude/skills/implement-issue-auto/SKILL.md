---
name: implement-issue-auto
description: Unattended variant of implement-issue, used only by the overnight automated pipeline — never invoke this interactively, use implement-issue instead. Processes every unblocked owner:agent/placeholder issue in issues/ sequentially in one run (not just one issue), immediately follows each with review-issue-auto instead of leaving that optional, retries a review-issue-auto failure exactly once before giving up on it, commits after each issue's implement+review cycle completes (one commit per issue), and never pauses to ask the user anything — stuck in-progress or needs-review issues are logged and skipped rather than surfaced as a blocking question. Ends by writing OVERNIGHT_REPORT.md summarizing the run and committing it. Requires an issues/ folder (from doc-to-issues).
---

# implement-issue-auto

This is `implement-issue` adapted to run unattended, overnight, with nobody available to answer a
question mid-run. It is invoked only by the overnight scheduled task's own prompt — never by a
human directly, and never by another skill expecting the original single-issue, ask-when-unsure
behavior. If you're implementing one issue interactively with a human present, use
`implement-issue` instead; this variant exists purely to remove the points where that skill would
otherwise pause for a person who isn't there.

Everything in `implement-issue` that isn't called out below as different still applies verbatim:
existing-conventions-win, no premature abstraction, TDD when the project has a test framework,
the placeholder-issue handling, the definition-of-done checklist, and running `code-review` (plus
`security-review` when `security: true`) before considering an issue finished.

## Differences from implement-issue

**Processes the whole eligible batch, not one issue.** Loop: select the first unblocked issue
(`status: open`, `owner` is `agent` or `placeholder`, every `depends_on` ID `status: done`) exactly
as `implement-issue` does, implement it fully through its own definition-of-done and inline
code-review/security-review, then continue immediately to "Review and commit" below before picking
the next one. Keep going until no unblocked `agent`/`placeholder` issue remains. Do not stop after
one issue the way `implement-issue` does when run interactively.

**Never pauses to ask anything.** Where `implement-issue` would stop and ask the user how to
proceed:

- A `status: in-progress` issue found at the start (interrupted prior session) — don't guess
  whether to resume or reset it. Leave it exactly as found, untouched, note it in
  `OVERNIGHT_REPORT.md` under "Needs your attention", and skip past it to other eligible issues.
- A `done ⚠️ needs-review` issue (security-relevant spec change flagged by `doc-to-issues`) — same
  treatment: don't address it automatically, note it in the report, move on.
- Anything else `implement-issue` would normally surface as a judgment call for the user — treat
  "I'm not confident enough to proceed without asking" as a signal to leave that specific issue
  alone (don't force it to `done`), note why in the issue's Notes and in the report, and continue
  with the rest of the batch. One uncertain issue never stops the whole run.

`owner: user` issues continue to be skipped and reported exactly as `implement-issue` already
does — no change needed there, that behavior already fits unattended running. Same for
`owner: placeholder`: build it for real with a clearly-fake default, flag it, keep going.

## Review and commit (per issue)

Immediately after an issue passes its own definition-of-done and is marked `done ⚠️ pending-review`
(and after running `documentation` and re-syncing with `doc-to-issues`, same as `implement-issue`
already does per issue):

1. Invoke `review-issue-auto` (see that skill) against this specific issue right now — don't defer
   review to the end of the run or leave it optional the way `review-issue` normally is.
2. **On pass** (marker cleared back to plain `done`): proceed to commit.
3. **On fail** (issue reopened to `in-progress` with feedback appended): give it exactly **one**
   more implementation attempt, using the feedback `review-issue-auto` wrote into the issue as the
   starting point — same implementation rules, same inline code-review/security-review, same
   `review-issue-auto` pass afterward.
   - If this second attempt passes review, proceed to commit as a normal success.
   - If it fails review again, stop retrying this issue. Leave it `in-progress` with the latest
     feedback in place, note it in `OVERNIGHT_REPORT.md` under "Needs your attention" with both
     rounds of feedback, and move on to the next issue. Never attempt a third round.

**Commit once the issue's implement+review cycle is settled** — whether it landed clean, needed
the one retry, or is being left reopened after two failed reviews. One commit per issue, covering
everything that changed for it (code, `issues/INDEX.md`, `issues/FEATURES.md`, the issue file
itself, and anything `documentation` updated):

```
git add -A
git commit -m "<issue-id>: <issue title>

<one or two lines: what changed, and pass/retry/reopened status>"
```

Then push immediately (`git push origin <current branch>`) rather than waiting until the end of
the run — if the session is interrupted partway through the batch, everything committed so far is
already safely on the branch for the morning review instead of lost with the session.

## Ending the run

Once no unblocked `agent`/`placeholder` issue remains (everything left is blocked, done, stale,
`owner: user`, or one of the skipped/flagged cases above), write `OVERNIGHT_REPORT.md` at the
project root (overwrite if one exists from an earlier run on this branch) with:

- **Completed** — issues implemented and committed cleanly (first attempt).
- **Completed after retry** — issues that needed the one review-fail retry, and what the first
  round's feedback was.
- **Needs your attention** — issues left reopened after a second failed review, with both rounds'
  feedback; plus any `in-progress`/`needs-review` issues found at the start and skipped rather than
  guessed at.
- **Waiting on you** — same `owner: user` list `implement-issue` already reports.
- **Placeholders built** — same `done ⚠️ placeholder` list `implement-issue` already reports.

Commit and push this report as the run's final commit:

```
git add OVERNIGHT_REPORT.md
git commit -m "Overnight run summary — <date>"
git push origin <current branch>
```

## Security

No change from `implement-issue`'s own security posture — this variant doesn't touch how secrets,
credentials, or untrusted input are handled, it only changes when the pipeline pauses for a human.
The git credential this skill pushes with is provided by the environment the overnight task runs
in, not by anything in this skill file — never read, echo, or write a token or credential value
anywhere in code, commits, or `OVERNIGHT_REPORT.md`.
