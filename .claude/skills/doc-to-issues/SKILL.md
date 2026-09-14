---
name: doc-to-issues
description: Turn a project's SPEC.md into small, independently-implementable issue files under issues/, so any agent can pick one up without re-deriving how the spec decomposes into work. Flags issues touching auth, secrets, or untrusted input as security-sensitive, used downstream by implement-issue and qc for extra scrutiny. Classifies each issue's owner — agent (fully agent-doable), user (hard blocker needing credentials/business decisions only the user can supply), or placeholder (soft preference like colors/copy, filled with a flagged default) — so implement-issue knows what it can pick up automatically. Keeps issues in sync on rerun as SPEC.md evolves — adds issues for new content, leaves in-progress/done issues alone except flagging done issues hit by a security change, marks stale issues instead of deleting, keeps FEATURES.md honest. When the user is specifically handing this backlog off to the overnight automated pipeline (implement-issue-auto), commits and pushes SPEC.md + issues/ to the overnight branch as a final explicit step — not on an ordinary invocation. Use when turning a spec into issues/tasks/tickets, or invoking /doc-to-issues. Requires an existing SPEC.md — if none, use interview first.
---

# doc-to-issues

Translate a spec document into a backlog of small, self-contained issue files that any agent —
including one with zero memory of the interview that produced the spec — can pick up and
implement without first figuring out how to break the spec down.

This skill only generates and syncs issue files. Picking one up and implementing it is ordinary
agent work afterward ("implement issue auth-003"), not part of this skill.

## Before generating anything

Find the spec to translate: `SPEC.md` at the project root, or the equivalent labeled section in
`CLAUDE.md` if the project uses that convention instead (see the `documentation` skill). If
neither exists, stop and say so — point the user at the `interview` skill rather
than inventing a spec to translate.

Check whether `issues/` already exists. If it does, this is a **sync**, not a fresh generation —
read every existing issue file and its status before writing anything (see "Syncing on rerun"
below).

## Layout

```
issues/
  INDEX.md
  <feature-slug>/
    001-<short-slug>.md
    002-<short-slug>.md
```

- One folder per feature/area, named from the SPEC.md section it comes from.
- Files numbered sequentially within their feature folder, zero-padded 3 digits. On a sync that
  adds issues to an existing folder, continue from that folder's current highest number — never
  renumber or touch existing files.
- Each issue's ID is `<feature-slug>-<NNN>` (e.g. `auth-003`) — unique across the whole project,
  which is what makes cross-feature `depends_on` references unambiguous.

Before slugging a new folder from a SPEC.md section heading, check whether an existing feature
folder is actually the same feature under a new name — same scope, same issues underneath it,
just reworded. If so, keep using that folder (and its existing issue numbering); don't create a
second folder for a section that only changed its heading text. Only create a genuinely new folder
when the scope is actually new.

## Breaking the spec into issues

Aim for issues small enough that one agent session can implement one start-to-finish:

- Split a feature into its constituent pieces of work rather than emitting one giant issue per
  SPEC.md section — a section describing "user auth" should become several issues (schema/model,
  signup flow, login flow, session handling, ...), not one.
- Don't split so fine that issues become meaningless in isolation (a single function is usually
  too small; an endpoint or a UI flow is usually about right).
- If the spec left something genuinely undecided (marked open in SPEC.md per the interview skill's
  convention), don't silently resolve it while writing the issue — either leave that issue's scope
  narrower to exclude the undecided part, or note the open question in the issue body so the
  implementing agent knows to flag it rather than guess.
- Identify real dependencies (issue B needs a schema/API that issue A creates) and record them —
  but don't invent sequencing where none exists; independent issues should have no `depends_on`.
- Flag an issue `security: true` if it touches anything SPEC.md's Security section identifies as
  relevant, or if the work itself involves auth/authorization, secrets or credentials, sensitive/
  personal data, handling untrusted input (user input, file uploads, third-party API responses),
  or network/file-system access on behalf of a user. When in doubt whether something qualifies,
  flag it — a false positive costs one extra security-review pass; a false negative skips one
  entirely.
- Set `owner` to who can actually do the work:
  - `agent` — the default. Anything an agent can complete start-to-finish from the spec: backend
    logic, data models, APIs, infrastructure, most functional UI behavior.
  - `user` — a genuine hard blocker: credentials, API keys, or third-party accounts (payment
    processors, external services); legal/business decisions (company name, pricing, terms of
    service, compliance sign-off); domain or hosting choices. There's no reasonable placeholder for
    these — the issue simply can't be completed without real input only the user can provide.
  - `placeholder` — a soft preference the agent can implement with an obvious default and revisit
    later: UI colors, typography/layout preferences, copy/brand voice, logos/icons/images/other
    media assets. Unlike `user`, these don't block progress — the agent builds them with a flagged
    placeholder so the project stays runnable end-to-end.
  - When in doubt between `agent` and one of the other two, prefer flagging it — same false-positive
    reasoning as `security`.

## What the Security section changes about a feature's issues

If SPEC.md's Security section says a feature area is genuinely low-risk, most of that feature's
issues will be `security: false` — don't flag everything in a project just because *some* part of
it (e.g. auth) is sensitive. Flag at the issue level based on what that specific issue does, not
what the project as a whole touches.

## Issue file format

```markdown
---
id: auth-003
title: Add session cookie handling to login flow
status: open
security: true
owner: agent
depends_on: [auth-001]
spec_ref: "SPEC.md#authentication"
---

## Description

<what this issue covers, in terms of the decision(s) in SPEC.md it implements>

## Acceptance criteria

- <concrete, checkable outcomes, drawn from the spec's validated decisions and edge cases>

## Notes

<anything from the spec worth flagging: edge cases, explicitly rejected alternatives, open
questions the spec left unresolved that touch this issue>
```

`status` is one of `open`, `in-progress`, `done`, `stale`. Leave updating `in-progress`/`done` to
the agent that implements the issue — don't set those yourself during generation.

`security` is always present (`true` or `false`) — never omit it, since an absent field is
ambiguous between "not flagged" and "not yet considered." This is what `implement-issue` uses to
decide whether `security-review` is mandatory before marking the issue done, and what `qc` uses to
decide whether a feature needs adversarial testing.

`owner` is always present (`agent`, `user`, or `placeholder`) for the same reason. This is what
`implement-issue` uses to decide whether it can pick up an issue automatically at all.

## issues/INDEX.md

Keep a single table listing every issue, regenerated whenever issues are added or their status
changes:

```markdown
| ID | Title | Status | Security | Owner | Depends on |
|----|-------|--------|----------|-------|------------|
| auth-001 | ... | open | true | agent | |
| auth-003 | ... | open | true | user | auth-001 |
```

This is what an agent should read first to find the next unblocked open issue — unblocked meaning
every ID in `depends_on` has status `done`.

When you add a security re-flag note to a `done` issue (see the exception above), also append
`⚠️ needs-review` to that row's `Status` cell (e.g. `done ⚠️ needs-review`) so it's visible from
the index, not just inside the issue file. Clear the marker (back to plain `done`) once the note
it refers to has been resolved and removed from the issue — `implement-issue` owns noticing and
resolving these (see its stuck-work check).

`implement-issue` similarly appends `⚠️ placeholder` to a `done` `owner: placeholder` issue's
`Status` cell once it's implemented with a flagged default (e.g. `done ⚠️ placeholder`) — this
skill doesn't set that marker itself since it's only known once the issue is actually built, but
generate the issue as plain `open` either way and leave the marker to implement-issue.

`implement-issue` also appends `⚠️ pending-review` to every issue it finishes (e.g.
`done ⚠️ pending-review`), flagging it as available for the optional `review-issue` skill to give
it an independent second pass. This is a **different marker from `⚠️ needs-review` above** — don't
conflate them: `⚠️ needs-review` means a security-relevant spec change may have invalidated
already-shipped work and is set by this skill; `⚠️ pending-review` just means "not yet given the
optional review-issue pass" and is set by `implement-issue` on every issue it completes, cleared
back to plain `done` by `review-issue` once it reviews the diff (or left as `in-progress` with
feedback if `review-issue` finds a real problem). Like the other markers, this skill doesn't set or
clear `⚠️ pending-review` itself — just be aware it can appear on `done` rows you read during a
sync.

Markers stack if more than one applies — a `done` issue can be
`⚠️ needs-review ⚠️ placeholder ⚠️ pending-review` all at once; don't let adding one marker clobber
another that's already there.

## issues/FEATURES.md

Alongside `INDEX.md`, maintain a feature-level summary — this is what the `qc` skill uses to find
which whole features are ready for a human to actually test:

```markdown
| Feature | Issues | Status | Last QC |
|---------|--------|--------|---------|
| auth | 4/4 done | not-ready | — |
| billing | 2/5 done (1 stale) | not-ready | — |
```

When generating or syncing, add a row for every feature folder (new ones start `not-ready`) and
update the `Issues` count — call out stale issues separately (as above) rather than folding them
into the denominator, since a stale issue isn't "remaining open work" the same way an open one is.

Otherwise, leave `Status`/`Last QC` alone — `qc` owns recomputing readiness and recording QC
results — except the one case above (new issues landing on an already-passed/failed feature reset
it to `not-ready`). Don't remove a feature's row just because a rerun found no new content for it.

## Syncing on rerun

When `issues/` already has content:

- **New spec content** → generate new issue files for it, following the same
  breakdown/numbering/dependency rules as a fresh run.
- **Existing `open` issues** whose corresponding spec content is unchanged → leave untouched.
- **Existing `in-progress`/`done` issues** → never modify their content or status, even if the
  spec wording around them shifted slightly. These represent work already committed to or
  finished. **Exception:** if the change is specifically to SPEC.md's Security section and it now
  says something that affects what a `done` issue already built (new requirement, tightened rule,
  a risk that wasn't previously called out), add a note to that issue flagging it — e.g. "SPEC.md's
  Security section changed after this shipped: <what changed>; may need re-review" — without
  altering its status or content otherwise. This is the one case where a done issue isn't fully
  hands-off, because silently leaving a real security gap unflagged is worse than a stray note.
- **Existing issues whose spec content was removed or changed incompatibly** → don't delete the
  file. Set `status: stale` and add a line to its Notes explaining what changed in the spec that
  invalidated it. A future agent (or the user) decides whether to discard or rework it.
- **Existing feature whose `FEATURES.md` row is `qc-passed`/`qc-failed`, now getting new issues** →
  set its `Status` back to `not-ready` — new open work means the feature is no longer in the state
  that status claims, and `FEATURES.md` should stay honest for anyone reading it directly, not only
  when `qc` happens to run.
- Update `issues/INDEX.md` to reflect all of the above.
- Report a short summary in chat: issues created, issues marked stale (and why), issues left
  untouched — don't stay silent about a sync that changed the backlog.

## Language

Write issue titles, descriptions, and notes in whatever language `SPEC.md` is written in — this
skill's own triggering doesn't depend on conversation language, but the output should match the
spec it's translating, not the language of the request that invoked the skill.

## Handing off to the overnight pipeline

This is a distinct, explicit step — only do this when the user is specifically
preparing this backlog to be picked up by the overnight automated pipeline
(`implement-issue-auto`), e.g. they say something like "get this ready for tonight's
run" or "push this for the overnight pipeline". An ordinary `doc-to-issues` run or
resync — including the resyncs `implement-issue`/`implement-issue-auto` trigger
automatically after finishing an issue — never does this; it would be surprising for
routine backlog maintenance to start pushing branches unprompted.

When it does apply, after finishing the normal generate/sync above:

1. Create (or reuse, if one from earlier the same day already exists and hasn't been
   run yet) a branch named `overnight/<YYYY-MM-DD>` off the current branch.
2. Commit `SPEC.md` and `issues/` to it:
   ```
   git checkout -b overnight/<YYYY-MM-DD>   # or: git checkout overnight/<YYYY-MM-DD>
   git add SPEC.md issues/
   git commit -m "Prepare backlog for overnight run — <YYYY-MM-DD>"
   git push -u origin overnight/<YYYY-MM-DD>
   ```
3. Tell the user the branch name and how many issues are eligible (`owner: agent` or
   `placeholder`, unblocked) for the overnight run to pick up, so they know what
   they're about to trigger before they fire the scheduled task.

Don't push anything beyond `SPEC.md` and `issues/` here — no code changes belong in
this commit, since none have been made yet.
