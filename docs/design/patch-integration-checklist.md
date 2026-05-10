# Patch integration checklist

> **Status:** drafting. This is the working list for landing the post-MVP design patch into the existing built system at `/Users/nataliewilson/Code/foundry-systems/good-society-homebrew`.
>
> **Companion docs:** [`post-mvp-design-patch.md`](./post-mvp-design-patch.md) is the spec. [`patch-preview-post-mvp.html`](./patch-preview-post-mvp.html) is the visual reference.
>
> **Out of scope for this doc:** the dossier refactor (separate spec — `patch-dossier-refactor.md`), the Cabinet (separate spec — `patch-cabinet.md`), the Arrival (separate spec — `patch-arrival.md`).

This doc covers everything that's a styling refinement or visual touch on **modules that already exist and work** in the repo. None of these items require JS rewrites; most are pure CSS and a few are template tweaks.

---

## 0. Repo state assumed

- Build is at Session B-5 complete per `CLAUDE.md` §13.
- All 10 data models, all four actor sheets, all five item sheets, 14+ apps, hooks, helpers all exist and load.
- All 12 themes (`_theme-rose.css` through `_theme-connection-grey.css` + `_theme-npc.css`) exist.
- Bundled font files for Lora, Crimson Text, Cormorant Garamond, EB Garamond, DM Serif Display, and Cinzel are in `styles/fonts/`.
- Legacy boilerplate files (`module/boilerplate.mjs`, `module/sheets/actor-sheet.mjs`, etc.) are still present but not actively used by Good Society code paths. Cleanup is out of scope here.

---

## 1. Shared rules (reference these per-module)

These four rules appear repeatedly in §3 below. Each module section says "apply rule 1.1" or "apply rule 1.2" rather than restating.

### 1.1 Functional colors — light + dark variants

The `:root` defines the cream-surface (light) values:

```css
:root {
  --gs-positive: #4A7A4A;          /* verdant */
  --gs-danger:   #8B2A2A;          /* oxblood */
  --rep-positive-bg: rgba(74, 122, 74, 0.08);
  --rep-negative-bg: rgba(139, 42, 42, 0.08);
  --rep-empty-fg:    rgba(112, 128, 96, 0.4);
}
```

Dark themes (Mags, Avril) override all five to brighter values that read on near-black:

```css
.gs-actor[data-theme="mags"],
.gs-themed[data-theme="mags"] {
  --gs-positive: #7AB87A;          /* mint-bright */
  --gs-danger:   #D85959;          /* clear red */
  --rep-positive-bg: rgba(122, 184, 122, 0.12);
  --rep-negative-bg: rgba(216, 89, 89, 0.12);
  --rep-empty-fg:    rgba(200, 197, 192, 0.35);
}

.gs-actor[data-theme="avril"],
.gs-themed[data-theme="avril"] {
  --gs-positive: #7AB87A;
  --gs-danger:   #D85959;
  --rep-positive-bg: rgba(122, 184, 122, 0.14);
  --rep-negative-bg: rgba(216, 89, 89, 0.14);
  --rep-empty-fg:    rgba(232, 221, 200, 0.35);
}
```

**Rule:** any time a component carries positive/negative reputation semantics (rep tag pill, condition state, dashboard sub-rail pill, etc.) it binds to `--gs-positive` / `--gs-danger` and never to a theme accent.

### 1.2 Indicator unification

Every indicator across the system follows the same rule:

- **Available / active state:** filled `--gs-brand`.
- **Spent / unavailable state:** outline `--gs-brand` at ~45% opacity.
- **Shape carries semantics:** pill = MT, dot = monologue, pip = resolve, square = inner-conflict box, disc = phase marker, etc. Color does NOT change between states.

Color is only used semantically (positive/negative wax-seal pendants on the dossier, danger states on chat cards). Never to indicate "available vs. spent."

### 1.3 Section eyebrow style

Standalone eyebrow heading (default):

```css
font-family: 'Lora', serif;
font-weight: 600;
font-size: 11.5px;
letter-spacing: 0.18em;
color: var(--gs-brand);     /* (or --dossier-rose where dossier scopes it) */
text-transform: uppercase;
margin: 0 0 9px;
padding-bottom: 5px;
border-bottom: 1px solid var(--gs-accent-2);  /* sage hairline */
position: relative;
```

Plus a gilt diamond `◆` punctuating the right edge:

```css
.eyebrow::after {
  content: '◆';
  position: absolute;
  right: 0; bottom: -5px;
  font-size: 8px;
  color: var(--gs-accent-3);   /* gilt */
  background: var(--gs-paper);  /* cream — cuts through the hairline */
  padding: 0 5px;
  line-height: 1;
}
```

Subdued variant (used inside contained blocks where the container's own border would double up): drop the divider and step the size/weight down to Lora 500 / 10.5 px / `--gs-accent-2` color.

### 1.4 Dark-theme cross-surface exception

Mags and Avril are dark-paper themes whose v1 `--gs-brand` (cool grey, candlelight gold) is calibrated to read on near-black. On shared cream surfaces — dashboard rows, dock rows, dossier theme swatches, chat cards in cream chrome, board entries — those two themes substitute their v1 `--gs-accent-1` (deep blood `#6B0F1A`, oxblood `#8B2A2A`) so they have visible identifying color.

This is implemented per-theme in the theme CSS files, not as a global rule. New dark themes added later must override `--gs-brand` to a cream-readable value on `.gs-themed` (the wrapper used for content traveling onto cream surfaces) while keeping the original `--gs-brand` on `.gs-actor` (the actor's own sheet body, which sits on dark paper).

---

## 2. CSS-only touches

These are modifications to existing files. No code changes required.

### 2.1 `styles/_variables.css`

**Verify present:**
- `--gs-positive: #4A7A4A`
- `--gs-danger: #8B2A2A`

**Add (if not present):**
- `--rep-positive-bg: rgba(74, 122, 74, 0.08)`
- `--rep-negative-bg: rgba(139, 42, 42, 0.08)`
- `--rep-empty-fg: rgba(112, 128, 96, 0.4)`
- `--gs-ornament: 'Lavishly Yours', 'Lora', cursive, serif`

### 2.2 `styles/themes/_theme-mags.css` and `_theme-avril.css`

**Add to each:** the 5-variable functional-color override block from rule 1.1. Both for `.gs-actor[data-theme="…"]` (sheet body) AND `.gs-themed[data-theme="…"]` (traveling content).

### 2.3 `styles/_fonts.css`

**Add Lavishly Yours.** Two options:

- **Local-bundled (matches existing pattern):** add `@fontsource/lavishly-yours` to `package.json`, run the existing font-copy script (`scripts/copy-fonts.mjs` per CLAUDE.md §15 — B-0 entry), declare `@font-face` in `_fonts.css` pointing at `styles/fonts/lavishly-yours/lavishly-yours-latin-400-normal.woff2`.
- **Google Fonts:** add `<link href="https://fonts.googleapis.com/css2?family=Lavishly+Yours&display=swap">` to `system.json`'s `styles` array OR import in `good-society.css`.

Local-bundled is preferred for offline play and to match the v1 architecture decision (CLAUDE.md §15 B-0).

### 2.4 `styles/components/_reputation-tag.css`

**Rebind to functional colors.** Replace any `--dossier-sage` / `--gs-accent-2` references for tag color with `--gs-positive`. Replace any `--dossier-terracotta` / `--gs-accent-1` references with `--gs-danger`. Backgrounds use `--rep-positive-bg` / `--rep-negative-bg`.

**Pill geometry:**

```css
.gs-rep-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px 4px 10px;
  border-radius: 100px;
  border: 1px solid var(--gs-positive);
  background: var(--rep-positive-bg);
  color: var(--gs-positive);
  font-family: 'Lora', serif;
  font-weight: 500;
  font-size: 12.5px;
  letter-spacing: 0.02em;
}
.gs-rep-tag .mark { font-size: 9px; line-height: 1; }
.gs-rep-tag--negative {
  border-color: var(--gs-danger);
  color: var(--gs-danger);
  background: var(--rep-negative-bg);
}
.gs-rep-tag--empty {
  border-style: dashed;
  border-color: var(--rep-empty-fg);
  color: var(--rep-empty-fg);
  background: transparent;
}
```

The exact class names should match what the existing CSS file uses — check before writing. The intent is to **reuse the same selectors and just change values**, not rename.

### 2.5 `styles/components/_section-header.css`

**Apply rule 1.3.** Strengthen the standalone eyebrow per the spec. Add the subdued variant for contexts where the eyebrow sits inside a paper-warm container with its own border.

If the existing eyebrow style is already strong, this may be a no-op — verify against the spec before changing.

### 2.6 `styles/components/_resolve-track.css`, `_mt-badge.css`, `_monologue-dot.css`, `_phase-marker.css`, `_inner-conflict-grid.css`

**Apply rule 1.2.** Audit each: any place where the indicator changes COLOR between available/spent (e.g., gilt → empty, brand → grey), refactor to filled-vs-outline of `--gs-brand` only.

This is where most "color-coded state" logic likely lives in the existing build. Each file gets an audit pass.

### 2.7 `styles/components/_dashboard-row.css`

**Apply rule 1.4.** Verify that `--row-brand` (the per-row accent stripe variable) reads from the actor's theme via `.gs-themed[data-theme="..."]` cascade. For Mags and Avril, the value comes from their dark-theme `.gs-themed` block per rule 1.4 — should automatically be the `--gs-accent-1` value.

If the row currently hardcodes a per-theme color in `_dashboard-row.css` itself (e.g., `.row.theme-mags { --row-brand: ... }`), remove those hardcodes and let the theme CSS provide them via `.gs-themed`.

### 2.8 `styles/foundry-chrome.css`

**No change expected.** Verify the chrome theme uses house style (`--gs-paper`, `--gs-brand`, etc.) directly and not theme-overridable values. Foundry chrome is shared across all actors; it should always render in house style.

---

## 3. Per-module audit

For each module: list the files, list what to verify, and note any required edits. If a module passes the audit unchanged, that's a valid outcome.

### 3.1 Public Info Dashboard

**Files:** `module/apps/public-info-dashboard.js`, `templates/apps/dashboard.hbs`, `styles/apps/_dashboard.css`, `styles/components/_dashboard-row.css`, `templates/components/dashboard-major-row.hbs`.

**Verify:**

- Row accent stripe binds to `var(--gs-brand)` via `.gs-themed[data-theme="..."]` cascade. (Apply rule 1.4 — Mags/Avril rows pick up their dark-theme `--gs-brand` override automatically.)
- Resolve pips, MT pill, monologue dot in each row apply rule 1.2 (brand-on / brand-outline).
- Condition pills in the row sub-rail apply rule 1.1 (functional colors). They should look identical to the dossier rep-tag pills modulo size.
- The `dashboard-major-row.hbs` partial does NOT hardcode color states (e.g., no `class="filled green"` or `class="spent grey"`).

**Visual reference:** `patch-preview-post-mvp.html` §ii.

### 3.2 Cycle Phase HUD

**Files:** `module/apps/cycle-hud.js`, `styles/apps/_cycle-hud.css`, `styles/components/_phase-marker.css`.

**Verify:**

- Six phase markers (one per cycle phase: pre-cycle / novel / reputation / rumour-scandal / epistolary / upkeep) render with rule 1.2 — past = filled, current = filled + halo, future = outline.
- No phase-specific colors. Halo is `--gs-accent-3` (gilt).

### 3.3 My Characters Dock

**Files:** `module/apps/my-characters-dock.js`, `module/helpers/dock-context.js`, `templates/apps/dock.hbs`, `templates/components/dock-major-row.hbs`, `dock-connection-row.hbs`, `styles/apps/_dock.css`, `styles/components/_dock-row-major.css`, `_dock-row-connection.css`.

**Verify:**

- Each Major row's accent + portrait disc adopts the actor's theme via `.gs-themed` (rule 1.4 carries Mags/Avril fallback automatically).
- Connection rows adopt the connection variant theme.
- Indicators apply rule 1.2.
- Eyebrow labels in the dock header apply rule 1.3.

**No expected JS changes.**

### 3.4 Persona Switcher (popover)

**Files:** `module/apps/persona-switcher-popover.js`, `styles/components/_persona-switcher-popover.css`, `_persona-picker.css`.

**Verify:**

- The popover's row hover states use `--gs-paper-warm` background, no theme-shift per row.
- Active persona indicator uses rule 1.2 (filled `--gs-brand` ring or fill).
- Switcher's container uses house chrome (`--gs-paper`, sage hairlines) regardless of which actor's persona is being switched. The persona ITEMS inside reflect each persona's `chatColor` if defined (small colored swatch next to the name).

### 3.5 Persona Editor

**Files:** `module/apps/persona-editor.js`, `templates/apps/persona-editor.hbs`, `styles/apps/_persona-editor.css`.

**Verify:**

- Form fields use the standard form-input styling from `_form-inputs.css`.
- Eyebrow section labels apply rule 1.3.
- "Visibility" radio group uses functional state colors (or stays neutral — not strictly positive/negative semantics).

### 3.6 Upkeep Wizard / Roster

**Files:** `module/apps/upkeep-wizard.js`, `upkeep-roster.js`, `templates/apps/upkeep-wizard.hbs`, `upkeep-roster.hbs`, `styles/apps/_upkeep-wizard.css`, `_upkeep-roster.css`.

**Verify:**

- Step indicator dots apply rule 1.2 (past = filled, current = filled + halo, future = outline).
- Per-Major roster rows in the GM view adopt their actor's theme via `.gs-themed`.
- "Pending changes" preview inside the wizard uses rule 1.1 for positive/negative items.
- Eyebrows apply rule 1.3.

### 3.7 Condition Picker

**Files:** `module/apps/condition-picker.js`, `templates/apps/condition-picker.hbs`, `styles/apps/_condition-picker.css`.

**Verify:**

- Condition options render as pill chips matching rule 1.1 (functional colors per polarity).
- Modal chrome uses house style.

### 3.8 Bulk Permissions Panel

**Files:** `module/apps/bulk-permissions-panel.js`, `templates/apps/bulk-permissions-panel.hbs`, `styles/apps/_bulk-permissions-panel.css`, `styles/components/_permission-pill.css`.

**Verify:**

- Permission pills (`NONE / OBSERVER / OWNER`) use rule 1.2 — filled-or-outline `--gs-brand` for the active state, outlines for others. NOT three different colors.
- Cell hover states are paper-warm tint, not color-coded.
- Eyebrows apply rule 1.3.

### 3.9 NPC Organizer

**Files:** `module/apps/npc-organizer.js`, `templates/apps/npc-organizer.hbs`, `styles/apps/_npc-organizer.css`.

**Verify:**

- Organizer renders all NPCs in house style (the NPC theme is house style — no per-NPC theme override).
- Bulk-action buttons follow the standard button style.

### 3.10 NPC Quick Create

**Files:** `module/apps/npc-quick-create.js`, `templates/apps/npc-quick-create.hbs`, `styles/apps/_npc-quick-create.css`.

**Verify:**

- Form fields use standard `_form-inputs.css` styling.
- House style chrome.

### 3.11 Monologue Editor

**Files:** `module/apps/monologue-editor.js`, `templates/apps/monologue-editor.hbs`, `styles/apps/_monologue-editor.css`.

**Verify:**

- The editor's surface uses the active actor's theme (a monologue is themed by its speaker).
- Eyebrow labels (Title, Body, Visibility) apply rule 1.3.

### 3.12 Session Log Preview

**Files:** `module/apps/session-log-preview.js`, `module/helpers/session-log-generator.js`, `templates/apps/session-log-preview.hbs`, `styles/apps/_session-log-preview.css`.

**Verify:**

- Per-event rows adopt the event speaker's theme via `.gs-themed` (chat-card flow).
- Status indicators (resolved / unresolved) apply rule 1.2.
- Eyebrows apply rule 1.3.

### 3.13 Reveal Control

**Files:** `module/apps/reveal-control.js`, `styles/apps/_reveal-control.css`.

**Verify:**

- Visibility-state pills (`secret / public / redacted`) apply rule 1.2 plus shape variation. Don't use color-coded states.
- Container uses house style; the popover sits on top of any actor sheet.

### 3.14 Token Hover Card

**Files:** `module/hooks/token-hover-card.js`, `styles/components/_token-hover-card.css`.

**Verify:**

- Hover card body adopts the actor's theme via `.gs-themed`.
- Mini resolve pips, MT pill, monologue dot apply rule 1.2.
- Reputation tag count chips (if shown) apply rule 1.1.
- Eyebrows apply rule 1.3.

### 3.15 Connection Sheet

**Files:** `module/sheets/connection-sheet.js`, `templates/actors/connection/*.hbs`, `styles/sheets/_connection.css`.

**Verify:**

- Sheet adopts the connection's variant theme via `.gs-themed[data-theme="connection-..."]`.
- Reputation tags on the connection (positive/negative tags applied to this Connection actor) apply rule 1.1.
- Impressions section eyebrow applies rule 1.3.
- Persona section uses the same persona-switcher pattern as the dossier.

**Note:** the dossier's connection-public-info spread (when you click a connection chip on a Major's dossier) reads from this Connection's data but renders inside the dossier shell. That's covered in the dossier refactor spec, not here. This sheet is the GM-editing view.

### 3.16 Family Sheet

**Files:** `module/sheets/family-sheet.js`, `templates/actors/family/*.hbs`, `styles/sheets/_family.css`.

**Verify:**

- Family sheet uses house style (Family is not theme-bound).
- Crest medallion (`styles/components/_crest-medallion.css`) renders in gilt.
- Member list rows adopt each member's theme via `.gs-themed` (cross-theme rendering).
- Eyebrows apply rule 1.3.

### 3.17 NPC Sheet

**Files:** `module/sheets/npc-sheet.js`, `templates/actors/npc/*.hbs`, `styles/sheets/_npc.css`.

**Verify:**

- NPC sheet uses house style only.
- Eyebrows apply rule 1.3.
- No theme switcher (NPCs don't choose themes per CLAUDE.md §6.4).

### 3.18 Item sheets (all five)

**Files:** `module/sheets/reputation-tag-sheet.js`, `reputation-condition-sheet.js`, `inner-conflict-sheet.js`, `magic-skill-sheet.js`, `backstory-action-sheet.js`. Templates: `templates/items/*.hbs`. Styles: `styles/sheets/_item-base.css`, `_item-reputation-tag.css`, `_item-reputation-condition.css`, `_item-inner-conflict.css`, `_item-magic-skill.css`, `_item-backstory-action.css`.

**Verify across all five:**

- House style chrome (item sheets are GM/owner editing surfaces, not themed by any actor).
- Polarity selectors (positive / negative) on rep-tag and rep-condition sheets use rule 1.1 — sage/forest for positive, terracotta/oxblood for negative.
- Inner-conflict box previews on the inner-conflict item sheet apply rule 1.2.
- Eyebrows apply rule 1.3.

**Reputation tag specifically:**
- Add `icon: string` field to the data model (per spec §4.7) — see also dossier refactor spec.
- Add icon picker to the sheet's form.

### 3.19 Chat Cards (all six variants)

**Files:** `templates/chat-cards/system.hbs`, `in-character.hbs`, `monologue.hbs`, `completion.hbs`, `persona-switch.hbs`, `letter.hbs`. Styles: `styles/components/_chat-card-base.css`, `_chat-card-system.css`, `_chat-card-in-character.css`, `_chat-card-monologue.css`, `_chat-card-completion.css`, `_chat-card-persona-switch.css`, `_letter-card.css`. Helper: `module/helpers/chat-cards.js`.

**Verify:**

- Each card wraps content in `.gs-themed[data-theme="…"]` using the speaker's theme (already done per CLAUDE.md §12.5 — verify the chat-cards helper still calls `themedWrap`).
- Persona switch cards use the destination persona's `chatColor` override if set.
- Card chrome (header, divider, footer) uses theme `--gs-brand` and `--gs-accent-3`.
- Reputation-related content inside cards (e.g., a tag being applied) uses rule 1.1 — not theme accent.
- Card-level eyebrows apply rule 1.3.

**No JS changes expected.**

### 3.20 Speaking-As Switcher

**Files:** `module/hooks/speaking-as.js`, `templates/components/speaking-as.hbs`, `styles/components/_speaking-as.css`.

**Verify:**

- Per-actor pills in the popover adopt the actor's theme via `.gs-themed`.
- Active selection uses rule 1.2 (filled `--gs-brand`).
- Container uses house style chrome.

### 3.21 Rule Tooltips

**Files:** `module/helpers/rule-tooltip.js`, `styles/components/_rule-tooltip.css`.

**Verify:**

- Tooltip body uses house style (`--gs-paper-warm`, `--gs-ink`, sage hairline).
- The trigger glyph (`?`) uses `--gs-accent-3` (gilt).
- Tooltip eyebrows (the rule's name + page-ref) apply rule 1.3 in subdued form.

### 3.22 Foundry Chrome Theme

**Files:** `styles/foundry-chrome.css`.

**Verify:**

- All overrides use house style only — no theme-shift on Foundry chrome.
- Body class toggle (`body.gs-chrome-themed`) still gates the application of the theme per CLAUDE.md §28.

---

## 4. Audit pass procedure

For each module above:

1. Open the relevant CSS / template / JS files.
2. Search for hardcoded color hex values that aren't `--gs-paper`, `--gs-paper-warm`, `--gs-ink`, `--gs-accent-3` (gilt), or theme accent variables. Any leftover hardcoded hex values are suspect.
3. Search for class names like `.is-spent`, `.is-empty`, `.spent`, `.empty`, `.disabled` and verify they apply rule 1.2 (no color swap).
4. Search for `background:` or `color:` declarations on `.tag`, `.pill`, `.condition`, `.chip` selectors. Verify these use functional colors per rule 1.1, not theme accents.
5. Verify the eyebrow style on every section header — there should be no `font-style: italic` + `font-size: 11px` + `opacity: 0.85` pattern remaining (that's the old eyebrow). Should be the new strong style per rule 1.3.

---

## 5. Open questions

- **Do we keep the `--row-brand` variable** on `.row.theme-X` or rebind to read directly from `.gs-themed[data-theme="X"] --gs-brand`? The latter is cleaner architecture but requires updating the dashboard row partial. **[FILL IN — defer until dashboard refactor or do during this checklist?]**
- **Is the indicator-unification rule already applied** in the existing component CSS or does it need refactoring? Audit during pass §4. **[FILL IN per-component as audit completes.]**
- **Lavishly Yours bundling vs. Google Fonts** — pick during audit §2.3. Bundling is more work; Google Fonts is simpler but requires online play. **[FILL IN — Natalie decision.]**

---

## 6. Decisions captured during integration

(Empty — fill in as decisions are made during the work.)
