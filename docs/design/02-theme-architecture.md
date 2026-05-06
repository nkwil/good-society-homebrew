# 02 — Theme Architecture

**Status:** Locked — open questions resolved 2026-05-05; implementation details delegated to per-component design docs
**Date opened:** 2026-05-05
**Date locked:** 2026-05-05

## Summary

The Good Society Foundry system uses a two-layer theming model:

1. A **house style** that owns the system's chrome and any shared/unthemed surface.
2. **Character themes** that scope to a single actor and apply to that actor's sheet, the letters they author, their entries on shared boards, and rumours they originate.

This document explains the why, the scope boundaries, and the implementation approach.

## Why two layers (and not one, and not three)

**One unified theme** is the conventional Foundry approach. It's simpler. It also flattens the central conceit of Good Society — that the major characters are *not a party*, they're distinct social entities with conflicting interests, private information, and individual stories. The mechanics already encode this distinction (private sheets, monologue tokens compelling a specific character to reveal interiority, letters with named senders and recipients). A flat theme works against the mechanics rather than with them.

**Three or more layers** (e.g. house + family/house-of-origin + character) would over-engineer the problem. House Willowood and House Cloudcandle don't need their own visual identities — the *characters within them* do, and characters can express their family identity through accent choices within their personal theme rather than inheriting a separate layer.

Two layers gives us: the world feels coherent, the characters feel distinct, and the mechanics of "this letter is from that person" or "this rumour was started by this character" can be expressed visually without writing custom UI per case.

## Scope boundaries — what is house, what is character

Use this table to resolve any ambiguity during component design:

| Surface                                    | Theme               | Notes                                                        |
|--------------------------------------------|---------------------|--------------------------------------------------------------|
| Module window chrome (titlebars, borders)  | House               | Foundry application frame                                    |
| GM/Facilitator dialogs and tools           | House               | Phase progression, cycle management, narrative prompts       |
| Phase tracker (Novel Chapter → Upkeep)     | House               | Shared cycle state                                           |
| Shared Reputation board (the "public sheet")| House (mostly)     | Each character's *entry* on the board uses their theme accent (e.g. tag pill colors, name color). Board chrome stays house. |
| Rumour & Scandal board                     | House               | Individual rumours may carry a small accent of the originator's theme |
| Character sheet (entire body)              | Character           | Sheet titlebar inherits house chrome; everything inside the sheet body adopts the character's theme |
| Letter UI (Epistolary)                     | Sender's character  | The letter card uses the sender's full theme. Recipient information uses house-style chrome around it |
| Inner Monologue popup                      | Speaker's character | When a character is compelled to monologue, the popup adopts their theme |
| Resolve / Monologue token UI               | House               | Tokens are universal currency, not character-specific        |
| Inner Conflict table on sheet              | Character           | Lives inside the sheet, inherits character theme             |
| Reputation tags on the public board        | Character (accent)  | Tag pill background stays neutral; accent stripe and text color use character theme |
| Chat messages (system-emitted)             | House               | Mechanical chat output (token spends, phase changes)         |
| Chat messages (in-character lines)         | Speaker's character | When a player speaks in character, the message bubble carries their theme |

## Implementation approach

### CSS variable scoping

The house style sets root-level CSS custom properties:

```css
:root {
  --gs-paper:    #EFE6D2;
  --gs-ink:      #3D2F26;
  --gs-brand:    #2A3A2D;
  /* ... full house palette in decisions.md ... */
}
```

Character themes override under a per-actor selector. The selector pattern:

```css
.gs-actor[data-theme="candlelight"] {
  --gs-paper:    #16100E;
  --gs-ink:      #E8DDC8;
  /* ... full character palette ... */
}
```

Any descendant that uses the variables (e.g. `background: var(--gs-paper)`) automatically resolves to the nearest scope. Foundry sheets attach the `.gs-actor` class and the `data-theme` attribute on the sheet root, so everything inside inherits cleanly.

### Where theming gets applied dynamically

For surfaces that aren't bound to a single actor (chat messages, letter cards in a journal, tag pills on the shared board), the theme has to travel with the *content*, not the surface. Approach:

1. The data carries a reference to the speaker/sender/originator actor ID.
2. At render time, the rendered element gets a wrapper div with `class="gs-themed"` and `data-theme="<theme-id>"`, where `<theme-id>` is read from the actor's theme setting.
3. CSS variables resolve inside that wrapper.

This means letter cards, themed chat messages, and themed board entries all use the same primitive — a `gs-themed` wrapper that locally rebinds the palette — without per-component theme logic.

### Theme assignment at the actor level

A new field on the actor schema:

```js
// system.json schema fragment, illustrative
{
  "data": {
    "theme": "cashmere"  // one of: cashmere, candlelight, inkwell-character, atelier, ...
  }
}
```

A theme picker control on the character sheet allows the player to change it. The system ships with a registry of preset themes loaded at init; the registry is extensible so we (or eventually players) can add custom themes via a module-level setting or a JSON file.

Schema specifics will be finalized in the system planning track (`docs/system/`) — this document only states the requirement that actors carry a theme reference.

### Font loading

Each preset declares display and body font families. The system loads font files for all registered themes at init time using `@fontsource` packages bundled with the system, or referenced via CDN. Fallback stacks ensure missing fonts degrade gracefully (Cormorant Garamond → Georgia → serif).

### Foundry-specific notes

- **CSS scoping in Foundry sheet apps:** Foundry's `Application` framework gives each sheet its own root element. Scope theme variables to that root via a class on the sheet's container (configured in the Application class). Avoid `:root` overrides from sheets — those leak globally.
- **Chat message theming:** Chat messages are rendered into a shared log. Wrapping each in a `gs-themed` div with the speaker's theme works, but ensure the message template doesn't apply background colors to the outer message container (the wrapper handles that).
- **Journal entries for letters:** If letters live in journal entries, embed each with a `gs-themed` wrapper. If letters live as their own document type, they carry their own theme reference natively.

## Open questions — resolutions

### Open Question 1 — Inkwell-character variant — RESOLVED

**Resolution:** Not needed. The locked theme registry (see `decisions.md`) has six bespoke major character themes (`rose`, `roger`, `mags`, `avril`, `dixon`, `clayton`) and five connection variants — none of which use the unmodified Inkwell palette. The only theme that inherits the house style is `npc`, and that's intentional: NPCs are world citizens whose visual identity *is* the world.

If a future major character genuinely wants painterly-storybook warmth, design a new variant at that point.

### Open Question 2 — Pearlinda-archetype theme — DEFERRED

**Resolution:** Pearlinda is not in the current locked theme registry. When/if she returns to active play, design a dedicated theme (working name: `pearlinda` or `confetti`) at that point. Possible direction: high-saturation palette (hot pink, periwinkle, chrome silver), playful display type with curves, tasteful sparkle/star accents, letters that look like passed notes rather than formal correspondence. Keep the brief on file but don't build until needed.

### Open Question 3 — Theme transitions — RESOLVED

**Resolution:** Yes, lightly. The `.gs-themed[data-theme="..."]` wrapper carries a 0.5px accent border in `--gs-accent-1` (or `--gs-brand` at low opacity). This provides a soft envelope between house chrome and character-themed content without looking heavy-handed. Specifics locked when the chat-card and letter-card components reach detailed design (see `13-chat-cards.md`, `05-epistolary-ui.md`).

### Open Question 4 — Color contrast / accessibility — DEFERRED TO IMPLEMENTATION

**Resolution:** Audit each theme's body-text-on-paper contrast against WCAG AA (4.5:1) during the first component implementation pass. The `mags` and `avril` dark-paper themes are highest risk. If any combination fails, prefer adjusting the theme over excusing it — the antique-but-clean principle (see `decisions.md`) explicitly requires both period feel *and* legibility.

If a theme combination cannot be saved without breaking its identity, document the exception and ship a per-user "high-contrast mode" toggle that overrides the failing tokens.

## Component scope reference

For the per-component theme scope assignment (which components are house-styled, which are character-themed, which are hybrid), see `03-component-inventory.md`. That document is the authoritative mapping; the table earlier in this file is a categorical summary, not a per-component spec.

## Implementation order (recommended)

When this document feeds into actual code work in Claude Code:

1. House style CSS variables → `styles/_variables.css` and `styles/_house.scss`
2. House style fonts loaded → `system.json` declares font assets, base SCSS imports `@fontsource` packages
3. One core component built and styled in house style only → suggested: card primitive
4. Theme wrapper mechanism (`.gs-themed[data-theme=...]`) → tested by themeing a single card
5. First character preset implemented as full overrides → suggested: `cashmere` (least adventurous, validates the override pipeline)
6. Resolve Open Questions 1 and 2 → design Pearlinda preset and Inkwell-character variant
7. Remaining presets implemented
8. Letter UI built using the wrapper mechanism → first real test of per-sender theming
9. Reputation board → first real test of mixed-theme shared surface

## Files that depend on locking this document

- `03-component-library.md` (next file) — needs the wrapper mechanism specified
- `04-character-sheet.md` — needs to know what's house chrome vs character body
- `05-epistolary-ui.md` — needs to know how sender theme is carried
- `06-reputation-board.md` — needs to know how mixed-theme entries render

## Changelog

| Date       | Change                                                                          |
|------------|---------------------------------------------------------------------------------|
| 2026-05-05 | File created. Two-layer architecture, scope boundaries, and implementation outlined. Open questions captured. |
| 2026-05-05 | Status moved to Locked. All four open questions resolved or deferred to implementation. Component scope reference added pointing to `03-component-inventory.md`. |
