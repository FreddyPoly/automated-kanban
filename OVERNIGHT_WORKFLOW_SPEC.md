# Overnight Implementation Workflow — Spec

## Goal

Automate the middle of a 5-skill development pipeline (`interview` → `doc-to-issues` →
`implement-issue` → `review-issue` → `qc`) so that the two human-in-the-loop skills
(`interview`, `qc`) stay manual, while `implement-issue` and `review-issue` run
unattended in the cloud overnight, on every open issue, without requiring the user's
own computer to stay on.

## Current pipeline (as-is)

| # | Skill | Run by | Input | Output | Committed today? |
|---|-------|--------|-------|--------|------------------|
| 1 | `interview` | Human | Conversation | `SPEC.md` (local) | No |
| 2 | `doc-to-issues` | Human | `SPEC.md` | One `.md` file per issue (local) | No |
| 3 | `implement-issue` | Human | issue `.md` + full codebase + `SPEC.md` | Code changes (working tree) | No (not committed) |
| 4 | `review-issue` | Human | Code changes from step 3 | Review report | No |
| 5 | `qc` | Human | Implemented feature | Manual test scenario | N/A |

Everything currently lives only on the user's local machine; nothing in steps 1–4 is
pushed to git today.

## The real pipeline (revised after reading the actual skills)

The first draft of this spec assumed a simpler shape than what actually exists.
Reading `interview`, `doc-to-issues`, `implement-issue`, `review-issue`, and `qc` in
full changed several things:

- There's no separate "review" step to duplicate — `implement-issue` already runs
  `code-review` (Claude's own built-in skill) and `security-review` (also built-in,
  when the issue is `security: true`) **inline**, before it will mark an issue done.
  `review-issue` is a *different, optional* second-opinion pass: a dedicated Opus
  subagent checking specifically whether the diff conforms to `SPEC.md` and the
  issue's acceptance criteria — the failure mode of "the agent was confident it met
  the criteria, and was wrong" — not a general code-quality pass.
- Issues aren't loose `.md` files — `doc-to-issues` produces a structured
  `issues/` folder: `issues/INDEX.md` (one table row per issue, with `status`,
  `security`, `owner`, `depends_on`), `issues/FEATURES.md` (feature-level readiness
  for `qc`), and `issues/<feature-slug>/NNN-slug.md` per issue, each with YAML
  frontmatter (`id`, `status`, `security`, `owner`, `depends_on`, `spec_ref`).
- There's no separate "review report" file. Review feedback (from `code-review`,
  `security-review`, or `review-issue`) is written directly into the issue file and
  reflected as a status marker in `issues/INDEX.md` — `done ⚠️ pending-review`,
  `done ⚠️ placeholder`, `done ⚠️ needs-review`, or reopened to `in-progress` with
  feedback appended. That *is* the review record; nothing else needs to be invented.

## Target pipeline (to-be)

Steps 1–2 stay local and human-run, exactly as today. `doc-to-issues` gains one new,
explicit final step (not automatic on every invocation — see its own section below):
when generating/syncing issues specifically to hand off to an overnight run, it
commits and pushes `SPEC.md` + `issues/` to a short-lived branch (e.g.
`overnight/2026-09-14`).

The user then manually fires a Cowork scheduled task bound to that branch. That task
runs `implement-issue-auto` once. `implement-issue-auto` is the unattended variant of
`implement-issue`: instead of doing one issue and stopping, it loops over every
unblocked `owner: agent`/`placeholder` issue in the backlog, sequentially, and for
each one:

1. Implements it exactly as `implement-issue` would (existing-conventions-win, no
   scope creep, TDD when the project has a test framework, inline `code-review` +
   `security-review`, marked `done ⚠️ pending-review`).
2. Immediately runs `review-issue-auto` (the unattended variant of `review-issue`)
   against that same issue — made a mandatory step of the automated pipeline instead
   of the optional pass it is interactively.
3. On a review pass: commit. On a review failure: retry the implementation once using
   the feedback, then commit either way (clean, or reopened with feedback if the
   retry also failed) — never a silent third attempt.
4. Pushes after every issue's commit, not just at the end, so an interrupted overnight
   session never loses more than the one issue in flight.

Issues are processed one at a time, sequentially — not fanned out in parallel — so
later issues can see the results of earlier ones and the branch stays simple to
reason about. (`implement-backlog`, the user's own parallel/worktree batch-runner
skill, was considered and deliberately not used here — it stops mid-run for a human
go-ahead before launching subagents, which doesn't fit unattended overnight use.)

When the run ends, `implement-issue-auto` writes `OVERNIGHT_REPORT.md` (completed /
completed-after-retry / needs-your-attention / waiting-on-you / placeholders-built)
and commits+pushes it as the final commit.

The next morning, the user (human):
- Pulls the branch locally.
- Reads the review reports and diffs.
- Runs `qc` to generate a test scenario for whichever issues they want to validate.
- Tests manually, then merges to main (or discards) at their discretion — this
  decision is never automated.

## Explicit non-goals / constraints

- Nothing is ever merged to the main branch automatically. The overnight run only
  ever produces commits on a disposable feature/overnight branch.
- No code or tests are executed by `implement-issue` or `review-issue` — both work
  purely at the file level (read/write text, no dev server, no test runner).
- `SPEC.md` and issue files are not committed to the project by default in the
  general workflow — they are pushed only to the throwaway overnight branch as a
  deliberate, manual handoff step, not as a standing practice.
- The overnight agent never has access to `.env` files or any other gitignored
  secrets — only tracked repo content plus a scoped GitHub token for pushing to the
  branch.

## Trigger model

Manual: the user runs `doc-to-issues`, pushes `SPEC.md` + issues to the overnight
branch, then explicitly starts the overnight cloud task before going to bed. No
scheduled/cron trigger — avoids wasted runs on nights with no prepared issues.

## Stack context

- Frontend: Angular. Backend: Python.
- Repo: private GitHub repository.
- Secrets: `.env` files, gitignored, never committed — safe by construction, since
  the cloud agent only ever sees tracked files.

## Security

- Risk level: elevated — project includes authentication/session handling,
  sensitive/personal user data, and API keys as secrets.
- Secrets handling: `.env` files are gitignored and never enter the repo the cloud
  agent clones; the only credential the cloud agent holds is a GitHub token scoped
  to push to the overnight branch (not to main, not to other repos).
- Trust boundary: the cloud agent operates only within the disposable overnight
  branch. It cannot merge to main and cannot execute code, so a bad implementation
  cannot run against real data or real credentials — it can only produce a diff for
  human review.
- Attribution: commits made by the overnight automation are attributed distinctly
  from the user's own commits (via commit author/co-author metadata), so it's always
  clear in history which changes were human-authored vs. automation-authored.
- `review-issue` should be prompted to explicitly flag any change touching
  authentication, session handling, or personal data, so those diffs get extra human
  scrutiny in the morning rather than being treated the same as routine changes.

## Decisions from follow-up round

- **Issue handoff**: `doc-to-issues` is extended so its own last step pushes
  `SPEC.md` + the issue files it just created to the overnight branch. No separate
  manual push step.
- **Trigger mechanism**: a Cowork scheduled task ("Routine"), created once, then
  fired manually by the user (e.g. "run in 3 hours" or "run at 2am") rather than on
  a recurring cron — matches the "only when I have issues ready" usage pattern.
- **Commit granularity**: one commit (or commit group) per issue/feature, not one
  commit per file or per small change.
- **Skill duplication**: the automated pipeline uses `implement-issue-auto` and
  `review-issue-auto`, project-scoped copies that never touch the user's global
  `implement-issue`/`review-issue`. They differ from the interactive originals in:
  looping over the whole eligible batch instead of one issue; never pausing to ask
  (a stuck/needs-review issue found is logged and skipped, not surfaced as a
  question); running the review pass automatically and mandatorily instead of
  leaving it optional; one automatic retry on a review failure before giving up on
  that issue; committing + pushing per issue as it settles. `interview` and `qc`
  are not duplicated and stay human-run. `doc-to-issues` is not duplicated either —
  it's the same skill, just with one new explicit final step added (see below), that
  only activates when generating/syncing issues *for* an overnight handoff, not on
  every ordinary invocation.
- **Retry policy**: exactly one automatic retry per issue on a review failure, chosen
  over unlimited retries specifically to bound the risk of a silent loop.

## GitHub access for the overnight run

Corrected after reading Anthropic's actual docs on cloud environments and routines:
**no manually-created token is needed at all.** Cloud scheduled tasks (routines)
authenticate to GitHub through the Claude GitHub App connected to the account —
"git credentials and signing keys stay outside the sandbox, and a proxy
authenticates on the session's behalf with scoped credentials." The routine clones
the repo and pushes commits under the user's own GitHub identity automatically, as
long as the Claude GitHub App has access to `automated-kanban` (confirmed already
installed).

A push to a non-`claude/`-prefixed branch (like our `overnight/<date>`) is only
rejected if the branch is GitHub-protected, someone else has an open PR from it, or
it carries commits from a different GitHub user — none of which applies here, since
every commit on the branch comes from the same account.

The fine-grained PAT created earlier in this session was used only for the manual
`git push` calls made from the device shell while scaffolding the demo project —
it's unrelated to how the automated pipeline authenticates, and the user was advised
to revoke it now that it's unneeded.

## Demo project (test bed for the pipeline)

A small, disposable project used only to prove the overnight pipeline works end to
end, before touching the real Angular/Python project.

- **App**: single-board kanban (Trello-like). Fixed columns (To Do / In Progress /
  Done). Cards have a title only. No multi-board support, no auth.
- **Frontend**: Angular.
- **Backend**: Python, FastAPI.
- **Storage**: in-memory (no DB, resets on restart) — keeps focus on the pipeline,
  not persistence.
- **Security posture**: deliberately low-risk — no login, no real secrets, nothing
  PII-adjacent. This demo is for proving mechanics, not for re-testing the security-
  flagging behavior (that gets validated against the real project later).
- **Location**: created directly on the user's computer, under `source/`, as a real
  local git repo (not built in a cloud scratch space and copied over) — so the
  pipeline is tested against real local git from the start.

## Skills packaging for the demo

All 5 skills (`interview`, `doc-to-issues`, `implement-issue`, `review-issue`, `qc`)
plus the 2 automated variants (`implement-issue-auto`, `review-issue-auto`) are
copied into the demo project's own `.claude/skills/` folder and committed to the
repo. This is project-scoped: it does not touch or modify the user's global skills
in any way, and the demo repo is fully self-contained/portable.

## Status

- Demo project scaffolded, tested end to end, pushed to
  `github.com/FreddyPoly/automated-kanban` (`main`).
- All skills copied into `.claude/skills/`: `interview`, `doc-to-issues`,
  `implement-issue`, `review-issue`, `qc`, `documentation`, `report`, plus the two
  new `implement-issue-auto` / `review-issue-auto` variants and `doc-to-issues`'s
  overnight-handoff addition. Committed and pushed.
- Branch naming decided: `overnight/YYYY-MM-DD`.
- GitHub access confirmed: the Claude GitHub App is installed on
  `FreddyPoly/automated-kanban`, so no token/credential setup is needed for the
  scheduled task to clone and push.

## Open items still for the build phase

- Run the human half for real (phase 4): `interview` on a small kanban feature,
  then `doc-to-issues` with the overnight handoff, to get real issues on an
  `overnight/<date>` branch.
- Create the scheduled task itself (phase 5) and run a real dry run (phase 6):
  fire the task → verify the branch afterward.
