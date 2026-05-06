# 00 — System Overview

**Status:** Living document — update when adding new design docs or revising architectural decisions
**Date opened:** 2026-05-05

## What this folder is

The `docs/design/` folder contains the complete visual and interaction design specification for the Good Society Foundry VTT system. Every surface — sheets, modals, persistent UI, chat cards, primitives — has its own focused spec doc. This index orients you to the whole.

This is **design canon**. When implementing, the design docs are the source of truth for what the system *should look like and behave as*. The system plan and CLAUDE.md (in the project root) cover what the system *should do mechanically* — the data models, hooks, and code conventions. The two are complementary; design defers to mechanics on schema and game rules, mechanics defers to design on visuals and UX.

If a design choice and a mechanical choice conflict, surface the conflict and resolve it explicitly — don't let one silently override the other.

## Read this first if you are…

| Your situation | Start with |
|---|---|
| **New to the project, just joining** | This doc, then `decisions.md`, then `04-character-sheet.md` |
| **Implementing a specific surface** | The numbered doc for that surface (see Document catalog below) |
| **Implementing the theme system** | `decisions.md`, then `02-theme-architecture.md`, then `23-primitives-batch.md` |
| **Trying to understand "why does X look like Y"** | `decisions.md` (design principle), then the doc for X |
| **Reviewing design for cohesion or conflicts** | This doc's "Architectural pillars" section, then the relevant doc |
| **Authoring content (tooltips, motto)** | `20-rule-tooltips.md` for tooltip catalog; the per-actor docs for example content |

## Architectural pillars

The whole design rests on these decisions. They appear repeatedly across docs because they govern everything.

### 1. Antique but clean and legible

The top-level design principle (`decisions.md` Design principle section). Every primitive, every sheet, every modal honors:

- Hairlines (0.5px), not heavy borders.
- Generous padding (12-16px minimum even on small components).
- Period typography (Lora display, Crimson Text body, theme-specific overrides) at modern readable sizes.
- Sentence case for prose; small caps for labels.
- One ornament per surface, max.
- High contrast on all body text — WCAG AA at minimum.
- Letterpress-style precision; no worn or distressed textures.

When in doubt: "would this hold up in a well-bound 1815 society novel reprinted today on archival paper?"

### 2. Two-layer theming model

The single most consequential architectural decision (`02-theme-architecture.md`). The system uses a hybrid theme model:

- **House style** (Inkwell & Wildflower) — the system's chrome. Module windows, GM tools, item sheets, persistent UI, anything not bound to a specific character voice.
- **Character themes** — applied to a single actor's sheet body, the letters they author, in-character chat, persona-bound surfaces. Selected per actor from a registry of twelve presets (six bespoke major themes + five connection variants + NPC).

This model is what lets one player's chat read in candlelight gold while another's reads in pink-and-cream while another's reads in heraldic red — same chat log, three voices.

### 3. The `.gs-themed[data-theme="…"]` wrapper

The implementation pattern that makes per-character theming portable (`02-theme-architecture.md`, proven in `05-epistolary-ui.md`). Wrap any element in:

```html
<div class="gs-themed" data-theme="{theme-id}">
  <!-- content using var(--gs-paper), var(--gs-brand), etc. -->
</div>
```

Inside the wrapper, CSS variables resolve to the named theme's palette. This same pattern is used in:
- Letter cards (sender's theme)
- Chat cards (speaker's theme)
- Major character sheet bodies
- Connection sheet bodies (with cross-theme nesting for impressions)
- Public Info Dashboard rows
- My Characters Dock rows
- NPC Organizer rows
- Family sheet member rows
- Bulk Permissions Panel actor rows

A single wrapper mechanism, eight surfaces. Build it once, reuse everywhere.

### 4. Cross-theme rendering for shared surfaces

Some surfaces show *multiple characters* simultaneously. The dashboard shows five Majors with five different themes; the Connection sheet's impressions show one connection's view of multiple Majors; the Family sheet shows multiple member Majors. These can't be themed at the surface level (which character would win?) — they use cross-theme rendering: the surface chrome is house, but each character-bearing element is wrapped independently in `.gs-themed[data-theme="…"]` for that character.

The visual effect is "one shared room, multiple voices co-existing." This is the system's most distinctive UI quality.

### 5. House-styled item sheets (objects in the world, not voices)

All item sheets (Reputation Tag, Reputation Condition, Inner Conflict, Magic/Skill, Backstory Action) are house-styled regardless of which actor they belong to (`12-item-sheets.md`). Items are objects players reference; they don't carry character voices. This is intentional — opening a tag's sheet from Avril's character should feel like reaching for an object in the world, not continuing Avril's voice.

The visual contrast between themed-sheet and house-styled-item-sheet is part of the design's clarity. Don't theme item sheets even if it seems consistent — the inconsistency carries meaning.

### 6. Hybrid surfaces (house chrome + per-character accents)

Surfaces that need both visual cohesion *and* character distinctness use this pattern. Examples:

- The Public Info Dashboard's chrome is house, but each Major's row pulls accent colors from their theme (name color, portrait border, resolve pip color, accent stripe).
- The My Characters Dock follows the same pattern at narrower scale.
- The Bulk Permissions Panel uses cross-theme rendering on actor names while keeping the grid chrome uniform.
- The Family sheet's member list shows each member's row in their theme accent against house chrome.

The design rule: **chrome stays house; identifying elements (name, portrait border, accent stripe) themed**. Document each hybrid surface's specific rules in its own doc; don't try to generalize.

### 7. Persistent UI trinity (HUD + Dashboard + Dock)

Three always-visible (or always-pinnable) surfaces work together to give players full situational awareness without opening any sheets:

- **Cycle Phase HUD strip** (`08-cycle-phase-hud.md`) — top of canvas, world-state.
- **Public Info Dashboard** (`07-public-info-dashboard.md`) — communal, all Majors at a glance.
- **My Characters Dock** (`09-my-characters-dock.md`) — personal, your owned actors.

Together they cover "what phase are we in," "what's everyone's state," and "what are my characters' states." This trinity is the system's foundation for awareness during play.

### 8. The reputation flow is end-to-end designed

A complete chain from tag to consequence:

1. Reputation Tag item created on actor (`12-item-sheets.md`).
2. Tag count check fires on add (`reputation-rules.js` helper).
3. Threshold of 3 tags of one polarity → Condition Picker modal opens (`18-condition-picker.md`).
4. Player picks → Reputation Condition item created on actor.
5. Active Conditions section on Major sheet's Public tab updates (`04-character-sheet.md`).
6. Pending Changes log accumulates events (visible in Upkeep Wizard).
7. Upkeep Wizard's Reputation Review step walks through pending changes (`11-upkeep-wizard.md`).
8. Acknowledgment clears the pending log.

Every link has a locked spec. Implement linearly; the flow works as a system.

### 9. The persona system is first-class

Personas (CLAUDE.md §11) are not tokens-with-different-images. They're identity overrides that affect the actor's portrait, name, hover summary, public tags, chat color, and per-field visibility. Switching a persona triggers:

- Token image + nameplate updates across all scenes.
- Sheet header re-render.
- Public Info Dashboard row re-render.
- My Characters Dock row re-render.
- Persona switch announcement chat card (`10-chat-cards.md`).
- Optional Sequencer VFX.

The persona switcher UI is in `13-persona-switcher.md`; the data model is in CLAUDE.md §6.5. Avril becomes The Black Hound; Dixon becomes his secret-magic-user form. The system's most expressive feature.

### 10. The GM pill is the visual cue for GM-only content

A small terracotta `[GM]` pill (`23-primitives-batch.md` #12) marks any section, button, or surface as GM-only. Used on the NPC sheet header, Family sheet's GM Notes block, Bulk Permissions Panel, GM tools (Reveal, Quick-Create, Organizer), and the Session Log preview. Consistent visual language means even players who can see the surface know which parts are out of bounds.

## The design system at a glance

### House style (Inkwell & Wildflower)

```
Paper:        #EFE6D2  (creamy painted-paper)
Paper warm:   #F4ECD8  (raised surfaces, cards)
Ink:          #3D2F26  (sepia text)
Brand:        #2A3A2D  (forest green — display, primary brand)
Accent 1:     #B85C3F  (terracotta — primary accent, GM cues)
Accent 2:     #708060  (sage — dividers, muted)
Accent 3:     #C9A55C  (honey — illuminated capitals, ceremonial)
Danger:       #8B2A2A  (oxblood — scandal, negative reputation)
Positive:     #4A7A4A  (verdant — favorable reputation)

Display font: Lora, Palatino, Book Antiqua, Georgia
Body font:    Crimson Text, Palatino, Georgia
UI font:      system-ui (small numerics, controls)
```

Full registry in `decisions.md`.

### Theme registry (12 presets)

| Theme ID | Display | Body | Anchor |
|---|---|---|---|
| `rose` | Cormorant Garamond | EB Garamond | Soft pink + gold + wine |
| `roger` | Cormorant Garamond | EB Garamond | Soft blue + gold + navy (mirror of rose) |
| `mags` | DM Serif Display | Crimson Text | Cold dark + steel + blood |
| `avril` | Didot | Crimson Text | Warm dark + candlelight + oxblood |
| `dixon` | Cinzel | Crimson Text | Cream + heraldic red + gold |
| `clayton` | Lora | Crimson Text | Cream + forest green |
| `connection-green` | Lora | Crimson Text | Sage on cream |
| `connection-purple` | Lora | Crimson Text | Plum on cream |
| `connection-blue` | Lora | Crimson Text | Indigo on cream |
| `connection-yellow` | Lora | Crimson Text | Marigold on cream |
| `connection-grey` | Lora | Crimson Text | Slate on cream |
| `npc` | (inherits house) | (inherits house) | — |

Full palette specs in `decisions.md`.

### Component count

- **24 numbered design docs** specifying complete UI surfaces or component groups.
- **~50 of ~60 inventory components** designed (most "remaining" are already covered in batch docs).
- **13 primitives** consolidated in one canonical reference (`23-primitives-batch.md`).

### File organization (when implemented)

```
good-society-homebrew/
├── styles/
│   ├── _variables.css            # house style CSS variables
│   ├── primitives/
│   │   ├── _card.css
│   │   ├── _button.css
│   │   └── ... (one per primitive)
│   ├── themes/
│   │   ├── _theme-rose.css
│   │   ├── _theme-avril.css
│   │   └── ... (one per theme)
│   ├── components/               # composed components from primitives
│   ├── sheets/                   # per-sheet layouts
│   └── apps/                     # custom apps (dashboard, dock, etc.)
├── templates/
│   ├── actors/                   # per-type sheet templates
│   ├── components/               # reusable partials
│   ├── chat-cards/
│   └── apps/
├── module/
│   ├── helpers/
│   │   ├── chat-cards.js
│   │   ├── themed-wrap.js
│   │   ├── reputation-rules.js
│   │   ├── session-log-generator.js
│   │   └── ...
│   ├── apps/                     # custom ApplicationV2 windows
│   ├── sheets/                   # actor sheet classes
│   └── hooks/
└── lang/
    └── en.json                   # tooltip content + all UI strings
```

## Document catalog

All design docs in numerical order. Each line: number + name + status + one-line summary.

| # | Doc | Status | One-line summary |
|---|---|---|---|
| 00 | system-overview.md | Living | This doc — orientation and index |
| — | README.md | Living | Folder readme with workflow notes |
| — | decisions.md | Locked | Design principle, palette, type, theme registry — the constitutional document |
| 01 | mood-exploration.md | Closed | Four mood directions explored; led to multi-theme architecture |
| 02 | theme-architecture.md | Locked | Two-layer theming + `.gs-themed` wrapper mechanism |
| 03 | component-inventory.md | Open | Master list of all components with theme scope and design status |
| 04 | character-sheet.md | Locked | Major Character sheet — header, two tabs, persistent token strip |
| 05 | epistolary-ui.md | Locked | Letter composer + card; canonical proof of the wrapper pattern |
| 06 | connection-sheet.md | Locked | Connection sheet with cross-theme impression accents |
| 07 | public-info-dashboard.md | Locked | Facilitator dashboard with hybrid theming on Major rows |
| 08 | cycle-phase-hud.md | Locked | Persistent thin strip showing cycle and phase progression |
| 09 | my-characters-dock.md | Locked | Pinned panel for owned actors; player-side complement to dashboard |
| 10 | chat-cards.md | Locked | All six chat card variants + Speaking-As switcher + Inner Monologue editor |
| 11 | upkeep-wizard.md | Locked | Multi-step modal for cycle close; GM Roster View for tracking completion |
| 12 | item-sheets.md | Locked | Five item sheets in one batch; Inner Conflict box grid primitive |
| 13 | persona-switcher.md | Locked | In-sheet picker, switcher popover, full editor; switching pipeline UI |
| 14 | family-sheet.md | Locked | House-styled actor sheet with crest medallion and member list |
| 15 | welcome-panel.md | **Cut (2026-05-06)** | Originally a first-load modal with three onboarding paths. Removed when the bundled sample world was cut from scope. Design preserved in the doc. |
| 16 | npc-sheet.md | Locked | NPC sheet as deltas from Connection; promote-to-Connection workflow |
| 17 | token-hover-card.md | Locked | Canvas-anchored hover card for all actor types |
| 18 | condition-picker.md | Locked | Threshold-triggered modal for picking Reputation Conditions |
| 19 | gm-tools.md | Locked | Reveal Control + NPC Quick-Create + NPC Organizer batch |
| 20 | rule-tooltips.md | Locked | System-wide tooltip layer + comprehensive content catalog |
| 21 | edit-conflict-warning.md | Locked | Three-layer conflict prevention for shared Connections |
| 22 | bulk-permissions-panel.md | Locked | GM grid for setting actor ownership across all users |
| 23 | primitives-batch.md | Locked | 13 primitives in one canonical component library reference |
| 24 | session-log.md | Locked | Auto-generated end-of-session journal entry |
| 25 | backup-export.md | Locked | GM-only utility for full world JSON export and import |
| 26 | pending-changes-log.md | Locked | "Since last Upkeep" inline section on the Major sheet |
| 27 | token-frame.md | Locked | Canvas-side ring/border that distinguishes Major / Connection / NPC |

## Where to look for X

| What you're looking for | Doc |
|---|---|
| The design's color values | `decisions.md` |
| The font stack for character X | `decisions.md` (theme registry) |
| Why everything looks "antique" | `decisions.md` (Design principle) |
| How themes wrap content | `02-theme-architecture.md` |
| The full list of components | `03-component-inventory.md` |
| Major character sheet anatomy | `04-character-sheet.md` |
| How letters work | `05-epistolary-ui.md` |
| How chat cards are themed | `10-chat-cards.md` |
| What buttons should look like | `23-primitives-batch.md` |
| What every section header explains | `20-rule-tooltips.md` (tooltip catalog) |
| How Upkeep guides the player | `11-upkeep-wizard.md` |
| Reputation flow end-to-end | `04-character-sheet.md` → `12-item-sheets.md` → `18-condition-picker.md` → `11-upkeep-wizard.md` |
| The persona system | CLAUDE.md §11 (data) + `13-persona-switcher.md` (UI) |
| GM-only utilities | `19-gm-tools.md` + `22-bulk-permissions-panel.md` |
| Edge cases for shared editing | `21-edit-conflict-warning.md` |
| End-of-session archival | `24-session-log.md` |

## Implementation order suggestions

Implementing the full system in dependency order. This roughly tracks the system plan's build phases (Plan §14) but ordered by the design dependencies.

### Phase A — Foundation (no dependencies)

1. CSS variables (`decisions.md` palette + type) into `styles/_variables.css`.
2. House style theme into `styles/themes/_theme-house.css`.
3. Primitives in priority order (`23-primitives-batch.md`):
   a. Card surface, hairline divider.
   b. Section header (with `data-tooltip-key` integration).
   c. Form controls (input, dropdown, checkbox).
   d. Buttons (all four variants).
   e. Status indicators (visibility flag, GM pill).
   f. Modal/dialog.
   g. Tab navigation.

After Phase A, the system has its design vocabulary in CSS form. No sheets yet.

### Phase B — Theme system

4. Theme wrapper helper (`themed-wrap.js`).
5. One character theme override block — `rose` recommended (`decisions.md` registry).
6. Test: open a placeholder sheet wrapped in `.gs-themed[data-theme="rose"]` and verify variables resolve correctly.

After Phase B, the theme infrastructure is validated end-to-end with one theme.

### Phase C — Major Character sheet

7. Major Character sheet header partial (`04-character-sheet.md`).
8. Tab navigation primitive applied.
9. Public tab body, section by section.
10. Private tab body.
11. Persistent tokens strip.
12. Resolve track, MT toggle, monologue dot primitives.

After Phase C, one full character sheet is locked. Test with a sample Lady Rose actor.

### Phase D — Remaining themes + actor variants

13. The remaining 11 themes from `decisions.md` registry.
14. Connection sheet (`06-connection-sheet.md`).
15. NPC sheet (`16-npc-sheet.md`).
16. Family sheet (`14-family-sheet.md`).

After Phase D, all four actor types have working sheets across all twelve themes.

### Phase E — Item sheets

17. Item sheets batch in order (`12-item-sheets.md`):
    a. Reputation Tag (CLAUDE.md §9 worked example).
    b. Reputation Condition.
    c. Backstory Action.
    d. Inner Conflict (with shared box grid partial).
    e. Magic/Skill (with cast pipeline).

### Phase F — Persistent UI trinity

18. Cycle Phase HUD (`08-cycle-phase-hud.md`).
19. Public Info Dashboard (`07-public-info-dashboard.md`) — proves hybrid theming.
20. My Characters Dock (`09-my-characters-dock.md`) — reuses dashboard primitives.

### Phase G — Themed content surfaces

21. Chat card system (`10-chat-cards.md`):
    a. System-emitted card.
    b. In-character card.
    c. Speaking-As switcher.
    d. Persona switch announcement.
    e. Inner Monologue editor + card.
    f. Inner Conflict completion ceremony.
22. Letter composer + card (`05-epistolary-ui.md`).
23. Token hover card (`17-token-hover-card.md`).

### Phase H — GM tools

24. Bulk Permissions Panel (`22-bulk-permissions-panel.md`).
25. GM tools batch (`19-gm-tools.md`):
    a. Reveal Control popover.
    b. NPC Quick-Create.
    c. NPC Organizer.

### Phase I — Polish

26. Persona switcher UI (`13-persona-switcher.md`) — though pieces appear earlier.
27. Condition Picker modal (`18-condition-picker.md`).
28. Upkeep Wizard (`11-upkeep-wizard.md`).
29. In-Sheet Rule Tooltips (`20-rule-tooltips.md`) + content authoring in `lang/en.json`.

> Welcome Panel was cut from scope on 2026-05-06 (was item 27). See `15-welcome-panel.md` for the preserved design.

### Phase J — Robustness + retrospective

31. Edit-Conflict Warning system (`21-edit-conflict-warning.md`).
32. Session Log auto-generator (`24-session-log.md`).

After Phase J, the design specs are fully implemented. Sample world content authoring is content work, not implementation.

## Aggregated open questions

All open questions from individual docs in one list, deduplicated and grouped by theme.

### Theming and color

- Verify each theme passes WCAG AA at body size — especially Avril and Mags (dark themes). Adjust if any fail (`decisions.md`, `02-theme-architecture.md`).
- Should a sixth player-character archetype theme exist for chaotic-villainess characters (Pearlinda)? Deferred until needed (`02-theme-architecture.md`).
- Should the GM pill have severity variants? Tentative no (`23-primitives-batch.md`).

### Sheet layouts

- Should the Tokens & Cycle area on the Major sheet be a tab or a persistent strip? Locked: persistent strip (`04-character-sheet.md`).
- Should the persona switcher live in the side panel, the main column, or both? Locked: side panel only (`04-character-sheet.md`).
- Should the Connection sheet's `linkedMajorId` allow multiple Majors? Tentative no for v1 (`06-connection-sheet.md`).
- Should the Family sheet allow editing each member's `familyId` from this sheet? Tentative no (`14-family-sheet.md`).

### Persona system

- Should persona switching require a confirm for first switch? Tentative no (`13-persona-switcher.md`).
- Should secret personas appear to non-owner viewers in the popover? Tentative no — hide them (`13-persona-switcher.md`).
- Should tokens hover-card show a preview of new persona's portrait inline? Defer to v1.1 (`13-persona-switcher.md`).

### Reputation flow

- Should removed tags appear in the reputation review at Upkeep? Yes, with "removed" indicator (`11-upkeep-wizard.md`, `18-condition-picker.md`).
- Should Reputation Conditions auto-deactivate when source tag count drops below 3? Yes, with GM override (`12-item-sheets.md`).
- Should the Condition Picker support GM auto-firing? Tentative GM toast only — no auto-fire (`18-condition-picker.md`).

### Communal surfaces

- Should the Public Info Dashboard show Connections too? No for v1 (`07-public-info-dashboard.md`).
- Should the My Characters Dock include NPCs if user-owned? Yes, in tertiary section (`09-my-characters-dock.md`).
- Should the dock width be adjustable? Fixed at 290px for v1 (`09-my-characters-dock.md`).

### Chat and communication

- Should the Speaking-As switcher remember the last persona used per actor? Yes (`10-chat-cards.md`).
- Should monologue cards auto-collapse after time? No — they earn their space (`10-chat-cards.md`).
- Should chat cards animate in/out? Minimal — instant appear, 100ms fade-out only (`10-chat-cards.md`).

### Polish surfaces

- Should the Upkeep Wizard be opt-out per-user? Yes via `upkeepWizardEnabled` setting (`11-upkeep-wizard.md`).
- Should the tooltip system support pinning open? Defer to v1.1 (`20-rule-tooltips.md`).

### Robustness

- Should the Edit-Conflict warning include an undo affordance for accidental reveals? Tentative no — irreversible feel is intentional (`19-gm-tools.md`).
- Should conflicts auto-resolve if dismissed without action? No — require explicit action (`21-edit-conflict-warning.md`).
- Should the Bulk Permissions Panel show a "permissions diff" view? Defer to v1.1 (`22-bulk-permissions-panel.md`).

### Session archival

- Should the session log auto-save without GM clicking End Session? No — GM is the right gate (`24-session-log.md`).
- Should the log capture out-of-character chat? No — mechanical events only (`24-session-log.md`).
- Should logs include stat snapshots at session end? No — log is changes-only (`24-session-log.md`).

## Schema additions to track

A few small schema additions are proposed across docs but not yet integrated into CLAUDE.md §6's data models. Track these for the next schema review:

| Field | Belongs to | Source doc | Purpose |
|---|---|---|---|
| `heirStatusFlavor: string` | Family | `14-family-sheet.md` | Italic flavor text on heir status row ("unprecedented in 200 years") |
| `establishedYear: number` | Family | `14-family-sheet.md` | Header metadata "est. 1612" |
| `system.theme: string` | All actors | `decisions.md` | Currently a flag/setting; consider promoting to schema |
| `pickerResolved.{polarity}: boolean` | Major | `18-condition-picker.md` | Flag tracking which thresholds have been resolved-without-condition |
| `upkeepProgress: object` | Major | `11-upkeep-wizard.md` | Per-step completion state for resumable Upkeep wizard |
| `sessionEvents: array` | World setting | `24-session-log.md` | Running event log for session log auto-generator |

Additional enum: `Family.heirStatus` should expand from `boolean` to `"named-son" | "named-daughter" | "named-foster" | "vacant" | "contested"` per `14-family-sheet.md`.

## Component patterns by reuse

These patterns appear across multiple docs. When implementing, build the pattern once and reuse:

| Pattern | Used in | Implementation note |
|---|---|---|
| `.gs-themed[data-theme="…"]` wrapper | Letter cards, chat cards, dashboard rows, dock rows, token hover cards, sheet bodies | Build helper in `themedWrap()` |
| Cross-theme rendering (per-element themes inside house chrome) | Connection impressions, Dashboard Majors, Dock rows, Family members, Bulk Permissions actor names | Same wrapper, applied per child element |
| Section header with `?` glyph | Every sheet section | Auto-applied via CSS pseudo-element on `[data-tooltip-key]` |
| GM pill | NPC sheet, Family sheet GM Notes, Reveal Control, NPC Quick-Create, NPC Organizer, Bulk Permissions Panel, Session Log | Single `.gs-gm-pill` primitive |
| Phase progression markers (dots + connectors + current pill) | Cycle Phase HUD, Upkeep Wizard step indicator | Shared `_phase-marker.css` primitive |
| ~~Dot fleuron title frame~~ | ~~Welcome Panel~~ | Orphaned: Welcome Panel cut 2026-05-06; primitive retained for future title-page surfaces |
| Soft-paper card with left-edge accent stripe | Reputation Criteria card, impression cards, condition cards, completed conflicts, Backstory Action source reference, conflict warning toast | `.gs-card--accent` variant |
| 5-pip resolve track | Major sheet strip, Connection sheet, Dashboard rows, Dock rows | Single `_resolve-track.css` primitive |
| Crest medallion (gold ring + forest field + monogram) | Family sheet | Could extract for future emblem needs |

## Authoring hand-off checklist

When the design is fully implemented and you're moving to content authoring:

- [ ] Tooltip catalog in `lang/en.json` (~50 keys) — `20-rule-tooltips.md`
- [ ] Canonical Reputation Conditions (positive and negative) in `packs/conditions/` — referenced by `18-condition-picker.md`
- [ ] Archetype Inner Conflicts in `packs/inner-conflicts/` (Family vs. Business, Duty vs. Desire, etc.) — drag-targets for player setup
- [ ] Generic NPC portrait silhouettes in `assets/portraits/generic/` — referenced by `19-gm-tools.md`
- [ ] Page references for tooltips pointing at the rulebook
- [ ] Localization fallbacks for any non-English locale support

## When designs change

This is a living folder. When a design decision changes:

1. Update the relevant doc.
2. Add a Changelog entry to that doc.
3. If the change cascades (a new architectural pattern, a new core decision), update this index.
4. If existing implementation contradicts the new design, flag in CLAUDE.md `## Open decisions` for the next implementation pass.

The folder is not frozen. As play surfaces real friction, designs will evolve.

## Closing observations

A few cross-cutting observations that don't fit elsewhere:

The system has roughly two kinds of surfaces: **identity-bearing** (sheets, letters, chat cards, hover cards — anything with a character voice) and **system-bearing** (item sheets, GM tools, modals, persistent UI). Identity-bearing surfaces use the wrapper mechanism with the actor's theme; system-bearing surfaces use house style. Knowing which kind a new surface is determines its theme treatment.

The **antique-but-clean principle** functions as both an aesthetic directive and a constraint that prevents feature creep. When a feature would require visual complexity that violates the principle, the principle is the right thing to keep — design around the constraint. This is why the system has no inline avatar emojis, no animated gradients, no "shine" or "glow" effects: the principle is what gives the system its coherent voice across thousands of small UI decisions.

The **theme registry was originally four mood directions (Cashmere, Candlelight, Inkwell, Atelier)** and grew to twelve specific character themes when player needs surfaced. The architecture supported this growth without changes — it's the same `.gs-themed` wrapper, just with more variant overrides. Future themes can be added similarly. The architecture is a true platform.

The **persona system** is the system's most expressive feature. Avril becoming The Black Hound, Dixon revealing his magic, Princess Adora switching to Korra — these are dramatic story beats made tractable by the data model and the UI. The system's design choices around personas (per-persona portraits, per-persona chat colors, per-persona visibility overrides, the announcement card, the token-update pipeline) all serve the same goal: making identity changes feel weighty in the fiction without being mechanically painful.

## Changelog

| Date       | Change                                                                |
|------------|-----------------------------------------------------------------------|
| 2026-05-05 | File created. Consolidated 24 design docs into a single index. Architectural pillars enumerated. Reading-order suggestions provided. Open questions aggregated across all docs. Schema additions tracked for next review. |
| 2026-05-05 | Design phase complete. Three final docs added: 25 (Backup/Export), 26 (Pending Changes Log), 27 (Token Frame). Catalog updated. Total: 27 numbered specs + 3 supporting docs (this overview, README, decisions.md). |
