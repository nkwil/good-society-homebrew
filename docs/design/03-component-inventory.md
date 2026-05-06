# 03 — Component Inventory

**Status:** Open — initial inventory complete; per-component design pending

## Purpose

This is the master list of every visual component in the Good Society Foundry system. Each entry maps a component to:

- **Source** — where in the system plan / CLAUDE.md it's specified
- **Theme scope** — house, character, or hybrid (and which sub-surfaces are which)
- **Design status** — not started, sketched, locked
- **Notes** — anything specific the design needs to honor

When a component is fully designed, it gets its own `0X-{component}.md` file under `docs/design/` and this entry links to it.

The "antique but clean and legible" principle (see `decisions.md`) applies to everything below without further mention.

## How theme scope works

Three values:

- **House** — uses the Inkwell & Wildflower house style only. Theme-neutral. Applies to chrome, item sheets, mechanical surfaces.
- **Character** — adopts a single actor's theme. Applies to character sheets, letters, in-character chat, persona-bound surfaces.
- **Hybrid** — primarily house-styled, with per-actor accents that pull from the character theme (typically: a name color, a portrait border, a tag accent stripe). Applies to shared surfaces that need to identify individual characters.

Reference: `02-theme-architecture.md` for the scope-boundary rules.

## Actor sheets

| # | Component | Source | Theme scope | Status | Notes |
|---|-----------|--------|------------|--------|-------|
| 1 | Major Character — sheet header | Plan §6.1, CLAUDE.md §10 | Character | Designed | Locked in `04-character-sheet.md`. 130px portrait side panel + flex main. Persona switcher in side panel; eyebrow + name + role + tab nav in main column. |
| 2 | Major Character — tab nav | Plan §6.1 | Character | Designed | Locked in `04-character-sheet.md`. **Two tabs only** (Public, Private) — Tokens & Cycle moved to a persistent strip rather than a third tab. Active tab carries a 1.5px `--gs-brand` underline. |
| 3 | Major Character — Public tab | Plan §6.1 (public) | Character | Designed | Locked in `04-character-sheet.md`. Five sections: Reputation Criteria (read-only from Family), Tags grid, Active Conditions, Inner Conflict (5+5 box grid), Completed Conflicts. Possible Conditions drag target replaced by the Condition Picker modal that fires on third-tag threshold. |
| 4 | Major Character — Private tab | Plan §6.1 (private) | Character | Designed | Locked in `04-character-sheet.md`. Seven sections: Bio chips inline, Desire, Notes & Objectives, Connections, Backstory, Magic/Skills, Adventurer Sentiment. Visibility flag indicator on each text field. |
| 5 | Major Character — Tokens & Cycle persistent strip | Plan §6.1, §9 | Hybrid | Designed | Locked in `04-character-sheet.md` as a persistent bottom strip. Resolve + MT + monologue dot left; cycle phase + Take Monologue button right. Replaces the third tab in the original PARTS skeleton. |
| 6 | Connection — sheet | Plan §6.2 | Character (connection variant) | Designed | Locked in `06-connection-sheet.md`. Single-page (no tabs), 600px wide. Header with cross-theme linked-Major reference. Description block. Impressions list with per-Major accent stripes (cross-theme rendering). Scene info (public tags + hover summary). State row (resolve + personas). |
| 7 | Family — sheet | Plan §3.3 | House | Designed | Locked in `14-family-sheet.md`. 580px single-page. Header + crest medallion (monogram fallback) + motto + origin/heir status + reputation criteria + GM notes + member Majors with cross-theme accents. House-styled because Families are shared across multiple Majors with different themes. |
| 8 | NPC — sheet | Plan §3.4 | House | Designed | Locked in `16-npc-sheet.md`. 540px, deltas from Connection: no impressions, no resolve track, sage side panel, GM pill, "[+ promote to Connection]" affordance. |

## Item sheets

All item sheets are house-styled — items are objects in the world, not voices.

| # | Component | Source | Theme scope | Status | Notes |
|---|-----------|--------|------------|--------|-------|
| 9 | Reputation Tag — sheet | Plan §4, CLAUDE.md §9 | House | Designed | Locked in `12-item-sheets.md`. 360px popup. Polarity toggle, description, source. |
| 10 | Reputation Condition — sheet | Plan §4 | House | Designed | Locked in `12-item-sheets.md`. 380px. Polarity, description, active toggle, source-tag references. |
| 11 | Inner Conflict — sheet | Plan §4 | House | Designed | Locked in `12-item-sheets.md`. 540px. Left/right labels + 5+5 box grid (primitive #39, also rendered on Major sheet). Completion fires ceremony card + auto-creates Backstory Action. |
| 12 | Magic/Skill — sheet | Plan §4, §10 | House | Designed | Locked in `12-item-sheets.md`. 460px. Cast button with visibility-aware confirm pipeline. Sequencer + JB2A integration. `triggersPersonaSwap` reference. |
| 13 | Backstory Action — sheet | Plan §4 | House | Designed | Locked in `12-item-sheets.md`. 400px. Auto-created on conflict completion. Source conflict reference, expanded/used toggles. |

## Custom apps and overlays

| # | Component | Source | Theme scope | Status | Notes |
|---|-----------|--------|------------|--------|-------|
| 14 | Public Info / Facilitator Dashboard | Plan §7, §12.5 | Hybrid | Designed | Locked in `07-public-info-dashboard.md`. House-styled chrome with per-Major rows that pull theme accents via `.gs-themed` wrapper. Five-theme cohabitation proven in mockup. Real-time updates via `updateActor` hook subscriptions. |
| 15 | My Characters Dock | Plan §12.1 | Hybrid | Designed | Locked in `09-my-characters-dock.md`. Pinned panel, 290px wide. Header + Major rows + Connections divider + Connection rows + footer with Speaking-As switcher. |
| 16 | Cycle Phase HUD Strip | Plan §12.2 | House | Designed | Locked in `08-cycle-phase-hud.md`. Thin 40px strip at top of canvas. Cycle counter, six-phase progression track, GM-only Advance Phase button. |
| 17 | Upkeep Wizard | Plan §12.2 | Hybrid | Designed | Locked in `11-upkeep-wizard.md`. Six-step per-Major modal (welcome → tokens → notes → desire → reputation review → complete). Themed to the active Major. GM Roster View instead of own wizard for GM users. |
| 18 | ~~Welcome Panel~~ | ~~Plan §12.6~~ | — | **Cut (2026-05-06)** | Removed from scope when the bundled sample world was cut. Without a Sample World card, the remaining two options didn't justify a first-load modal. Design preserved in `15-welcome-panel.md` for future reference. |
| 19 | Bulk Permissions Panel | Plan §12.5 | House | Designed | Locked in `22-bulk-permissions-panel.md`. 720px GM-only grid: actors × users with permission level dropdowns. Grouped by actor type (Majors, Connections, NPCs). Pure utility surface, house-styled chrome. |
| 20 | Reveal Control widget | Plan §12.5 | Hybrid | Designed | Locked in `19-gm-tools.md`. Single-field popover (360px) for per-field visibility flips, plus multi-field bulk form fired from dashboard's "reveal desires" GM action. House chrome with per-actor name accent. |
| 20a | Condition Picker Modal | Plan §12.3 | Character | Designed | Locked in `18-condition-picker.md`. 520px non-blocking themed modal triggered when 3rd tag of a polarity is added. Sources from bundled + homebrew compendiums. Three close paths: pick / later / no-condition. |
| 21 | NPC Quick-Create modal | Plan §12.5 | House | Designed | Locked in `19-gm-tools.md`. 380px modal triggered by canvas right-click. Name + role dropdown + optional portrait. Drops actor + token at click coordinates. |
| 22 | NPC Organizer (per scene) | Plan §12.5 | House | Designed | Locked in `19-gm-tools.md`. 290px sidebar listing Connection + NPC tokens on active scene. Click to focus camera, right-click for actions. Cross-theme rendering on rows. |
| 23 | Token Hover Card | Plan §8 | Hybrid | Designed | Locked in `17-token-hover-card.md`. 210px card serving Major/Connection/NPC tokens (renamed from "NPC hover card" since it serves all three). Persona-aware, visibility-respecting, position-aware. |
| 24 | Edit-Conflict Warning | Plan §12.7 | House | Designed | Locked in `21-edit-conflict-warning.md`. Three-layer system: awareness banner (passive), field-level presence indicator (subtle), save-time conflict warning toast with diff resolution (action-required). |
| 24a | Pending Changes Log section | `26-pending-changes-log.md` | House | Designed | Inline "Since last Upkeep" section on Major sheet's Public tab. Conditional render — collapses when `pendingChanges.length === 0`. Sits between Active Conditions and Inner Conflict. Cleared on Upkeep acknowledge. |
| 24b | Session Log preview modal | `24-session-log.md` | House | Designed | Auto-generated end-of-session journal entry. Event tracking via world flag `flags["good-society-homebrew"].sessionEvents`. Markdown generation + preview modal + dated journal entry on "End Session" click. |
| 24c | Backup & Export utility | `25-backup-export.md` | House | Designed | GM-only. Single .json export with metadata envelope (format/version/exportedAt/exportedBy/world/data). Merge-or-replace import. Accessible from settings menu or scene control button. |

## Chat and communication

| # | Component | Source | Theme scope | Status | Notes |
|---|-----------|--------|------------|--------|-------|
| 25 | Chat card — system-emitted | CLAUDE.md §11, `10-chat-cards.md` | House | Designed | Mechanical chat output: phase changes, bulk actions, "X joined", reputation tag added, monologue taken (announcement only). House style throughout. |
| 26 | Chat card — in-character (persona-aware) | Plan §12.1, `10-chat-cards.md` | Character | Designed | Speaker's persona portrait + name, message body styled with active theme. Persona's `chatColor` overrides character theme's brand if set. Theme stored on chat message at post time. |
| 27 | Speaking-As chat switcher | Plan §12.1, `10-chat-cards.md` | Hybrid | Designed | Above chat input. Speaker selector + mode label. Persona-expandable per actor. Synced with the dock's footer switcher via single user setting. |
| 28 | Inner Monologue editor + journal entry + chat card | Plan §12.4, `10-chat-cards.md` | Character | Designed | "Take Monologue" → editor (themed) → journal entry + themed chat card with expanded weight + sets `monologuedThisCycle`. |
| 29 | Inner Conflict completion ceremony card | Plan §12.4, `10-chat-cards.md` | Character | Designed | Auto-posted on conflict completion. Centered "EARNED" footer, gold star, themed to resolver. Auto-creates Backstory Action item. |
| 30 | Epistolary Letter composer | Plan §12.5 | Hybrid | Designed | Locked in `05-epistolary-ui.md`. House-styled chrome with sender-themed live preview pane. Auto-saving drafts. Single-recipient v1. |
| 31 | Epistolary Letter card (in chat / journal) | Plan §12.5 | Character (sender) | Designed | Locked in `05-epistolary-ui.md`. Single template at `templates/components/letter-card.hbs` wrapped in `.gs-themed[data-theme="..."]`. |
| 32 | Persona switch announcement card | CLAUDE.md §11, `10-chat-cards.md` | Character | Designed | Posted when an actor swaps persona. Whispered or public depending on the persona's `visibility.magic`. Uses the *new* persona's theme. |

## Component primitives

These are the reusable building blocks that compose all of the above. House style is the default; themes override via CSS variables.

| # | Component | Theme behavior | Status | Notes |
|---|-----------|----------------|--------|-------|
| 33 | Card surface | Inherits scope | Not started | Padding 18–24px, `border-radius: 12px`, 0.5px border in `--gs-accent-2` or `--gs-muted`. |
| 34 | Section header (small caps) | Inherits scope | Not started | Display font, 12px, letter-spacing 0.12em, font-feature-settings 'smcp', color `--gs-brand`. Optional 0.5px hairline rule below. The `?` glyph for tooltip-bearing headers (`20-rule-tooltips.md`). |
| 35 | Hairline divider | Inherits scope | Not started | 0.5px solid `--gs-accent-2` or `--gs-muted`. Optional centered ornament (small floral or simple lozenge). |
| 36 | Text input / textarea | House | Not started | 14px body type, 0.5px border `--gs-muted`, focus ring 1px `--gs-brand`. |
| 37 | Dropdown / select | House | Not started | Match text input height (36px) and styling. |
| 38 | Checkbox | Inherits scope | Not started | Used for inner conflict box grid (large) and visibility toggles (small). |
| 39 | Inner Conflict box grid (5+5) | Character | Designed | Locked in `12-item-sheets.md`. Rendered on Major sheet Public tab AND Inner Conflict item sheet. 22×22px boxes, fill with `--gs-brand` when checked. Completion fires ceremony + auto-creates Backstory Action. |
| 40 | Button — primary | Inherits scope | Not started | Solid `--gs-brand` background, paper text. Used for "Take Monologue", "Cast", "Advance Phase". |
| 41 | Button — secondary | Inherits scope | Not started | Outline only. 0.5px border `--gs-brand`. Body text in `--gs-brand`. |
| 42 | Button — GM-only | House | Not started | Distinguished by a small key icon and slightly different styling. Always confirms before destructive actions. |
| 43 | Reputation tag pill — positive ▲ | Hybrid | Not started | Pill shape, paper bg, small ▲ marker, `--gs-positive` accent stripe on the left edge. |
| 44 | Reputation tag pill — negative ▼ | Hybrid | Not started | Same as above with ▼ marker and `--gs-danger` accent. |
| 45 | Resolve token track | Character | Sketched | Five-pip horizontal row. Used in Major sheet strip, dashboard, dock. |
| 46 | MT toggle | Character | Not started | Single small badge. Off = outline; On = filled `--gs-brand` with "MT" in paper color. |
| 47 | Monologue dot | Character | Not started | Tiny circular indicator. Available = `--gs-accent-3` filled; spent = outline only. |
| 48 | Visibility flag indicator | Hybrid | Not started | Three-state pill or inline icon: secret/public/redacted. |
| 49 | Visual reputation meter | Character | Not started | Three-pip indicator showing how close to a condition trigger. |
| 50 | Portrait frame (oval, side panel) | Character | Sketched | Oval frame, 78×92px on Major sheet, 70×84px on Connection/NPC, smaller in dock and dashboard rows. |
| 51 | Token frame (canvas) | Character | Designed | Locked in `27-token-frame.md`. Three variants: Major 3px solid ring + glow, Connection 2px solid ring, NPC 1px dashed ring. Implemented via Foundry's TokenRing API with custom PIXI overlay fallback. Persona-aware ring color. |
| 52 | Modal / dialog | House | Not started | `border-radius: 16px`, paper background, optional title bar in `--gs-brand` with paper text. |
| 53 | Tab navigation | Inherits scope | Not started | See #2 above. |
| 54 | Icon button | Inherits scope | Not started | 28px square, ghost by default, hover fill `--gs-paper-warm`. |
| 55 | Tooltip / In-sheet rule tooltip | House | Designed | Locked in `20-rule-tooltips.md`. System-wide tooltip primitive triggered by `data-tooltip-key` on section headers. 290px. 600ms hover delay with dwell-mode bypass. ~50 tooltip keys catalogued. |
| 56 | Persona switcher | Character | Designed | Locked in `13-persona-switcher.md`. Three contexts: in-sheet picker (closed), switcher popover (open), full editor modal. Stripe color encodes persona character (brand for primary, danger for secret, accent-3 for other). |
| 57 | Crest medallion | House | Designed | Locked in `14-family-sheet.md`. 92×110px oval, two-layer (honey-gold ring + forest-green field), monogram fallback when no `imageUrl` set. |
| 58 | Magic skill tile | Character | Designed | Locked in `12-item-sheets.md` (cast pipeline) and `04-character-sheet.md` (sheet placement). Cast button with visibility-aware confirm. |
| 59 | Family panel (read-only on Major sheet) | Hybrid | Designed | Locked in `04-character-sheet.md` Public tab spec. Renders Family info on the Major sheet. Family chrome is house; the panel sits inside the character-themed sheet. |
| 60 | GM pill | House | Designed | Locked in `19-gm-tools.md` and used across NPC sheet, GM tools, GM roster. Terracotta bg, paper text, 10px Crimson, 1×7px padding. Extracted as a primitive for reuse. |
| 61 | Polarity arrow | Inherits scope | Designed | Locked in `17-token-hover-card.md`. Reusable ▲/▼ glyph used on reputation tag pills, condition cards, condition picker, hover card. |

## Counts

- **Sheets and apps:** 32 components
- **Primitives:** 29 components (added GM pill #60, polarity arrow #61)
- **Total:** 61

Status as of 2026-05-05: 30 designed (#1–8 actor sheets, #9–13 item sheets, #14–18 apps, #20 + 20a + 21–23 GM tools, #25–32 chat cards, #39 inner conflict grid, #55 tooltip, #56 persona switcher, #57 crest medallion, #58 magic skill tile, #59 family panel, #60 GM pill, #61 polarity arrow), 0 sketched-only (45/50 promoted to designed), 31 not started (most remaining primitives).

## Implementation order (suggested)

When this document feeds into actual code work in Claude Code, the recommended order matches the system plan's build phases (CLAUDE.md §13, Plan §14):

1. Component primitives 33–35 (card, section header, divider) — foundational, used everywhere
2. Component primitives 40–42 (buttons), 36–38 (form inputs)
3. Major Character sheet header (#1) — first character-themed surface, validates the wrapper mechanism
4. Resolve token track (#45), MT toggle (#46), monologue dot (#47) — token economy primitives
5. Reputation tag pills (#43, #44) and meter (#49)
6. Inner Conflict box grid (#39) — the highest-stakes mechanical primitive (used by Major sheet AND item sheet)
7. Major Character sheet tabs (#2–5) and full layout
8. Connection sheet (#6), Family sheet (#7), NPC sheet (#8) — remaining actor sheets
9. Item sheets (#9–13)
10. Public Info dashboard (#14), Cycle HUD (#16), My Characters dock (#15)
11. Chat cards (#25–32) including monologue and letter flows
12. Upkeep Wizard (#17) — the highest-impact polish surface
13. Remaining apps and primitives (GM tools, hover cards, tooltips)

This roughly tracks the system plan's phases 1–11.

## Files this will spawn

As individual components reach the design stage, they get their own document under `docs/design/`:

- `04-character-sheet.md` ✓ (Locked)
- `05-epistolary-ui.md` ✓ (Locked)
- `06-connection-sheet.md` ✓ (Locked)
- `07-public-info-dashboard.md` ✓ (Locked)
- `08-cycle-phase-hud.md` ✓ (Locked)
- `09-my-characters-dock.md` ✓ (Locked)
- `10-chat-cards.md` ✓ (Locked)
- `11-upkeep-wizard.md` ✓ (Locked)
- `12-item-sheets.md` ✓ (Locked, includes inner conflict grid)
- `13-persona-switcher.md` ✓ (Locked)
- `14-family-sheet.md` ✓ (Locked)
- `15-welcome-panel.md` ✓ (Locked)
- `16-npc-sheet.md` ✓ (Locked)
- `17-token-hover-card.md` ✓ (Locked)
- `18-condition-picker.md` ✓ (Locked)
- `19-gm-tools.md` ✓ (Locked, three GM tools)
- `20-rule-tooltips.md` ✓ (Locked)
- `21-edit-conflict-warning.md` ✓ (Locked)
- `22-bulk-permissions-panel.md` ✓ (Locked)
- `23-primitives-batch.md` ✓ (Locked)
- `24-session-log.md` ✓ (Locked)
- `25-backup-export.md` ✓ (Locked)
- `26-pending-changes-log.md` ✓ (Locked)
- `27-token-frame.md` ✓ (Locked)
- `28-foundry-chrome-theme.md` ✓ (Locked)

## Changelog

| Date       | Change                                                                |
|------------|-----------------------------------------------------------------------|
| 2026-05-05 | File created. Full inventory of 59 components captured with theme scope and design status. |
| 2026-05-05 | Status updates: #1–5 (Major Character sheet) marked Designed in `04-character-sheet.md`. #30–31 (Epistolary) marked Designed in `05-epistolary-ui.md`. Major sheet structure: two tabs + persistent strip. |
| 2026-05-05 | Status updates: #6 (Connection sheet) Designed in `06-connection-sheet.md`. #14 (Public Info dashboard) Designed in `07-public-info-dashboard.md`. Cross-theme rendering pattern documented and visually proven. |
| 2026-05-05 | Status updates: #15 (My Characters Dock) Designed in `09-my-characters-dock.md`. #16 (Cycle Phase HUD) Designed in `08-cycle-phase-hud.md`. Persistent UI trinity complete. |
| 2026-05-05 | Eleven new docs landed (10–20). Status flips: #7, #8, #9–13, #17, #18, #20, #21–23, #25–29, #32, #39, #55, #56, #57, #58, #59 all Designed. New entries: #20a Condition Picker, #60 GM pill, #61 Polarity arrow. Component #23 renamed from "NPC hover card" to "Token hover card" since it serves all three actor types. |
| 2026-05-06 | Design integration v4 (docs 21–28 + 00). Status flips: #19 (Bulk Permissions Panel) → Designed per `22-bulk-permissions-panel.md`; #24 (Edit-Conflict Warning) → Designed per `21-edit-conflict-warning.md`; #51 (Token frame) → Designed per `27-token-frame.md`. New entries: #24a Pending Changes Log section, #24b Session Log preview modal, #24c Backup & Export utility. Design docs list extended to include 21–28. |
