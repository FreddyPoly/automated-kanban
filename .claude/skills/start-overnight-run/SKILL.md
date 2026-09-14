---
name: start-overnight-run
description: Commits and pushes any pending SPEC.md/issues/ changes to a fresh overnight/<date> branch, then asks what time (CEST/CET) to run tonight and creates a one-shot cloud scheduled task for implement-issue-auto on that branch. Run this by name after doc-to-issues, once you're ready to queue an overnight run — it is not invoked automatically by doc-to-issues or anything else.
---

# start-overnight-run

Single entry point for handing a freshly-generated backlog off to the overnight pipeline:
commit + push the branch, then schedule the run. Combines what used to be two separate
manual steps (`doc-to-issues`'s own handoff step, and manually creating a scheduled task)
into one.

## When to use this

Only when explicitly invoked by name, after `doc-to-issues` has produced (or updated)
`SPEC.md` and `issues/` for a set of issues you're ready to run overnight. Never invoke
this automatically as a consequence of another skill running.

## Step 1 — Commit and push the overnight branch

1. Run `git status --short` to see whether `SPEC.md` and/or `issues/` have pending
   (uncommitted or untracked) changes.
2. Determine the branch name: `overnight/<YYYY-MM-DD>`, using today's date
   (`date +%Y-%m-%d`).
   - If a branch with that name already exists locally or on `origin`, reuse it — check
     it out (creating a local tracking branch from `origin/<branch>` if it only exists
     remotely) rather than creating a second branch for the same day.
   - Otherwise create it fresh from the current `main`.
3. If there are pending changes to `SPEC.md`/`issues/`:
   - `git add SPEC.md issues/`
   - Commit: `Prepare backlog for overnight run — <date>` (plus this project's usual
     commit attribution trailer).
   - Push: `git push -u origin overnight/<date>` (or plain `git push` if the branch
     already has an upstream).
4. If there are no pending changes but the branch already exists and is already pushed,
   that's fine — skip straight to Step 2 using that branch. If there's nothing to hand
   off at all (no `SPEC.md`/`issues/` changes and no existing branch for today), stop and
   tell the user there's nothing to schedule.
5. Switch back to `main` locally once the branch is pushed, so the working tree isn't
   left checked out on a throwaway branch.

## Step 2 — Ask what time to run

Ask the user directly, in chat, what time tonight (or whichever night) they'd like the
run to fire, in CEST/CET (France local time) — e.g. "What time should it run tonight?"
Don't guess a default.

Once you have an hour:
1. Get the current UTC time (`date -u`) to establish today's date.
2. Convert the requested France local time to UTC. France uses CEST (UTC+2) during
   daylight saving (roughly late March–late October) and CET (UTC+1) the rest of the
   year — check today's date against that window rather than assuming CEST year-round.
3. If the resulting UTC timestamp is already in the past relative to now, roll it forward
   to the next day and say so explicitly when reporting back.

## Step 3 — Create the scheduled task

Create a one-shot scheduled task (not recurring) via the scheduled-task/Routine creation
tool available in this session:

- `run_once_at`: the UTC timestamp computed above.
- `requires_local_device`: false — the run happens entirely in the cloud, authenticated
  via the Claude GitHub App, and never needs the user's own computer.
- `prompt`: a complete, standalone instruction (the triggered session starts fresh, with
  no memory of this conversation) telling it to:
  - Clone `https://github.com/FreddyPoly/automated-kanban` (the Claude GitHub App
    handles auth automatically — never look for or create a token).
  - Check out the specific branch from Step 1 (name it explicitly).
  - Never touch `main`.
  - Read and follow `.claude/skills/implement-issue-auto/SKILL.md` from that branch
    exactly (it invokes `review-issue-auto` itself, per issue).
  - Run it once — it loops the whole eligible backlog itself, commits and pushes per
    issue, and writes `OVERNIGHT_REPORT.md` as its last step.
  - Never ask the user anything; log anything blocking to `OVERNIGHT_REPORT.md` and
    move on.

If the scheduled-task creation tool isn't available in the current session (for example,
this skill is being run from a plain local Claude Code session without it), stop and tell
the user to run this skill from a session that has it, rather than silently skipping the
scheduling step.

## Step 4 — Report back and flag approval mode

Tell the user, in one short summary:

- The branch name, and what was pushed to it (or that it already had everything).
- The scheduled time, in both CEST/CET and UTC.
- A reminder to check that the new scheduled task has **automatic approval** turned on,
  since it needs to run unattended with nobody available to approve actions.

## Security

No new credentials are created or stored. Git push relies on whatever authentication the
current session already has (the user's own local git credentials when run from their
machine, or the Claude GitHub App when run from a cloud session) — this skill never
generates or asks for a token. The scheduled task it creates only ever targets the
disposable `overnight/<date>` branch, never `main`.
