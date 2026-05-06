# 19 — GM Tools Batch (Reveal Control, NPC Quick-Create, NPC Organizer)

**Status:** Locked — three small GM-only utility surfaces specified together; visual proof rendered for all three
**Date opened:** 2026-05-05
**Covers inventory entries:** #20 Reveal Control widget, #21 NPC Quick-Create modal, #22 NPC Organizer per scene

## Goal

Specify three small GM-only utility surfaces in a single doc. Each handles one frequent operation in the GM's daily loop:

- **Reveal Control** — confirms field-visibility flips with appropriate dramatic gravity. Single-field popovers fired from the dashboard or sheet contexts; bulk forms for the dashboard's "reveal desires" action.
- **NPC Quick-Create** — drops a new NPC at a canvas click point with sensible defaults. Solves "what's the innkeeper's name?" mid-scene without breaking flow.
- **NPC Organizer** — sidebar listing all Connection and NPC tokens currently placed on the active scene. Click to focus camera, right-click for quick actions.

These three are batched because they share a common visual register (house style, GM pill in headers, utility tone) and because each is small enough that a dedicated doc would feel light. As a batch they capture the GM's operating loop on a single scene: drop NPCs, see who's there, reveal information at the right moment.

## Shared GM tool conventions

All three surfaces share these:

- **House-styled.** No theme wrapping at the surface level. (Some surfaces — like the Reveal Control popover for a specific actor — do show the actor's theme accents in places, but the chrome stays house.)
- **GM pill in headers.** Same `var(--gs-accent-1)` (terracotta) bg + paper-color pill from the NPC sheet (`16-npc-sheet.md`). 10px Crimson Text, "GM" label, padding 1×7px, border-radius 3px. Always next to or before the section eyebrow.
- **Utility tone, not ceremony.** These are tools, not story moments. The visual register is restrained: small modals, inline forms, no flourishes. Title-page ornaments (dot-fleurons, ornamented dividers) aren't appropriate here — those belong to ceremonial surfaces, not GM utilities.
- **Confirmations before consequential actions.** Reveals are confirmed; NPC drops show a "creates a token + actor" preview line so the GM knows what's happening; Organizer right-click actions confirm destructive operations.
- **Compact action buttons.** `var(--gs-brand)` filled for primary action, outlined `var(--gs-accent-2)` for secondary/cancel. 12px Lora, 5×14px padding, 4px corner radius.

## Reveal Control widget

CSS class root: `.gs-reveal-control`

Used for flipping per-field visibility flags on actors. Two forms:

1. **Single-field confirm** (most common) — opens as a popover when the GM clicks a visibility flag indicator on a sheet or dashboard. Confirms a single flip with appropriate gravity.
2. **Multi-field bulk form** — opens from the Public Info Dashboard's "reveal desires" GM bulk action. Lets the GM pick multiple actor/field combinations and reveal them in a coordinated batch.

The single-field form is documented here in detail; the bulk form is described as a multi-row variant.

### Single-field popover

Dimensions: 360px wide. Height auto.

#### Layout

```
┌──────────────────────────────────────┐
│  [GM]  REVEAL CONTROL                  │
│  Lady Rose Willowood                   │
├──────────────────────────────────────┤
│  FIELD     desire                       │
│  CURRENT   ○ secret                     │
│  FLIP TO   ● public  (irreversible feel) │
│                                          │
│  ┌─────────────────────────────────┐  │
│  │ This will reveal Rose's desire  │  │
│  │ to all players. The reveal posts │  │
│  │ a chat card and is logged...    │  │
│  └─────────────────────────────────┘  │
├──────────────────────────────────────┤
│              [cancel]  [reveal to all] │
└──────────────────────────────────────┘
```

#### Header

- Padding: 14px 20px.
- 0.5px bottom border in `var(--gs-accent-2)`.
- GM pill + "REVEAL CONTROL" eyebrow (small caps 11px, letter-spacing 0.18em, color `var(--gs-accent-2)`).
- Below the eyebrow: actor name in display type 18px Lora, `var(--gs-brand)`. Identifies which actor is being acted upon.

#### Body

- Padding: 16px 20px.
- A two-column grid showing field, current value, and target value:
  - Column 1 (70px): label in 11px small caps.
  - Column 2: value with state icon.
    - **secret**: outlined dot `○`, sage color, italic 12px.
    - **public**: filled dot `●`, verdant color, body type 13px.
    - **redacted**: slash `⊘`, oxblood color, italic 12px.
- Below the grid, a soft-paper card warning the consequences. Background `var(--gs-paper-warm)`, 2.5px left-edge accent in `var(--gs-accent-1)` (terracotta — caution color), italic body type 12px, line-height 1.55. The text varies by flip:
  - secret → public: "This will reveal Rose's desire to all players. The reveal posts a chat card and is logged. Continue?"
  - public → secret: "This will hide Rose's desire from all players except yourself and Rose's owner. Continue?"
  - either → redacted: "This will replace Rose's desire field with a redaction bar visible to all players. Continue?"

The "(irreversible feel)" small italic tag next to the FLIP TO line is a deliberate emotional cue: technically reversible, but the dramatic moment isn't. Players who saw the reveal can't unsee it.

#### Footer

- Padding: 12px 20px.
- Background: `var(--gs-paper-warm)`.
- Right-aligned: cancel (outline) + primary button.
- Primary button label varies:
  - secret → public: "reveal to all ↗"
  - public → secret: "make secret"
  - either → redacted: "redact"

#### When fired

- From a Major sheet's Private tab field visibility indicator (per `04-character-sheet.md`).
- From the Public Info Dashboard's per-row Reveal Control action (per `07-public-info-dashboard.md`).
- From the Reveal Control popover programmatically (e.g. as part of the Inner Conflict completion ceremony or a Backstory Action expansion that reveals information).

#### Side effects on confirm

1. The actor's `system.visibility.{field}` updates.
2. A system-emitted chat card posts (per `10-chat-cards.md`): "GM has revealed Lady Rose's desire to all players: {desire text}." The card content varies by flip type.
3. Any open Major sheets re-render to reflect the new state.
4. The Public Info Dashboard re-renders.
5. If the field was hidden in any open hover cards (per `17-token-hover-card.md`), they update on next hover.

### Multi-field bulk form

Same chrome, expanded body. Instead of a single field/current/target row, the body shows a checkbox list of actor+field combinations. The form is fired from the dashboard's "reveal desires" GM bulk action and similar.

```
┌──────────────────────────────────────────┐
│  [GM]  REVEAL CONTROL · BULK              │
│  Reveal desires · 5 majors                 │
├──────────────────────────────────────────┤
│  ☑ Lady Rose Willowood — desire (secret) │
│  ☑ Roger Willowood — desire (secret)      │
│  ☐ Avril Eclair — desire (already public) │
│  ☑ Dixon Cloudcandle — desire (secret)    │
│  ☑ Clayton Trotwood — desire (secret)     │
│                                              │
│  Selected reveals will all post simultaneously
├──────────────────────────────────────────┤
│        [cancel]  [reveal 4 desires]        │
└──────────────────────────────────────────┘
```

- Each row is a checkbox + actor name + field name + current state in italic.
- Already-public fields are shown unchecked and disabled with their state in italic ("already public") so the GM understands they don't need to flip.
- The primary button label updates with the count: "reveal {N} desires".
- Confirms all flips and posts a single batch chat card listing each reveal.

### Theme behavior

Reveal Control popovers are house-styled chrome. The actor name in the header is rendered in `var(--gs-brand)` (theme primary) — when fired for Rose, the name is in pink-wine; for Avril, candlelight gold. This is the same hybrid pattern as dashboard rows: house chrome with per-character accent on the identifying element.

For the multi-field bulk form, each row's actor name uses the actor's theme color via `.gs-themed[data-theme="..."]` wrappers per row. Same wrapper mechanism used everywhere else.

## NPC Quick-Create modal

CSS class root: `.gs-npc-quick-create`

Triggered by right-clicking empty canvas → "Create NPC here" in the context menu. Opens a tiny modal with three fields. On confirm, drops an NPC token at the click point with sensible defaults.

### Dimensions

380px wide. Height auto.

### Layout

```
┌──────────────────────────────────────────┐
│  [GM]  CREATE NPC HERE                     │
│  drop at click point on Cashmere Castle...│
├──────────────────────────────────────────┤
│  NAME                                       │
│  [text input]                               │
│                                              │
│  ROLE                                       │
│  [dropdown ▾]                               │
│                                              │
│  PORTRAIT (optional)                        │
│  [use generic placeholder]   [browse]       │
├──────────────────────────────────────────┤
│  creates a token + actor                    │
│                       [cancel]  [drop NPC ↗]│
└──────────────────────────────────────────┘
```

### Header

- Padding: 14px 20px.
- 0.5px bottom border in `var(--gs-accent-2)`.
- GM pill + "CREATE NPC HERE" eyebrow.
- Below the eyebrow: italic "drop at click point on {scene name} · {scene region label if any}". Confirms the drop location so the GM knows where the token will land.

### Body

Three fields stacked vertically with 12px gap.

#### Name

A plain text input. Required. Placeholder shows a sensible example based on the role (e.g. "An Innkeeper", "Madame Lacroix", "A Footman").

If left blank when "drop NPC" is clicked, the system uses the role label as the name (e.g. "Anonymous gentleman" creates an NPC named "Anonymous gentleman").

#### Role

A dropdown of preset roles plus a "Custom..." option. Presets cover the common ambient cast:
- Innkeeper
- Tavern keeper
- Footman
- Maid
- Stable hand
- Coachman
- Anonymous gentleman
- Anonymous lady
- Vendor / Tradesperson
- Servant
- Guard
- Custom...

Selecting Custom turns the dropdown into a text input where the GM types the role.

The role is used for two things: (1) the NPC's `bio.role` field, and (2) the placeholder portrait selection (see Portrait below).

#### Portrait (optional)

A small picker with two states:
- "use generic placeholder" — the system selects a role-appropriate generic placeholder image from the `assets/portraits/generic/` folder. Default state.
- "[browse]" — opens Foundry's file picker to select a specific portrait. Sets `bio.portraitUrl` on the new NPC.

The generic placeholder approach means a quick-create NPC has *some* portrait without the GM having to pick one. The placeholder is a tasteful silhouette (an oval with a generic profile shape), themed to the role where possible (a chef's hat for tavern keeper, etc. — but if generic-portrait assets aren't available, all NPCs use a single neutral silhouette).

### Footer

- Padding: 12px 20px.
- Background: `var(--gs-paper-warm)`.
- Left: italic helper text "creates a token + actor".
- Right: cancel + "drop NPC ↗" primary button.

### On confirm

1. A new NPC actor is created with the form values + sensible defaults (no description, empty hover summary, empty public tags — the GM can fill these later via the NPC sheet).
2. A token is dropped at the original right-click coordinates on the canvas, linked to the new actor.
3. The modal closes.
4. A small toast appears in the bottom-right: "Created {NPC name} at click point. [Open sheet]"

The toast's "Open sheet" affordance lets the GM immediately edit the new NPC's full sheet if they want to flesh it out beyond the quick-create defaults.

### Theme behavior

Pure house style. NPCs don't have themes; the modal that creates them follows suit.

## NPC Organizer per scene

CSS class root: `.gs-npc-organizer`

Persistent sidebar panel listing all Connection and NPC tokens currently placed on the active scene. Per-scene — switches content when the GM activates a different scene.

Different from the My Characters Dock (`09-my-characters-dock.md`):
- **Dock** = user's owned actors (always there regardless of scene).
- **Organizer** = scene-placed tokens of NPC + Connection actors (changes with active scene).

Both can be open simultaneously; they don't overlap in purpose.

### Dimensions

290px wide (matches the dock's width for visual consistency when both are pinned).
Height auto, max-height ~80vh.

Like the dock, draggable but not resizable. Position persisted to user settings (separate setting from dock — `organizerPosition`).

### Visibility

GM-only by default. A user setting (`organizerPlayerVisible`, default false) lets the GM grant view access to players. The default is GM-only because most placement decisions are GM-side.

### Layout

```
┌──────────────────────────────────┐
│ [GM]  SCENE TOKENS         5     │ ← header
│ Cashmere Castle · ballroom        │
├──────────────────────────────────┤
│ CONNECTIONS · 3                   │
│ ┌─[H]─ Mr. Hats McHats ────────┐  │
│ ┌─[L]─ Miss Lavinia Fernvale──┐  │
│ ┌─[L]─ Lady Mystery ──────────┐  │
│                                    │
│ NPCs · 2                          │
│ ┌─[L]─ Madame Lacroix ────────┐  │
│ ┌─[I]─ An Innkeeper ──────────┐  │
├──────────────────────────────────┤
│ click to focus · right-click ...  │ ← footer
└──────────────────────────────────┘
```

### Header

- Background: `var(--gs-paper)`.
- Padding: 12px 16px.
- 0.5px bottom border in `var(--gs-accent-2)`.
- Top row: GM pill + "SCENE TOKENS" eyebrow on the left, italic count on the right.
- Below: italic 10px scene name + region label. The scene name comes from `canvas.scene.name`. If the scene has tagged regions (a "ballroom" region within "Cashmere Castle"), the active region is shown.

### Body

Padding: 12px 14px.

Two sections:

- **Connections** section: small caps eyebrow with count. Below, list of rows, one per Connection token on the scene.
- **NPCs** section: small caps eyebrow with count. Below, list of rows, one per NPC token on the scene.

Sections are separated by 12px vertical margin. If either section is empty, it doesn't render (no empty placeholder).

### Row

Compact — narrower than the dock's connection rows because the organizer is lighter-touch.

```
┌─[P]─ Name ────────────────────┐
```

- Layout: `display: grid; grid-template-columns: 24px 1fr; gap: 8px; padding: 6px 10px; border-radius: 5px; cursor: pointer;`.
- Background: `var(--gs-paper-warm)`.
- 2.5px left-edge accent stripe in the actor's `--gs-brand` (theme color via `.gs-themed` wrapper).
- Portrait: 22×26px oval, theme palette, initial fallback in display type 11px.
- Name: display type 11px, theme `--gs-brand`. Truncates with ellipsis if too long.

### Click behavior

- **Click** a row → focus the canvas camera on the corresponding token.
- **Hover** a row → the corresponding token on the canvas highlights briefly (a 1px golden outline pulses for ~600ms — `var(--gs-accent-3)`).
- **Right-click** a row → opens a small context menu with quick actions:
  - Open sheet
  - Switch persona (if the actor has multiple personas)
  - Move to here (drag the camera position; click confirms a new placement)
  - Remove from scene (deletes the token, with confirm; doesn't delete the actor)
- **Double-click** a row → opens the actor sheet (alternative to right-click → Open sheet, faster).

### Footer

- Padding: 8px 14px.
- Background: `var(--gs-paper-warm)`.
- 0.5px top border.
- Italic 10px center-aligned helper: "click to focus · right-click for actions".

### Real-time updates

The Organizer subscribes to:
- `createToken` — adds a row when a new Connection or NPC token is placed.
- `deleteToken` — removes a row.
- `updateToken` — re-renders a row if the underlying actor's persona/theme changed.
- `canvasReady` — full reload when the active scene changes.

Filters to actor types `connection` and `npc` only. Major character tokens belong on the dashboard, not the organizer.

### Theme behavior

Sidebar chrome is house-styled. Each row uses cross-theme rendering — `.gs-themed[data-theme="..."]` wrapping per row, picking up the actor's character/connection theme. Same hybrid pattern as the dashboard and dock.

NPC rows render with house-style accents (sage stripe), since NPCs use the `npc` theme that inherits house. This is the visual signal that an NPC vs a Connection is on the scene.

## Edge cases

### Reveal Control fired for a field that's already at the target state
The popover doesn't open. A toast appears: "Lady Rose's desire is already public." No-op.

### NPC Quick-Create when the canvas isn't on a scene
The right-click context menu doesn't show "Create NPC here" — the action is gated by `canvas.scene` being non-null. If the GM tries to create an NPC from outside a scene context, fall back to opening the regular NPC creation flow (Foundry default actors directory).

### NPC Organizer when no tokens are placed
The body shows a single italic placeholder: "No Connection or NPC tokens on this scene yet. Right-click empty canvas to create one." No section headers.

### NPC Organizer scene without tagged regions
The header's region label is omitted; just the scene name. Layout adjusts naturally.

### Multiple right-clicks in NPC Quick-Create
If the GM right-clicks elsewhere mid-modal, the context menu re-opens but the NPC Quick-Create modal stays at its first-click coordinates. The GM closes the modal first if they want a different drop point.

### Reveal Control on a redacted field flipping back to public
This is a less common path. The text in the consequence card adjusts: "This will replace the redaction with the field's actual value, visible to all players."

### Canvas camera focus conflicts with player view
The Organizer's "click to focus" only moves the GM's camera (`canvas.scene.view()`). It doesn't pan players' views — that would be intrusive. A separate "share view" affordance could exist for syncing player cameras, but defer to v1.1.

## Implementation notes for Claude Code

### Reveal Control

1. Build a generic `RevealControlPopover` `ApplicationV2` that takes `{actor, field}` (single-field form) or `{actors, fields}` (bulk form) as constructor args.
2. Render the appropriate template based on form mode.
3. Wire from the Major sheet's visibility flag indicators (single-field) and from the Public Info Dashboard's "reveal desires" GM bulk action (bulk form).
4. Test all three flip paths (secret↔public↔redacted) with appropriate consequence text.
5. Verify chat card posts on confirm.

### NPC Quick-Create

1. Build a small `NpcQuickCreate` `ApplicationV2` triggered by a right-click context menu entry on the canvas.
2. Use Foundry's default `getSceneControlButtons` and `getCanvasContextMenu` hook to register the action.
3. The form's "drop NPC" handler creates the actor (using NPC schema defaults) and the token at the captured click coordinates.
4. Show the toast confirmation with the "Open sheet" affordance.

### NPC Organizer

1. Build the `NpcOrganizer` as an `Application` (not v2 — it's a sidebar, not a primary surface; lighter is fine).
2. Subscribe to the four canvas/token hooks for real-time updates.
3. Wire the click and right-click actions. Use Foundry's `canvas.animatePan` for camera focus.
4. Implement the row partial as cross-theme-rendered (`.gs-themed` wrapper per row).
5. Add the scene control button to toggle organizer visibility.

CSS organization:
- `styles/apps/_reveal-control.css` — single-field and bulk popover styling
- `styles/apps/_npc-quick-create.css` — small modal styling
- `styles/apps/_npc-organizer.css` — sidebar panel styling
- Reuse: `_gm-pill.css` (the GM pill, used in all three plus the NPC sheet — extract as a primitive)

### Test path (combined)

1. **Reveal Control**: From Lady Rose's Private tab, click the visibility indicator next to her desire field. Verify popover opens themed correctly (Rose's name in her brand color). Confirm flip secret→public. Verify desire becomes public, chat card posts, dashboard updates.
2. **NPC Quick-Create**: Right-click an empty space on the ballroom scene. Click "Create NPC here". Fill name "An Innkeeper", select role "Innkeeper" from the dropdown, leave portrait as generic placeholder. Drop. Verify the NPC token appears at the click coordinates, the actor is created, the toast shows.
3. **NPC Organizer**: Open the sidebar from the scene controls. Verify it shows the placed Connection and NPC tokens. Click "An Innkeeper" — verify the camera focuses on that token. Right-click → Remove from scene. Confirm. Verify the token disappears from canvas and from the organizer.
4. **Multi-field reveal**: From the Public Info Dashboard, click "reveal desires" GM bulk action. Verify the bulk Reveal Control opens with the four secret-desire majors checked, Avril unchecked (already public). Confirm. Verify all four desires flip to public, dashboard updates, batch chat card posts.

If 1–4 pass, the GM tools batch is production-ready.

## Open questions

1. **Should the Reveal Control include an undo affordance for accidental reveals?** **Tentative answer: no.** The "irreversible feel" tag in the popover is the design choice. If a GM truly needs to undo, they manually flip back via the popover again — but this requires deliberate intent.

2. **Should NPC Quick-Create have a "make persistent" option for ad-hoc NPCs?** I.e. drop the NPC for this scene only, deleted at scene-end. **Tentative answer: no for v1.** All NPCs are persistent by default; the "remove from scene" action handles cleanup.

3. **Should NPC Organizer support drag-to-reorder?** Reordering tokens visually, e.g. by importance. **Tentative answer: no.** The token-on-scene order is determined by canvas layering, not by sidebar order.

4. **Should NPC Organizer show distance from a "focal" token (e.g. the GM's selected token)?** Useful in scenes with positioning. **Tentative answer: defer to v1.1.** Out of scope for the basic GM tools batch.

5. **Should Reveal Control bulk form support cross-actor reveals (different fields on different actors at once)?** Currently restricted to one field type across all actors. **Tentative answer: no for v1.** The dashboard's bulk actions are field-scoped (reveal desires, reveal backstories) — keeping it that way is simpler.

6. **Should NPC Quick-Create remember the last role used and pre-select it?** Useful for chaining ("I need three more footmen"). **Tentative answer: yes**, default to last-used role within a session.

7. **Should NPC Organizer show "offline" state for tokens whose actors have been deleted but tokens remain (orphans)?** Edge case — the linked actor was removed but the token persists. **Tentative answer: yes**, show with reduced opacity and a small italic "(orphan)" note. Right-click → "Promote to NPC" to re-create an actor.

## Visual proof

Three GM tool surfaces are rendered above (`good_society_gm_tools_batch_three_surfaces`):

1. **Reveal Control popover** themed for Lady Rose, single-field confirm flipping desire from secret to public. Shows the field/current/target grid, the consequence-warning card, and the "(irreversible feel)" emotional tag.
2. **NPC Quick-Create modal** with name input, role dropdown, optional portrait picker, and the "creates a token + actor" footer note.
3. **NPC Organizer sidebar** for the Cashmere Castle ballroom scene, showing three Connections (Hats green, Lavinia yellow, Lady Mystery purple) and two NPCs (Madame Lacroix, An Innkeeper) with cross-theme rendering on the rows.

All three demonstrate the shared GM-tool conventions: house chrome, GM pill in headers, utility tone, cross-theme accents on actor-identifying elements.

## Changelog

| Date       | Change                                                                |
|------------|-----------------------------------------------------------------------|
| 2026-05-05 | File created. Three GM tool surfaces specified together: Reveal Control (single-field popover and multi-field bulk form), NPC Quick-Create (right-click canvas modal), NPC Organizer (per-scene sidebar). Shared conventions documented. Visual proof rendered for all three. |
