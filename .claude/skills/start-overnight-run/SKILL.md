---
name: start-overnight-run
description: Commits and pushes any pending SPEC.md/issues/ changes to a fresh overnight/<date> branch, then asks what time (CEST/CET) to run tonight and creates a one-shot cloud routine (via RemoteTrigger) for implement-issue-auto, configured with a push-capable environment (auto-discovered from this repo's own trigger history, no hardcoded ID) so it can actually push. Run this by name after doc-to-issues, once you're ready to queue an overnight run — it is not invoked automatically by doc-to-issues or anything else.
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
   - If **no** branch with that name exists yet (locally or on `origin`), create it
     fresh from the current `main` — this is the common case.
   - If a branch with that name **already exists**, don't silently reuse it — ask the
     user whether this backlog should join that branch or be scheduled independently:
     - **Join it** (e.g. re-running this skill because an earlier push failed, or
       adding more issues before that night's run has fired): check it out (creating a
       local tracking branch from `origin/<branch>` if it only exists remotely) and add
       this backlog's commit to it as before — it'll be picked up by whatever routine
       is already scheduled against that branch.
     - **Independent run** (a second, separately-scheduled run landing the same day):
       create a new branch instead, suffixed to disambiguate (e.g. `overnight/<date>-b`,
       or a timestamp suffix — ask which naming style they'd like). Use this suffixed
       name as `<date>` for the rest of this skill (commit message, push, and the
       branch referenced in Step 4's prompt).
     Reusing the existing branch without asking risks silently folding unrelated work
     into a run that may already be scheduled (or may even have already fired) against
     it — if unsure whether a routine is already pointed at it, check with
     `RemoteTrigger action: "list"` before deciding.
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

## Step 3 — Resolve the environment_id

`RemoteTrigger` needs an `environment_id` scoped with GitHub push access to this repo.
There is no API to create or list Environments directly, but every past routine's config
(including its `environment_id` and which repo it targeted) is visible in trigger
history, so resolve it from there instead of hardcoding a literal:

1. Get this repo's slug from `git remote get-url origin` (e.g. `FreddyPoly/automated-kanban`).
2. Call `RemoteTrigger action: "list"`.
3. Find any entry whose `job_config.ccr.session_context.sources` or `.outcomes` (or the
   equivalent `session_request.config.sources`/`outcomes`) names a `git_repository` for
   this repo slug, and read its `environment_id` (`job_config.ccr.environment_id` or
   `session_request.environment_id` — both fields carry the same value).
4. If more than one match exists, prefer the most recently `updated_at`/`created_at` one.
5. If **no** match exists — this is the first overnight run ever for this repo — stop and
   tell the user: they need to create (or point you to) an Environment with GitHub push
   access to this repo in claude.ai Settings → Environments, and confirm a push from it
   actually works, before a routine can be scheduled. There is no way to do this step
   without the user, since Environment creation isn't exposed to any tool. Once one such
   Environment has been used successfully, this lookup will find it automatically on
   every future run — for this repo or any other project that adopts this skill.

## Step 4 — Create the routine

Use the `RemoteTrigger` tool (`action: "create"`) — **not** `mcp__scheduled-tasks__create_scheduled_task`.
That tool creates a plain local scheduled task tied to this device with no repo-push
authorization; it is what produced the push-denied failure this skill was fixed after
(see `OVERNIGHT_WORKFLOW_SPEC.md`'s "Correction" section for the full incident). A
`RemoteTrigger`-created routine, bound to the environment resolved in Step 3, is what
actually gets scoped GitHub push access.

Body shape (fields below were validated by hand against this account/repo — don't
improvise a different shape without re-testing it the way the correction section
describes):

```json
{
  "name": "Overnight kanban run — automated-kanban — <date>",
  "run_once_at": "<UTC timestamp from Step 2>",
  "notifications": {"channel": {"push": true, "email": false, "slack": false}},
  "session_request": {
    "environment_id": "<environment_id resolved in Step 3>",
    "config": {
      "allowed_tools": ["Bash", "Read", "Write", "Edit", "Glob", "Grep", "WebFetch", "WebSearch"],
      "sources": [
        {"type": "git_repository", "url": "<this repo's URL, from git remote get-url origin>"}
      ],
      "outcomes": [
        {
          "type": "git_repository",
          "git_info": {
            "type": "github",
            "repo": "<this repo's owner/name slug>",
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

- `environment_id` must be the value resolved in Step 3 — never invent one or leave it to
  default. Omitting it (or defaulting it) is what caused the original failure: the
  session got a placeholder environment with no repo write scope, so every `git push` was
  denied with "not in this session's authorized repository set." It's not a secret, just
  an account resource ID, but it's tied to a specific repo — Step 3's lookup is what keeps
  this skill working unmodified across repos instead of baking one repo's ID in here.
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
   `git fetch origin <branch>` then `git merge origin/<branch>`, where `<branch>` is the
   exact branch name resolved and pushed in Step 1 (`overnight/<date>`, or the suffixed
   name if this was an independent same-day run) — resolve merge conflicts in favor of
   clean history since this is the very first step and nothing local has diverged yet.
   Never touch `main` at any point.
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

## Step 5 — Report back and flag approval mode

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
current (interactive) session already has. The routine created in Step 4 pushes using the
credential the Claude GitHub App injects for the environment resolved in Step 3 — this
skill never generates, stores, or asks for a token, and never invents an environment_id.
The routine can only push to the single branch the platform assigns it at run time
(enforced by the platform itself, not by this skill); it cannot push to `main` or to any
other branch without live user confirmation, which never happens in this unattended flow.
