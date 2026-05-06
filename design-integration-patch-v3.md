# Design Integration Patch v3

This patch integrates the third wave of design work — eleven new component-level design docs (`10-chat-cards.md` through `20-rule-tooltips.md`) plus updates to `03-component-inventory.md` and `README.md` — into the system planning files (`PLAN.md`, `CLAUDE.md`) and the Session B-1 briefing.

Apply via Claude Code with this prompt:

> Read every locked design doc in `docs/design/` (01–20). Then apply the patches in `design-integration-patch-v3.md` to `PLAN.md`, `CLAUDE.md`, and `docs/sessions/session-b1-briefing.md`. Show me a unified diff for each file before saving. **One small DataModel change** is in this patch (Family schema) — call it out separately, don't apply silently.

---

## Why this patch exists

Eleven new per-component design docs landed:

| Doc | Covers |
|---|---|
| `10-chat-cards.md` | Six chat card variants (system / in-character / monologue / completion / persona-switch / letter), Speaking-As switcher, Inner Monologue editor flow |
| `11-upkeep-wizard.md` | Six-step Upkeep wizard per Major + GM Roster View; themed to active Major |
| `12-item-sheets.md` | All five item sheets + the Inner Conflict box grid primitive |
| `13-persona-switcher.md` | Three contexts: in-sheet picker (closed), switcher popover (open), full editor modal |
| `14-family-sheet.md` | Family actor sheet with crest medallion (monogram fallback); cross-theme member rows |
| `15-welcome-panel.md` | First-load modal with three options (Sample World / Blank / Quick-Start) |
| `16-npc-sheet.md` | NPC sheet as deltas from the Connection sheet; promote-to-Connection workflow |
| `17-token-hover-card.md` | Canvas hover card for Major/Connection/NPC (component renamed from "NPC hover card") |
| `18-condition-picker.md` | Reputation threshold modal; sources from bundled + homebrew compendiums |
| `19-gm-tools.md` | Three GM tools batched: Reveal Control, NPC Quick-Create, NPC Organizer |
| `20-rule-tooltips.md` | System-wide tooltip primitive + ~50-key content catalog |

Plus `03-component-inventory.md` and `README.md` were updated with status flips for the now-designed components.

---

## Headline structural changes

Five things matter most:

1. **`themedWrap` helper underpins six chat-card variants** — chat cards (in-character, monologue, completion, persona-switch, letter) all use the helper from Session B-0. Theme is stored on the chat message at post time (`flags.senderTheme`) so historic cards survive theme changes.

2. **Inner Conflict box grid is a shared primitive** between the Major sheet's Public tab and the Inner Conflict item sheet. Build it once at `templates/components/inner-conflict-grid.hbs`; both sheets import the partial.

3. **Token Hover Card is renamed** from "NPC hover card" — same component serves Majors, Connections, and NPCs via the wrapper mechanism. Inventory entry #23 updated.

4. **Family schema may need a small revision.** The decisions doc pencils in `heirStatus: boolean`; the Family sheet design wants an enum (`named-son | named-daughter | named-foster | vacant | contested`) plus optional `establishedYear: number` and `heirStatusFlavor: string`. Flagged below — don't auto-apply.

5. **Tooltip primitive is system-wide**, triggered by `data-tooltip-key` on section headers. ~50 tooltip keys to author in `lang/en.json`. Catalog in `20-rule-tooltips.md`.

---

## Patch 1 — `CLAUDE.md`

### 1.1 Add a recipe to §11 — Adding a chat card

**Replace** the "Adding a chat card or themed surface" recipe with:

```markdown
### Adding a chat card or themed surface

All chat cards go through `module/helpers/chat-cards.js`. Six post-card helpers exist:

```js
import { postSystemCard } from "../helpers/chat-cards.js";        // house style, mechanical updates
import { postInCharacterCard } from "../helpers/chat-cards.js";   // themed, normal chat
import { postMonologueCard } from "../helpers/chat-cards.js";     // themed, expanded weight
import { postCompletionCard } from "../helpers/chat-cards.js";    // themed, ceremony
import { postPersonaSwitchCard } from "../helpers/chat-cards.js"; // themed (new persona)
import { postLetterCard } from "../helpers/chat-cards.js";        // themed (sender)
```

Each helper:
1. Resolves the theme id from the actor (or "npc"/"system" for non-character cards).
2. Wraps content via `themedWrap()` from `module/helpers/themed-wrap.js`.
3. Stores `cardType`, `speakerActorId`, `speakerTheme`, `speakerPersonaId` on the chat message flags so historic cards survive theme changes.
4. Calls `ChatMessage.create({...})`.

Templates live under `templates/chat-cards/` (one per variant). Per-variant CSS lives under `styles/components/_chat-card-{variant}.css` plus a shared `_chat-card-base.css`.

Full spec in `docs/design/10-chat-cards.md`.
```

### 1.2 Update §6.3 (Family schema) — flag for revision

**Find** the §6.3 Family schema and **append** a note before the schema block:

```markdown
> **Schema revision flagged.** Per `docs/design/14-family-sheet.md` §"Open questions" 3, 4, the Family schema's `heirStatus: boolean` should likely be an enum (`named-son | named-daughter | named-foster | vacant | contested`). Two optional fields are also recommended: `establishedYear: number` and `heirStatusFlavor: string` (a short italic flavor caption for the heir status row). Apply via a Session A.6 schema revision before Session B-1 builds the Family sheet.
```

### 1.3 Add to §15 anti-patterns

**Append** to the §15 bullet list:

```markdown
- ❌ Don't render the Token Hover Card with hardcoded actor-type styling. The same component template handles Majors, Connections, and NPCs via the `.gs-themed[data-theme="..."]` wrapper. Per `docs/design/17-token-hover-card.md`.
- ❌ Don't filter the Token Hover Card's content client-side. Visibility filtering for non-owners (hiding secret-persona true names, etc.) happens in `_prepareContext` server-side. Client-side filtering is not safe for secret-persona protection.
- ❌ Don't tooltip a section header without a `data-tooltip-key` attribute and a body in `lang/en.json` under `GOODSOCIETY.tooltips.{key}.body`. Per `docs/design/20-rule-tooltips.md`. Missing keys silently render no tooltip — easy to miss in QA.
- ❌ Don't manually concatenate chat-card HTML. Always go through `module/helpers/chat-cards.js`. Centralized helpers carry the right flags + theme wrapping consistently. Per `docs/design/10-chat-cards.md`.
```

### 1.4 Update §13 (Build phase status)

**Replace** the "Currently in" / "Done" / "Next" block with:

```markdown
**Currently in:** Phase 1b — CSS architecture (next: Session B-0)

**Done:**
- Phase 0: fork, rename, verify load
- Session A: all 10 DataModels defined and registered
- Session A.5: theme field backfilled on Major/Connection/NPC; chatStyle removed from Major
- Design integration v1: theming architecture, twelve-theme registry, antique-but-clean principle integrated
- Design integration v2: per-component design docs 04–09 (Major sheet, Epistolary, Connection, Dashboard, Cycle HUD, Dock) integrated
- Design integration v3: per-component design docs 10–20 integrated (chat cards, Upkeep wizard, item sheets, persona switcher, Family sheet, Welcome panel, NPC sheet, Token hover card, Condition picker, GM tools, Rule tooltips)

**Next:**
- Session A.6 (small schema revision) — Family `heirStatus` enum + optional `establishedYear` and `heirStatusFlavor` fields. ~15 minutes.
- Session B-0 — CSS architecture (variables, fonts, themedWrap helper, card primitive, .gs-themed wrapper, clayton preset)
- Session B-1 — sheet templates batch (per docs/design/04, 06, 07, 12, 14, 16; structural changes locked; full per-component specs available)
- Session B-2 — remaining eleven theme presets
- Session B-3 — chat card system (per docs/design/10) — six variants + Speaking-As switcher + Inner Monologue editor flow
- Session B-4 — Custom apps batch — Welcome Panel, Public Info Dashboard, My Characters Dock, Cycle HUD, GM Tools, Token Hover Card, Tooltip system
- Session B-5 — Persona switcher + Upkeep Wizard + Condition Picker (per docs/design/13, 11, 18) — interactive flows tied to existing data models
```

### 1.5 Add a new world setting note in §8

**Append** to the existing settings list in §8:

```markdown
- `tooltipsEnabled` — boolean. Default `true`. User scope. Hides tooltip `?` glyphs and suppresses hover when false (per `docs/design/20-rule-tooltips.md`).
- `upkeepWizardEnabled` — boolean. Default `true`. User scope. When false, Upkeep advances without opening the per-Major wizard (per `docs/design/11-upkeep-wizard.md`).
- `organizerPlayerVisible` — boolean. Default `false`. World scope. Whether non-GM users can open the NPC Organizer sidebar (per `docs/design/19-gm-tools.md`).
```

---

## Patch 2 — `PLAN.md`

### 2.1 Update §6.4 Reference: design system — full list

**Replace** the §6.4 file list with:

```markdown
### 6.4 Reference: design system

A full design-system documentation tree lives in `docs/design/`:

- `README.md` — folder orientation
- `01-mood-exploration.md` — mood directions explored, decision rationale (Closed)
- `02-theme-architecture.md` — two-layer model, scope boundaries, wrapper mechanism (Locked)
- `03-component-inventory.md` — 61 components mapped to theme scope and design status
- `decisions.md` — authoritative locked palette, type tokens, twelve-theme registry, antique-but-clean principle
- `04-character-sheet.md` — Major Character sheet (Locked)
- `05-epistolary-ui.md` — Letter composer + letter card + `themedWrap` helper (Locked)
- `06-connection-sheet.md` — Connection sheet (Locked)
- `07-public-info-dashboard.md` — Public Info dashboard (Locked)
- `08-cycle-phase-hud.md` — Cycle Phase HUD strip (Locked)
- `09-my-characters-dock.md` — My Characters dock (Locked)
- `10-chat-cards.md` — six chat card variants + Speaking-As switcher + Inner Monologue editor flow (Locked)
- `11-upkeep-wizard.md` — six-step Upkeep wizard + GM Roster (Locked)
- `12-item-sheets.md` — all five item sheets + inner-conflict box grid (Locked)
- `13-persona-switcher.md` — picker + popover + editor (Locked)
- `14-family-sheet.md` — Family sheet + crest medallion (Locked)
- `15-welcome-panel.md` — first-load modal (Locked)
- `16-npc-sheet.md` — NPC sheet + promote-to-Connection (Locked)
- `17-token-hover-card.md` — canvas hover card for all actor types (Locked)
- `18-condition-picker.md` — reputation threshold modal (Locked)
- `19-gm-tools.md` — Reveal Control + NPC Quick-Create + NPC Organizer (Locked)
- `20-rule-tooltips.md` — tooltip primitive + ~50-key content catalog (Locked)

When implementing visual surfaces, link the relevant design doc in your Claude Code prompt rather than describing the design inline. This keeps the implementation grounded in the locked decisions and prevents drift.
```

### 2.2 Update §13 (Build phases) — split late phases per the new docs

**Find** Phase 6 (Public Info dashboard) through Phase 9 (Polish) and **replace** with:

```markdown
**Phase 6 — Custom apps batch (5–7 days)**
Build the persistent UI trinity and GM tools using the `themedWrap` helper from B-0:
- Public Info dashboard (per `docs/design/07-public-info-dashboard.md`)
- My Characters dock with Speaking-As switcher (per `docs/design/09-my-characters-dock.md`)
- Cycle Phase HUD strip (per `docs/design/08-cycle-phase-hud.md`)
- Welcome Panel (per `docs/design/15-welcome-panel.md`)
- GM tools: Reveal Control, NPC Quick-Create, NPC Organizer (per `docs/design/19-gm-tools.md`)
- Token Hover Card (per `docs/design/17-token-hover-card.md`)
- In-sheet Tooltip system (per `docs/design/20-rule-tooltips.md`)

**Phase 7 — Chat card system (3–4 days)**
Six card variants + Speaking-As switcher + Inner Monologue editor flow per `docs/design/10-chat-cards.md`. Centralized helpers in `module/helpers/chat-cards.js`. Templates under `templates/chat-cards/`. The Speaking-As switcher integrates with the My Characters dock's footer.

**Phase 8 — Personas + interactive flows (4–5 days)**
- Persona switcher (picker + popover + editor) per `docs/design/13-persona-switcher.md`
- Upkeep Wizard (per-Major) + GM Roster View per `docs/design/11-upkeep-wizard.md`
- Condition Picker modal per `docs/design/18-condition-picker.md`
- Magic/Skill VFX integration with Sequencer + JB2A per `docs/design/12-item-sheets.md` Cast pipeline

**Phase 9 — Polish & content (ongoing)**
Compendium packs (canonical conditions, sample characters, sample inner conflicts, sample personas), localization (the ~50 tooltip keys catalogued in `20-rule-tooltips.md`), settings UI, README for friends installing it.
```

### 2.3 Update §15 locked-in decisions

**Append** to the numbered list in §15:

```markdown
11. **Chat card system uses the `themedWrap` helper for all character-bound variants.** Six variants are locked: system-emitted (house), in-character (themed), monologue (themed, expanded), completion ceremony (themed), persona-switch (new persona's theme), letter (sender's theme). Theme id stored on the chat message flag at post time so historic cards survive theme changes. Source of truth: `docs/design/10-chat-cards.md`.
12. **The Token Hover Card serves all three actor types** (Majors, Connections, NPCs) via the wrapper mechanism. Inventory entry #23 renamed from "NPC hover card" to "Token hover card." Source: `docs/design/17-token-hover-card.md`.
13. **The Inner Conflict box grid is a shared primitive** rendered identically on the Major sheet's Public tab and the Inner Conflict item sheet. Single Handlebars partial at `templates/components/inner-conflict-grid.hbs`. Per `docs/design/12-item-sheets.md`.
14. **Tooltips are system-wide and house-styled.** Triggered by `data-tooltip-key` attribute on section headers. ~50 tooltip keys catalogued in `docs/design/20-rule-tooltips.md`. Authored in `lang/en.json` under `GOODSOCIETY.tooltips.*`.
```

---

## Patch 3 — `docs/sessions/session-b1-briefing.md`

### 3.1 Add per-component design-doc links to "Source-of-truth" list

**Find** the "Source-of-truth design docs" list near the top and **replace** with:

```markdown
**Source-of-truth design docs to keep open:**
- `docs/design/03-component-inventory.md` — 61 components, theme scope, recommended order
- `docs/design/04-character-sheet.md` — Major Character sheet, full spec (Locked)
- `docs/design/06-connection-sheet.md` — Connection sheet, full spec (Locked)
- `docs/design/12-item-sheets.md` — all five item sheets + inner-conflict grid primitive (Locked)
- `docs/design/13-persona-switcher.md` — picker + popover + editor (deferred to Session B-5 but referenced from sheets)
- `docs/design/14-family-sheet.md` — Family sheet (Locked)
- `docs/design/16-npc-sheet.md` — NPC sheet (Locked, deltas from Connection)
- `docs/design/decisions.md` — palette/type/registry, antique-but-clean principle
- `docs/design/02-theme-architecture.md` — scope boundaries, hybrid-theming gotcha
- `CLAUDE.md` §10 — Major Character sheet skeleton (now reflects two-tab + persistent strip structure)
- `CLAUDE.md` §9 — Reputation Tag worked example for item sheets
```

### 3.2 Update "Locked sheet structures" section

**Replace** the Family sheet stanza with:

```markdown
### Family sheet (per `14-family-sheet.md`)

- Width: **580px**, height: auto
- House-styled (no `.gs-actor` wrapper). Family is shared across multiple Majors with different themes — must look "of the world."
- Six PARTS: `header`, `crest`, `origin`, `reputation`, `notes`, `members`
- Crest medallion uses monogram fallback (no per-family art needed unless `crest.imageUrl` is set)
- Member rows use cross-theme rendering (each row wrapped in `.gs-themed[data-theme="<member-theme>"]`)
- Schema revision (Session A.6) needed before this builds: `heirStatus` boolean → enum
```

**Replace** the NPC sheet stanza with:

```markdown
### NPC sheet (per `16-npc-sheet.md`)

- Width: **540px** (narrower than Connection's 600px)
- House-styled. NPC theme inherits house with no overrides.
- Same as Connection sheet **minus** the impressions list and **minus** the State row's resolve track
- Sage side panel (`var(--gs-accent-2)`) — the visual signal that this is house-styled, not character-themed
- GM pill in the header eyebrow
- Includes `[+ promote to connection]` and `[grant to player]` actions in the header
- **Reuse all shared partials from the Connection sheet** — only the impressions and state-row partials are absent
```

**Replace** the Item sheets stanza with:

```markdown
### Item sheets (per `12-item-sheets.md`)

All five: Reputation Tag (360px), Reputation Condition (380px), Inner Conflict (540px), Magic/Skill (460px), Backstory Action (400px).

- All house-styled. No `.gs-actor` class.
- Common conventions: header (eyebrow + name input + optional meta) + body (label + control field stack) + optional footer (only Magic/Skill and GM-overridden Inner Conflict have one).
- **The Inner Conflict box grid is a shared primitive** — same partial used on the Inner Conflict item sheet AND on the Major sheet's Public tab. Build at `templates/components/inner-conflict-grid.hbs`.
- Magic/Skill's Cast button has a visibility-aware confirm pipeline (per `12-item-sheets.md` §"Cast pipeline").
- Backstory Action is auto-created when an Inner Conflict completes (per the box grid primitive's completion behavior).
```

### 3.3 Add new "What's NOT in this session" note

**Find** the "What's NOT in this session" section and **append** at the end:

```markdown
- ❌ Persona switcher full editor. The in-sheet picker (closed state) per `04-character-sheet.md` and `06-connection-sheet.md` IS in scope. The popover and editor modal are in Session B-5.
- ❌ Tooltip system. The tooltip primitive is system-wide infrastructure built in Session B-4 (custom apps). However, **section headers built this session should already have the `data-tooltip-key` attributes set** so they're tooltip-ready when B-4 ships. Use the catalog in `docs/design/20-rule-tooltips.md` to map header → key.
```

### 3.4 Update implementation-order summary

**Find** the numbered "Implementation order" list and **replace** with:

```markdown
1. **Component primitives that everyone uses** — buttons (#40, #41, #42), text input + dropdown + checkbox (#36, #37, #38). Build as Handlebars partials in `templates/partials/` and matching CSS in `styles/components/`.
2. **GM pill primitive** (#60) — extracted from the NPC sheet and GM tools. Single CSS file at `styles/components/_gm-pill.css`. Used by NPC sheet header, GM tools, GM Roster View. Per `docs/design/19-gm-tools.md`.
3. **Polarity arrow primitive** (#61) — reusable ▲/▼ glyph used on tag pills, condition cards, hover cards. Per `docs/design/17-token-hover-card.md` and `docs/design/12-item-sheets.md`.
4. **Major Character sheet header** (#1) — first character-themed surface. Validates that the `.gs-actor[data-theme="..."]` selector is being set on the sheet root. Per `04-character-sheet.md` §"Header spec — locked".
5. **Token economy primitives** — resolve track (#45), MT toggle (#46), monologue dot (#47). These appear in the Major sheet's persistent strip *and* on the dashboard *and* the dock. Build once, reuse three places.
6. **Reputation primitives** — tag pills positive (#43) and negative (#44), visual reputation meter (#49), visibility flag (#48).
7. **Inner Conflict box grid** (#39) — the highest-stakes mechanical primitive. Per `docs/design/12-item-sheets.md` §"Inner Conflict box grid primitive". Build at `templates/components/inner-conflict-grid.hbs` so the same partial is used by both the Inner Conflict item sheet and the Major sheet's Public tab.
8. **Major Character full layout** — header, tab nav, Public tab, Private tab, persistent strip. Per `04-character-sheet.md`.
9. **Connection sheet** (#6) — single page, five PARTS. Per `06-connection-sheet.md`. Validates cross-theme rendering inside the impressions list.
10. **Family sheet** (#7) — per `14-family-sheet.md`. House-styled. Includes the Crest Medallion primitive (#57) — monogram fallback when `crest.imageUrl` is unset.
11. **NPC sheet** (#8) — per `16-npc-sheet.md`. Reuses Connection partials.
12. **Item sheets** (#9–13) — per `12-item-sheets.md`. Includes the Inner Conflict box grid (already built in step 7).
13. **In-sheet persona picker (closed state)** — the small inline picker on Major and Connection sheets. The popover and editor modal are deferred to Session B-5.
```

---

## Patch 4 — Out-of-band notes

These don't belong in PLAN, CLAUDE, or briefings — they're notes for Natalie:

1. **Family schema revision.** Before Session B-1 builds the Family sheet, run a tiny Session A.6 to evolve `heirStatus: boolean` to `heirStatus: enum["named-son", "named-daughter", "named-foster", "vacant", "contested"]` with `initial: "vacant"`. Add optional `establishedYear: number` and `heirStatusFlavor: string` fields. ~15 minutes of Claude Code work.

2. **`themedWrap` evolution for personas.** The helper from Session B-0 needs to apply the persona's `chatColor` as inline `style="--gs-brand: ${chatColor};"` per `docs/design/05-epistolary-ui.md` §"Sender is a Persona override." The B-0 briefing already specifies this — verify the implementation handles it before Session B-3 (chat cards).

3. **Tooltip catalog content authoring.** The ~50 tooltip keys in `docs/design/20-rule-tooltips.md` total roughly 1500–2000 words of authored copy. Worth a focused 2-hour content-authoring pass to draft them all in `lang/en.json` before the tooltip system goes live. Plan as a Phase 9 polish task (or Phase 1 if you want headers to be tooltip-ready from the start).

4. **`module/helpers/chat-cards.js` is a real file.** Six post-card helpers will live there. Build during Session B-3. Until then, any chat output (from Session B-1 sheets, etc.) should go through stub functions that just `console.log` — don't pre-implement the chat helpers, but do reference them in stubs so the eventual swap is clean.

5. **`module/helpers/reputation-rules.js` is also a real file.** Per `docs/design/18-condition-picker.md`, the helper `checkThresholdAndPrompt(actor, polarity)` runs after every reputation tag-add operation. Build during Session B-5 (Condition Picker). Inner Conflict completion logic (the 6-or-5-on-one-side rule, per CLAUDE.md §4 #4) also lives here.

6. **Token Hover Card visibility filtering is server-side.** Don't rely on client-side filtering for secret-persona protection. The `_prepareContext` of the hover card Application is where the filtering happens. Per `docs/design/17-token-hover-card.md` §"Implementation note."

7. **The condition picker's third-tag trigger** integrates with the Major sheet's Reputation Tags grid. Per `docs/design/18-condition-picker.md`, after a tag is added, the helper `checkThresholdAndPrompt(actor, polarity)` runs; if the count is exactly 3 and `promptOnThreeTags` is true, the picker opens. Wire this trigger in Session B-5, not B-1 (B-1 just builds the visual sheet).

---

## How to apply this patch

1. The file is already at the repo root (`design-integration-patch-v3.md`).
2. The eleven new design docs are already in `docs/design/`.
3. `03-component-inventory.md` and `README.md` were re-synced with their newer FVTT versions.
4. The Session B-1 briefing was revised in place.
5. Open Claude Code in the repo. Run the prompt at the top of this file.
6. Review the diffs Claude Code presents for `PLAN.md`, `CLAUDE.md`, and `docs/sessions/session-b1-briefing.md`. Commit if they match.
7. Once those are committed, decide on Session A.6 (the small Family schema revision) before Session B-0.
