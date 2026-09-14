---
id: urgent-cards-003
title: Add urgent toggle button and highlight styling to cards
status: open
security: false
owner: agent
depends_on: [urgent-cards-002]
spec_ref: "SPEC.md#behavior"
---

## Description

The user-facing half of the feature: a toggle control on each card and a visual highlight
when a card is urgent, per SPEC.md's "Behavior" section.

## Acceptance criteria

- Each card in `app.component.html` gets a new icon button (⚑) in its `card-actions` row,
  alongside the existing `←` `→` `✕` buttons, following the same unicode-glyph-button
  convention (`type="button"`, a `title` tooltip, e.g. "Mark urgent" / "Unmark urgent"
  depending on current state).
- Clicking the button calls `KanbanService.setUrgent` with the opposite of the card's
  current `urgent` value and updates local state the same way `move()`/`remove()` do
  (replace the card in `this.cards` with the response).
- A card with `urgent: true` renders with a colored left-edge accent stripe and a subtle
  background tint, using the app's existing accent color `#b14a3b` (already used for
  `.error` and `.card-actions button.delete` in `app.component.css`) — add a `.card.urgent`
  (or equivalent) CSS class bound to `card.urgent`.
- Urgent cards are not reordered — they render in the same position they would without the
  flag (list order in the template is unchanged; this is purely a CSS/class concern).
- Non-urgent cards are visually unaffected (no stripe/tint).

## Notes

- SPEC.md explicitly rejected auto-sorting urgent cards to the top of their column — don't
  add any sorting/reordering logic here, `cardsIn()` should stay as-is.
- SPEC.md explicitly rejected adding an urgent option to the add-card form — don't touch
  `addCard()` or the form template.
