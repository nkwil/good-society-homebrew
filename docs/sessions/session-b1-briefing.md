# Session B-1 — Sheet Templates Batch

**Goal:** build every Handlebars template + its sheet class for all four Actor types and all five Item types. Templates consume the house CSS variables, the per-component CSS files, and the `.gs-actor[data-theme="..."]` mechanism set up in Session B-0. **No automation logic, no hooks beyond sheet registration, no chat cards, no custom apps.** Visual fidelity to the locked design specs is the bar.

This is the largest session of the build. Schedule 2–3 days of focused work. Following the implementation order strictly is what keeps it manageable — don't jump ahead.

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

## Locked sheet structures

These are pulled from the per-component design docs. Don't deviate without revisiting the design doc.

### Major Character sheet (per `04-character-sheet.md`)

- Width: **720px**, height: auto
- Structure: **two tabs (Public, Private) + persistent tokens & cycle strip below**. NOT three tabs.
- PARTS: `header`, `tabs`, `public`, `private`, `strip`
- Sheet root carries `class="gs-major-sheet gs-actor"` and `data-theme="{actor.system.theme}"`
- Header layout: 130px portrait side panel + flex main column
- Strip is always visible across tab switches

### Connection sheet (per `06-connection-sheet.md`)

- Width: **600px**, height: auto
- Structure: single page, no tabs
- PARTS: `header`, `description`, `impressions`, `scene`, `state`
- Sheet root carries `class="gs-connection-sheet gs-connection"` and `data-theme="{actor.system.theme}"`
- Header layout: 110px portrait side panel + flex main column
- Cross-theme rendering inside impressions: each impression card's left-edge accent uses the *target Major's* theme color (each impression wrapped in `.gs-themed[data-theme="<major-theme>"]`)
- This is the canonical multi-theme-on-one-sheet validation

### Family sheet (per `14-family-sheet.md`)

- Width: **580px**, height: auto
- House-styled (no `.gs-actor` wrapper). Family is shared across multiple Majors with different themes — must look "of the world."
- Six PARTS: `header`, `crest`, `origin`, `reputation`, `notes`, `members`
- Crest medallion uses monogram fallback (no per-family art needed unless `crest.imageUrl` is set)
- Member rows use cross-theme rendering (each row wrapped in `.gs-themed[data-theme="<member-theme>"]`)
- Schema revision (Session A.6) needed before this builds: `heirStatus` boolean → enum

### NPC sheet (per `16-npc-sheet.md`)

- Width: **540px** (narrower than Connection's 600px)
- House-styled. NPC theme inherits house with no overrides.
- Same as Connection sheet **minus** the impressions list and **minus** the State row's resolve track
- Sage side panel (`var(--gs-accent-2)`) — the visual signal that this is house-styled, not character-themed
- GM pill in the header eyebrow
- Includes `[+ promote to connection]` and `[grant to player]` actions in the header
- **Reuse all shared partials from the Connection sheet** — only the impressions and state-row partials are absent

### Item sheets (per `12-item-sheets.md`)

All five: Reputation Tag (360px), Reputation Condition (380px), Inner Conflict (540px), Magic/Skill (460px), Backstory Action (400px).

- All house-styled. No `.gs-actor` class.
- Common conventions: header (eyebrow + name input + optional meta) + body (label + control field stack) + optional footer (only Magic/Skill and GM-overridden Inner Conflict have one).
- **The Inner Conflict box grid is a shared primitive** — same partial used on the Inner Conflict item sheet AND on the Major sheet's Public tab. Build at `templates/components/inner-conflict-grid.hbs`.
- Magic/Skill's Cast button has a visibility-aware confirm pipeline (per `12-item-sheets.md` §"Cast pipeline").
- Backstory Action is auto-created when an Inner Conflict completes (per the box grid primitive's completion behavior).

## Implementation order

Build per `03-component-inventory.md` §"Implementation order (suggested)". Summary:

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

## What's NOT in this session

- ❌ Automation logic. No "click this and resolve token decrements." Click handlers can be wired but their bodies are stubs (`console.log` is fine).
- ❌ Chat cards or letter cards. They live in Session B-3 alongside the chat-styling layer (uses `themedWrap` from Session B-0).
- ❌ Custom apps (Public Info dashboard, My Characters dock, Cycle HUD, Upkeep wizard, letter composer). Those are Phase 3 / 5 / 6 per PLAN.md §13.
- ❌ Hover cards, scene controls, persona switching pipeline, monologue journal flow.
- ❌ The remaining eleven theme presets — that's Session B-2.
- ❌ Persona switcher full editor. The in-sheet picker (closed state) per `04-character-sheet.md` and `06-connection-sheet.md` IS in scope. The popover and editor modal are in Session B-5.
- ❌ Tooltip system. The tooltip primitive is system-wide infrastructure built in Session B-4 (custom apps). However, **section headers built this session should already have the `data-tooltip-key` attributes set** so they're tooltip-ready when B-4 ships. Use the catalog in `docs/design/20-rule-tooltips.md` to map header → key.

This session is **shape and styling only**. Resist scope creep.

## Critical pattern 1 — setting `data-theme` on the sheet root

The whole CSS architecture rests on the sheet class setting two attributes on its root element:

1. A class — `.gs-actor` (Majors), `.gs-connection` (Connections). Family, NPC, and item sheets don't need these — they're house-styled.
2. A `data-theme` attribute — value pulled from `actor.system.theme`.

Wire this in the sheet class via the ApplicationV2 `_onRender` hook:

```js
async _onRender(context, options) {
  await super._onRender(context, options);
  const root = this.element;
  if (this.document.type === "major-character") {
    root.classList.add("gs-actor");
    root.dataset.theme = this.document.system.theme || "clayton";
  } else if (this.document.type === "connection") {
    root.classList.add("gs-connection");
    root.dataset.theme = this.document.system.theme || "connection-green";
  }
  // Family, NPC, items: no class — house-styled
}
```

A common mistake will be setting `data-theme` on the *sheet body* instead of the sheet *root*. ApplicationV2's `this.element` is the root element; setting it there ensures every descendant inherits via the CSS variable cascade.

## Critical pattern 2 — the hybrid-theming gotcha

When a `.gs-themed` wrapper exists around a component but some properties (like dashboard row backgrounds, dock row backgrounds) should *not* pick up the theme, the wrapper's variable cascade leaks. This isn't a problem on actor *sheets* (where everything inside should be themed), but it'll come up in B-1 when you build any cross-theme primitives.

For the Connection sheet's impression cards — which are wrapped in the *target Major's* theme — the *card's own paddings, borders, and structural CSS* use the connection's outer theme variables, while the cross-theme accent stripe uses the inner Major-theme `--gs-brand`. Be careful which variables are "always-house," "always-character," and "cross-theme" inside cards like this. Per `06-connection-sheet.md` §"Cross-theme rendering inside the sheet."

When in doubt, hardcode house values inside the inner component for properties that must stay house, and document with a comment: `/* hardcoded house --gs-paper-warm — prevents wrapper cascade leak */`.

## Critical pattern 3 — cross-theme rendering inside a sheet (Connection's impressions)

The most complex pattern in this session. Per `06-connection-sheet.md`:

```html
<form class="gs-connection-sheet gs-connection" data-theme="connection-green">
  <!-- ... connection's chrome uses connection-green variables ... -->

  <section class="impressions">
    <!-- Each impression card is wrapped in the target Major's theme -->
    <div class="gs-themed" data-theme="rose">
      <div class="impression-card">
        <span class="major-ref">Lady Rose</span>
        <p>"A proper young lady..."</p>
      </div>
    </div>
    <div class="gs-themed" data-theme="avril">
      <div class="impression-card">
        <span class="major-ref">Avril Eclair</span>
        <p>"...a girl with secrets like teeth."</p>
      </div>
    </div>
  </section>
</form>
```

The `.impression-card`'s left-edge accent stripe uses `var(--gs-brand)`, which inside each `.gs-themed` wrapper resolves to *that Major's* brand color — Rose's wine-pink, Avril's candlelight gold. Validate this works before stamping the pattern across the dashboard and dock in later phases.

## Per-component briefing strategy

Rather than re-stating each component's spec here (the design docs are exhaustive), **link the relevant inventory entry and design-doc section in your Claude Code prompt for each component**:

> Build component #1 (Major Character sheet header). Spec: `docs/design/04-character-sheet.md` §"Header spec — locked". The sheet class lives in `module/sheets/major-character-sheet.js` (skeleton in CLAUDE.md §10.2). The template lives in `templates/actors/major-character/header.hbs`.

> Build the Public tab Reputation Criteria section. Spec: `docs/design/04-character-sheet.md` §"Public tab spec → 1. Reputation Criteria". This pulls read-only data from the linked Family actor. Empty state and visibility-flag handling must match the spec.

The design docs are detailed; let them be the reference instead of summarizing.

## Starting prompt for Claude Code

> Phase 1c, Session B-1 — Sheet templates batch. Read `docs/sessions/session-b1-briefing.md` end-to-end. Also read `docs/design/03-component-inventory.md`, `docs/design/04-character-sheet.md`, `docs/design/06-connection-sheet.md`, `docs/design/decisions.md`, and CLAUDE.md §9 + §10 for the worked patterns.
>
> Build the components in the order listed in `03-component-inventory.md` §"Implementation order (suggested)". For each component:
>
> 1. State which inventory row you're building.
> 2. Link the relevant design-doc section as your spec source.
> 3. Show me the Handlebars template + the CSS additions + the sheet-class wiring.
> 4. Pause. I'll say "next" or "stop, this needs adjustment."
>
> Critical patterns:
> - Sheet roots get `.gs-actor` / `.gs-connection` class + `data-theme` attribute via the `_onRender` hook (snippet in §"Critical pattern 1" of the briefing). Item, Family, NPC sheets stay house-styled — no `.gs-actor` class.
> - Major Character sheet uses two tabs (Public, Private) + persistent strip — NOT three tabs. PARTS: header, tabs, public, private, strip. Per `docs/design/04-character-sheet.md` §"Structural recommendation."
> - Connection sheet's impressions list is the cross-theme validation: each impression wrapped in the *target Major's* theme. Per `docs/design/06-connection-sheet.md` §"Cross-theme rendering inside the sheet."
> - Honor the eight antique-but-clean rules from CLAUDE.md §12.1. If a layout violates one, flag and ask before proceeding.
>
> No automation logic. No chat cards. No custom apps. No theme presets beyond Clayton (already in B-0). Visual fidelity to the locked design specs is the bar.

## Mid-session prompts you'll likely use

- `next` — proceed to next inventory row
- `show me the current state of styles/components/` — sanity-check the file list
- `pause, compare against docs/design/04-character-sheet.md §"<section>"` — re-anchor to the spec
- `summarize what's been built so far in Session B-1`
- `we're drifting from the antique-but-clean principle — restate it and try again`
- `the inner conflict box grid doesn't feel weighty enough — what would help?`

## End-of-session verification

1. Restart Foundry world. Console (F12) → no red errors.
2. Open one of each: Major Character, Connection, Family, NPC. Each renders its full layout with default values populated. No visual breakage, no missing CSS.
3. Major Character sheet:
   - Two tabs (Public, Private) visible at the top — NOT three.
   - Persistent tokens & cycle strip visible at the bottom across tab switches.
   - Set `theme` to `rose`, `clayton`, `dixon` via console (`actor.update({ "system.theme": "..." })`). Sheet visibly re-themes between switches. **Other themes won't work yet** — Session B-2 builds them.
4. Connection sheet:
   - Open one with at least two linked Major impressions. Each impression card's left-edge accent stripe should be the corresponding Major's theme color, not the connection's. **This is the cross-theme validation.** If both stripes are the connection's color, the wrapper inside impressions isn't being applied — diagnose before continuing.
5. Open one of each item type. Each renders cleanly using house style only — no character-theme tinting.
6. Visibility flag indicators appear on every sensitive field on the Major Private tab.
7. Inner Conflict box grid renders with 5+5 boxes; clicking checkboxes toggles state visually (logic stub is fine).
8. Resolve track, MT toggle, monologue dot all render on the Major persistent strip. Click handlers update visual state.
9. **No regression** on Session A's verification: `game.actors.contents[0].system` still shows the schema fields with proper values; no `undefined` introduced by template work.

If anything fails, stop and fix before Session B-2. Theme presets are easy to add once the templates are stable; the reverse is much harder.

## Update CLAUDE.md §13 after the session

```markdown
**Currently in:** Phase 1d — Theme presets (next: Session B-2)

**Done:**
- Phase 0: fork, rename, verify load
- Session A: all 10 DataModels defined and registered
- Session A.5: theme field backfilled
- Design integration v1 + v2: theming architecture, registry, antique-but-clean principle, per-component design docs (04-09) integrated
- Session B-0: CSS architecture + themedWrap helper + Clayton preset
- Session B-1: sheet templates
  - Component primitives: buttons, inputs, checkboxes, hairlines, cards, section headers
  - Token primitives: resolve track, MT toggle, monologue dot
  - Reputation primitives: tag pills, visual meter, visibility flag indicators
  - Inner Conflict box grid
  - Major Character full sheet — two tabs (Public, Private) + persistent tokens & cycle strip, per docs/design/04
  - Connection sheet — single page, validated cross-theme rendering inside impressions list, per docs/design/06
  - Family sheet (house style)
  - NPC sheet (house style)
  - All five item sheets
  - Persona switcher (in Major bio header and Connection state block)

**Next:**
- Session B-2 — remaining eleven theme presets (rose, roger, mags, avril, dixon, all five connections, npc-as-empty)
- Phase 2 onward — token economy logic, cycle phase mechanics, automation hooks (per PLAN.md §13)
```

Commit and push. Session B-2 follows immediately — it's parallel-safe and mostly mechanical CSS files.
