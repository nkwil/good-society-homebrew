# Design Documentation

Visual design and front-end planning for the Good Society Foundry VTT system.

## How this folder is organized

Numbered files capture the design exploration in the order it happened. Read them in order to understand how the current visual direction was arrived at. `decisions.md` is the authoritative log of locked-in choices — when in doubt, defer to it.

```
docs/design/
├── README.md                       ← you are here
├── 01-mood-exploration.md          ← four mood directions, comparison, rationale (Closed)
├── 02-theme-architecture.md        ← two-layer theming model, scope boundaries (Locked)
├── 03-component-inventory.md       ← all 59 components, theme scope, design status
├── decisions.md                    ← locked-in choices (principle, palette, type, registry)
├── 04-character-sheet.md           ← Major Character sheet, full layout (Locked)
├── 05-epistolary-ui.md             ← letter composer + card + .gs-themed wrapper (Locked)
├── 06-connection-sheet.md          ← Connection actor sheet (Locked)
├── 07-public-info-dashboard.md     ← Facilitator dashboard, hybrid theming (Locked)
├── 08-cycle-phase-hud.md           ← persistent phase strip (Locked)
├── 09-my-characters-dock.md        ← pinned owned-actor panel (Locked)
├── 10-chat-cards.md                ← six chat card variants + Speaking-As switcher (Locked)
├── 11-upkeep-wizard.md             ← six-step Upkeep flow + GM Roster (Locked)
├── 12-item-sheets.md               ← all five item sheets + inner-conflict box grid (Locked)
├── 13-persona-switcher.md          ← in-sheet picker + popover + editor modal (Locked)
├── 14-family-sheet.md              ← Family actor sheet + crest medallion (Locked)
├── 15-welcome-panel.md             ← first-load modal with three starting paths (Locked)
├── 16-npc-sheet.md                 ← NPC actor sheet + promote-to-Connection flow (Locked)
├── 17-token-hover-card.md          ← canvas hover card for Major/Connection/NPC (Locked)
├── 18-condition-picker.md          ← reputation threshold modal (Locked)
├── 19-gm-tools.md                  ← Reveal Control, NPC Quick-Create, NPC Organizer (Locked)
└── 20-rule-tooltips.md             ← in-sheet tooltip primitive + content catalog (Locked)
```

## Workflow

1. Explore — open-ended visual options for a question (e.g. "what should the character sheet feel like?")
2. Decide — pick a direction, capture the choice in `decisions.md` with a short rationale
3. Specify — translate the decision into something implementable (Handlebars templates, SCSS variables, asset specs)
4. Build — implement in the system source under `src/` or `styles/` (separate from this folder)

This folder is for thinking, deciding, and documenting. Implementation lives elsewhere in the project.

## Working with Claude Code on these docs

When asking Claude Code to act on a design document, prefer specific file references over general ones:

- "Read `docs/design/decisions.md` and use the locked palette to set up `styles/_variables.scss`."
- "Implement the character sheet header per `docs/design/04-character-sheet.md` §'Header spec — locked' using Handlebars partials under `templates/actors/major-character/`."

Avoid "use the design we discussed" — link the file.

## Out of scope here

Game mechanics, data schema, and Foundry document structure live under `/CLAUDE.md` and `/PLAN.md` (separate planning track). The mechanic decisions made there will eventually inform schema-dependent design (sheet field layouts, etc.) — but mood, palette, type, and component aesthetics can be locked in independently.
