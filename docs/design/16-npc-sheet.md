# 16 — NPC Sheet

**Status:** Locked — full sheet specified as deltas from the Connection sheet; visual proof rendered for Madame Lacroix
**Date opened:** 2026-05-05
**Covers inventory entry:** #8 NPC sheet

## Goal

Specify the NPC actor sheet (CLAUDE.md §6.4). NPCs are the ambient cast — innkeepers, dressmakers, footmen, anonymous gentlemen at the ball — who matter to the world without being formal Connections to any Major. Lighter-weight than Connection sheets: no impressions, no resolve track, no inner conflicts. Just bio + scene info + optional personas.

The NPC sheet is the simplest actor sheet in the system. Most NPCs will live in one place forever (a token on a scene) and never need their sheet opened beyond initial setup. The sheet's job is to be quick, comprehensive, and forgettable — present when needed, invisible the rest of the time.

## Why house-styled

NPCs use the `npc` theme, which inherits the house style (per `decisions.md` registry). Reason: NPCs are world citizens whose visual identity *is* the world. They don't carry a personal voice the way Majors and Connections do.

If an NPC becomes important enough to merit a personal theme, **promote them to a Connection** rather than designing a custom NPC theme. The sheet's footer surfaces this affordance directly (see Promotion section below).

## Structural relationship to the Connection sheet

The NPC sheet is essentially the Connection sheet **minus** the impressions list, **minus** the State row's resolve track, with a slightly narrower default width and a small "promote to Connection" affordance.

This doc focuses on those deltas. Patterns shared with the Connection sheet (header structure, description block, scene info two-column layout, persona block, theme handling for cross-theme references) follow `06-connection-sheet.md` directly.

If you find yourself asking "how should this part of the NPC sheet work?" and the answer isn't here, it's the same as the Connection sheet's answer.

## Sheet dimensions

```js
position: { width: 540, height: "auto" }
```

540px (narrower than Connection's 600px). NPCs have less content; smaller is appropriate.

## Top-level layout

```
┌─────────────────────────────────────────────┐
│  HEADER                                       │
│  ┌────────┬───────────────────────────────┐ │
│  │portrait│ [GM] NPC · ambient cast       │ │
│  │+ chips │ Madame Lacroix                 │ │
│  │        │ Proprietor · widowed           │ │
│  │        │ [+ promote to connection]      │ │
│  └────────┴───────────────────────────────┘ │
├─────────────────────────────────────────────┤
│  DESCRIPTION (prose block)                    │
├─────────────────────────────────────────────┤
│  PUBLIC TAGS    │   HOVER SUMMARY             │
├─────────────────────────────────────────────┤
│  PERSONAS · {N}                               │
│  [single primary row, or list if multi]       │
└─────────────────────────────────────────────┘
```

Five blocks. No State row (no resolve, no MT, no monologue). No impressions. The persona block is optional in the sense that it's always there but mostly trivial — a single primary identity for most NPCs.

## Header spec

CSS class root: `.gs-npc-sheet__header`

### Layout

Same two-column structure as the Connection sheet header, slightly narrower:
- Side panel: 110px wide.
- Main column: flex 1.

### Side panel

Same as Connection's side panel:
- Portrait (70×84px oval).
- Bio chips (italic centered, age + role + pronouns).
- Background: `var(--gs-accent-2)` (sage — house default; this is the visual "this is house-styled, not character-themed" cue).

The sage side panel is a small but important visual signal: every Connection has its theme color in the side panel; every NPC has sage. At a glance, you can tell whether you're looking at a Connection (themed) or an NPC (house) just from the side-panel color.

### Main column

- **Eyebrow row**:
  - Left cluster: a small **GM pill** (`var(--gs-accent-1)` terracotta bg, paper text, 10px Crimson Text, padding 1px 7px) + "NPC · ambient cast" eyebrow in 11px small caps.
  - Right: italic 11px "theme · npc · house style" — explicit so the GM understands the theme assignment.
- **NPC name**: display type Lora, 24px, color `var(--gs-brand)` (forest green — house). The name reads in `var(--gs-brand)` rather than `var(--gs-ink)` because for an NPC sheet, the name *is* the identity (no role/title to disambiguate). Different from Connection's `var(--gs-ink)` treatment.
- **Role + pronouns**: italic body type, 13px, `var(--gs-accent-2)` (sage). Format: "{role} · {modifier}" e.g. "Proprietor of Lacroix & Daughter · widowed", "Innkeeper · gruff", "Stable hand · young".
- **Action row** (below): two small inline action links:
  - "[+ promote to connection]" — opens a confirm dialog (see Promotion section).
  - "[grant to player]" — opens a permission picker for assigning ownership to a specific player. Shorthand for the per-actor permission flow.

### GM pill explanation

The GM pill in the eyebrow is a deliberate "this is GM-only by default" visual. NPCs default to `ownership.defaultLevel: "NONE"` per CLAUDE.md §6.4 — only the GM can edit them unless a player is explicitly granted ownership. The pill makes that scope obvious.

## Description block

Same as Connection sheet (per `06-connection-sheet.md`):
- Section header in small caps.
- HTML editor body, italic-leaning prose, 14px, line-height 1.65.

The description is where most NPC content lives. Everything from "the innkeeper has a limp from the war" to "this dressmaker secretly runs the Swan's Crossing rumour mill" goes here.

## Scene info row

Same as Connection sheet's two-column scene info block:
- Left: Public Tags chip-list. Each tag is a small pill in `var(--gs-paper)` with sage border, sage text. "[+ add]" affordance at the end.
- Right: Hover Summary (1–2 sentences in italic 12px).

These two fields drive the NPC's appearance on the canvas: hovering an NPC token fires the NPC Hover Card (`15-npc-hover-card.md` when written) showing the portrait + name + role + hover summary; the public tags appear in the NPC Organizer sidebar (per Plan §12.5).

## Persona block

Same as Connection sheet's persona block, with these specific differences:

- Most NPCs have only the primary persona. The block renders a single row showing the active persona with no add/edit affordances unless GM clicks "[+ add identity]".
- For NPCs that *do* have alternate personas (the spy innkeeper, the disguised assassin), the persona switcher works identically to the Major/Connection switcher (per `13-persona-switcher.md`).
- The persona row uses a 2.5px left-edge accent in `var(--gs-brand)` (forest green — house). NPCs that have personas don't carry per-persona colors the way Major secret personas do — there's no character theme palette to derive accents from. Plain house treatment.

## Footer

No persistent footer. The header's "[+ promote to connection]" and "[grant to player]" actions are the only sheet-level meta-actions; both live in the header row rather than a footer band.

## Promotion to Connection

When the GM clicks "[+ promote to connection]":

1. A confirm dialog appears: "Promote {NPC name} to Connection? This makes them eligible for player ownership, impressions, and a resolve track. The NPC's bio, description, scene info, and personas are preserved."
2. On confirm, the system:
   - Changes the actor's type from `npc` to `connection`.
   - Initializes the Connection-specific schema fields: `linkedMajorId: ""`, `impressions: []`, `resolve: { current: 1, max: 5 }`, `ownership.defaultLevel: "OBSERVER"`.
   - Prompts the GM: "Pick a connection theme variant" — opens a small picker showing the five connection themes (green, purple, blue, yellow, grey). Selecting one sets `system.theme = "connection-{variant}"`.
   - Closes the NPC sheet and opens the now-Connection sheet.

The promotion is a one-way operation by default. Reverting from Connection back to NPC is rare; if needed, the GM can edit the actor's type via Foundry's developer tools.

### Why this affordance matters

Plan §3.4: "If an NPC becomes important enough to matter to a Major, you can convert it to a Connection later." The promotion path is a real workflow — a player asks "what's the innkeeper's name?" mid-scene, the GM creates an NPC with `NPC Quick-Create` (inventory #21, future doc), uses them for several scenes, and then realizes they've become a meaningful figure deserving impressions and a theme. The promote action makes that transition cheap.

## Edge cases

### NPC with no description
The description block shows a quiet placeholder: italic "No description yet." in `var(--gs-accent-2)`. Doesn't hide the section.

### NPC with no scene info
Same handling — empty placeholders for both public tags and hover summary, italic muted.

### NPC promoted while a token is placed on a scene
The token stays on the scene, now linked to the now-Connection actor. Foundry handles this transparently. The token's hover card may briefly show stale info for a beat before re-rendering with the new theme; not a problem in practice.

### NPC granted to player ownership without promotion
Possible — the GM might want a player to control an NPC without promoting. The "[grant to player]" action handles this. The NPC stays an NPC; the player just has edit rights on the sheet. Less common than promotion but valid.

### NPC with multiple personas
Treated identically to Connection multi-persona case. The persona switcher (per `13-persona-switcher.md`) opens the popover and editor as expected. Rare; most NPCs won't use this.

## Implementation notes for Claude Code

When prompted to build this sheet:

1. Build it as a thin variation of the Connection sheet. **Reuse all shared partials**: the header, description block, scene info row, persona block. Only the impressions and state-row partials are absent.
2. Add the GM pill and the promote/grant action row in the header.
3. Wire the "[+ promote to connection]" action: confirm dialog → actor type change → connection theme picker → reload as Connection sheet.
4. Wire "[grant to player]": opens the Foundry permission dialog scoped to this actor.

CSS organization:
- `styles/sheets/_npc.css` — minimal additions on top of `_connection.css`. Side panel uses `var(--gs-accent-2)` instead of `var(--gs-side-panel)`. Header gets the GM pill styling. Action row in the header.
- Reuse: everything else from the Connection stylesheet.

### Test path

1. Create a new NPC actor. Verify the sheet opens at 540px width with sage side panel and GM pill in the header.
2. Fill in name, role, description, public tags, hover summary. Save. Verify auto-save persists.
3. Place a token of this NPC on a scene. Hover the token. Verify the NPC Hover Card (when implemented) shows the right info.
4. Click "[grant to player]". Pick a player. Verify they can now open the sheet for editing.
5. Click "[+ promote to connection]". Confirm. Pick connection-green. Verify the actor's type changes and the Connection sheet opens.
6. Open the now-Connection's sheet. Verify the original description, public tags, hover summary, and persona are preserved. Verify the new fields (impressions list, resolve track) are present and empty.

If 1–6 pass, the NPC sheet is production-ready.

## Open questions

1. **Should NPCs support a "category" field for filtering in the actors directory?** E.g. "tradesperson", "servant", "noble", "anonymous". **Tentative answer: no for v1.** Public tags already serve this purpose; adding a separate category creates duplicate taxonomies.

2. **Should the GM pill appear on Major and Connection sheets too?** **Tentative answer: no.** Those sheets are typically owned by players; a GM pill would be confusing. The NPC sheet's GM pill is specifically because NPCs default to GM-only.

3. **Should promotion to Connection be reversible?** **Tentative answer: no built-in revert.** GMs needing to revert can use Foundry's actor-type edit tools. Reversion is rare and adds substantial complexity.

4. **Should NPCs without a portrait fall back to a generic role glyph?** A small chair icon for stable hand, a comb for hairdresser. **Tentative answer: no — fall back to the actor initial.** Role-based glyphs would clutter the visual language. The initial fallback is consistent with all other actor sheets.

5. **Should the NPC sheet show a "linked tokens" count?** "Currently placed on 3 scenes" as a header note. **Tentative answer: defer to v1.1.** Useful but not essential for v1; the NPC Organizer sidebar (#22) covers per-scene placement awareness.

## Visual proof

The NPC sheet for Madame Lacroix is rendered above (`good_society_npc_sheet_madame_lacroix`). It validates: the sage side panel that distinguishes NPCs from themed Connections at a glance, the GM pill in the header eyebrow, the promote/grant action row, the description prose block, the scene info two-column layout with public tags + hover summary, the persona block with a single primary identity. Pure house style throughout.

The sheet feels lighter than a Connection sheet — fewer sections, narrower, less ornament — which is exactly the design intent. NPCs are ambient; their sheet should feel ambient too.

## Changelog

| Date       | Change                                                                |
|------------|-----------------------------------------------------------------------|
| 2026-05-05 | File created. NPC sheet specified as deltas from the Connection sheet (no impressions, no state row, narrower width, sage side panel, GM pill, promote/grant actions). Promotion to Connection workflow specified. Visual proof rendered for Madame Lacroix. |
