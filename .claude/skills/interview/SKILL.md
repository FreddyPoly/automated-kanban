---
name: interview
description: Extensively interview the user about a new idea, feature, or problem before any planning or implementation starts — pain points, edge cases, stack choices, missing specs, missing use cases, security (auth, sensitive data, secrets, untrusted input — always at least raised, never silently skipped), deep-dive across the whole plan. Ends by writing the validated decisions, including a required Security section, to a spec document (SPEC.md or equivalent) so a future agent can pick up the project without repeating the interview. Use whenever the user describes something they want built or solved and wants to be interviewed first, or when they invoke /interview explicitly. Do not use this for small, well-specified requests (typo fixes, one-line changes, "just do X") — it's for genuinely new ideas/features/problems where requirements aren't fully formed yet. Works in any conversation language, English or French included — ask questions and write SPEC.md in whatever language the user is writing in, or the existing spec's language if there's precedent.
---

# Interview

Before designing or implementing anything, interview the user until you both share a real
understanding of what's being built and why. Don't let this collapse into a single round of
questions followed by a plan — treat it as a conversation that continues until the open questions
run out, not a form to fill in once.

## Before asking anything

If this is happening inside an existing project, spend a few minutes grounding yourself in reality
first: read the relevant code/config/docs (CLAUDE.md or equivalent, related files, existing
patterns). Questions built on what's actually there ("I see X already does Y — should the new thing
reuse that, or is it deliberately separate?") are far more useful than generic ones, and they signal
you've actually looked. If there's no existing project or codebase to ground against, skip this and
go straight to questioning — don't invent context that isn't there.

## What to cover

Work through these angles — not as a rigid checklist to recite, but as a set of lenses to make sure
nothing important is left unasked:

- **Pain points** — what's actually broken or annoying today, concretely, not just in the abstract
- **Problems to anticipate** — failure modes, race conditions, scale/edge cases, what happens when
  things go wrong or inputs are unusual
- **Stack/tooling choices** — when there's a real decision (new dependency, new pattern, multiple
  valid approaches), surface the tradeoff explicitly rather than silently picking one
- **Missing specifications** — behavior the user hasn't pinned down yet that has more than one
  reasonable interpretation
- **Missing use cases** — scenarios the user hasn't mentioned that the feature/idea will still need
  to handle
- **Security** — mandatory, not optional: always establish at least whether the project touches
  authentication/authorization, sensitive or personal data, secrets/credentials, untrusted input
  (user-submitted data, third-party APIs, file uploads), or has compliance requirements. If the
  answer is genuinely "none of that" for a small/local/low-risk project, get that stated explicitly
  rather than letting the topic pass silently — a documented "no" is fine, an unasked question isn't.
  If any of it applies, go deep the same way you would for any other real decision: who's trusted
  with what, how secrets are stored, what happens with malformed/malicious input, what's the blast
  radius if this specific piece breaks. Depth scales with what the project actually touches — this
  isn't a full threat-modeling exercise for a script with no users and no network exposure, but it
  is one for anything handling auth, payments, PII, or external input
- **Deep-dive across the whole plan** — don't stop at the first layer; each answer usually reveals
  another decision underneath it (this is normal — keep going, don't treat it as scope creep)
- **QC approach, for projects with a manual or GUI-heavy verification story** — if the feature will
  mostly get tested by a human clicking through a UI (a native app, a desktop menu bar app, anything
  without a scriptable API surface), raise whether an automated QC harness is worth setting up: a
  script that drives the app end-to-end and reports pass/fail per scenario, meant to run before any
  manual walkthrough. Not every project needs this — for something with a thin or already-scriptable
  surface (a CLI, a web app already covered by browser automation, a library), plain manual QC is
  usually fine and raising this would just be noise. It's worth surfacing for projects where manual
  QC is likely to be repeated often and error-prone (stale running instances, "did I actually see
  what I think I saw" ambiguity) — the user can always decline. If they want one, this only needs to
  capture the *decision* and *shape* here, not build it — that's a separate, deliberate
  implementation task for later (`doc-to-issues`/`implement-issue`, or a dedicated session).

## How to ask

- Prefer `AskUserQuestion` for concrete decision points — it's faster for the user than prose, and
  forces you to actually name the options rather than asking vaguely. Batch related questions
  together (up to 4 per call) instead of one at a time.
- When you have a genuine recommendation, make it the first option and mark it "(Recommended)" —
  don't present false-neutral menus when you actually know the better default.
- Use free-text/prose questions for things that don't reduce to a menu (numbers, descriptions,
  "what else is going on here").
- Go in rounds. Answers to round one routinely open up round two — that's the interview working, not
  a sign you asked the wrong questions the first time. Keep going until you genuinely run out of
  open questions, not until you've asked "enough."
- Don't ask about things you can just go check yourself (existing code, file contents, obvious
  defaults) — reserve questions for things only the user can actually decide.

## When to stop

Stop when you could accurately explain the request back to the user — goal, constraints, edge
cases, and the shape of a solution — without them needing to correct you. At that point, print a
numbered **"Shared Understanding"** summary back to them (not another round of questions) — goal,
constraints, edge cases, chosen approach, security posture, and any open/deferred items — so it's
visible and easy to confirm or correct point-by-point.

Then **STOP**. Do not write to `SPEC.md` (or equivalent), do not generate issue files, and do not
begin planning or implementation. Explicitly ask the user to confirm the summary or tell you what to
amend. Treat this as a hard gate, not a formality to rush past — wait for their explicit go-ahead
(or corrections, which you then fold in and re-summarize) before doing anything else.

## Writing it down

Once — and only once — the user confirms the summary, capture it in a document at the project root
before moving on — this is what lets a future agent (or a future you, in a new session) read the
project cold and start implementing without re-running the interview.

- Reuse `SPEC.md` if the project already has one (see the `documentation` skill's convention);
  create it if not. For a project too small to warrant a dedicated file, a clearly-labeled section
  in `CLAUDE.md` is fine instead.
- Write only decisions actually validated in the conversation — goal, constraints, edge cases
  covered, the chosen approach, and any tradeoffs that were explicitly resolved (including which
  alternatives were rejected and why, when that's not obvious). This is not a transcript of the
  Q&A — compress it into the shape of the decisions, not the back-and-forth that produced them.
- Always include a `## Security` section, even when the answer is "not applicable" — state the
  risk level and why (e.g. "no auth, no persisted user data, no network exposure — low risk").
  When security topics do apply, record the actual decisions: what's trusted vs not, how secrets
  are handled, how untrusted input is treated, what data is sensitive and how it's protected. This
  section is what lets `doc-to-issues` flag which issues are security-sensitive downstream — don't
  leave it vague enough that it can't do that.
- If `SPEC.md` already has content, reconcile your additions with what's there rather than
  appending a disconnected new block — update anything the interview just changed or clarified.
- Leave open questions marked as open if any genuinely remain unresolved (e.g. deferred by the
  user for later) — don't paper over them as decided.
- If the user wants an automated QC harness (see above), document it in its own SPEC.md section —
  what it automates, exactly how to invoke it, what shape/location its output takes, and what it
  deliberately can't cover (so manual QC still knows what's left to it). This is the convention the
  `qc` skill relies on: it checks SPEC.md for this section and runs the harness accordingly instead
  of always defaulting to a fully manual walkthrough — so the section needs to be concrete enough to
  act on, not just "yes we want one someday."

If the result is heading toward code changes, this document is your cue to move into planning
(e.g. plan mode) next — but don't start writing a plan or touching implementation files while the
interview is still open.

## Language

Ask questions, print the "Shared Understanding" summary, and write `SPEC.md` in whatever language
the user is writing in — don't ask which language to use, read it from their messages. If
`SPEC.md`/`CLAUDE.md` already has content in a different language than the current conversation,
match the existing document instead of switching it mid-file. This skill's own triggering doesn't
depend on conversation language, so recognize the need to interview regardless of whether the
request comes in English, French, or anything else. `doc-to-issues` already expects to match
whatever language `SPEC.md` is written in (see its own `## Language` section), so a non-English
spec flows through the rest of the pipeline without extra handling.
