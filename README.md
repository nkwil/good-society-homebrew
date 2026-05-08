# Good Society (Homebrew) — Foundry VTT System

A standalone Foundry VTT v13 system for a homebrew variant of **Good Society** (a Jane Austen-inspired narrative TTRPG by Storybrewers Roleplaying). Built by Opal.

---

## What this system does

- **Character sheets** for all actor types: Major Characters, Connections, Family, NPCs — fully implementing the printed sheet layout with the full field set.
- **Token economy automation**: Resolve track with click-to-toggle pips, Major Token badge, monologue dot, cycle-phase indicator — all visible in a persistent strip that stays rendered across tab switches.
- **Reputation system**: Positive and negative tag management (Item drag-and-drop), automatic condition-picker prompt when a character hits 3 tags of either polarity, pending-changes log for Upkeep review.
- **Inner Conflict**: 5+5 grid with completion detection (6 total OR 5 on one side), completion ceremony chat card.
- **Public Info Dashboard**: Facilitator-facing board showing all Major Characters with their public reputation, resolve, cycle state, and themed rows. GM bulk actions row for phase wizards and permissions management.
- **My Characters Dock**: Per-player persistent list of owned actors with quick-access Speaking-As toggle.
- **Cycle HUD**: 8-position cycle tracker per the rulebook (Novel × 2, Reputation × 2, Rumour & Scandal, Epistolary × 2, Upkeep), with final-cycle special handling (skip R&S and second Reputation; second Epistolary becomes the epilogue).
- **Upkeep Wizard**: Step-by-step per-Major modal walking through resolve refresh, tag trading, and completion confirmation. Player and GM variants.
- **Reputation Phase Wizard**: GM-facing and player-facing modal for declaring positive/negative reputation changes, with real-time actor sync.
- **Persona system**: Multiple identities per Major/Connection/NPC, each with its own portrait, token image, token name, and visibility overrides. Switching persona updates every placed token across all scenes instantly.
- **Letter Composer**: Full epistolary interface — sender/recipient actor selectors, subject, body, seal color picker, sender-themed live preview. Letters post to chat and archive to the recipient's inbox in the Journal sidebar.
- **Chat cards**: Six styled variants (system, in-character, monologue, completion ceremony, persona switch, letter) — all themed to the sending actor. Monologues can be archived to a themed Journal entry.
- **Speaking-As switcher**: Injected into the chat input bar; speaker rewriting via `preCreateChatMessage` hook. Includes a persona sub-picker.
- **Rule Tooltips**: Section headers on every sheet show a `?` glyph on hover with a plain-English rule explanation and optional rulebook page reference.
- **Token Hover Cards**: Canvas token hover shows portrait, public tags, and scene summary — themed per actor type.
- **Event Timeline**: In-fiction calendar of dated events with GM/player visibility controls and current-date reveal.
- **Session Log**: Automatic event tracking (tag added/removed, condition triggered, conflict completed, persona switched, letter sent) with a GM-only preview and export to Journal.
- **NPC Organizer**: GM sidebar for quick NPC management, with one-click promote-to-Connection.
- **Bulk Permissions Panel**: Grid editor for setting actor ownership levels across all users at once.

### Homebrew additions

Beyond canonical Good Society rules:

- **Magic/Skills system**: Item type `magic-skill` with an optional casting VFX (via Sequencer + JB2A) and public/secret visibility chooser. Some skills trigger a persona swap on cast.
- **Adventurer Sentiment**: Flavor text field on Major Characters (no mechanics).
- **Modified inner-conflict completion rule**: 6 boxes total OR 5 on one side (canonical rule is 5 on one side only).
- **Extended persona system**: More fields per persona (hover summary, public scene tags, chat color override) than the base rules describe.

---

## Installation

**Foundry v13 only.** This system uses APIs (`ApplicationV2`, `HandlebarsApplicationMixin`, `TypeDataModel`) that are not available in v12 or earlier.

### Manual install

1. Download the repository as a `.zip` file (or clone it).
2. Unzip into your Foundry user data folder under `Data/systems/good-society-homebrew/`.
3. From that folder, run `npm install` once to copy the required font files:
   ```
   npm install
   ```
   This runs the `postinstall` script (`scripts/copy-fonts.mjs`) which copies web font files from `node_modules/@fontsource/*/` into `styles/fonts/`. The system uses Google Fonts sourced via `@fontsource` npm packages — no internet connection is required at runtime.
4. In Foundry, go to **Game Systems** and verify **Good Society (Homebrew)** appears. If it doesn't, check that the folder is named exactly `good-society-homebrew`.
5. Create a new World using this system.

### Optional modules

These modules are recommended but not required. The system degrades gracefully if they are absent.

| Module | Purpose |
|---|---|
| [Sequencer](https://foundryvtt.com/packages/sequencer) | On-canvas VFX for Magic/Skill casts |
| [JB2A Patreon](https://jb2a.com/) or [JB2A Free](https://foundryvtt.com/packages/JB2A_DnD5e) | VFX asset library used by Sequencer |

Without Sequencer: Magic/Skill casts still work — they post a chat card and trigger persona swaps. The canvas effect is simply skipped.

---

## Settings

All settings are in **Configure Settings → System Settings**.

| Setting | Scope | Default | Description |
|---|---|---|---|
| Cycle Phase | World | Pre-Cycle | Current phase of the cycle (used by Cycle HUD and phase wizards). |
| Cycle Number | World | 1 | Which cycle the table is in. |
| Cycle Position | World | 0 | 0–9 position within the 8-position cycle structure (0 = pre-cycle, 9 = ended). |
| Final Cycle | World | false | Activates final-cycle special rules: skips Rumour & Scandal and second Reputation; second Epistolary becomes the epilogue. |
| Auto-Refresh on Upkeep | World | true | Automatically refresh resolve tokens when advancing through Upkeep. |
| Prompt on Three Tags | World | true | Opens the Condition Picker when a character accumulates 3 positive or 3 negative reputation tags. |
| Default Max Resolve | World | 5 | Starting maximum resolve for new Major Characters. |
| Default Starting Resolve | World | 3 | Starting current resolve for new Major Characters. |
| Enable Homebrew Magic | World | true | Enables the Magic/Skills tab on Major Character sheets and the cast pipeline. |
| Rule Tooltips | Client | true | Shows `?` glyphs on section headers with hover rule explanations. Turn off if you know the rules well. |
| Upkeep Wizard | Client | true | When on, Upkeep phase opens a per-Major wizard. When off, Upkeep advances directly without prompting. |
| NPC Organizer Visible to Players | World | false | Allows non-GM users to open the NPC Organizer sidebar panel. |
| Apply Foundry Chrome Theme | Client | true | Re-themes Foundry's surrounding chrome (titlebars, sidebar, chat log, notifications) to match the Good Society house style. Toggle at runtime without page reload. |

---

## Actor types

| Type | Description |
|---|---|
| `major-character` | Player characters. Full sheet with Public/Private tabs, resolve track, reputation, inner conflicts, personas, magic. |
| `connection` | NPCs with player-facing sheets. Shared read access by default; GM can promote specific Connections to individual player ownership. |
| `family` | One per family group. Holds the family name, origin, crest, unique negative reputation criteria, and member list. Multiple Majors share one Family actor. |
| `npc` | GM-only actors. Simpler sheet; can be promoted to Connection via a single button. |

## Item types

| Type | Description |
|---|---|
| `reputation-tag` | A positive or negative reputation tag attached to a character. |
| `reputation-condition` | An active reputation condition triggered by tag accumulation. |
| `inner-conflict` | A conflict with 5+5 boxes. Tracks which side is being filled; fires a completion ceremony when done. |
| `magic-skill` | A homebrew skill with optional Sequencer VFX and persona-swap trigger. |
| `backstory-action` | A backstory action tied to an inner conflict, with used/expanded state. |

---

## Theming

The system has two layers:

- **House style** ("Inkwell & Wildflower"): Antique parchment palette, Lora display type, Crimson Text body. Applied to chrome, item sheets, GM tools, and all system-emitted surfaces.
- **Character themes**: Six Major presets (Rose, Roger, Mags, Avril, Dixon, Clayton) and five Connection variants. Applied per-actor; in-character chat cards, letters, and monologues travel with the sender's theme.

Switching a character's theme on their sheet takes effect immediately everywhere their theme appears — including historic chat cards (which store the theme id in flags and re-resolve variables at render time, not at write time).

---

## Credits

- Game system: **Good Society** by Storybrewers Roleplaying
- Foundry system: **Opal**
- Boilerplate base: [Asacolips' Boilerplate System](https://github.com/asacolips-projects/boilerplate)
- Fonts: [Fontsource](https://fontsource.org/) (Lora, Crimson Text, EB Garamond, DM Serif Display, Cinzel)
- Optional VFX: [Sequencer](https://github.com/fantasycalendar/FoundryVTT-Sequencer) + [JB2A](https://jb2a.com/)
