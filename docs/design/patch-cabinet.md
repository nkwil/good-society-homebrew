# Patch: the Cabinet (player module menu)

> **Status:** drafting. Entirely new module — no v1 spec equivalent. An on-theme rail for collapsing every visible UI surface (system surfaces, third-party modules, Foundry chrome) at once.
>
> **Layout pivoted 2026-05-09:** the original spec called for a vertical right-edge rail. Per Natalie's design call during visual QA, the Cabinet is now **horizontal, anchored bottom-center directly above Foundry's macro hotbar**. The drawer stacks ABOVE the rail (toward the canvas) instead of sliding out to the side. Functional behavior — surface registry, visibility toggling, per-user persistence, Esc-to-close — is unchanged. CSS specifics in §3.5 below have been amended to match; the rest of the spec is layout-agnostic. See `post-mvp-design-patch.md` §16 (decision log, 2026-05-09 entry) for the rationale.
>
> **Companion docs:** [`post-mvp-design-patch.md`](./post-mvp-design-patch.md) §9 (the spec), [`patch-preview-post-mvp.html`](./patch-preview-post-mvp.html) §iv (the visual reference, vertical-rail era — superseded), [`patch-integration-checklist.md`](./patch-integration-checklist.md) §1 (shared rules).
>
> **Repo target:** `module/apps/cabinet.js` (new) + `templates/apps/cabinet.hbs` (new) + `styles/apps/_cabinet.css` (new) + small registration changes to `module/good-society.js`.

---

## 1. Goals

1. **Give players an on-theme way to collapse modules.** Foundry sessions accumulate a lot of visible surfaces — public info dashboard, my-characters dock, cycle HUD, third-party modules (Sequencer, dice tray, combat tracker, etc.), Foundry's own sidebar. The Cabinet is one place to hide / show them all without losing state.
2. **Bottom-anchored rail by default; drawer opens upward on demand.** Default state is a small horizontal strip centered above Foundry's macro hotbar. Click the toggle, drawer slides up with toggles for every known surface. (Was: vertical right-edge rail. Pivoted 2026-05-09.)
3. **Persist per-user.** Each user has their own visibility preferences (`game.user.flags["good-society-homebrew"].cabinetVisibility`).
4. **House style, not theme-bound.** The Cabinet renders in Inkwell & Wildflower regardless of which actor is selected. It's a chrome surface, not a content surface.
5. **Don't break anything.** Hiding a module just sets `display: none` on its DOM element via a CSS class on `<body>`; doesn't unregister anything. Showing it removes the class. Toggle is reversible.

---

## 2. Scope

### In scope

- The Cabinet ApplicationV2 itself (rail + drawer).
- Visibility toggle for **system surfaces** (Public Info Dashboard, My Characters Dock, Cycle Phase HUD, Session Log, anything else owned by this system).
- Visibility toggle for a **canonical list of common third-party modules** (Sequencer effects layer, Combat Tracker, Token Mold, Dice Tray, ...). The list is curated — any module not on the list isn't togglable from here. Power users can edit world settings.
- Visibility toggle for **Foundry chrome** sub-elements (players list, sidebar, hotbar). The Foundry chrome theme already styles these per CLAUDE.md §28 — the Cabinet can also hide them entirely.
- Bulk actions: "hide all" and "show all" at the foot of the drawer.
- Per-user persistence in user flags.
- Keyboard dismiss (Esc closes the drawer).

### Out of scope

- Module *settings* (e.g., changing module behavior). Cabinet only toggles visibility.
- Per-scene visibility (e.g., "hide combat tracker on social-scene maps"). Visibility is global per user.
- Auto-hide rules (e.g., "hide HUD during combat"). Manual only.
- Drag-rearranging the rail's icon order. Order is fixed by the registered surface list.
- Letting the Cabinet hide itself. The toggle button stays visible always.

---

## 3. Architecture

### 3.1 Class

```js
// module/apps/cabinet.js
import { COWORK_SURFACES } from "../constants.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class Cabinet extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: "gs-cabinet",
    classes: ["good-society", "gs-cabinet"],
    window: { frame: false, positioned: true },
    position: { width: 320, height: "auto" },
    actions: {
      toggleSurface: this.prototype._onToggleSurface,
      hideAll:       this.prototype._onHideAll,
      showAll:       this.prototype._onShowAll,
      toggleDrawer:  this.prototype._onToggleDrawer,
    },
  };

  static PARTS = {
    cabinet: { template: "systems/good-society-homebrew/templates/apps/cabinet.hbs" },
  };

  // Read state from user flags
  get visibility() {
    return game.user.flags["good-society-homebrew"]?.cabinetVisibility ?? {};
  }

  isVisible(surfaceId) {
    const v = this.visibility[surfaceId];
    if (typeof v === "boolean") return v;
    return COWORK_SURFACES.find(s => s.id === surfaceId)?.defaultVisible ?? true;
  }

  async _setVisible(surfaceId, value) {
    const next = { ...this.visibility, [surfaceId]: value };
    await game.user.setFlag("good-society-homebrew", "cabinetVisibility", next);
    this._applyVisibility();
    this.render();
  }

  /**
   * Apply visibility classes to <body> for each known surface.
   * Each surface declares a CSS hide class; toggle that class on/off.
   */
  _applyVisibility() {
    for (const surface of COWORK_SURFACES) {
      const visible = this.isVisible(surface.id);
      document.body.classList.toggle(surface.hideBodyClass, !visible);
    }
  }

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    ctx.groups = COWORK_SURFACES.reduce((groups, s) => {
      groups[s.group] ??= [];
      groups[s.group].push({ ...s, visible: this.isVisible(s.id) });
      return groups;
    }, {});
    ctx.drawerOpen = this._drawerOpen ?? false;
    return ctx;
  }

  _onToggleSurface(event, target) {
    const surfaceId = target.dataset.surfaceId;
    const wasVisible = this.isVisible(surfaceId);
    return this._setVisible(surfaceId, !wasVisible);
  }

  async _onHideAll() {
    const next = COWORK_SURFACES.reduce((o, s) => ({ ...o, [s.id]: false }), {});
    await game.user.setFlag("good-society-homebrew", "cabinetVisibility", next);
    this._applyVisibility();
    this.render();
  }

  async _onShowAll() {
    const next = COWORK_SURFACES.reduce((o, s) => ({ ...o, [s.id]: true }), {});
    await game.user.setFlag("good-society-homebrew", "cabinetVisibility", next);
    this._applyVisibility();
    this.render();
  }

  _onToggleDrawer() {
    this._drawerOpen = !this._drawerOpen;
    this.render();
  }
}
```

### 3.2 Surface registry

The Cabinet needs to know which surfaces exist, what group each belongs to, what CSS class hides each one, and what label/letter to show on the rail.

```js
// module/constants.js (extend the existing file)

export const COWORK_SURFACES = [
  // System surfaces
  { id: "public-info-dashboard", group: "system",  label: "Public Info Dashboard", railGlyph: "P",  hideBodyClass: "gs-hide-dashboard",  defaultVisible: true },
  { id: "my-characters-dock",    group: "system",  label: "My Characters Dock",    railGlyph: "D",  hideBodyClass: "gs-hide-dock",       defaultVisible: true },
  { id: "cycle-hud",             group: "system",  label: "Cycle Phase HUD",       railGlyph: "C",  hideBodyClass: "gs-hide-cycle-hud",  defaultVisible: true },
  { id: "session-log-preview",   group: "system",  label: "Session Log",           railGlyph: "L",  hideBodyClass: "gs-hide-session-log", defaultVisible: false },

  // Third-party modules
  { id: "module-sequencer",      group: "modules", label: "Sequencer",             railGlyph: "Sq", hideBodyClass: "gs-hide-sequencer",  defaultVisible: true,  ifModule: "sequencer" },
  { id: "module-combat-tracker", group: "modules", label: "Combat Tracker",        railGlyph: "Ct", hideBodyClass: "gs-hide-combat",     defaultVisible: false },
  { id: "module-token-mold",     group: "modules", label: "Token Mold",            railGlyph: "Tm", hideBodyClass: "gs-hide-token-mold", defaultVisible: true,  ifModule: "token-mold" },
  { id: "module-dice-tray",      group: "modules", label: "Dice Tray",             railGlyph: "Dt", hideBodyClass: "gs-hide-dice-tray",  defaultVisible: false, ifModule: "dice-tray" },

  // Foundry chrome
  { id: "foundry-players-list",  group: "foundry", label: "Players list",          railGlyph: "Pl", hideBodyClass: "gs-hide-players",    defaultVisible: true },
  { id: "foundry-sidebar",       group: "foundry", label: "Sidebar",               railGlyph: "Sb", hideBodyClass: "gs-hide-sidebar",    defaultVisible: true },
  { id: "foundry-hotbar",        group: "foundry", label: "Hotbar",                railGlyph: "Hb", hideBodyClass: "gs-hide-hotbar",     defaultVisible: true },
];
```

`ifModule` is optional — when present, the surface only appears in the registry if the named module is active. Filter at runtime in `_prepareContext`:

```js
ctx.groups = COWORK_SURFACES
  .filter(s => !s.ifModule || game.modules.get(s.ifModule)?.active)
  .reduce(...);
```

### 3.3 CSS hide classes

`styles/apps/_cabinet.css` declares the hide classes:

```css
body.gs-hide-dashboard #gs-public-info-dashboard,
body.gs-hide-dock      #gs-my-characters-dock,
body.gs-hide-cycle-hud .gs-cycle-hud,
body.gs-hide-session-log #gs-session-log-preview {
  display: none !important;
}

body.gs-hide-sequencer  .sequencer-effects,
body.gs-hide-combat     #combat,
body.gs-hide-token-mold #token-mold-config,
body.gs-hide-dice-tray  #dice-tray { display: none !important; }

body.gs-hide-players #players,
body.gs-hide-sidebar #sidebar,
body.gs-hide-hotbar  #hotbar { display: none !important; }
```

The `!important` is intentional — Foundry's own CSS can be high-specificity, and Cabinet is the override.

**Note:** the exact element IDs (`#gs-public-info-dashboard`, `#players`, etc.) need to be verified against the existing build. Each system app should already render with a stable ID; confirm before writing.

### 3.4 Rail + drawer template

```hbs
{{!-- templates/apps/cabinet.hbs --}}
<div class="gs-cabinet-shell">

  {{#if drawerOpen}}
    <aside class="gs-cabinet-drawer">
      <header class="gs-cabinet-drawer-head">
        <h3>The Cabinet</h3>
        <small>open and close everything you have on the board</small>
      </header>

      {{#each groups as |surfaces groupKey|}}
        <section class="gs-cabinet-group">
          <h4>{{lookup ../groupLabels groupKey}}</h4>
          {{#each surfaces as |surface|}}
            <div class="gs-cabinet-row">
              <div class="gs-cabinet-row-name">
                {{surface.label}}
                <small>{{surface.locationHint}}</small>
              </div>
              <span class="gs-cabinet-toggle {{#if surface.visible}}on{{/if}}"
                    data-action="toggleSurface"
                    data-surface-id="{{surface.id}}"
                    role="switch"
                    aria-checked="{{surface.visible}}"></span>
            </div>
          {{/each}}
        </section>
      {{/each}}

      <footer class="gs-cabinet-drawer-foot">
        <button data-action="hideAll" type="button">hide all</button>
        <button data-action="showAll" type="button">show all</button>
        <span class="spacer"></span>
        <span>esc to close</span>
      </footer>
    </aside>
  {{/if}}

  <nav class="gs-cabinet-rail" aria-label="Cabinet">
    {{#each rail as |surfaces groupKey|}}
      {{#each surfaces as |surface|}}
        <span class="gs-cabinet-rail-btn {{#if surface.visible}}is-active{{/if}}"
              data-action="toggleSurface"
              data-surface-id="{{surface.id}}"
              title="{{surface.label}}">
          {{surface.railGlyph}}
        </span>
      {{/each}}
      {{#unless @last}}<span class="gs-cabinet-rail-divider"></span>{{/unless}}
    {{/each}}
    <span class="gs-cabinet-rail-divider"></span>
    <button class="gs-cabinet-rail-toggle" data-action="toggleDrawer" type="button" title="Open the Cabinet">≡</button>
  </nav>
</div>
```

`groupLabels` is a context dictionary (e.g., `{ system: "Good Society", modules: "Player modules", foundry: "Foundry chrome" }`).

### 3.5 Styling

Layout pivoted 2026-05-09 from vertical right-edge to horizontal bottom-center. Current values:

- Rail anchored at `bottom: 64px; left: 50%; transform: translateX(-50%)` — directly above Foundry's macro hotbar, centered on the viewport's horizontal axis. ~32 px tall. `--gs-paper` background, `--gs-accent-2` outline, pill border-radius (`100px`).
- Rail is `flex-direction: row` with a vertical hairline divider (`width: 0.5px; height: 18px`) between groups.
- Each rail button is a 32 px circle, paper-warm, sage outline, `--gs-brand` glyph.
- Active dot at top-right of each button (filled `--gs-brand`, 6 px, hairline).
- Drawer stacks ABOVE the rail when toggled (`flex-direction: column` on `.gs-cabinet-shell`; template's existing DOM order — drawer first, rail second — places drawer on top, rail at bottom). 320 px wide, `max-height: 70vh`. `margin-bottom: 8px` for the gap between drawer and rail.
- Drawer background = `--gs-paper`, sage hairlines, `--gs-paper-warm` group headers.
- Footer = `--gs-paper-warm`, hairline at top, two text-button "hide all" / "show all".

Full CSS in `styles/apps/_cabinet.css`. The preview HTML at `patch-preview-post-mvp.html` §iv still shows the vertical-rail era; visual QA going forward should look at the live system, not the preview.

---

## 4. Registration

### 4.1 Hook into `init` or `ready`

```js
// module/good-society.js — add to existing init/ready hooks

import { Cabinet } from "./apps/cabinet.js";

Hooks.once("ready", () => {
  // existing ready-time wiring...

  // Single instance, accessible as a singleton
  game.goodSociety ??= {};
  game.goodSociety.cabinet = new Cabinet();
  game.goodSociety.cabinet.render(true);
  game.goodSociety.cabinet._applyVisibility();  // apply current user's flags on first load
});
```

### 4.2 Esc keybinding

```js
// In Cabinet's _onRender or constructor:
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && this._drawerOpen) {
    this._drawerOpen = false;
    this.render();
  }
});
```

(Or use Foundry's `KeybindingsConfig` API if cleaner.)

### 4.3 Settings registration

Two world settings + one user setting:

```js
// module/settings.js — add to registerSettings()

game.settings.register("good-society-homebrew", "cabinetEnabled", {
  name: "GOODSOCIETY.settings.cabinetEnabled.name",
  hint: "GOODSOCIETY.settings.cabinetEnabled.hint",
  scope: "world",
  config: true,
  type: Boolean,
  default: true,
});

game.settings.register("good-society-homebrew", "cabinetIncludeFoundryChrome", {
  name: "GOODSOCIETY.settings.cabinetIncludeFoundryChrome.name",
  hint: "GOODSOCIETY.settings.cabinetIncludeFoundryChrome.hint",
  scope: "world",
  config: true,
  type: Boolean,
  default: true,
});

// Per-user state lives in flags, not settings (already handled).
```

In `Cabinet._prepareContext`, filter the `foundry` group out if `cabinetIncludeFoundryChrome` is false.

---

## 5. Localization

Add to `lang/en.json`:

```json
{
  "GOODSOCIETY.cabinet.title": "The Cabinet",
  "GOODSOCIETY.cabinet.subtitle": "open and close everything you have on the board",
  "GOODSOCIETY.cabinet.group.system": "Good Society — System",
  "GOODSOCIETY.cabinet.group.modules": "Player modules",
  "GOODSOCIETY.cabinet.group.foundry": "Foundry chrome",
  "GOODSOCIETY.cabinet.hideAll": "hide all",
  "GOODSOCIETY.cabinet.showAll": "show all",
  "GOODSOCIETY.cabinet.escToClose": "esc to close",
  "GOODSOCIETY.cabinet.openTitle": "Open the Cabinet",
  "GOODSOCIETY.settings.cabinetEnabled.name": "Show the Cabinet",
  "GOODSOCIETY.settings.cabinetEnabled.hint": "If enabled, players see a small rail on the right edge of the screen for collapsing on-screen modules.",
  "GOODSOCIETY.settings.cabinetIncludeFoundryChrome.name": "Cabinet can hide Foundry chrome",
  "GOODSOCIETY.settings.cabinetIncludeFoundryChrome.hint": "Lets the Cabinet toggle Foundry's own players list, sidebar, and hotbar in addition to system surfaces and third-party modules."
}
```

---

## 6. Edge cases

- **First-time user:** no flags set. `isVisible(surfaceId)` falls back to `defaultVisible`. Default visibility per surface is in the registry.
- **GM with the system disabled (`cabinetEnabled: false`):** `Cabinet.render()` is gated on the setting. If false, never instantiate.
- **Module activated mid-session:** the rail won't reflect newly-active third-party modules until the page reloads. A future enhancement can listen for `Hooks.on("hotReload"` or similar. Out of scope for v1.
- **Surface element doesn't render in DOM:** the hide class is harmless if the matching ID isn't present.
- **Theme switching on the Cabinet:** Cabinet always renders in house style. It does NOT receive `data-theme` from the active actor.
- **Mobile / narrow viewports:** the rail's `right: 18px` becomes problematic if the viewport is too narrow. Out of scope; Foundry on desktop is the primary target.

---

## 7. Implementation order

1. Add `COWORK_SURFACES` to `module/constants.js`.
2. Add settings (`cabinetEnabled`, `cabinetIncludeFoundryChrome`) to `module/settings.js`.
3. Add localization keys to `lang/en.json`.
4. Create `module/apps/cabinet.js` with the class skeleton (no UI yet).
5. Create `templates/apps/cabinet.hbs` with the rail markup only (no drawer).
6. Create `styles/apps/_cabinet.css` with rail styling. Wire into `styles/good-society.css` import order.
7. Register the Cabinet in `module/good-society.js` ready hook. Verify rail renders.
8. Add drawer markup to `cabinet.hbs`. Add drawer styling. Verify toggle works.
9. Wire `_onToggleSurface`, `_onHideAll`, `_onShowAll`. Verify hide classes apply.
10. Wire Esc-to-close.
11. Test against actual modules (Sequencer, etc.) to verify the hide selectors match.
12. Polish — animations, transitions on drawer slide, hover states.

Each step ends with a working build.

---

## 8. Open questions

- **Element IDs to hide.** The hide-class CSS selectors target IDs like `#gs-public-info-dashboard`, `#combat`, `#players`. Confirm the system's existing apps render with these IDs and that Foundry's own elements use these IDs in v13. **[FILL IN — verify against repo and live Foundry.]**
- **Sequencer effects layer hide selector.** Sequencer renders into PIXI canvas, not DOM — `.sequencer-effects` may not exist. May need a different mechanism (call `Sequencer.EffectManager.endAllEffects()`?). **[FILL IN — confirm with module maintainer or test.]**
- **Esc handling conflict.** Foundry already binds Esc to other things (cancel selection, close popups). Should Cabinet's Esc-handler be limited to "only when drawer is open and no other modal is up"? **[FILL IN.]**
- **Mobile fallback** — out of scope, but document that the rail position is desktop-targeted. **[FILL IN — note in spec.]**
- **Default visibility per surface** — the registry has my best guesses (`combat: false`, `dice-tray: false`, etc.). Confirm with Natalie which surfaces should default visible vs. hidden. **[FILL IN.]**

---

## 9. Decisions captured during build

(Empty — fill in as decisions are made during the work.)
