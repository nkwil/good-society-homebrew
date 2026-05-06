# 08 — Cycle Phase HUD Strip

**Status:** Locked — visual proof rendered for both GM and player views
**Date opened:** 2026-05-05
**Covers inventory entry:** #16 Cycle Phase HUD Strip

## Goal

Specify the persistent Cycle Phase HUD strip (Plan §12.2). It's an always-visible thin bar at the top of the canvas showing the current cycle number and phase, with a phase progression track that lets players see at a glance where they are in the six-phase cycle. The GM gets an Advance Phase button on the right edge.

This is the smallest persistent surface in the system, and the most-seen — every player and the GM looks at it constantly without thinking about it. The "antique but clean and legible" principle matters more here than anywhere else: the strip can't ever feel intrusive.

## Where it lives

Foundry's `ui.nav` area sits at the top of the canvas, across the full width minus the left sidebar. The HUD strip renders into a custom slot here via `Hooks.on("renderSceneNavigation", ...)` or by injecting a custom `Application` rendered into a sibling element above the scene tabs.

Implementation choice: render as a small `Application` (not `ApplicationV2` — too heavy) attached directly to `document.querySelector("#ui-top")` or similar. The strip is light enough that re-rendering on every settings change is fine; debounce to 100ms.

## Sheet dimensions

```
height: 40px (compact)
width: full available width of #ui-top minus padding
```

Single row. No vertical growth. If horizontal space is constrained, the phase track collapses gracefully (see Edge cases below).

## Layout

Three columns, full width:

```
┌─────────────────────────────────────────────────────────────────┐
│ [cycle 3]   ●─novel─●─REPUTATION─○─rumour─○─epi─○─upk   [advance →] │
└─────────────────────────────────────────────────────────────────┘
   ^^^^^^^   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^   ^^^^^^^^^
   left      center (flex 1, phase track)                  right (GM only)
```

CSS class root: `.gs-cycle-hud`

```css
.gs-cycle-hud {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 24px;
  align-items: center;
  padding: 10px 22px;
  background: var(--gs-paper);
  border: 0.5px solid var(--gs-accent-2);
  border-radius: 8px;
}
```

## Left cluster — cycle counter

CSS class: `.gs-cycle-hud__counter`

- "cycle" label: small caps, 11px, letter-spacing 0.16em, color `var(--gs-accent-2)`.
- Cycle number: display type, 22px, color `var(--gs-brand)`, line-height 1.
- The two are baseline-aligned with an 8px gap.

Pulled from world setting `game.settings.get("good-society-homebrew", "cycleNumber")`.

## Center — phase track

CSS class: `.gs-cycle-hud__track`

The phase progression visualization. Six phases in order:
1. **pre-cycle** — between sessions, before play resumes
2. **novel** — Novel Chapter (in-character play, the bulk of a cycle)
3. **reputation** — Reputation Phase (assess and adjust tags)
4. **rumour** — Rumour & Scandal (collaborative gossip)
5. **epistolary** — Epistolary (letter-writing, see `05-epistolary-ui.md`)
6. **upkeep** — Upkeep (housekeeping, see `11-upkeep-wizard.md` when written)

Each phase renders as a small marker with a name. The track connects them with hairline rules.

### Marker states

```
COMPLETED       CURRENT (highlighted)        FUTURE
●  novel       ◉  REPUTATION (filled pill)   ○  rumour
filled dot     larger dot in pill bg         outlined dot
brand color    paper inside terracotta pill  accent-2 outline only
```

- **Completed** marker: 9px filled circle in `var(--gs-brand)` (forest green). Phase name beside it in italic 11px `var(--gs-accent-2)` (sage).
- **Current** marker: a horizontal pill (terracotta `var(--gs-accent-1)` background, `border-radius: 100px`, padding 4px 10px) containing a 9px paper-filled circle and the phase name in display type, 12px, `var(--gs-paper)` (the pill's foreground). The pill draws the eye without screaming.
- **Future** marker: 9px outlined circle in `var(--gs-accent-2)`. Phase name beside it in italic 11px `var(--gs-accent-2)`.

### Connectors

Between markers: a 0.5px horizontal line, 22px wide, with 6px margin on each side.
- Connector before a completed phase: `var(--gs-brand)` (forest green — this segment is "filled").
- Connector after the current phase: `var(--gs-accent-2)` (sage — these segments are "future").

The pattern: completed markers + completed connectors form a continuous left-side, then the current pill, then sage outlines on the right.

### Why a pill on the current phase

The pill (using terracotta `var(--gs-accent-1)`) does three things at once:

1. Visually draws the eye to "you are here" without changing the strip's height.
2. Prints the phase name larger than its neighbors so it can't be misread.
3. Uses the warm accent color (terracotta) that isn't used in the row chrome anywhere else, so the eye notices it.

Outlined dots (future) and filled dots (past) sit visually quieter. The rhythm reads at a glance: "we've done two, we're on this one, four to go."

## Right cluster — GM advance button

CSS class: `.gs-cycle-hud__advance`

Visible only to GM users. For player users, this column collapses to zero width and the phase track expands into the freed space.

- Secondary outline button.
- 0.5px border in `var(--gs-brand)`, color `var(--gs-brand)`, paper background.
- Padding 5px 14px, body type 12px, letter-spacing 0.04em.
- Label: "advance phase →".
- On click: confirms with a small modal ("Advance from Reputation Phase to Rumour & Scandal? This refreshes pending changes for review."). On confirm, increments world setting `cyclePhase` (and `cycleNumber` when wrapping from upkeep to pre-cycle).
- Posts a chat card on advance: "GM advanced cycle to {new phase name}." with relevant flags so other surfaces (dashboard, dock, sheets) react.

## Theme behavior

The HUD is **house-styled only**. No character theming applies here. The strip is a piece of system chrome that belongs to the world, not to any one character.

This is intentional. Themed UI is for character-bound surfaces; the cycle strip belongs to the table.

## Dynamic behavior

### Real-time updates

The strip subscribes to the `updateSetting` Foundry event filtered to `cyclePhase` and `cycleNumber`. When either changes, the strip re-renders. Re-render is full (the strip is small enough that incremental doesn't pay back).

### Phase transition animation

When the current phase changes, the new pill briefly grows from its previous "future" outlined state to its filled pill state over 400ms (a single CSS transition on `padding` and `background`). Subtle — no flashes, no bouncing. The completed dot it leaves behind fills with `var(--gs-brand)` over the same 400ms.

This satisfies the antique-but-clean principle: motion is functional (you can see what changed) without being decorative.

## Edge cases

### Narrow viewport
At <800px wide canvas, the phase track collapses to current phase only with previous and next as small markers. Other phases are accessible via tooltip or by widening the window.

```
[cycle 3]   ◀  ◉ REPUTATION  ▶                    [advance →]
```

The `◀` and `◮` glyphs indicate "more on each side" and tooltip on hover with the phase names.

At <600px wide, the track collapses entirely to just the current phase pill, with cycle counter and advance button on either side.

### Pre-cycle phase
The first marker. Before any play happens. Visually: the "pre" marker is current, the others are all future-outlined. Cycle number reads 0 or 1 depending on house convention.

### Wrapping from Upkeep back to Novel
When the GM advances from Upkeep, the next phase is Novel of the next cycle. The transition increments `cycleNumber` and resets all `monologuedThisCycle` flags (per Plan §12.2 if `autoRefreshOnUpkeep` is true).

The HUD strip re-renders showing the new cycle number and the phase track resetting (only "pre" filled, "novel" as the current pill). The animation runs once per advance.

### GM adjusting cycle number manually
If the GM directly edits `cycleNumber` from the World Settings UI (not via the Advance button), the HUD updates the same way. No special handling needed.

## Implementation notes for Claude Code

When prompted to build this strip, the recommended order:

1. Build the strip as a standalone `Application` that renders into a custom DOM slot above the scene navigation. Verify it appears and disappears correctly.
2. Wire it to `cyclePhase` and `cycleNumber` settings via `Hooks.on("updateSetting", ...)` or settings change callbacks.
3. Build the phase track as a partial that takes a current-phase argument and renders the six markers in the right states.
4. Add the GM advance button with confirm modal and chat card posting.
5. Test phase transitions manually — advance through all six phases and back to verify the visual states cycle correctly.

CSS organization:
- `styles/components/_cycle-hud.css` — the strip and the phase track
- `styles/components/_phase-marker.css` — the dot/pill marker primitive (potentially reusable in the Upkeep wizard)

Test path:
1. Open Foundry. Verify the strip appears at the top of the canvas.
2. As GM, click advance. Confirm. Verify the pill moves to the next phase smoothly.
3. As player, verify no advance button is visible.
4. Resize the canvas window narrower. Verify the phase track collapses gracefully.
5. Set a `cyclePhase` value via the Foundry console. Verify the strip updates without a page reload.

## Open questions

1. **Should clicking a future phase "skip ahead"?** Currently no — only the GM advance button moves through phases sequentially. Skipping would surprise people. **Tentative answer: no skipping.** GMs needing to skip should use the world settings UI directly with a clear "this is a deliberate skip" dialog.

2. **Should the strip be hideable?** Some GMs may prefer to use the Public Info dashboard for phase tracking and not have the strip taking up canvas space. **Tentative answer: yes, via a user setting.** Default visible.

3. **Should the strip support keyboard shortcuts for advance?** GM convenience. **Tentative answer: no for v1.** A keyboard shortcut on the advance button risks accidental advancement (cycle phases are dramatic moments). Click-with-confirm is the right friction.

4. **Phase name choices.** "rumour" vs "rumour & scandal", "epistolary" vs "letters", "upkeep" vs "housekeeping". The schema uses "rumour-scandal", "epistolary", "upkeep" as canonical. **Tentative answer: use abbreviations on the strip ("rumour", "epi", "upk" if needed at narrow widths) but keep canonical names in the world setting and any chat output.** The display labels can drift from the data labels safely.

## Visual proof

The HUD strip is rendered above (`good_society_cycle_phase_hud_strip`) in two states: the GM view (with advance button) and the player view (without). Both demonstrate: cycle counter, six-phase track with two completed phases, the current Reputation phase pill, three future phases outlined, and the right-edge GM control. The visual is restrained enough to feel like part of the system chrome, distinctive enough to communicate state at a glance.

## Changelog

| Date       | Change                                                                |
|------------|-----------------------------------------------------------------------|
| 2026-05-05 | File created. Strip layout, phase track marker states, GM/player view differences, dynamic behavior, edge cases all specified. Visual proof rendered for both views. |
