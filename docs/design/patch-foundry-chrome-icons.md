# Patch: Foundry chrome icons

> **Status:** drafting. Extends v1's `28-foundry-chrome-theme.md` with custom illustrated icons replacing Foundry's default Font Awesome glyphs across the scene controls, sidebar tabs, Cabinet rail, and a few related surfaces.
>
> **Companion docs:** [`28-foundry-chrome-theme.md`](./28-foundry-chrome-theme.md) (locked v1 — handles the *color* re-theme; this doc adds the *icon* re-theme on top), [`patch-cabinet.md`](./patch-cabinet.md) (the Cabinet's rail consumes the same icon registry), [`post-mvp-design-patch.md`](./post-mvp-design-patch.md) (master spec).
>
> **Repo target:** `module/constants.js` (extend with icon registry) + `styles/foundry-chrome.css` (add icon-swap CSS rules) + `assets/chrome-icons/` (new asset directory, GM-supplied illustrations) + small registration touches in `module/good-society.js`.

---

## 1. Goals

1. **Replace Foundry's default Font Awesome glyphs** with on-theme illustrated icons across the surfaces players look at constantly: scene controls, sidebar tabs, the Cabinet rail.
2. **Match the seal-type pattern.** Custom illustrations supplied by the GM, dropped into a known asset directory; the registry maps surface IDs to asset paths.
3. **Don't break Foundry on update.** Icons swap via CSS pseudo-elements + a controlled body class. If Foundry changes a class name in a future version, the worst case is an unstyled Font Awesome glyph showing through — no broken functionality.
4. **Graceful fallback.** If an asset is missing, the Font Awesome icon still renders. Each icon is opt-in per surface.
5. **Reuses the existing chrome opt-in.** The whole feature gates on the `applyFoundryChrome` setting from v1 §28. Toggle off → default Foundry icons everywhere. Toggle on → custom icons applied.

---

## 2. What `28-foundry-chrome-theme.md` already does

The locked v1 spec covers **color and typography overrides** for window titlebars, sidebar background, sidebar tabs, scene navigation, chat log surrounding area, default form controls, notifications, players list, hotbar background. All of it gates on `body.gs-chrome-themed` per the v1 spec's opt-in mechanism.

What 28 explicitly does NOT do:

- Replace Foundry's Font Awesome icons.
- Replace the Cabinet rail's letter glyphs (the Cabinet didn't exist in v1).
- Provide an asset directory for icon files.

This patch adds those.

---

## 3. Surfaces affected

### 3.1 Scene controls (left vertical strip)

Foundry's left-side vertical strip of tools. Default icons are FA glyphs:

| Control | Default FA glyph | Notes |
|---|---|---|
| `token` | `fa-user-alt` | the most-clicked tool |
| `measure` | `fa-ruler` | ruler / measurement |
| `tiles` | `fa-cubes` | tile placement |
| `drawings` | `fa-pencil-alt` | freehand drawings |
| `walls` | `fa-block-brick` | wall placement |
| `lighting` | `fa-lightbulb` | light placement |
| `sounds` | `fa-music` | sound placement |
| `regions` | `fa-game-board-simple` | region placement |
| `notes` | `fa-bookmark` | journal note pins |

Plus our system-injected scene controls (per `module/hooks/scene-controls.js`):

| Control | Glyph | Notes |
|---|---|---|
| `gs-dashboard` | `fa-list` (or similar) | toggles Public Info Dashboard |
| `gs-organizer` | `fa-users-rectangle` | NPC organizer (GM only) |
| `gs-permissions` | `fa-key` | bulk permissions panel (GM only) |
| `gs-session-log` | `fa-scroll` | session log preview |

All of these can be replaced. The system-injected controls are easier (we own them); the Foundry-shipped ones swap via CSS.

### 3.2 Sidebar tabs (right vertical column)

Foundry's right sidebar tabs. Default FA glyphs:

| Tab | Default FA glyph |
|---|---|
| `chat` | `fa-message` |
| `combat` | `fa-swords` |
| `scenes` | `fa-map` |
| `actors` | `fa-users` |
| `items` | `fa-suitcase` |
| `journal` | `fa-book-open` |
| `tables` | `fa-th-list` |
| `cards` | `fa-id-badge` |
| `playlists` | `fa-music` |
| `compendium` | `fa-atlas` |
| `settings` | `fa-cogs` |

For Good Society, several of these have natural period equivalents — the journal becomes a calligraphic open book, the actors tab becomes a row of cameo silhouettes, the chat tab becomes a quill, the playlist becomes a small fortepiano or sheet music. **The exact illustrations are up to Natalie**; the registry just defines slots.

### 3.3 Cabinet rail

The Cabinet (`patch-cabinet.md` §3) currently uses single-letter glyphs (P, D, C, L, Sq, Ct, Tm, Dt, Pl, Sb, Hb) for each surface in the rail. Custom icons replace those letters.

Per-surface mapping comes from the same icon registry. Each `COWORK_SURFACES` entry gets an `iconAsset` field that the rail renders.

### 3.4 Macro hotbar

**Optional / deferred.** The hotbar's macro slots are user-customized; they don't have predictable icons to swap. The hotbar's surrounding chrome is already re-themed by v1 §28. This patch leaves macro icons alone — those are user content.

### 3.5 Players list

Default Foundry shows a small list of connected players in the bottom-left, each with a colored circle for their assigned color. No FA glyphs to replace. v1 §28 already re-themes the panel's chrome. **No icon work needed here.**

### 3.6 Window titlebar gear / configure / close

Foundry's titlebar uses small FA glyphs for the close (×) and configure (⚙) buttons. Per v1 §28 these are already re-themed: close becomes a small × in `--gs-accent-2`, configure becomes the italic word "configure." Neither is a custom illustrated icon — they stay as styled text/typography. **No additional work in this patch.**

---

## 4. Architecture

### 4.1 Icon registry

```js
// module/constants.js — add a new export

export const CHROME_ICONS = {

  sceneControls: {
    // Foundry-shipped controls
    "token":         "systems/good-society-homebrew/assets/chrome-icons/scene-token.svg",
    "measure":       "systems/good-society-homebrew/assets/chrome-icons/scene-measure.svg",
    "tiles":         "systems/good-society-homebrew/assets/chrome-icons/scene-tiles.svg",
    "drawings":      "systems/good-society-homebrew/assets/chrome-icons/scene-drawings.svg",
    "walls":         "systems/good-society-homebrew/assets/chrome-icons/scene-walls.svg",
    "lighting":      "systems/good-society-homebrew/assets/chrome-icons/scene-lighting.svg",
    "sounds":        "systems/good-society-homebrew/assets/chrome-icons/scene-sounds.svg",
    "regions":       "systems/good-society-homebrew/assets/chrome-icons/scene-regions.svg",
    "notes":         "systems/good-society-homebrew/assets/chrome-icons/scene-notes.svg",
    // System-injected controls (we own these)
    "gs-dashboard":   "systems/good-society-homebrew/assets/chrome-icons/gs-dashboard.svg",
    "gs-organizer":   "systems/good-society-homebrew/assets/chrome-icons/gs-organizer.svg",
    "gs-permissions": "systems/good-society-homebrew/assets/chrome-icons/gs-permissions.svg",
    "gs-session-log": "systems/good-society-homebrew/assets/chrome-icons/gs-session-log.svg",
  },

  sidebarTabs: {
    "chat":       "systems/good-society-homebrew/assets/chrome-icons/sidebar-chat.svg",
    "combat":     "systems/good-society-homebrew/assets/chrome-icons/sidebar-combat.svg",
    "scenes":     "systems/good-society-homebrew/assets/chrome-icons/sidebar-scenes.svg",
    "actors":     "systems/good-society-homebrew/assets/chrome-icons/sidebar-actors.svg",
    "items":      "systems/good-society-homebrew/assets/chrome-icons/sidebar-items.svg",
    "journal":    "systems/good-society-homebrew/assets/chrome-icons/sidebar-journal.svg",
    "tables":     "systems/good-society-homebrew/assets/chrome-icons/sidebar-tables.svg",
    "cards":      "systems/good-society-homebrew/assets/chrome-icons/sidebar-cards.svg",
    "playlists":  "systems/good-society-homebrew/assets/chrome-icons/sidebar-playlists.svg",
    "compendium": "systems/good-society-homebrew/assets/chrome-icons/sidebar-compendium.svg",
    "settings":   "systems/good-society-homebrew/assets/chrome-icons/sidebar-settings.svg",
  },

  // Cabinet rail icons. Keys match COWORK_SURFACES[].id from patch-cabinet.md.
  cabinetRail: {
    "public-info-dashboard": "systems/good-society-homebrew/assets/chrome-icons/cabinet-dashboard.svg",
    "my-characters-dock":    "systems/good-society-homebrew/assets/chrome-icons/cabinet-dock.svg",
    "cycle-hud":             "systems/good-society-homebrew/assets/chrome-icons/cabinet-cycle-hud.svg",
    "session-log-preview":   "systems/good-society-homebrew/assets/chrome-icons/cabinet-session-log.svg",
    "module-sequencer":      "systems/good-society-homebrew/assets/chrome-icons/cabinet-sequencer.svg",
    "module-combat-tracker": "systems/good-society-homebrew/assets/chrome-icons/cabinet-combat.svg",
    "module-token-mold":     "systems/good-society-homebrew/assets/chrome-icons/cabinet-token-mold.svg",
    "module-dice-tray":      "systems/good-society-homebrew/assets/chrome-icons/cabinet-dice-tray.svg",
    "foundry-players-list":  "systems/good-society-homebrew/assets/chrome-icons/cabinet-players.svg",
    "foundry-sidebar":       "systems/good-society-homebrew/assets/chrome-icons/cabinet-sidebar.svg",
    "foundry-hotbar":        "systems/good-society-homebrew/assets/chrome-icons/cabinet-hotbar.svg",
  },
};
```

The structure is intentionally flat per-surface. Adding a new icon = adding a new entry.

### 4.2 CSS pattern — icon swap via pseudo-elements

The pattern relies on `body.gs-chrome-themed` (already established in v1 §28) gating the whole feature, plus per-control CSS rules that hide the Font Awesome `<i>` and inject the custom asset.

```css
/* In styles/foundry-chrome.css — extends the existing chrome theme */

/* Generic pattern for any icon swap */
body.gs-chrome-themed [data-icon-asset] {
  --icon-asset-url: var(--icon-asset);
}
body.gs-chrome-themed [data-icon-asset] > i.fas,
body.gs-chrome-themed [data-icon-asset] > i.fa-solid,
body.gs-chrome-themed [data-icon-asset] > i.fa-regular,
body.gs-chrome-themed [data-icon-asset] > i.fa-light {
  display: none;
}
body.gs-chrome-themed [data-icon-asset]::before {
  content: '';
  display: inline-block;
  width: var(--icon-size, 22px);
  height: var(--icon-size, 22px);
  background-image: var(--icon-asset-url);
  background-position: center;
  background-repeat: no-repeat;
  background-size: contain;
  opacity: 0.85;
  transition: opacity 0.15s, transform 0.15s;
}
body.gs-chrome-themed [data-icon-asset]:hover::before {
  opacity: 1;
  transform: scale(1.06);
}
body.gs-chrome-themed [data-icon-asset].active::before {
  opacity: 1;
}
```

Per-control rules then set `--icon-asset` based on the registry. Two ways to apply:

**Option A — direct CSS rules per control.** One CSS block per surface ID. Verbose but simple.

```css
body.gs-chrome-themed .scene-control[data-control="token"]      { --icon-asset: url('systems/.../scene-token.svg'); }
body.gs-chrome-themed .scene-control[data-control="measure"]    { --icon-asset: url('systems/.../scene-measure.svg'); }
/* ... etc for every control ... */
```

**Option B — JS-driven, set inline on init.** A `Hooks.on("renderSceneControls", ...)` walks the rendered DOM, reads the registry, and sets `--icon-asset` inline on each button.

```js
// module/hooks/chrome-icons.js (new)

import { CHROME_ICONS } from "../constants.js";

export function register() {
  Hooks.on("renderSceneControls", (app, html) => {
    if (!game.settings.get("good-society-homebrew", "applyFoundryChrome")) return;
    if (!game.settings.get("good-society-homebrew", "applyChromeIcons")) return;

    html[0].querySelectorAll("[data-control]").forEach(el => {
      const controlId = el.dataset.control;
      const asset = CHROME_ICONS.sceneControls[controlId];
      if (asset) {
        el.style.setProperty("--icon-asset", `url('${asset}')`);
        el.setAttribute("data-icon-asset", controlId);
      }
    });
  });

  Hooks.on("renderSidebarTab", (app, html) => {
    // similar, scoped to sidebar tab buttons
  });

  // Cabinet rail icons applied during the Cabinet's render via its template, not here
}
```

**Recommendation:** Option B. It's resilient to Foundry adding/removing controls and lets the registry stay the single source of truth. Downside: requires the hook to fire before the DOM is interactive.

### 4.3 Cabinet rail integration

The Cabinet's rail template (`templates/apps/cabinet.hbs` per `patch-cabinet.md` §3.4) renders single-letter glyphs in the rail buttons. Update the template to consult the icon registry:

```hbs
{{#each rail as |surface|}}
  <span class="gs-cabinet-rail-btn {{#if surface.visible}}is-active{{/if}}"
        data-action="toggleSurface"
        data-surface-id="{{surface.id}}"
        title="{{surface.label}}"
        {{#if surface.iconAsset}}
          style="--icon-asset: url('{{surface.iconAsset}}');"
          data-icon-asset="{{surface.id}}"
        {{/if}}>
    {{#unless surface.iconAsset}}
      {{surface.railGlyph}}
    {{/unless}}
  </span>
{{/each}}
```

The Cabinet's `_prepareContext` looks up each surface's icon from `CHROME_ICONS.cabinetRail`:

```js
// patch-cabinet.md §3.1 _prepareContext — extend
async _prepareContext(options) {
  const ctx = await super._prepareContext(options);
  ctx.groups = COWORK_SURFACES.reduce((groups, s) => {
    const iconAsset = CHROME_ICONS.cabinetRail[s.id];
    groups[s.group] ??= [];
    groups[s.group].push({ ...s, visible: this.isVisible(s.id), iconAsset });
    return groups;
  }, {});
  // ...
}
```

Letter glyph still ships as a fallback for any surface without a custom illustration. Both states are valid.

### 4.4 Asset spec

| Aspect | Requirement |
|---|---|
| Format | SVG preferred (scales perfectly); transparent PNG acceptable |
| Size | 24×24 minimum, 64×64 typical, square aspect |
| Color | Single-color or two-color flat. **Use `currentColor` if SVG** so the icon adopts the surface's color (e.g., scene controls inherit `--gs-accent-2`, active controls get `--gs-brand`). |
| Style | Period-illustrative, line-art, or calligraphic. Should sit comfortably alongside Lavishly Yours and Lora — not photographic, not modern flat-vector. |
| Stroke weight | 1.5–2 px equivalent at the design size. Goes thicker than icons typically need so the strokes survive when downscaled. |
| Aliasing | Aliased / pixel-perfect at 24 px. |

Asset filenames mirror the registry keys: `scene-token.svg`, `sidebar-chat.svg`, `cabinet-dashboard.svg`, etc. **Naming is load-bearing** — the registry references them directly.

### 4.5 Active / inactive states

Foundry distinguishes active controls (selected tool, current sidebar tab) from inactive ones via class names like `.active` or attribute states. The CSS rules already handle hover (scale + opacity bump) and active (full opacity).

For tools like the scene controls where an icon is BOTH a button and a state, the icon should remain *the same illustration* but render at:

- **Inactive:** opacity 0.85, color `--gs-accent-2`.
- **Hover:** opacity 1, scale 1.06.
- **Active:** opacity 1, color `--gs-brand`, slight 1px gilt outline.

Implemented via CSS only — the asset is one SVG, the surrounding state is the chrome.

### 4.6 Setting registration

Add to `module/settings.js`:

```js
game.settings.register("good-society-homebrew", "applyChromeIcons", {
  name: "GOODSOCIETY.settings.applyChromeIcons.name",
  hint: "GOODSOCIETY.settings.applyChromeIcons.hint",
  scope: "client",
  config: true,
  type: Boolean,
  default: true,
});
```

The hint should explicitly note: "Requires the chrome theme to be enabled. Falls back to Foundry's default icons for any surface without a custom asset."

When `applyChromeIcons` is false, the icon-swap CSS rules don't apply (the `[data-icon-asset]` attribute still gets set on elements, but the CSS gates on `body.gs-chrome-icons` which a separate body-class watcher toggles). Foundry's defaults render unchanged.

---

## 5. Localization

```json
{
  "GOODSOCIETY.settings.applyChromeIcons.name": "Use custom chrome icons",
  "GOODSOCIETY.settings.applyChromeIcons.hint": "Replace Foundry's default icons on the scene controls, sidebar tabs, and Cabinet rail with the system's illustrated icons. Requires the chrome theme to be enabled. Falls back to Foundry's defaults for any surface without a custom asset."
}
```

---

## 6. Edge cases

- **Asset missing.** A 404 on the `background-image` URL leaves the pseudo-element empty (transparent). Combined with `display: none` on the FA `<i>`, this means a missing asset shows nothing. **Fix:** the JS-side `applySceneIcons` checks if the asset is present in the registry before setting `data-icon-asset`. If absent, no swap happens — the FA icon stays. (See §4.2 Option B.)
- **Foundry adds a new scene control in a future version.** The new control isn't in the registry. The hook falls through; FA icon shows by default. New control gets its own asset entry when the GM is ready.
- **Foundry renames a control.** Same outcome — the rename means the old key in the registry no longer matches anything; the FA icon shows. Not a regression.
- **User on a low-bandwidth connection.** SVG icons load with the rest of the system. The chrome theme + icon CSS files are small. No measurable performance impact expected.
- **High-DPI / retina.** SVG handles this natively. PNG assets should be at least 2× their display size (e.g., 48×48 PNG for a 24×24 display).
- **Color scheme changes.** Per §4.4, SVG icons should use `currentColor` so they pick up the surface's text color. The chrome theme already sets the surface text color per-state (active / inactive / hover). Single source of truth.

---

## 7. File-by-file plan

| File | Action | Notes |
|---|---|---|
| `module/constants.js` | Extend | Add `CHROME_ICONS` registry per §4.1. |
| `module/settings.js` | Extend | Register `applyChromeIcons` per §4.6. |
| `module/hooks/chrome-icons.js` | Create | Register hooks per §4.2 Option B (JS-driven). Wire `register()` from `module/good-society.js` ready hook. |
| `module/good-society.js` | Modify | Import + call `chromeIconsHooks.register()`. Toggle `body.gs-chrome-icons` class based on setting. |
| `styles/foundry-chrome.css` | Extend | Add icon-swap pattern CSS per §4.2. |
| `styles/apps/_cabinet.css` | Modify | Add `--icon-asset` consumption in `.gs-cabinet-rail-btn` per §4.3. Letter glyph styling remains as fallback. |
| `templates/apps/cabinet.hbs` | Modify | Per §4.3 — render `iconAsset` inline if present, fall back to `railGlyph` otherwise. |
| `module/apps/cabinet.js` | Modify | `_prepareContext` adds `iconAsset` to each surface from `CHROME_ICONS.cabinetRail`. |
| `lang/en.json` | Extend | Add localization keys per §5. |
| `assets/chrome-icons/*.svg` | Create (placeholders) | Empty/placeholder SVGs for every registry key, so the asset paths exist and the GM has a list to fill in. |

---

## 8. Implementation order

1. Extend `module/constants.js` with `CHROME_ICONS`. Each entry's asset path is canonical even if the file doesn't exist yet.
2. Create `assets/chrome-icons/` directory with empty SVG placeholders for every registry key. Document the naming convention in the directory's README.
3. Add the `applyChromeIcons` setting to `module/settings.js` + localization keys.
4. Extend `styles/foundry-chrome.css` with the icon-swap CSS pattern.
5. Add the body-class toggle (`body.gs-chrome-icons`) to the existing setting's `onChange` handler.
6. Create `module/hooks/chrome-icons.js`. Register `renderSceneControls` and `renderSidebarTab` hooks. Test with one or two scene controls (e.g., Token + Measure).
7. Verify: with the placeholder SVGs in place, no icons render but functionality works. Replace one SVG with a real illustration; verify it appears.
8. Extend the Cabinet integration per §4.3.
9. Replace remaining Foundry-shipped icon assets as Natalie supplies illustrations. Test each one.
10. Audit: with the chrome theme on but custom icons off, default icons should render. With both on, custom icons render. Toggle each setting independently.

Each step ends with a working build.

---

## 9. Open questions

- **Foundry version ranges.** Scene controls and sidebar class names are stable across v11–v13 per the v1 §28 risk note. But "stable" doesn't mean immutable. **[FILL IN — confirm against current Foundry v13 build that the data attributes used in the registry are correct.]**
- **System-injected scene controls.** The four GS scene control buttons (`gs-dashboard`, `gs-organizer`, `gs-permissions`, `gs-session-log`) are wired in `module/hooks/scene-controls.js`. The icon registry should be the single source for those too — wire the hook handler to set the icon at injection time.
- **Sequencer detection.** The Cabinet rail conditionally shows the Sequencer icon (per `patch-cabinet.md` §3.2 — `ifModule: "sequencer"`). Same pattern applies here: conditionally include in the rail's icon mapping. **[FILL IN — confirm registration order doesn't break when Sequencer is absent.]**
- **Icon style precedent.** Should icons feel calligraphic / period-illustrative (matching Lavishly Yours), line-art (matching Lora's geometry), or something more decorative (small woodcut feel)? **[FILL IN — Natalie picks once she's worked on a few sample illustrations.]**
- **Asset format choice.** SVG with `currentColor` is the recommended path. PNG works too but loses color flexibility. **[FILL IN — pick once illustrations are sourced.]**
- **Macro hotbar.** Out of scope for this patch per §3.4. Worth revisiting if the GM wants macro slots to inherit the chrome theme too. **[Defer.]**

---

## 10. Decisions captured during build

(Empty — fill in as decisions are made during the work.)
