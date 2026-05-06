# Design Documentation

Visual design and front-end planning for the Good Society Foundry VTT system.

## How this folder is organized

Numbered files capture the design exploration in the order it happened. Read them in order to understand how the current visual direction was arrived at. `decisions.md` is the authoritative log of locked-in choices — when in doubt, defer to it.

```
docs/design/
├── README.md                    ← you are here
├── 01-mood-exploration.md       ← four mood directions, comparison, rationale (Closed)
├── 02-theme-architecture.md     ← two-layer theming model, scope boundaries (Locked)
├── 03-component-inventory.md    ← all 59 components, theme scope, design status
├── decisions.md                 ← locked-in choices (principle, palette, type, registry)
└── (future per-component files)
    ├── 04-character-sheet.md
    ├── 05-epistolary-ui.md
    ├── 06-reputation-board.md
    ├── 07-token-economy.md
    ├── 08-inner-conflict.md
    ├── 09-public-info-dashboard.md
    ├── 10-cycle-phase-hud.md
    ├── 11-upkeep-wizard.md
    ├── 12-persona-switcher.md
    ├── 13-chat-cards.md
    └── 14-npc-hover-card.md
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
- "Implement the character sheet wireframe in `docs/design/03-character-sheet.md` using Handlebars partials under `templates/actor/`."

Avoid "use the design we discussed" — link the file.

## Out of scope here

Game mechanics, data schema, and Foundry document structure live under `docs/system/` (separate planning track). The mechanic decisions made there will eventually inform schema-dependent design (sheet field layouts, etc.) — but mood, palette, type, and component aesthetics can be locked in independently.
