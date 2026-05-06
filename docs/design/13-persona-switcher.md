# 13 — Persona Switcher UI

**Status:** Locked — three contexts specified (in-sheet picker, switcher popover, full editor); cross-actor-type behavior specified
**Date opened:** 2026-05-05
**Covers inventory entry:** #56 Persona Switcher

## Goal

Specify the visual surface for persona management. CLAUDE.md §11 (locked decision #8) makes personas first-class: every Major (and optionally Connection/NPC) has a list of personas with their own portraits, token images, names, and visibility overrides. The persona-swap *logic* is documented in CLAUDE.md §11; this doc covers the UI for adding, editing, and switching between them.

The persona system is one of Good Society's distinguishing features: Avril is "The Maid" in society and "The Black Hound" in the assassin's guild. Dixon is publicly anti-magic and secretly a magic user. Princess Adora is "Korra the Hawk" when out of court. The UI has to make these moments feel weighty — switching personas is dramatic, not administrative — while staying compact enough to live inside an actor sheet.

## Three contexts

The persona switcher surfaces in three places, each at a different scale:

| Context | Where | Function |
|---------|-------|----------|
| **In-sheet picker** (closed) | Major sheet header side panel; Connection sheet State row; NPC sheet (optional) | Shows current active persona inline. Click to open the switcher popover. |
| **Switcher popover** (open) | Floats from the in-sheet picker | Lists all personas with active/primary indicators. Click to switch. "+ New persona" opens the editor. |
| **Persona editor modal** | Full screen modal | Add/edit a persona's full data: name, portraits, token, hover summary, public tags, chat color override, per-persona visibility overrides. |

These three states form a progressive disclosure pattern — you see the active persona at all times, you can swap with one popover click, and you can edit details with a deeper modal flow.

## In-sheet picker spec (closed state)

CSS class root: `.gs-persona-picker`

Lives in:
- **Major sheet header side panel** — bottom of the side panel, below the bio chips (per `04-character-sheet.md`).
- **Connection sheet State block** — right column of the State row alongside the resolve track (per `06-connection-sheet.md`).
- **NPC sheet** — optional; if the NPC has personas, similar position to Connection's.

### Layout (side-panel context, Major sheet)

```
┌───────────────┐
│ [portrait]    │
│   age 22      │
│   heir        │
│   House W     │
│ ───────────── │
│ PERSONA       │
│ The Maid ▾    │
└───────────────┘
```

The picker sits beneath the bio chips, separated by a 0.5px hairline rule.

- **Eyebrow**: "PERSONA" in 10px small caps, letter-spacing 0.16em, color `var(--gs-brand)` (theme-driven). Centered or left-aligned per the sheet's convention.
- **Trigger**: italic display type, 13–14px, `var(--gs-brand)`, with a small ▾ glyph trailing. Format: "{persona name} ▾".

If the actor has only one persona (the implicit primary), the picker can render as a non-interactive label: "The Maid · primary". Or it can still be clickable — opening the popover then offers "+ New persona" as the only meaningful action. **Locked: always interactive**, even for single-persona actors. Players need a discoverable path to add second personas.

### Layout (state-block context, Connection sheet)

In the Connection sheet's State block, the picker sits alongside the resolve track in a two-column layout. The eyebrow is the same; the trigger sits in a small inline pill rather than as plain inline text:

```
┌────────────────────────────┐
│ PERSONAS         [+ add]   │
│ ┌─[H]─ Hats McHats ─primary│
│ └────────────────────────┘ │
└────────────────────────────┘
```

For Connections with only one persona, the pill renders as the active persona with no dropdown affordance. The "+ add" action is on the section header.

### Why the split

The Major sheet's side panel is a vertical, identity-forward column — the picker is a meaningful inline element in the character's "who am I" zone. The Connection sheet's State block is a more administrative footer-style row — the picker is a smaller utility. Same data, different visual weight.

## Switcher popover spec (open state)

CSS class root: `.gs-persona-switcher-popover`

Opens when the in-sheet picker is clicked. A small floating panel anchored to the picker.

Width: 280–320px depending on context. Height auto.

### Layout

```
┌───────────────────────────────────┐
│ PERSONAS · OPEN     2 identities  │ ← header
├───────────────────────────────────┤
│ ┌─[A]─ The Maid ──── ACTIVE ┐    │
│ │     primary · active        │    │
│ └────────────────────────────┘    │
│ ┌─[A]─ The Black Hound ─────┐     │
│ │     secret · magic hidden  │    │
│ │                  switch ↗  │    │
│ └────────────────────────────┘    │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─    │
│ ⊕  new persona                    │
└───────────────────────────────────┘
```

### Header

- Background: `var(--gs-paper)` (theme).
- Padding: 12px 16px.
- 0.5px bottom border in `var(--gs-accent-2)`.
- Two-span row: "PERSONAS · OPEN" eyebrow on the left (10px small caps, letter-spacing 0.18em, `var(--gs-brand)`); italic count on the right ("{N} identities").

### Persona list

Each persona renders as a row card. Layout: `display: grid; grid-template-columns: 36px 1fr auto; gap: 10px; padding: 10px 12px; align-items: center; border-radius: 6px; cursor: pointer;`.

- Background: `var(--gs-paper-warm)`.
- 2.5px left-edge accent stripe.
- Margin-bottom: 4px between rows.

#### Stripe color

The accent stripe color encodes the persona's character:
- **Primary persona** (the canonical identity): `var(--gs-brand)` (theme primary).
- **Secret personas** (any visibility override is `secret`): `var(--gs-danger)` (oxblood — signals "this identity is dangerous").
- **Other personas** (additional public-known identities): `var(--gs-accent-3)` (honey/gold).

The visual cue tells the player at a glance which identities are safe to reveal and which are not.

#### Row content

- **Portrait** (32×38px oval): the persona's `portraitUrl` if set; otherwise the initial in display type 16px. The portrait reflects the persona, not the actor — Avril's Maid persona has one portrait, her Black Hound persona has another.
- **Name + subtitle stack**:
  - Top: persona name in display type 14px, `var(--gs-brand)` (or for secret personas, `var(--gs-danger)`).
  - Bottom: italic 10px, `var(--gs-accent-2)`. Format depends on state:
    - Primary, active: "primary · active"
    - Primary, not active: "primary"
    - Secret: "secret · {what's hidden}" e.g. "secret · magic hidden"
    - Other: empty or hover-summary excerpt
- **Right cluster**:
  - Active persona: small "ACTIVE" badge (filled `var(--gs-brand)` with paper text, 9px small caps, padding 2×6px, border-radius 3px).
  - Inactive persona: italic "switch ↗" link, 10px, `var(--gs-accent-2)`. Click to switch.

#### Click behavior

- Click anywhere on an inactive persona row → triggers the persona-swap pipeline (CLAUDE.md §11). The switcher popover closes; the sheet header updates; the persona switch announcement chat card posts (per `10-chat-cards.md`); placed tokens update across scenes.
- Click an active persona row → no-op (or opens the editor modal — see below).
- Right-click any row → opens a context menu: "Edit persona", "Duplicate", "Delete" (if not primary).
- Hover a row → row gets a subtle border emphasis (0.5px `var(--gs-brand)`).

### Add new persona

Below the persona list, separated by a 0.5px dashed rule:
- Layout: `display: flex; align-items: center; gap: 8px; padding: 8px 12px; cursor: pointer;`
- A 18×18px circle with a `+` glyph (in `var(--gs-accent-2)` outlined style).
- Italic 12px "new persona" label, `var(--gs-accent-2)`.
- Click → opens the persona editor modal in "create" mode.

### Closing

The popover closes on:
- Switching to a different persona.
- Clicking outside the popover.
- Pressing Escape.

It stays open if the player clicks "+ new persona" — the editor modal opens *over* the popover, and the popover is dismissed when the editor closes.

## Persona editor modal spec

CSS class root: `.gs-persona-editor`

Width: 480px. Height: auto.

The full-detail UI for adding or editing a persona. Themed to the parent actor.

### Layout

```
┌──────────────────────────────────────────────┐
│ PERSONA EDITOR · AVRIL ECLAIR    [PRIMARY]    │
│ The Black Hound                                │
├──────────────────────────────────────────────┤
│ PORTRAIT          TOKEN IMAGE                  │
│ [thumbnail.webp]  [token.webp]                 │
│                                                  │
│ TOKEN NAMEPLATE                                 │
│ [The Black Hound]                              │
│                                                  │
│ HOVER SUMMARY                                   │
│ [An anonymous figure in dark dress...]         │
│                                                  │
│ CHAT COLOR        PUBLIC TAGS                   │
│ [#8B2A2A]         [stranger] [+ add]            │
│                                                  │
│ VISIBILITY OVERRIDES · per-identity              │
│ [desire: inherit] [backstory: secret] [magic: secret]
├──────────────────────────────────────────────┤
│ [delete persona]      [cancel]   [save]        │
└──────────────────────────────────────────────┘
```

### Header

- Background: theme `var(--gs-paper)`.
- Padding: 16px 22px.
- 0.5px bottom border.
- Two-span row, justified:
  - Left stack: eyebrow "PERSONA EDITOR · {PARENT ACTOR NAME}" (10px small caps, letter-spacing 0.18em, `var(--gs-brand)`); persona name input below as a large display type field, 20px, `var(--gs-brand)` (or `var(--gs-danger)` for secret personas — color reflects the stripe).
  - Right: a "PRIMARY" toggle pill. Outlined when off; filled `var(--gs-brand)` with paper text when on. Click to set this persona as primary (un-setting whichever was primary before — only one can be primary).

### Body

Padding: 18px 22px. Display: `flex; flex-direction: column; gap: 14px`.

#### Portrait + Token Image (paired row)

Two-column grid. Each is a labeled file picker:
- Label: small caps 10px.
- Picker: `display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: var(--gs-paper-warm); border: 0.5px solid var(--gs-accent-2); border-radius: 4px;`
- Inside: a small preview circle (22×26 for portrait, 22×22 for token) showing the image (or initial fallback), filename in italic body type 11px.
- Click → opens Foundry's file picker to select an image.

#### Token Nameplate

A single-line text input. Body type 13px. The nameplate is what appears under the token on the canvas — for Avril's Black Hound persona, "The Black Hound" rather than "Avril Eclair."

#### Hover Summary

A small textarea (HTML-editor-lite — Foundry's editor helper or a plain textarea). Italic body type, 12px, line-height 1.55. The text shown when a player mouses over this persona's token on the canvas.

#### Chat Color (paired with Public Tags)

Two-column grid:

- **Chat Color**: a color swatch + hex input + "override" italic indicator. The color overrides the actor's `chatStyle.color` for in-character chat cards posted while this persona is active. If unset, the parent theme's `--gs-brand` is used. Click the swatch → opens a small color picker (Foundry has one built in).

- **Public Tags**: a chip-list of small public tags. Each tag is a removable pill (small × on hover). "[+ add]" link at the end. Tags are visible on the persona's hover card and in scene-info contexts.

#### Visibility Overrides

A row of three small cards, one per overridable visibility flag (desire, backstory, magic). Each card:
- Background: `var(--gs-paper-warm)`.
- Padding: 8px 10px.
- 0.5px border.
- Top: small caps label (e.g. "desire").
- Bottom: current value as italic text. Possible values: `inherit`, `secret`, `public`, `redacted`. Click to cycle.

The visibility overrides are the most consequential field. They let a persona override the parent actor's visibility on a per-identity basis. Avril's Maid persona inherits the default (probably "secret" for magic). Avril's Black Hound persona overrides magic to `secret` even if the actor's default is `public`. Dixon's Duke persona overrides magic to `secret` (he's hiding it); his secret-magic-user persona could override magic to `public` (in a private context where he's revealing himself).

The "inherit" value is the default — most personas just defer to the actor. Overrides are intentional.

### Footer

- Background: `var(--gs-paper-warm)`.
- Padding: 14px 22px.
- 0.5px top border.
- Display: `flex; justify-content: space-between; align-items: center`.
- Left: "delete persona" — destructive button, outlined in `var(--gs-danger)` with body type 12px in `var(--gs-danger)`. Disabled if this is the primary persona (you can't delete your only identity). Confirms before firing.
- Right cluster: "cancel" (secondary outline) + "save" (primary filled in `var(--gs-accent-3)` honey-gold for the editor's celebratory color, paper text).

### Editor modes

- **Create mode**: opens with all fields blank (or sensible defaults: name "New persona", primary off, all visibility "inherit", chat color blank). Save creates a new persona on the parent actor.
- **Edit mode**: opens with the selected persona's current values populated. Save updates the persona.

The header eyebrow distinguishes the two: "NEW PERSONA · {PARENT NAME}" vs "PERSONA EDITOR · {PARENT NAME}".

## Switching pipeline UI feedback

When the player clicks a persona to switch (from the popover), the system runs the persona-swap pipeline (CLAUDE.md §11). The UI feedback is layered:

1. **Immediate**: the popover closes. The in-sheet picker updates to show the new active persona's name. The sheet header's portrait updates to the new persona's portrait. (~100ms perceived).
2. **~200ms**: the persona switch announcement chat card posts (per `10-chat-cards.md`).
3. **~300ms** (if Sequencer is installed): a brief VFX fires on placed tokens — JB2A's misty-step or similar by default; per-skill VFX if the switch was triggered by an Alter Self magic-skill (per Plan §10).
4. **~400ms**: placed tokens update across all scenes (token image + nameplate update via `scene.updateEmbeddedDocuments`).
5. **~500ms**: the Public Info Dashboard, My Characters Dock, and any open chat speaker references re-render with the new persona.

The 100–500ms cascade gives the switch ceremony — fast enough to feel responsive, slow enough to feel like a moment.

If Sequencer isn't installed, the pipeline still fires; the VFX step is skipped silently.

## Personas across actor types

### Major Character

Personas are first-class. Most Majors will have at least 2: a primary and a secret/alternate. The picker is in the side panel. The full editor opens for any add/edit.

### Connection

Personas are optional. Most Connections won't use them; some will (the innkeeper who's secretly a spy). The picker lives in the State block. The editor is the same modal, themed to the connection.

### NPC

Personas are optional and rare. NPCs that need persona support are usually candidates for promotion to Connection. The picker only appears if the NPC has personas; the editor is the same.

The persona system is identical in data and UI across actor types — only the surface placement and frequency-of-use differ.

## Theme behavior

The persona picker, popover, and editor are all **themed to the parent actor**. They live within the actor's voice. This is intentional — opening the editor for one of Avril's personas should feel like working inside Avril's world (candlelight + crimson), not in a system box.

The persona-switch announcement chat card uses the *new* persona's theme (with optional `chatColor` override). See `10-chat-cards.md` for that card's spec.

## Edge cases

### Single persona (just primary)
The picker shows the primary persona. Clicking opens the popover with one persona row + "+ new persona" affordance. Switching is a no-op since there's only one option.

### Setting a different persona as primary
The previous primary loses its primary flag; the new one gains it. No data is lost — both personas continue to exist. Confirmation: "Make 'The Black Hound' the primary identity? This means {parent} appears as Black Hound by default."

### Deleting a persona
- Cannot delete the primary persona. The button is disabled with a tooltip: "Set another persona as primary first."
- Deleting a non-primary persona prompts confirm: "Delete 'The Black Hound'? This removes the persona but keeps any chat history attributed to it."
- After delete, if the deleted persona was active, the actor reverts to primary.

### Persona-switch chains
If a magic-skill triggers a persona swap (Alter Self per Plan §10) and that target persona is itself in a chain, no infinite loops — switching to a persona that has its own `triggersPersonaSwap` doesn't auto-fire it. Triggers only happen at cast time.

### Chat color collides with theme brand
The override is stored as a hex color. If a player picks a color that clashes badly with the theme palette, the in-character chat card will look off. **Tentative answer: don't validate** — let players make aesthetic mistakes, they can change it.

### Visibility override of "inherit" with parent flag changing
If the parent actor's `visibility.magic` changes from "public" to "secret", any persona with magic = "inherit" automatically follows. Personas with explicit overrides hold their value.

### Persona has no portrait
Falls back to the parent actor's portrait, then to the actor initial. Same fallback as the sheet header rule.

## Implementation notes for Claude Code

When prompted to build the persona switcher, the recommended order:

1. Build the in-sheet picker (closed state) on the Major sheet header. Hard-code the active persona for now to verify rendering.
2. Build the switcher popover. Wire it to open on picker click. Render two hard-coded personas to validate the row card design.
3. Wire the persona-swap pipeline (CLAUDE.md §11) to the popover's switch action. Verify the immediate sheet update and the chat card.
4. Build the persona editor modal in create mode. Verify a new persona can be added, saved, and appears in the popover.
5. Add edit mode to the modal. Verify clicking an existing persona's row context-menu "Edit" opens the modal pre-populated.
6. Wire visibility overrides. Verify inherit/secret/public/redacted cycling.
7. Wire delete. Verify primary protection.
8. Apply the same picker pattern to the Connection sheet State block (smaller variant).

CSS organization:
- `styles/components/_persona-picker.css` — the in-sheet picker (closed)
- `styles/components/_persona-switcher-popover.css` — the open list popover
- `styles/apps/_persona-editor.css` — the modal editor

### Test path

1. Open Avril's sheet. Verify the persona picker shows "The Maid".
2. Click the picker. Verify the popover opens listing The Maid (active) and The Black Hound (secret).
3. Click The Black Hound. Verify the swap pipeline fires: sheet header updates, persona switch chat card posts (themed to Black Hound), token image updates on canvas if a token is placed.
4. Open the popover again. Right-click The Black Hound → Edit. Verify the editor modal opens populated with Black Hound's data.
5. Change a visibility override to "redacted". Save. Verify the persona's data is updated.
6. Click "+ new persona" from the popover. Verify the editor opens in create mode. Save with a name. Verify the new persona appears in the list.
7. Try to delete the primary persona. Verify the delete button is disabled.
8. Set a non-primary persona as primary. Try to delete the previously-primary one. Verify it works.

If 1–8 pass, the persona switcher is production-ready.

## Open questions

1. **Should the picker show portrait or just text in the side panel?** Adding a small portrait dot beside the name would make the closed picker more identifiable but adds visual weight. **Tentative answer: text only in the closed state.** The portrait is on the sheet header itself; the picker is a "current label", not a thumbnail.

2. **Should switching personas require a confirm for the player's first switch?** First-time educational moment vs. friction. **Tentative answer: no confirm by default.** Switching is the point. If a player wants to revert, they can switch back.

3. **Should secret personas appear in the popover for non-owner viewers?** GMs should see all personas; players viewing another player's sheet shouldn't see the other player's secret personas. **Tentative answer: hide secret personas from non-owners and non-GMs.** Visibility logic mirrors per-field visibility rules.

4. **Should the editor allow per-persona resolve track override?** A persona could conceivably "have" different resolve. **Tentative answer: no.** Resolve is the actor's, not the persona's. Personas are identity, not separate characters.

5. **Should the editor allow per-persona description/backstory override?** Could let Avril have a different backstory as Black Hound vs. as Maid. **Tentative answer: no for v1.** Adds complexity for marginal gain. The visibility override (showing/hiding the actor's backstory based on persona) is the meaningful control.

6. **Should there be a "default persona for this scene" feature?** Per Plan §11.3 Option A — a scene flag setting the default persona for an actor. **Tentative answer: defer to v1.1.** Manual switching is the v1 mechanic; auto-switching adds complexity.

7. **Should personas have icons (a small glyph distinguishing primary vs. secret vs. other)?** **Tentative answer: yes, but understated.** Primary gets no icon; secret gets a small `🔒` glyph; other gets nothing. Discreet enough to scan, restrained enough to fit the antique-but-clean principle.

## Visual proof

Three persona switcher states in Avril's theme are rendered above (`good_society_persona_switcher_avril`):

1. **Closed in-sheet picker** — the side-panel snippet showing portrait, name, role, hairline, "PERSONA · The Maid ▾".
2. **Open switcher popover** — the floating panel with two persona rows (The Maid as active+primary, The Black Hound with secret stripe) and the "+ new persona" affordance.
3. **Persona editor modal** — full editor for The Black Hound with portrait + token image, nameplate, hover summary, chat color override, public tags, three visibility override cards, and footer with delete + cancel + save.

Validates: progressive disclosure pattern, secret persona distinction (oxblood stripe and color), visibility override surface, theme adherence in all three states.

## Changelog

| Date       | Change                                                                |
|------------|-----------------------------------------------------------------------|
| 2026-05-05 | File created. Three-context persona switcher specified (in-sheet picker, switcher popover, full editor). Cross-actor-type behavior, switching pipeline UI feedback timing, and seven open questions all documented. Visual proof rendered with Avril's two-persona case (Maid + Black Hound). |
