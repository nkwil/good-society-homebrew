# Design Decisions — Locked

This is the authoritative record of design choices that have been locked in for the Good Society Foundry system. Sections marked `Pending` are not yet decided. Sections marked `Locked` should not be changed without an explicit revisit and a new entry in the Changelog at the bottom.

When implementing, treat the Locked values as the source of truth. If you find yourself wanting to deviate, open a new exploration document under `docs/design/` and update this file once the new choice is locked.

---

## Design principle — antique but clean and legible

**Status:** Locked — 2026-05-05

This is the top-level design rule that every theme, every component, and every visual decision in the system must honor. It reconciles a tension that period-styled UIs normally resolve poorly:

> The system should look antique — period-correct typography, parchment surfaces, calligraphic ornament, restrained palettes drawn from Regency / early-Victorian print culture. It should also be cleanly legible at modern accessibility standards — generous whitespace, hairline rules, strong text contrast, no decorative texture that interferes with reading.

Concretely, this principle resolves to the following implementation rules:

1. **Generous whitespace.** Padding inside cards is at least 18–24px on the small axis. Sections are separated by whitespace before they're separated by rules.
2. **Hairlines, not heavy borders.** All borders, dividers, and separators are 0.5px (rendered as 1px on standard displays, half-pixel on retina). Heavy 2px+ borders are reserved for accent emphasis on featured items only.
3. **Period typography at modern sizes.** Display serifs (Cormorant, Didot, Cinzel, Lora) are used at sizes that ensure readability — 20px+ for character names, 14px+ for body. Italic serifs are used for emphasis in the period style, but never for body paragraphs (legibility cost too high).
4. **Restrained ornament.** One decorative flourish per surface, not many. A hairline gold rule with a single midpoint ornament is an antique gesture; a frame within a frame within a frame is not. Use ornament where it earns its weight (titles, dividers between sections), not as wallpaper.
5. **High contrast on all body text.** Every theme's body-on-paper combination must clear WCAG AA (4.5:1). Themes that fail get adjusted, not excused.
6. **No worn or distressed texture.** Textures simulating wear (paper grain, ink bleed, age spots) reduce legibility for marginal aesthetic gain. Period feel comes from palette, type, and motif — not from simulated decay.
7. **Letterpress-style precision.** Type is set crisply, never blurred or shadowed. Hairlines are exact. Alignment is honest. The look is a well-printed book, not a faded scrap.
8. **Sentence case for prose, small caps for section titles.** The Foundry sheet idiom of small caps for section labels (e.g. SCANDALS, RUMOURS, RESOLVE) is period-correct and legible; reserve it for labels and eyebrows. Prose stays sentence case.

When in doubt during implementation, ask "would this hold up in a well-bound 1815 society novel reprinted today on archival paper?"

---

## Theming architecture

**Status:** Locked — 2026-05-05
**Reference:** `02-theme-architecture.md`

The system uses a **two-layer theming model**:

1. **House style** — the system's chrome. Module windows, shared spaces (Public Info dashboard, Cycle phase HUD strip, My Characters dock, GM tools), and item sheets (reputation tags, conditions, inner conflicts, magic-skills, backstory actions). These surfaces are universal — they're not "voices," they're objects in the world.
2. **Character themes** — applied to a single actor's sheet body, the letters they author in the Epistolary phase, their entries on shared boards, rumours they originate, and chat cards spoken by them or one of their personas. Selected per actor from the locked twelve-theme registry. Personas may further override the actor's `chatColor` per-identity.

Implementation: house style sets root CSS custom properties; character themes scope overrides under a per-actor selector and via a portable `.gs-themed[data-theme="..."]` wrapper for content that travels (chat messages, letter cards, themed board entries).

See `02-theme-architecture.md` for the scope-boundary table, the wrapper mechanism, and Foundry-specific notes. See `03-component-inventory.md` for the full per-component theme assignment.

---

## House style

**Status:** Locked — 2026-05-05
**Direction:** Inkwell & Wildflower

### Palette

```scss
// styles/_house-palette.scss

$gs-house-paper:        #EFE6D2;  // primary surface
$gs-house-paper-warm:   #F4ECD8;  // raised surfaces, cards
$gs-house-ink:          #3D2F26;  // primary text — sepia
$gs-house-brand:        #2A3A2D;  // forest green — display, primary brand
$gs-house-accent-1:     #B85C3F;  // terracotta — primary accent
$gs-house-accent-2:     #708060;  // sage — secondary accent, dividers
$gs-house-accent-3:     #C9A55C;  // honey — illuminated capitals, highlights
$gs-house-muted:        rgba(112, 128, 96, 0.3);
$gs-house-danger:       #8B2A2A;  // oxblood — scandal, ruin, negative reputation
$gs-house-positive:     #4A7A4A;  // verdant — favorable reputation
```

CSS custom property mirror:

```css
:root {
  --gs-paper:        #EFE6D2;
  --gs-paper-warm:   #F4ECD8;
  --gs-ink:          #3D2F26;
  --gs-brand:        #2A3A2D;
  --gs-accent-1:     #B85C3F;
  --gs-accent-2:     #708060;
  --gs-accent-3:     #C9A55C;
  --gs-muted:        rgba(112, 128, 96, 0.3);
  --gs-danger:       #8B2A2A;
  --gs-positive:     #4A7A4A;
}
```

### Typography

```scss
$gs-house-display:  'Lora', 'Palatino', 'Book Antiqua', Georgia, serif;
$gs-house-body:     'Crimson Text', 'Palatino', Georgia, serif;
$gs-house-italic:   'Crimson Text Italic', 'Palatino Italic', Georgia, serif;
$gs-house-ui:       system-ui, 'Helvetica Neue', sans-serif;
```

### Type scale

| Use                            | Size | Weight | Family   | Notes                          |
|--------------------------------|------|--------|----------|--------------------------------|
| Module window header           | 22px | 500    | display  | Foundry sheet titles            |
| Section header (board/tracker) | 18px | 500    | display  |                                 |
| Subsection / small caps label  | 12px | 500    | display  | letter-spacing 0.12em, small-caps |
| Body                           | 14px | 400    | body     |                                 |
| UI label / pill                | 11px | 500    | ui       | letter-spacing 0.08–0.12em      |
| Numeric (token counts, ages)   | 16px | 500    | display  |                                 |

Character themes override display, body, and italic stacks. UI font stays consistent across themes for legibility of small controls.

---

## Theme registry — twelve presets locked

**Status:** Locked — 2026-05-05

Each theme exposes the same set of CSS variables and chat-style tokens so the implementation is uniform. Schema fields they map to (per CLAUDE.md):

- `Major.system.chatStyle.color` ← theme's `--gs-brand`
- `Major.system.chatStyle.font` ← theme's `--gs-body` family
- `Persona.chatColor` ← override of `chatStyle.color`, defaults to inherit

The CSS file structure is `styles/themes/_theme-{id}.css`, each defining a `.gs-actor[data-theme="{id}"]` selector block.

### Major character themes

#### `rose` — Soft, pink, traditional

```css
.gs-actor[data-theme="rose"] {
  --gs-paper:       #FAF1ED;
  --gs-paper-warm:  #F5E6E0;
  --gs-side-panel:  #E8C5CE;  /* tan side panel for portrait column */
  --gs-ink:         #4A2030;
  --gs-brand:       #B85B6F;
  --gs-accent-1:    #D4889E;
  --gs-accent-2:    #E8C5CE;
  --gs-accent-3:    #C9A574;  /* shared with roger — twin link */
  --gs-display:     'Cormorant Garamond', Georgia, serif;
  --gs-body:        'EB Garamond', 'Lora', Georgia, serif;
  --gs-italic:      'EB Garamond Italic', 'Lora Italic', Georgia, serif;
}
```

#### `roger` — A mirror of Rose, but blue

```css
.gs-actor[data-theme="roger"] {
  --gs-paper:       #F1F0F8;
  --gs-paper-warm:  #E5E4F0;
  --gs-side-panel:  #C5D5E8;
  --gs-ink:         #1F2A4A;
  --gs-brand:       #4A6B8B;
  --gs-accent-1:    #7A9BC4;
  --gs-accent-2:    #C5D5E8;
  --gs-accent-3:    #C9A574;  /* shared with rose */
  --gs-display:     'Cormorant Garamond', Georgia, serif;
  --gs-body:        'EB Garamond', 'Lora', Georgia, serif;
  --gs-italic:      'EB Garamond Italic', 'Lora Italic', Georgia, serif;
}
```

#### `mags` — Dark, moody, lethal

```css
.gs-actor[data-theme="mags"] {
  --gs-paper:       #0F1014;
  --gs-paper-warm:  #1A1D24;
  --gs-side-panel:  #2E3340;
  --gs-ink:         #C8C5C0;
  --gs-brand:       #8E96A8;
  --gs-accent-1:    #6B0F1A;  /* deep blood — danger */
  --gs-accent-2:    #485468;
  --gs-accent-3:    #2E3340;
  --gs-display:     'DM Serif Display', 'Didot', serif;
  --gs-body:        'Crimson Text', Georgia, serif;
  --gs-italic:      'Crimson Text Italic', Georgia, serif;
}
```

#### `avril` — Candlelight & crimson

```css
.gs-actor[data-theme="avril"] {
  --gs-paper:       #16100E;
  --gs-paper-warm:  #2C1F2A;
  --gs-side-panel:  #2C1F2A;
  --gs-ink:         #E8DDC8;
  --gs-brand:       #E8C988;
  --gs-accent-1:    #8B2A2A;  /* oxblood */
  --gs-accent-2:    #8B6A3F;
  --gs-accent-3:    #4A2C1E;
  --gs-display:     'Didot', 'Bodoni 72', 'DM Serif Display', serif;
  --gs-body:        'Crimson Text', Georgia, serif;
  --gs-italic:      'Crimson Text Italic', Georgia, serif;
}
```

#### `dixon` — Red & yellow & dignified

```css
.gs-actor[data-theme="dixon"] {
  --gs-paper:       #FAF3E0;
  --gs-paper-warm:  #F0E5C8;
  --gs-side-panel:  #C9A33C;  /* heraldic gold */
  --gs-ink:         #2A1812;
  --gs-brand:       #8B2A22;  /* heraldic red */
  --gs-accent-1:    #C9A33C;
  --gs-accent-2:    #5C3A28;
  --gs-accent-3:    #E8DCC0;
  --gs-display:     'Cinzel', 'Trajan Pro', Georgia, serif;
  --gs-body:        'Crimson Text', Georgia, serif;
  --gs-italic:      'Crimson Text Italic', Georgia, serif;
}
```

Note on Cinzel: Roman-monumental capitals work beautifully for "Dixon Cloudcandle" but become hard to read in long stretches. Limit Cinzel to character names and section headers; everything else uses Crimson Text.

#### `clayton` — Green and simple

```css
.gs-actor[data-theme="clayton"] {
  --gs-paper:       #F4F1E6;
  --gs-paper-warm:  #E8E4D6;
  --gs-side-panel:  #C9DABB;
  --gs-ink:         #2A332A;
  --gs-brand:       #4A6B3F;
  --gs-accent-1:    #708060;
  --gs-accent-2:    #C9A574;
  --gs-accent-3:    #9CB088;
  --gs-display:     'Lora', 'Palatino', Georgia, serif;
  --gs-body:        'Crimson Text', 'Palatino', Georgia, serif;
  --gs-italic:      'Crimson Text Italic', 'Palatino Italic', Georgia, serif;
}
```

Note: Clayton shares display and body type with the house style (Lora + Crimson Text). The differentiation is palette only — appropriate for a "simple" character whose identity is grounded rather than stylized.

### Connection themes

All five connection variants share the same template — type stack, layout, ornament density, accent-stripe motif. They differ only in the color family. Type matches the house style (Lora + Crimson Text) so connection cards visually feel "of the world" while their color stripes mark them as distinct individuals.

```css
/* shared connection base */
.gs-connection {
  --gs-paper:       #F4F1E6;
  --gs-paper-warm:  #ECE7D6;
  --gs-display:     'Lora', 'Palatino', Georgia, serif;
  --gs-body:        'Crimson Text', 'Palatino', Georgia, serif;
  --gs-italic:      'Crimson Text Italic', 'Palatino Italic', Georgia, serif;
}

.gs-connection[data-theme="connection-green"] {
  --gs-ink:         #2A4A2D;
  --gs-brand:       #6B8A4F;
  --gs-accent-1:    #B8C99A;
}

.gs-connection[data-theme="connection-purple"] {
  --gs-ink:         #3A2A4A;
  --gs-brand:       #6B4A7A;
  --gs-accent-1:    #C0A8C9;
}

.gs-connection[data-theme="connection-blue"] {
  --gs-ink:         #15244A;
  --gs-brand:       #2D4A75;       /* navy/sapphire — distinct from roger's slate */
  --gs-accent-1:    #A0B5D0;
}

.gs-connection[data-theme="connection-yellow"] {
  --gs-ink:         #6B4A1A;
  --gs-brand:       #B88B33;       /* marigold/ochre */
  --gs-accent-1:    #E8D4A0;
}

.gs-connection[data-theme="connection-grey"] {
  --gs-ink:         #2A2D32;
  --gs-brand:       #5C6068;
  --gs-accent-1:    #B8BCC0;
}
```

### NPC theme

```css
.gs-npc[data-theme="npc"] {
  /* inherits house style — no overrides */
}
```

NPCs use the house style as their personal theme. This is intentional: NPCs are "world citizens" whose visual identity is the world itself, not a personality. If an NPC becomes important enough to merit a personal theme, promote them to a Connection.

---

## Component conventions

**Status:** Pending — to be detailed in `03-component-inventory.md`

The component inventory captures the full surface map. Specific styling conventions (button states, focus rings, modal padding) lock incrementally as each component is designed.

---

## Out of scope

These are decided in the Foundry system planning track (`/CLAUDE.md`, `/good-society-foundry-system-plan.md`) and not duplicated here:

- Data schema for actors and items (see CLAUDE.md §6, §7)
- Foundry document types (see CLAUDE.md §6)
- Mechanic implementations (token logic, reputation rules)
- Module dependencies (Sequencer, JB2A)
- Build phases and timeline

This design document tree assumes those decisions and styles around them.

---

## Changelog

| Date       | Section                | Change                                                                 | Notes |
|------------|------------------------|------------------------------------------------------------------------|-------|
| 2026-05-05 | All                    | File created with pending placeholders                                 | Awaiting mood selection from `01-mood-exploration.md` |
| 2026-05-05 | Theming architecture   | Locked: two-layer model (house style + character themes)               | See `01-mood-exploration.md` Decision section |
| 2026-05-05 | House style            | Locked: Inkwell & Wildflower as house style; palette and type tokens   | Direction 3 from mood exploration |
| 2026-05-05 | Character theme presets| Initial library locked: cashmere, candlelight, atelier                 | Superseded later same day |
| 2026-05-05 | Design principle       | Added: antique but clean and legible                                   | Eight implementation rules |
| 2026-05-05 | Theme registry         | Replaced earlier presets with locked twelve-theme registry             | 6 major + 5 connection + 1 NPC. Cashmere/Atelier dropped, candlelight kept as `avril`. |
| 2026-05-05 | Theme registry         | Schema-aligned: themes expose `chatStyle.color` and `chatStyle.font`   | See CLAUDE.md §6.1 |
