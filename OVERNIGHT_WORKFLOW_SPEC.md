# Overnight Implementation Workflow — Spec

## Goal

Automate the middle of a development pipeline so the two human-in-the-loop stages
(`interview`, `qc`) stay manual, while implementing and reviewing issues runs
unattended in the cloud overnight, on every open issue, without requiring the user's
own computer to stay on.

## Pipeline

| # | Skill | Run by | Input | Output |
|---|-------|--------|-------|--------|
| 1 | `interview` | Human | Conversation | `SPEC.md` |
| 2 | `doc-to-issues` | Human | `SPEC.md` | `issues/` folder (`INDEX.md`, `FEATURES.md`, one `.md` per issue) |
| 3 | `start-overnight-run` | Human | `SPEC.md` + `issues/` | Pushed branch + scheduled cloud routine |
| 4 | `implement-issue-auto` (loops the backlog; calls `review-issue-auto` per issue) | Cloud, unattended | Issue files + codebase + `SPEC.md` | Code changes, committed + pushed per issue |
| 5 | `qc` | Human | Implemented feature | Manual test scenario, verdict recorded |

`implement-issue`/`review-issue` are the interactive originals that a human can still
run directly on any single issue; `implement-issue-auto`/`review-issue-auto` are
project-scoped unattended variants written as deltas against them (see "Skill
duplication" below), invoked only from inside the overnight routine — never by a
human directly.

There's no separate "review" step or "review report" file to account for:
`implement-issue`(-auto) already runs `code-review` and `security-review` (when
`security: true`) inline before marking an issue done; `review-issue`(-auto) is a
*second*, independent opinion checking specifically whether the diff conforms to
`SPEC.md` and the issue's acceptance criteria. All review feedback — from
`code-review`, `security-review`, or `review-issue`(-auto) — is written directly into
the issue file and reflected as a status marker in `issues/INDEX.md` (`done ⚠️
pending-review`, `done ⚠️ placeholder`, `done ⚠️ needs-review`, or reopened to
`in-progress` with feedback appended). That marker *is* the review record.

## How a run works, end to end

1. **Human** runs `interview` → `SPEC.md`, then `doc-to-issues` → `issues/`.
2. **Human** runs `start-overnight-run` once ready to hand the backlog off:
   - Commits and pushes `SPEC.md` + `issues/` to a branch named after the feature
     being handed off (see "Branch naming" below).
   - Asks what time tonight to fire, resolves a push-capable `environment_id` for
     this repo, and creates a one-shot `RemoteTrigger` routine for that time.
3. **Cloud, unattended**, when the routine fires:
   - The session starts already cloned and checked out on a branch the *platform*
     assigns — never the branch pushed in step 2 (see "Branch naming").
   - First action: `git fetch`/`git merge` the branch from step 2 onto its own
     assigned branch, pulling in the prepared `SPEC.md`/`issues/`.
   - Runs `implement-issue-auto` once. It loops every unblocked `owner: agent`/
     `placeholder` issue, sequentially:
     1. Implements it exactly as `implement-issue` would (existing-conventions-win,
        no scope creep, TDD when the project has a test framework, inline
        `code-review` + `security-review`, marked `done ⚠️ pending-review`, then a
        `documentation` run and a `doc-to-issues` resync — same as `implement-issue`
        already does per issue).
     2. Immediately runs `review-issue-auto` against that same issue — mandatory
        here, unlike the optional interactive `review-issue`.
     3. On pass: commit. On fail: one retry using the feedback, then commit either
        way (clean, or left `in-progress` with both rounds of feedback if the retry
        also fails) — never a silent third attempt.
     4. Pushes after every issue's commit, not just at the end, so an interrupted
        session never loses more than the one issue in flight.
   - Never pauses to ask the user anything — a stuck `in-progress` issue found at the
     start, a `done ⚠️ needs-review` issue, or any judgment call `implement-issue`
     would normally surface, is logged to `OVERNIGHT_REPORT.md` and skipped instead.
   - Writes and pushes `OVERNIGHT_REPORT.md` as the final commit (completed /
     completed-after-retry / needs-your-attention / waiting-on-you / placeholders-built).
   - Prints `FINAL BRANCH: <name>` as its very last action.
4. **Human**, the next morning: finds the actual branch (run notification,
   `OVERNIGHT_REPORT.md` commit, or the `FINAL BRANCH:` log line), pulls it, reads
   the reports and diffs, runs `qc` to test whichever issues are ready, then merges
   to `main` or discards at their own discretion — never automated.

Issues are processed one at a time, sequentially — not fanned out in parallel — so
later issues can see the results of earlier ones and the branch stays simple to
reason about. (`implement-backlog`, a parallel/worktree batch-runner, was
deliberately not used here — it stops mid-run for a human go-ahead before launching
subagents, which doesn't fit unattended overnight use.)

## Branch naming

**Parent branch** (created and pushed by `start-overnight-run`, step 2 above): named
after the feature being handed off — e.g. `urgent-cards` — no date, no `overnight`
prefix or mention anywhere in the name. The feature scope is derived from which
`issues/<feature-slug>/` folder(s) have pending changes at handoff time.

- Exactly one feature slug touched → use it directly as the branch name.
- More than one → `start-overnight-run` asks for a short combined name rather than
  guessing a concatenation.
- No pending changes at all (e.g. re-running after an earlier push failed) → asks
  which existing branch this run belongs to.
- If a branch with the resolved name already exists, `start-overnight-run` asks
  whether to join it or branch independently (suffixed, e.g. `<branch>-2`) rather
  than silently reusing it — this matters more with bare feature-slug names than it
  did with date-prefixed ones, since a feature slug is more likely to collide with an
  unrelated, hand-made branch a human is already using. A human confirms either way,
  which is treated as sufficient protection against that collision.

**Child branch**: the platform that runs the cloud routine does **not** honor the
exact branch name requested in `outcomes.git_info.branches` — it always assigns its
own randomly-suffixed branch (confirmed: requesting `test/push-check` produced
`test/push-check-rnf1yg` one run and `test/push-check-qlzcaa` the next). The fired
session also has a hard built-in rule refusing to push anywhere but the branch it's
already on, with no user present to grant the override it would otherwise ask for —
so this can't be fought from inside the prompt. `start-overnight-run` works with this
instead of against it:

- The `outcomes.git_info.branches` hint sent when creating the routine is the exact
  parent branch name (e.g. `urgent-cards`), not a generic placeholder — the
  platform's random suffix lands on top of it, so the resulting child branch looks
  like `urgent-cards-<suffix>`, traceable back to its parent by a simple prefix
  match.
- The routine's prompt tells the session to work on whatever branch it's given,
  merge in the parent branch first, and print `FINAL BRANCH: <name>` as its last
  action, since the exact final name is genuinely unknowable in advance.
- The routine's own human-readable `name` field is likewise keyed off the parent
  branch name.

## RemoteTrigger routine mechanics

- `RemoteTrigger` (not `mcp__scheduled-tasks__create_scheduled_task`, which creates a
  plain local task with no repo-push authorization) is what actually gets a routine
  scoped GitHub push access.
- Push authenticates through the Claude GitHub App connected to the account — no
  manually-created token is involved. The routine clones the repo and pushes commits
  under the user's own GitHub identity automatically, as long as the app has access
  to the repo.
- That's necessary but not sufficient: the routine also needs `session_request.environment_id`
  set to a real Environment with GitHub push access to this specific repo, plus
  explicit `session_request.config.sources`/`outcomes` entries naming the repo as a
  `git_repository`. Without all three, the proxy has nothing to authorize a push
  credential against — reads still work (the session authenticates as "you"), but
  every `git push` is rejected: `access denied by the git proxy: <repo> is not in
  this session's authorized repository set`.
- There's no API to create or list Environments directly. `start-overnight-run`
  resolves an existing one by scanning this account's own trigger history
  (`RemoteTrigger action: "list"`) for any past routine that already targeted this
  repo, and reusing its `environment_id`. For the very first overnight run ever on a
  given repo, that lookup finds nothing — a human has to create/confirm an
  Environment with GitHub push access to that repo in claude.ai Settings →
  Environments first; there's no tool-based way to do this step. Once one such
  Environment has been used successfully, every future run (for this repo, or any
  other project that adopts this skill) resolves it automatically.
- A push to a non-`claude/`-prefixed branch is only rejected if the branch is
  GitHub-protected, someone else has an open PR from it, or it carries commits from a
  different GitHub user — none of which applies here, since every commit on the
  branch comes from the same account.

## Skill duplication

`implement-issue-auto` and `review-issue-auto` are project-scoped copies that never
touch a user's global `implement-issue`/`review-issue`. They differ from the
interactive originals in: looping over the whole eligible batch instead of one issue;
never pausing to ask (a stuck/needs-review issue found is logged and skipped, not
surfaced as a question); running the review pass automatically and mandatorily
instead of leaving it optional; one automatic retry on a review failure before giving
up on that issue; committing + pushing per issue as it settles. `interview` and `qc`
are not duplicated and stay human-run. `doc-to-issues` is not duplicated either — the
automated run calls the same skill a human would, since `implement-issue`'s
"after marking an issue done" step already re-runs it to resync the backlog, and
`implement-issue-auto` inherits that verbatim.

Because the `-auto` variants are written as deltas against their interactive
originals ("same as `implement-issue`," "read `review-issue`'s sections and follow
them exactly") rather than as self-contained files, `implement-issue` and
`review-issue` must also be present wherever `implement-issue-auto`/
`review-issue-auto` are — even though a human never invokes them directly in an
automation-only context.

Retry policy: exactly one automatic retry per issue on a review failure, chosen over
unlimited retries specifically to bound the risk of a silent loop.

## Explicit non-goals / constraints

- Nothing is ever merged to `main` automatically. The overnight run only ever
  produces commits on a disposable branch, and the fired session cannot push anywhere
  but the one branch the platform assigned it.
- No code or tests are executed by `implement-issue`(-auto) or `review-issue`(-auto)
  — both work purely at the file level (read/write text, no dev server, no test
  runner).
- `SPEC.md` and issue files are not committed to the project by default in the
  general workflow — they're pushed only as part of a deliberate `start-overnight-run`
  handoff, not as a standing practice.
- The overnight agent never has access to `.env` files or any other gitignored
  secrets — only tracked repo content, plus the push credential the platform injects
  for the resolved environment.

## Security

This repo (the kanban demo described below) is low risk: no login, no real secrets,
nothing PII-adjacent. Concretely:

- **Secrets handling**: any `.env` files are gitignored and never enter the repo the
  cloud agent clones; the cloud agent's only credential is the one the Claude GitHub
  App injects for the environment resolved by `start-overnight-run`, scoped to this
  repo and to whichever single branch the platform assigns the session.
- **Trust boundary**: the cloud agent can only push to that one assigned branch, never
  `main`, and cannot execute code — `implement-issue-auto`/`review-issue-auto` work
  purely at the file level, so a bad implementation can only produce a diff for human
  review, never run against real data or credentials.
- **Attribution**: commits made by the overnight automation are attributed distinctly
  from the user's own commits (author/co-author metadata), so it's always clear in
  history which changes were human- vs. automation-authored.
- **Adopting this for a higher-risk project**: if this pipeline is pointed at a
  project that does handle authentication, sensitive/personal data, or real secrets,
  re-assess before relying on it there — in particular, brief `review-issue-auto` to
  explicitly flag any change touching authentication, session handling, or personal
  data for extra human scrutiny the next morning, rather than treating it the same as
  a routine change.

## Demo project (test bed for the pipeline)

The pipeline was built and validated against a small, disposable project before any
larger/riskier one: a single-board kanban app (Trello-like). Fixed columns (To Do /
In Progress / Done), cards have a title only, no multi-board support, no auth.
Frontend: Angular. Backend: Python/FastAPI. Storage: in-memory (no DB, resets on
restart) — keeps focus on the pipeline mechanics, not persistence. Created directly
on the user's computer as a real local git repo (not built in a cloud scratch space
and copied over), pushed to `github.com/FreddyPoly/automated-kanban`.

## Porting to another GitHub-hosted project

1. **Copy the minimum skill set** into the target repo's own `.claude/skills/`:
   `doc-to-issues`, `implement-issue`, `implement-issue-auto`, `review-issue`,
   `review-issue-auto`, `documentation`, `start-overnight-run`.
2. **Confirm the Claude GitHub App has access** to the target repo.
3. **First run only**: since `start-overnight-run`'s environment auto-discovery works
   by scanning this account's trigger history for a routine that already targeted
   that repo, a brand-new repo has nothing to find yet — see "Setting up the first
   Environment for a repo" below.
4. From then on, the flow is identical to this repo's: `interview` → `doc-to-issues`
   → `start-overnight-run` → (cloud) → `qc`.

### Setting up the first Environment for a repo

There's no API to create or list Environments, so this one-time step is done by hand in
the claude.ai web UI, not by any skill or tool:

1. Go to **claude.ai Settings → Environments**, logged into the account with the Claude
   GitHub App installed.
2. **Create (or reuse) an Environment**:
   - Name it something recognizable, e.g. `<repo>-push`, or a generic `github-push` if
     it's meant to be reused across future repos.
   - Grant it access to the target repo specifically (or the whole account/org, for a
     broader Environment covering multiple repos).
   - Make sure the access level includes **push**, not just read — read-only access lets
     a routine clone/browse but every `git push` is rejected by the git proxy.
3. **Confirm the Claude GitHub App itself has access to the repo** — a separate checkbox
   from the Environment, per "RemoteTrigger routine mechanics" above. Check the GitHub
   App's own installation settings (GitHub.com → Settings → Applications → Claude) and
   make sure the repo is in its repository list, not just installed at the org level with
   restricted repos.
   - **If the repo belongs to an org you don't administer**, installing/configuring the
     app is gated to org admins — you can't do it yourself as a regular member:
     - **Ask an org admin directly**: they install/configure the app at
       `github.com/organizations/<org>/settings/installations` → find "Claude" →
       Configure, then add the repo to its "Only select repositories" list (or grant "All
       repositories"). If the app is already installed for other repos in the org, this
       is just adding one more repo to its existing list, not a fresh install.
     - **Or, if the org allows it, self-service request**: some orgs enable
       member-initiated app requests. On the same installations page, a **Request**
       button (instead of Configure) lets you send an approval request to org owners
       without needing admin rights yourself — only present if the org hasn't disabled
       this.
     - If neither applies (no request button, no admin access), this step is blocked
       until an org owner acts — message them directly with the app name ("Claude") and
       the exact repo needed, rather than digging further through settings.
4. No routine needs to be scheduled or fired manually to "prime" anything — the
   Environment just needs to exist with push access. The very first `start-overnight-run`
   invocation for that repo has nothing to auto-discover, so as of the fallback added
   2026-09-27, it asks the user to paste that Environment's `environment_id` directly
   (visible in its detail view/URL in Settings → Environments) and uses it for that run
   immediately, instead of stopping and requiring a separate rerun. If the user doesn't
   have the ID handy yet, the skill stops and the user reruns it once they do.
5. Once one such Environment has been used successfully in a routine, every subsequent
   `start-overnight-run` run — for this repo, or any other project that adopts this
   skill and later reuses the same Environment — resolves the `environment_id`
   automatically from trigger history, with no manual step.

## Status

- Pipeline built and validated end to end against the kanban demo, pushed to
  `github.com/FreddyPoly/automated-kanban` (`main`).
- A dry run (`urgent-cards` feature, 3 issues) completed the full implement/review
  loop but initially failed to push, due to a placeholder `environment_id` and empty
  `sources`/`outcomes` on the routine — fixed by resolving a real environment and
  setting both fields explicitly (see "RemoteTrigger routine mechanics"). No work was
  lost (a git bundle of the unpushed commits was recovered), and the fix has since
  been validated on repeat runs.
- Branch naming redesigned 2026-09-27 to be feature-based instead of date-based (see
  "Branch naming").
