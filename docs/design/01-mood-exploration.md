# 01 — Mood Exploration

**Status:** Closed — see Decision section below
**Date opened:** 2026-05-05
**Date closed:** 2026-05-05

## Goal

Establish a visual mood for the Good Society Foundry system before designing specific components. The mood determines palette, typography, surface texture, decorative motifs, and overall "feel" — choices that propagate through every later design decision.

## Source material

The system adapts the Good Society tabletop RPG (Storybrewers Roleplaying, 2018) to a Forgotten Realms / Faerun setting. Tone is romantic dramedy — nobles in Swan's Crossing, scandals, marriages, letters, reputation. Light fantasy overlay (magical bloodlines, Faerun pantheon, the occasional assassin's guild) but the foreground is social politics, not combat.

Mechanically the system has no dice rolls and no combat tracker. Its UI surfaces are: character sheets centered on Desire, Reputation, and Inner Conflict; a public Reputation board; an Epistolary (letter-writing) phase; a Cycle/Phase tracker; and token displays (Resolve, Monologue).

## The four directions

Each direction was rendered visually in chat (see "good_society_foundry_mood_exploration_v1" widget). The summary below captures the same content in text so the rationale survives outside that environment.

### Direction 1 — Cashmere & Calligraphy

**Tagline:** Bridgerton in Faerun. Warm, social-season optimism.

**Palette:**

| Role         | Hex      | Notes                       |
|--------------|----------|-----------------------------|
| Paper        | `#FAF3E8`| Warm cream surface          |
| Blush        | `#E8C8CA`| Dusty rose accent           |
| Sage         | `#9CA984`| Secondary accent / dividers |
| Gold leaf    | `#D4A574`| Borders, ornamental flourishes |
| Wine         | `#6B2C39`| Display type, primary brand |

**Typography:** Cormorant Garamond (display), EB Garamond or Lora (body), Italic Garamond for tagged labels.

**Motifs:** Watercolor florals, calligraphic flourishes, gold leaf rules, lace-curtain transparencies.

**Tonal lean:** The most "comfortable" reading — embraces the romance and elegance of the source material without forcing tension. Players opening the system feel invited to a garden party.

**Best for:** Tables that want the high-society fantasy front-and-center, with mechanics that feel like discreetly handled etiquette.

### Direction 2 — Candlelight & Crimson

**Tagline:** Brontë after dark. Secretive, atmospheric, dangerous.

**Palette:**

| Role         | Hex      | Notes                       |
|--------------|----------|-----------------------------|
| Ink          | `#16100E`| Deep warm-black surface     |
| Aubergine    | `#2C1F2A`| Secondary surface           |
| Oxblood      | `#8B2A2A`| Primary brand, danger states |
| Candlelight  | `#E8C988`| Display type, highlights    |
| Parchment    | `#E8DDC8`| Body text                   |

**Typography:** Didot or DM Serif Display (display, high-contrast), Crimson Text (body), italic Crimson for letters.

**Motifs:** Wax seals, candle smoke, embossed leather, oil-portrait vignettes, parchment edges.

**Tonal lean:** Leans into the gothic underside of the source material — ruined reputations, assassin's guilds, secret correspondence, scandals that destroy lives. Players feel they have entered a drawing-room thriller.

**Best for:** Tables that want weight and consequence in their social play. Where the cost of being seen matters.

### Direction 3 — Inkwell & Wildflower

**Tagline:** Storybook Faerun. Painterly, whimsical, fantasy-forward.

**Palette:**

| Role         | Hex      | Notes                       |
|--------------|----------|-----------------------------|
| Paper        | `#EFE6D2`| Creamy painted-paper        |
| Sage         | `#708060`| Secondary accent            |
| Forest       | `#2A3A2D`| Display type                |
| Terracotta   | `#B85C3F`| Primary accent              |
| Honey        | `#C9A55C`| Highlight / illuminated capitals |

**Typography:** Lora or Palatino (display, humanist serif), Crimson Text or Lora Italic (body), occasional hand-lettered display flourishes.

**Motifs:** Ink-and-watercolor illustration, illuminated initial capitals, hand-drawn borders, botanical line art, painted seals.

**Tonal lean:** Embraces the Faerun fantasy more openly — feels like a beautifully illustrated tabletop sourcebook (think a Studio Ghibli-adjacent Regency). Magical bloodlines and assassin's guilds feel native rather than tonal anomalies.

**Best for:** Tables drawn to the Faerun fusion specifically — where the fantasy isn't decorative but central to the appeal.

### Direction 4 — Atelier

**Tagline:** Modern luxe. Fashion-magazine confidence over Regency bones.

**Palette:**

| Role         | Hex      | Notes                       |
|--------------|----------|-----------------------------|
| Paper        | `#FAF5EE`| Warm off-white              |
| Blush        | `#E8C8C0`| Soft accent                 |
| Honey        | `#C9A55C`| Tertiary accent             |
| Emerald      | `#2D5043`| Primary brand               |
| Charcoal     | `#1A1A1A`| Display type                |

**Typography:** Didot or Bodoni Moda (display, high-contrast Didone), Source Serif or Helvetica Neue (body — clean transitional or modern sans).

**Motifs:** Generous whitespace, fine 0.5px rules, single-color accents, asymmetric layouts, fashion-editorial composition.

**Tonal lean:** Lowest "fantasy surface" of the four. Reads contemporary and confident — Vogue doing a Regency feature. Mechanics feel like product design rather than period costume.

**Best for:** Tables that want the system to feel modern and unfussy, where Regency is a frame rather than a costume.

## Decision criteria

When picking, weigh:

1. **Player onboarding feel** — what should the first impression of opening a character sheet be? Garden party, candlelit study, illustrated storybook, or magazine spread?
2. **Tonal alignment with the GM's table** — Natalie's character lineup (Pearlinda's chaotic harem ending, Avril's assassin secrets) skews toward dramatic comedy with sharp edges. Does the mood support that, or fight it?
3. **Implementation cost** — illustrated directions (3 in particular) require sourcing or commissioning art. Type-driven directions (2 and 4) are largely achievable with web fonts and CSS alone.
4. **Headroom for variation** — the mood needs to support both a wedding announcement and a poisoning rumor. Some palettes flex more than others.

## Decision

**The exploration surfaced a stronger answer than "pick one of four."**

The four directions all felt like they had something true to say about the source material, and Good Society's mechanics specifically reward visual differentiation between characters (each major character has their own private sheet, their own desires, their own letters, their own reputation tags). Locking in a single mood would have flattened that. Instead, we adopted a multi-theme architecture:

- **House style:** Direction 3, Inkwell & Wildflower. Used for all system chrome — module windows, the shared Reputation board, Rumour & Scandal, Phase tracker, GM facilitator tools.
- **Character theme presets:** All four directions become a starting library. Players pick a theme per actor; it applies to that character's sheet, the letters they author in the Epistolary phase, their entries on the Reputation board, and rumours they originate.
- **Architecture details and implementation:** captured in `02-theme-architecture.md`.
- **Open question carried forward:** A character whose personality wants to *contrast* the world (Pearlinda especially — chaotic, the explicit center of her own narrative) shouldn't share a theme with the chrome. We may need an Inkwell-character variant or a fifth preset for this archetype.

```
Chosen direction:        Multi-theme (house style + character themes)
House style:             Direction 3 — Inkwell & Wildflower
Character theme presets: All four directions, players pick per actor
Modifications:           None at this stage; refinements deferred to component design
Rationale:               Per-character theming is mechanically expressive in this system
                         specifically because the game treats characters as distinct social
                         entities, not party members. Letters carrying their sender's identity
                         is an emotional moment the design should support.
Date locked:             2026-05-05
```

## Next files this will inform

- `decisions.md` — house style palette and type tokens, character theme preset registry
- `02-theme-architecture.md` — how the two-layer theming actually works at the CSS / Foundry level
- `03-component-library.md` — core UI primitives styled in house style, with theme-token hooks for character override
- `04-character-sheet.md` — once the data schema is far enough along to wireframe against
