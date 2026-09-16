---
id: drag-drop-cards-003
title: Implement native drag-and-drop for moving/reordering cards, remove arrow buttons
status: open
security: false
owner: agent
depends_on: [drag-drop-cards-002]
spec_ref: "SPEC.md#feature-drag-and-drop-card-movement"
---

## Description

The user-facing half of the feature: cards become draggable to move them between columns
and reorder them within a column, using the native HTML5 Drag and Drop API (no new
dependency — in particular, no `@angular/cdk`, per SPEC.md's rejected alternatives). This
replaces the existing `←`/`→` move buttons, which are removed entirely.

## Acceptance criteria

**Removing the arrow buttons**
- The `←` and `→` buttons are removed from each card's `card-actions` row in
  `app.component.html`. `⚑` (urgent toggle) and `✕` (delete) remain.
- `AppComponent.move()`, `isFirst()`, and `isLast()` (`app.component.ts`) are removed, as
  they're no longer called from the template.

**Drag mechanics**
- Each card `<li>` gets `draggable="true"` plus `(dragstart)`/`(dragend)` handlers.
  `dragstart` records which card is being dragged (component state) and sets
  `event.dataTransfer` data for spec-correctness; `dragend` clears that state
  unconditionally (covers both a successful drop and a drag that ends outside any valid
  drop target, which must be a no-op — card stays where it was).
- Column card-lists (and, for an empty column, the `<ul class="card-list">` itself as
  fallback) get `(dragover)` and `(drop)` handlers. `dragover` calls
  `event.preventDefault()` (required to allow dropping) and computes a target index by
  comparing the cursor's Y position against the vertical midpoints of sibling cards
  currently in that column, tracking the result (target column + target index) in
  component state for use by both the drop handler and the placeholder indicator below.
- Dropping on any column at any index is allowed — no adjacency restriction (matches
  SPEC.md: the backend already permitted moving to any column directly).
- An empty column (rendering the existing `<li class="empty">No cards</li>`) is a valid
  drop target that resolves to index 0.

**Applying the move**
- On drop, if the resolved (column, index) is identical to the dragged card's current
  (column, position), do nothing — no API call, no local mutation.
- Otherwise, apply the reorder optimistically to the local `cards` array immediately
  (so the UI reflects the new position without waiting for the network), then call
  `KanbanService.moveCard(id, column, index)`.
  - On success, reconcile local state with the server's response (same pattern as
    `toggleUrgent`/`remove`: replace/update from the returned data) so `position` values
    across the affected column(s) stay authoritative.
  - On error, call `this.refresh()` to refetch the board from the server and discard the
    optimistic change, surfacing the failure via the existing `error` state/banner.

**Visual feedback**
- The dragged card is visually distinguished while dragging (e.g. reduced opacity) via a
  CSS class bound to the drag state.
- A placeholder/insertion indicator (e.g. a thin highlighted line or gap) shows where the
  card will land, updated live as `dragover` recomputes the target index.
- New styling lives in `app.component.css`, following the file's existing conventions
  (small, purpose-named classes; reuse of the existing palette — no new colors needed for
  this).

## Notes

- SPEC.md explicitly accepts that removing the arrow buttons removes the only
  non-pointer way to move a card — this is a deliberate tradeoff for this demo project,
  not an oversight; don't add a keyboard fallback as part of this issue.
- SPEC.md explicitly rejected Angular CDK drag-drop and adjacency-restricted drops — see
  its "Rejected alternatives" for this feature.
- No dedicated drag-simulation QC harness per SPEC.md's QC approach for this feature;
  unit tests here can dispatch synthetic `dragstart`/`dragover`/`drop` DOM events to
  cover the index-calculation and optimistic-update logic, but the visual drag
  interaction itself is manually verified in-browser.
