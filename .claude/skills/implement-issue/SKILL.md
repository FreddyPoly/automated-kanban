---
name: implement-issue
description: Pick up and implement one unblocked issue from a project's issues/ folder (from doc-to-issues), using the issue file as the source of truth so an agent with no memory of the original interview can still build it correctly. Only picks up owner: agent/placeholder issues — owner: user issues (credentials, business decisions only the user can supply) are skipped and listed as waiting-on-you; placeholder issues (colors, copy) are built with a flagged default, swapped in later. Checks for issues stuck in-progress from an interrupted session, and done issues flagged needs-review by a security spec change, before picking new work. Covers selecting the issue, code-quality rules (existing conventions, no premature abstraction, TDD when tested), code-review before marking done (plus security-review when security: true), and updating docs/backlog after. Marks a finished issue done ⚠️ pending-review (rather than plain done) so the optional review-issue skill can later give it an independent second pass — this doesn't block anything downstream, including qc. Use to implement the next issue, work the backlog, or invoke /implement-issue. Requires an issues/ folder — if none, use doc-to-issues first.
---

# implement-issue

Implement exactly one issue from `issues/`, treating the issue file as sufficient on its own —
this is what makes the backlog usable by an agent that never sat through the original interview.

## Checking for stuck work first

Before selecting a new issue, scan `issues/INDEX.md` for two things that need attention before
picking up something new:

- **`status: in-progress` issues** — these are only ever set by this skill, so one existing means a
  previous session was interrupted before finishing (crash, context limit, you stopping it) rather
  than someone else legitimately owning it. Check whether there's matching uncommitted work for it
  (e.g. `git status` showing changes that plausibly belong to that issue), then ask the user how to
  proceed — resume it, or reset it to `open` (discard the partial attempt) — rather than guessing.
- **`done ⚠️ needs-review` issues** (set by `doc-to-issues` when a security-relevant spec change
  affects already-shipped work) — surface these to the user and ask whether to address one now. If
  yes, treat it like reopened work: set it `in-progress`, read the re-review note plus the current
  spec/security section to see what changed, make whatever change is actually needed, and take it
  back through the normal code-review/security-review and definition-of-done gates below. Once
  resolved, remove the re-review note from the issue and clear the `⚠️ needs-review` marker in
  `issues/INDEX.md`, leaving plain `done`.

Don't silently start a different issue while stuck or flagged work sits unresolved — surface both
every time until they're actually addressed.

## Selecting an issue

Read `issues/INDEX.md` top to bottom. Pick the **first** issue where `status: open`, `owner` is
`agent` or `placeholder`, and every ID listed in `depends_on` has `status: done`. Don't use
judgment to reorder (e.g. "this one seems more important") — the order in the index is the order,
and dependency-blocked or `owner: user` issues are skipped regardless of position.

`owner: user` issues are genuine hard blockers (credentials, business/legal decisions, accounts
only the user can create) — don't pick them up, don't attempt a workaround or a placeholder for
them. They're covered by the waiting-on-you report at the end of this run instead (see below).

If no `agent`/`placeholder` issue is unblocked (everything remaining is blocked, done, stale, or
`owner: user`), stop and report that rather than picking something blocked or inventing a new
issue.

If the user names a specific issue directly ("implement auth-003"), work on that one instead of
scanning for the next unblocked one — but still check its `depends_on` first and flag it if
something it depends on isn't `done` yet, rather than silently proceeding. If they name an
`owner: user` issue and are now providing what it needs (a credential's location, a business
decision, an account being created), that's how those get resolved — see "Resolving a hard
blocker" below.

## What to read before implementing

Start from the issue file alone: description, acceptance criteria, notes. Then ground yourself in
the actual codebase the way you would for any change — read the files/modules the issue touches,
existing patterns nearby, how similar things are already built.

Only open `SPEC.md` (or the project's spec-equivalent) if the issue is genuinely ambiguous and
reading the code doesn't resolve it. If you find yourself needing the spec regularly to understand
issues, that's a sign the issue file itself was under-specified — worth a note in the issue when
you're done, so `doc-to-issues` can write fuller issues next time, but don't let that block the
current implementation.

## Before starting

Set the issue's `status: in-progress` and update `issues/INDEX.md` to match, before writing code —
this is what lets anyone (human or agent) glance at the index and know it's claimed.

## Implementation rules

- **Existing conventions win.** Match the codebase's actual patterns, naming, and style over
  generic best practices when the two conflict. Don't introduce a new pattern for something the
  project already has an established way of doing.
- **No premature abstraction or scope creep.** Build exactly what this issue's acceptance criteria
  require — not infrastructure for other issues you can see elsewhere in the backlog, even if it
  looks like it'd save time later. Each issue is scoped on purpose.
- **Separation of concerns.** Keep modules/functions doing one coherent thing; don't let this
  issue's change sprawl into unrelated files unless the acceptance criteria actually require it.
- **Comments only where the *why* is non-obvious** — a hidden constraint, a workaround, something
  that would surprise a reader. Prefer readable naming and structure over explaining what the code
  does; don't add comments that just restate the code.
- **TDD when the project already has a test suite or test framework in place:** write a failing
  test for the behavior first, implement until it passes, then move to the next piece of the
  issue. Tests must be reliable and actually exercise the behavior — real assertions against real
  outcomes, including the edge cases the issue's acceptance criteria or notes call out. Don't write
  tests that pass regardless of correctness (no-op assertions, over-mocked paths that never touch
  the real logic, tests that only cover the happy path when the issue implies edge cases matter).
- **Don't bolt on a test framework the project doesn't have.** If there's no existing test
  infrastructure, implementing a single issue is not the place to introduce one — that's a bigger,
  project-wide decision. Flag it in the issue's Notes instead of deciding unilaterally.
- Never commit automatically. Implementing and marking an issue done is not, by itself, a request
  to commit — follow the general rule of only committing when the user explicitly asks.

## Implementing an owner: placeholder issue

Build it for real — actual working code, not a stub — using a sensible, clearly-fake-looking
default in place of the thing only the user can really decide: a reasonable color palette, generic
but coherent copy, a plain placeholder icon/image. The point is the feature is fully runnable and
demoable, just not final.

Note in the issue's Notes what's placeholder and what the user needs to supply to finalize it
(e.g. "using a default blue/gray palette pending your brand colors" or "logo is a generic
placeholder icon — swap in `/assets/logo.svg` once you have the real one"). When you mark it done,
append `⚠️ placeholder` to its `Status` cell in `issues/INDEX.md` (see `doc-to-issues`'s
convention) instead of plain `done`.

## Resolving a placeholder

When the user gives you the real thing a `done ⚠️ placeholder` issue was standing in for (actual
brand colors, real copy, a logo file), swap it in: replace the placeholder implementation, remove
the "placeholder pending..." note from the issue, and clear the `⚠️ placeholder` marker in
`issues/INDEX.md` back to plain `done`. Take it through code review again if the change is
substantive enough to warrant it (a full visual overhaul) — use judgment the same as for any other
change, it doesn't need the full definition-of-done ceremony for a one-line color swap.

## Resolving a hard blocker (owner: user)

When the user provides what an `owner: user` issue needs (a decision, a completed account signup,
a credential now in place), implement it like any other issue: acceptance criteria, tests,
code/security review, done.

If what they gave you is non-secret information (a company name, a pricing decision, a domain),
record it in `SPEC.md` the same way the interview would — this is a real decision, not just this
one issue's detail. If it's a credential or secret, never write the actual value into `SPEC.md`,
the issue file, or anywhere else — record only that it's been configured and where (e.g. "Stripe
key is set as `STRIPE_SECRET_KEY` in the environment"), consistent with this pipeline's security
handling elsewhere.

## Definition of done

Before marking `status: done`:

- Every acceptance criterion in the issue is actually met — check each one explicitly, don't
  eyeball it.
- If the project has an existing test suite, build, or lint step, it passes — or, if it was already
  failing before you started (check by running it as a baseline before making changes, or via
  recent CI/git history if that's faster), your change hasn't introduced *new* failures on top of
  that baseline. Don't let a pre-existing broken suite block every future issue indefinitely — but
  don't use "it was already broken" as an excuse to skip checking, either. Report any pre-existing
  failures you find in your summary; they're worth their own issue, just not a blocker for this one.
- The issue's diff has been through code review (see below).
- If something in the issue turns out to be wrong or blocked by something not captured in
  `depends_on` (a false assumption, a missing prerequisite), don't force it to done. Leave it
  `in-progress`, add a Notes entry explaining what's blocking it, and report this to the user
  instead of guessing your way to a green checkmark.

## Code review

Once acceptance criteria and tests pass, but before marking the issue done, run the `code-review`
skill (`/code-review`) against this issue's diff. This is a different check than the definition-of-
done gate above — it's not asking "does it meet the spec," it's catching what passing tests don't:
security issues, maintainability, convention drift, fragile logic.

If the issue is `security: true` (set by `doc-to-issues`), also run the `security-review` skill
against the diff — don't rely on `code-review` to catch security-specific issues incidentally.
This is in addition to code-review, not instead of it: code-review still covers the general
quality pass, security-review specifically covers what a general reviewer might not weight heavily
enough (injection, authz bypass, secret handling, unsafe deserialization, and similar). Issues that
aren't flagged `security: true` skip this extra pass — don't run security-review on everything, it
adds real time for issues where it has nothing to find.

- Findings that are clearly correct and small — fix them directly as part of finishing the issue,
  and mention what was fixed in the end-of-issue summary. Don't open a round trip for something
  that isn't actually in question.
- If a finding is significant, ambiguous, or would change the issue's approach (not just tidy up
  its execution), don't silently fix it either way — note it in the issue and surface it in your
  summary to the user rather than deciding unilaterally. Treat this as non-negotiable for anything
  security-review flags: a security finding you're not fully sure how to resolve gets surfaced to
  the user, not quietly patched with your best guess.
- After fixing findings, the issue's own acceptance criteria and tests still need to hold — re-check
  rather than assuming a review-driven change couldn't have broken something.

Once code review (and security-review, if applicable) passes with all findings resolved, mark the
issue `done ⚠️ pending-review` — not plain `done` — in both the issue file and `issues/INDEX.md`.
This flags it for the optional `review-issue` skill, which gives the diff one more independent
read against `SPEC.md` and the issue's acceptance criteria before anyone treats it as fully settled.
Nothing downstream waits on that marker being cleared — `issues/FEATURES.md` readiness and `qc`
both treat `done ⚠️ pending-review` the same as plain `done` — it's purely an opt-in flag for
whoever wants that extra pass. See `review-issue`'s `SKILL.md` for what it does with it.

## After marking an issue done

Update `issues/INDEX.md` to reflect the new status. If this issue had QC feedback on it (i.e. it
was reopened by `qc`, not fresh from generation), check whether every other issue under the same
feature is also `done` — a `qc-failed` run can reopen more than one issue at once, and the feature
isn't actually ready again until all of them are fixed, not just this one. Only if the whole
feature is clear, update its row in `issues/FEATURES.md` back to `ready-for-qc`; otherwise leave
its status as-is (still effectively not-ready) until the rest are done too.

Then:

1. Run the `documentation` skill to record what changed in the project's root docs.
2. Re-run `doc-to-issues` to resync the backlog — implementing one issue sometimes reveals the
   spec needs adjusting, or unblocks/invalidates others.

Do this automatically as part of finishing the issue, not as a separate step the user has to ask
for. Report a short summary at the end: which issue was implemented, what changed, and what (if
anything) the doc/backlog sync surfaced.

## Waiting-on-you report

End every run — regardless of what you implemented — by scanning `issues/INDEX.md` for two things
and listing them:

- **Open `owner: user` issues** — what each one is and what it's waiting on (a credential, a
  decision, an account).
- **`done ⚠️ placeholder` issues** — what each one is standing in for, so it's easy to tell you have
  real content ready to swap in (see "Resolving a placeholder" above).
- **`done ⚠️ pending-review` issues** — a one-line mention that these are ready for the optional
  `review-issue` skill whenever you want that extra pass; not something waiting *on* you the way
  the other two are, just worth surfacing so it doesn't sit invisible in `issues/INDEX.md`.

This is a passive report, not an interruption — don't stop mid-run to ask about these the way you
would for stuck in-progress or needs-review work; just make sure nothing waiting on the user is
invisible. Skip any list (or the whole report) if there's nothing to include.
