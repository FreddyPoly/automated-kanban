---
id: per-column-card-creation-002
title: Add per-column "+" button and inline input to the board template
status: done
security: false
owner: agent
depends_on: [per-column-card-creation-001]
spec_ref: "SPEC.md#behavior-1"
---

## Description

Wire the state/methods from per-column-card-creation-001 into the template and styles: drop
the old global add-card form and give each column a "+" button plus an inline creation
input, per SPEC.md's "Behavior" section under "Per-column card creation".

## Acceptance criteria

- The `<form class="add-card">` block is removed from `app.component.html`, along with its
  `.add-card`, `.add-card input`, `.add-card button`, `.add-card button:disabled` rules in
  `app.component.css`.
- Each column's `<h2>{{ column.label }}</h2>` row gets a small icon-only "+" button at its
  right end (flex layout so the button is right-aligned against the label), styled
  consistently with the existing action buttons (reuse the `.card-actions button` look/size
  or an equivalent class), with `type="button"` and `title="Add card"`. Clicking it calls
  `openAdd(column.id)`.
- When `isAdding(column.id)` is true, an inline `<input>` bound to that column's draft title
  appears inside that column's `<ul class="card-list">`, as an element appended after the
  existing `@for`/`@empty` content — so it coexists with the "No cards" empty-state
  placeholder rather than replacing it, and appears below any existing cards.
- Pressing Enter in the input calls `submitAdd(column.id)`. Pressing Escape, or the input
  losing focus (blur), calls `cancelAdd(column.id)`.
- After a successful `submitAdd`, the input is cleared and refocused (e.g. via a template
  reference variable and `ElementRef.focus()`, or `@ViewChildren` keyed by column), so the
  user can immediately type another title without re-clicking "+".
- Existing card action buttons and behavior (move left/right, urgent toggle, delete) are
  unaffected by these changes.

## Notes

- SPEC.md explicitly rejected a single global input with a column selector, and rejected
  limiting to one open column at a time — any number of columns' inputs can be visible
  simultaneously, each independent.
- New cards are appended to the end of the column's list (matches existing `cardsIn()`
  ordering / the old `addCard()` behavior) — no reordering logic needed.
