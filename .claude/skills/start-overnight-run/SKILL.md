---
name: start-overnight-run
description: Commits and pushes any pending SPEC.md/issues/ changes to a fresh overnight/<date> branch, then asks what time (CEST/CET) to run tonight and creates a one-shot cloud routine (via RemoteTrigger) for implement-issue-auto, configured with the repo's known-good environment so it can actually push. Run this by name after doc-to-issues, once you're ready to queue an overnight run — it is not invoked automatically by doc-to-issues or anything else.
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

## Step 3 — Create the routine

Use the `RemoteTrigger` tool (`action: "create"`) — **not** `mcp__scheduled-tasks__create_scheduled_task`.
That tool creates a plain local scheduled task tied to this device with no repo-push
authorization; it is what produced the push-denied failure this skill was fixed after
(see `OVERNIGHT_WORKFLOW_SPEC.md`'s "Correction" section for the full incident). A
`RemoteTrigger`-created routine, bound to a pre-configured environment, is what actually
gets scoped GitHub push access.

Body shape (fields below were validated by hand against this account/repo — don't
improvise a different shape without re-testing it the way the correction section
describes):

```json
{
  "name": "Overnight kanban run — automated-kanban — <date>",
  "run_once_at": "<UTC timestamp from Step 2>",
  "notifications": {"channel": {"push": true, "email": false, "slack": false}},
  "session_request": {
    "environment_id": "env_01HCoJULLFDFC9dciFU6H87z",
    "config": {
      "allowed_tools": ["Bash", "Read", "Write", "Edit", "Glob", "Grep", "WebFetch", "WebSearch"],
      "sources": [
        {"type": "git_repository", "url": "https://github.com/FreddyPoly/automated-kanban"}
      ],
      "outcomes": [
        {
          "type": "git_repository",
          "git_info": {
            "type": "github",
            "repo": "FreddyPoly/automated-kanban",
            "branches": ["overnight-run"]
          }
        }
      ]
    },
    "events": [
      {"payload": {"type": "user", "message": {"role": "user", "content": "<prompt, see below>"}}}
    ]
  }
}
```

Notes on the fields that are easy to get wrong:

- `environment_id` must be exactly `env_01HCoJULLFDFC9dciFU6H87z` — a pre-existing
  Environment on this account already configured with GitHub App write access to
  `automated-kanban`. Omitting it (or leaving the field to default) is what caused the
  original failure: the session got a placeholder environment with no repo write scope,
  so every `git push` was denied with "not in this session's authorized repository set."
  This isn't a secret — it's just an account resource ID — but it is specific to this
  account and repo; reusing this skill for a different repo needs an equivalent
  Environment set up first (repo access confirmed working) and its ID substituted here.
- `sources` (read) and `outcomes` (write target) must both explicitly name the repo as a
  `git_repository` entry. Without them the proxy has nothing to authorize a push
  credential against, regardless of `environment_id`.
- `outcomes.git_info.branches` is only a **hint** — the platform ignores the exact string
  and assigns its own randomly-suffixed branch name every run (confirmed: requesting
  `test/push-check` produced `test/push-check-rnf1yg` one run and
  `test/push-check-qlzcaa` the next). Don't rely on it to land on a specific branch name,
  and don't try to fight this in the prompt — the fired session has a hard built-in rule
  refusing to push to any branch other than the one it's already on, and there's no user
  present to grant the "explicit permission" it asks for to override that. The prompt
  below works *with* this instead of against it.

The prompt (`session_request.config.events[0].payload.message.content`) must be a
complete, standalone instruction (the triggered session starts fresh, with no memory of
this conversation) telling it to:

1. It is already cloned and already checked out on its own freshly-assigned branch —
   never create or switch to a different branch, and never attempt to push anywhere
   other than the branch it's already on.
2. Before anything else, pull in the prepared backlog:
   `git fetch origin overnight/<date>` then `git merge origin/overnight/<date>` (the
   branch from Step 1) — resolve merge conflicts in favor of clean history since this is
   the very first step and nothing local has diverged yet. Never touch `main` at any
   point.
3. Read and follow `.claude/skills/implement-issue-auto/SKILL.md` from that branch
   exactly (it invokes `review-issue-auto` itself, per issue).
4. Run it once — it loops the whole eligible backlog itself, commits and pushes per
   issue (`git push origin <current branch>`, already branch-name-agnostic — no change
   needed there), and writes `OVERNIGHT_REPORT.md` as its last step.
5. Never ask the user anything; log anything blocking to `OVERNIGHT_REPORT.md` and
   move on.
6. As the very last action, print one line in the exact form
   `FINAL BRANCH: <branch name>` (read it from `git branch --show-current`) so the
   branch is easy to find from the run log or notification, since it wasn't knowable in
   advance.

If the `RemoteTrigger` tool isn't available in the current session (for example, this
skill is being run from a plain local Claude Code session without it), stop and tell the
user to run this skill from a session that has it, rather than silently falling back to
the local scheduled-tasks tool — that fallback is exactly the bug this skill was fixed
after.

## Step 4 — Report back and flag approval mode

Tell the user, in one short summary:

- The branch name pushed in Step 1, and what was pushed to it (or that it already had
  everything).
- The scheduled time, in both CEST/CET and UTC.
- That the run's **actual final branch name is not known yet** — it's assigned by the
  platform when the routine fires, not by this skill. Tell the user to check the run's
  notification, the `OVERNIGHT_REPORT.md` commit, or the `FINAL BRANCH:` line in the
  claude.ai run log the next morning, rather than assuming it'll be `overnight/<date>`.
- A reminder to check that the routine has **automatic approval** turned on, since it
  needs to run unattended with nobody available to approve actions (the validated
  environment above already ran with `permission_mode: auto`, but reconfirm if you
  changed anything).

## Security

No new credentials are created or stored. Step 1's push uses whatever authentication the
current (interactive) session already has. The routine created in Step 3 pushes using the
credential the Claude GitHub App injects for the pre-configured `environment_id` — this
skill never generates, stores, or asks for a token. The routine can only push to the
single branch the platform assigns it at run time (enforced by the platform itself, not
by this skill); it cannot push to `main` or to any other branch without live user
confirmation, which never happens in this unattended flow.
