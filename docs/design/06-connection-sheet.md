# 06 — Connection Sheet

**Status:** Locked — full sheet specified; visual proof rendered in Connection Green theme
**Date opened:** 2026-05-05
**Covers inventory entry:** #6 Connection sheet

## Goal

Specify the Connection actor sheet (CLAUDE.md §6.2). Connections are supporting characters — innkeepers, cousins, hatters, lovers — whose theming and mechanical state are simpler than Major Characters but who still need a coherent surface for impressions, scene info, resolve, and the occasional persona. Connection actors default to a shared pool (everyone reads, GM authors), with specific Connections promotable to player ownership.

## Structural recommendation — single page, no tabs

Connection sheets are simpler than Major sheets. The data fits on one page without needing tab navigation:

- **Header** — portrait + name + relationship + linked Major reference + theme code.
- **Description** — bio prose.
- **Impressions list** — one entry per Major they're connected to, each "I think [Major] is..." in the Connection's voice.
- **Public tags + Hover summary** — the data the canvas hover card pulls from.
- **Resolve track + Personas** — mechanical and identity state.

No tabs, no persistent bottom strip (resolve max 5 default 1 — small enough to live inline). The whole sheet is character-themed using the connection's chosen color variant.

### PARTS composition

```js
static PARTS = {
  header:      { template: "systems/good-society-homebrew/templates/actors/connection/header.hbs" },
  description: { template: "systems/good-society-homebrew/templates/actors/connection/description.hbs" },
  impressions: { template: "systems/good-society-homebrew/templates/actors/connection/impressions.hbs" },
  scene:       { template: "systems/good-society-homebrew/templates/actors/connection/scene.hbs" },
  state:       { template: "systems/good-society-homebrew/templates/actors/connection/state.hbs" },
};
```

## Sheet dimensions

```js
position: { width: 600, height: "auto" }
```

600px is narrower than the Major sheet (720px). Connections are visually smaller objects in the system — narrower sheet reinforces this. Height auto.

## Top-level layout

```
┌─────────────────────────────────────────────────────────────────┐
│  HEADER                                                           │
│  ┌──────────┬──────────────────────────────────────────────┐    │
│  │ portrait │ eyebrow: CONNECTION · theme · {variant}       │    │
│  │ + bio    │ Mr. Hats McHats                                │    │
│  │ chips    │ A reliable hatter · he/him                     │    │
│  │          │ ─── linked to: [Lady Rose Willowood] ────      │    │
│  └──────────┴──────────────────────────────────────────────┘    │
│                                                                   │
│  DESCRIPTION (prose block)                                        │
│                                                                   │
│  IMPRESSIONS (one row per linked Major)                           │
│  [● Lady Rose] "A proper young lady..."                          │
│  [● Roger]     "A boy with too much money..."                    │
│                                                                   │
│  PUBLIC TAGS    │   HOVER SUMMARY                                  │
│                                                                   │
│  RESOLVE        │   PERSONAS                                       │
└─────────────────────────────────────────────────────────────────┘
```

## Header spec

CSS class root: `.gs-connection-sheet__header`

### Layout

Same two-column structure as the Major sheet header but at smaller scale:

- Side panel: 110px wide, 22×12px padding.
- Main column: flex 1, 20×26px padding.

### Side panel content

1. **Portrait** — oval, 70×84px (smaller than Major's 86×102), 1px border in `var(--gs-brand)`. Renders the active persona's portrait or the connection's primary portrait, falling back to character initial in `var(--gs-display)` at 32px.
2. **Bio chips** — italic body type at 11px, line-height 1.5, centered. Three lines: age, role label (e.g. "Hatter", "Naval officer", "Distant relation"), location or origin.

No persona switcher in the side panel. Connections rarely have multiple personas, and when they do, the persona switcher lives in the State section at the bottom alongside resolve.

### Main column content

1. **Eyebrow row** — between two text spans, justified.
   - Left: `connection` in 11px small-caps body type, letter-spacing 0.18em, color `var(--gs-brand)`.
   - Right: `theme · {variant}` in 11px italic.
2. **Connection name** — display type, 26px (smaller than Major's 32px), color `var(--gs-ink)`. Connection names use ink color for contrast — they're "of the world" rather than "voiced from within."
3. **Relationship label + pronouns** — italic body type, 13px, color `var(--gs-brand)`. Format: "{relationshipLabel} · {pronouns}".
4. **Linked Major reference** — a small inline pill below a 0.5px hairline rule. Format: "linked to · [{Major name}]" where the Major name is rendered as a clickable chip with the Major's theme color (a small dot in `--gs-brand` of the Major's theme + the Major's name in their `--gs-brand`). Click → opens the Major sheet.

The linked Major reference uses the Major's theme color, not the connection's. This is intentional cross-theme rendering: when you see a Connection sheet, you immediately see *who they belong to* in that Major's voice.

If `linkedMajorId` is empty, show "linked to · _no Major_" in italic muted style.

## Description block

CSS class root: `.gs-connection-sheet__description`

```
DESCRIPTION

Skilled, reliable, friendly. Began making hats as a child with
his father, Pappy Cap. Now runs the most beloved haberdashery
in three counties. Has never felt his hometown.
```

- Section header: small caps, 12px, letter-spacing 0.16em, color `var(--gs-brand)`.
- Body: HTML editor (Foundry's `editor` helper), 14px body type, line-height 1.65.
- No card surface — the description sits directly on the paper for cleaner flow into the Impressions section below.

## Impressions block

CSS class root: `.gs-connection-sheet__impressions`

The impressions list is the most distinctive part of the Connection sheet. The schema (CLAUDE.md §6.2) defines:

```
impressions: array<{ majorId, text }>
```

Each Major in the world that the Connection has formed an impression of gets a row. Players add impressions over time — they don't all need to be filled in at sheet creation.

### Visual

```
IMPRESSIONS · what he thinks of each              [+ add]

┌─[● Lady Rose]──────────────────────────────────────────────┐
│ "A proper young lady, far too gentle for the burden she     │
│  carries. She has the same eyes as her late mother."         │
└──────────────────────────────────────────────────────────────┘
┌─[● Roger]──────────────────────────────────────────────────┐
│ "A boy with too much money and not enough purpose..."       │
└──────────────────────────────────────────────────────────────┘
```

- Section header on the left, "[+ add]" action on the right.
- Each impression renders as a soft-paper card (`var(--gs-paper-warm)`, padding 10px 14px, `border-radius: 6px`).
- Each card carries a 2.5px left-edge accent stripe in the *Major's* `--gs-brand` color. This makes the impressions visually scannable — the player can see "ah, this is what Hats thinks of Rose" by color alone.
- Card content is a two-column grid: left column (130px) holds the Major reference (small portrait dot in their theme color + Major's name in their `--gs-brand`), right column holds the impression text in italic body type, 13px, line-height 1.55, color `var(--gs-ink)`.
- Click the Major reference → opens the Major sheet.
- Click the impression text → enters edit mode (textarea inline).
- "[+ add]" → opens a small picker listing Majors not yet impressioned. Select one, type the impression, save.

### Why this matters mechanically

Connections in Good Society serve as opinion-bearers. The `impressions` array is the data that lets the Public Info dashboard show "what the world thinks of this Major" by aggregating impressions from their Connections. The visual separation by Major-color makes the Connection sheet a useful at-a-glance reference for the GM.

## Scene info block

CSS class root: `.gs-connection-sheet__scene`

Two-column layout: Public Tags on the left, Hover Summary on the right.

### Public Tags

- Section header: small caps, 12px.
- Below: a wrap of small pills. Each pill: `var(--gs-paper)` bg, 0.5px border in `var(--gs-accent-1)`, padding 3px 10px, body type 11px, color `var(--gs-brand)`.
- These tags are what appear on the canvas hover card and in the NPC Organizer sidebar. Examples: "eligible", "tradesman", "widowed", "spy".
- Click "[+ add]" (small inline action) to add a new tag.

### Hover Summary

- Section header: small caps, 12px.
- Below: italic body type, 12px, line-height 1.55, color `var(--gs-ink)`. Shows what will appear in the canvas hover card when a player mouses over this connection's token.
- 1–2 sentences. Distinct from the description block: the description is comprehensive prose; the hover summary is a one-line elevator pitch.

## State block

CSS class root: `.gs-connection-sheet__state`

The bottom row of the sheet. Sits above a 0.5px top border in `var(--gs-accent-1)`. Two-column layout: Resolve on the left, Personas on the right.

### Resolve

- Section header: small caps "RESOLVE", 12px.
- Resolve track: 5-pip horizontal row. Filled = `var(--gs-brand)` solid; empty = 1px outline `var(--gs-accent-1)`. Click to toggle. Right-click resets to default starting value (1, per schema default).
- Italic counter to the right of the pips: "1 of 5".

### Personas

- Section header: small caps "PERSONAS", 12px, with "[+ add]" action on the right.
- Each persona renders as a small pill (similar shape to the Major's persona switcher entry): portrait dot, name, optional "primary" italic suffix in muted color.
- Active persona has a 2.5px left-edge `var(--gs-brand)` accent stripe.
- Click a persona → makes it active (triggers the persona-swap pipeline from CLAUDE.md §11).
- Click "[+ add]" → opens a small persona editor (smaller than the Major's persona UI).
- If only one persona exists, this section can be collapsed with a "no alternate identities" italic placeholder, or just the primary persona shown. The primary persona always exists implicitly (created when the actor is created).

## Theme behavior

The entire sheet is character-themed using the connection's chosen variant. `<form class="gs-connection-sheet gs-connection" data-theme="{actor.system.theme}">`.

The connection variants share a type stack with the house style (Lora + Crimson Text), so the visual difference between the connection sheet and a chrome surface is largely color. This is intentional — connections feel "of the world" but with their own color identity.

### Cross-theme rendering inside the sheet

The Connection sheet is the first surface where multiple themes coexist within a single sheet:

- The sheet's own chrome uses the connection's variant (e.g. `connection-green`).
- The linked Major reference uses the *Major's* theme color.
- Each impression card uses the *target Major's* theme color as its left-edge accent.

This works because each themed element is wrapped in its own `.gs-themed[data-theme="..."]` container. The Major name pill inside the impressions list is wrapped:

```html
<span class="gs-themed" data-theme="rose">
  <span class="gs-major-ref">Lady Rose</span>
</span>
```

The `.gs-major-ref` class uses CSS variables, which resolve to Rose's palette inside the wrapper. The connection's outer theme variables don't leak in because the wrapper rebinds them locally.

This is the same wrapper mechanism documented in `02-theme-architecture.md` and proven in `05-epistolary-ui.md`. The Connection sheet is its first multi-theme test.

## Edge cases

### No linked Major
Show "linked to · _no Major_" in italic muted style. The Connection still functions; it's just not currently belonging to any specific player's character.

### Many impressions
The impressions list can grow to 6+ entries (Hats McHats might form impressions of every Major in town). Render them stacked vertically with a 10px gap. If the list exceeds 8 entries, consider lazy-rendering or paginating (defer to v1.1).

### No impressions
Show a soft-paper placeholder card: italic "No impressions yet. [+ add]" centered in muted color. The placeholder is itself the add action.

### Connection promoted to player OWNER
When a Connection is owned by a specific player (not just shared pool), the sheet looks identical — the only difference is permission to edit. The schema's `ownership.defaultLevel` controls this.

### Connection has no personas array (legacy data)
If `personas` is empty or missing, show the "primary identity" implicit pill: just the connection's name and portrait. No persona-swap action.

## Implementation notes for Claude Code

When prompted to build this sheet, the recommended order:

1. Build header (`header.hbs`) — verify portrait + name + linked Major reference render correctly with cross-theme color.
2. Build description block (`description.hbs`) — simple HTML editor, validates the form pipeline.
3. Build impressions block (`impressions.hbs`) — most complex section, validates the cross-theme wrapper pattern in production.
4. Build scene info block (`scene.hbs`) — public tags + hover summary, prerequisites for the canvas hover card.
5. Build state block (`state.hbs`) — resolve track and personas, smaller versions of the Major sheet's primitives.

CSS organization:
- `styles/sheets/_connection.css` — sheet-level layout
- `styles/components/_impression-card.css` — the impression card with cross-theme accent stripe
- Reuse: `_resolve-track.css` (shared with Major), `_persona-switcher.css` (shared with Major)

Test in Foundry after each section. Validate the cross-theme wrapper specifically by:
1. Open Hats McHats's Connection sheet (Connection Green theme).
2. Add an impression for Rose. Verify the impression card's left edge is Rose's wine-pink, not connection-green.
3. Add an impression for Avril. Verify it's Avril's candlelight gold.
4. Click the linked Major reference. Verify the correct Major sheet opens.

If steps 1–4 work, the cross-theme wrapper mechanism is sound for any future component (Public Info dashboard rows, GM bulk panels, etc.) that needs to render multiple character themes on a single shared surface.

## Open questions

1. **Should the linked Major reference allow multiple Majors?** Currently single. The schema field is `linkedMajorId: string` (singular). But Hats McHats might be linked to multiple players' characters. **Tentative answer: keep singular for v1.** If a Connection is "owned" by multiple players, promote them to OBSERVER+OWNER ownership flags rather than multi-linking. Revisit if play surfaces a real need.

2. **Should impressions be visible to all players, or only the linked Major?** Currently all players see all impressions on a shared Connection. This means players may know things their characters don't. **Tentative answer: keep visible for v1.** Players already trust each other not to meta-game in this kind of game. If it becomes an issue, add a per-impression visibility flag (similar to Major fields).

3. **Should resolve be displayed at all on the Connection sheet?** Connections rarely use resolve in play. **Tentative answer: yes, keep it.** Mechanically minor but conceptually important — the resolve track is part of what defines an actor as having interiority. Removing it implicitly demotes Connections to NPC status.

4. **Should the impressions list show impressions FROM other Connections about this Connection (the inverse view)?** Could be useful but bloats the sheet. **Tentative answer: no.** That kind of inverted view belongs in the Public Info dashboard or a dedicated "social graph" view, not the Connection's own sheet.

## Visual proof

The full Connection sheet in Connection Green theme is rendered above (`good_society_connection_sheet_full_hats_mchats`). It validates: header proportions, cross-theme rendering of the linked Major reference and the per-Major impression accents, two-column scene info layout, two-column state row.

When implementation begins, render the same layout for at least one other connection variant (suggested: Connection Purple — Lady Mystery — to validate the variant overrides work uniformly).

## Changelog

| Date       | Change                                                                |
|------------|-----------------------------------------------------------------------|
| 2026-05-05 | File created. Single-page layout specified. Cross-theme rendering pattern (each impression's accent uses the target Major's theme) documented. Visual proof rendered in Connection Green. |
