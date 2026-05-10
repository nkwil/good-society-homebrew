# Patch: the Arrival

> **⚠ SUPERSEDED 2026-05-08 by [`patch-world-identity.md`](./patch-world-identity.md).** This doc's content is absorbed into the world-identity patch alongside the pause overlay and the v1 §29 reconciliation. Preserved here for back-compat with prior references; new work should reference `patch-world-identity.md` instead. The default `arrivalTitle` has changed from "Welcome to Swan's Crossing" to "Welcome to Good Society" — see `patch-world-identity.md` §4.5 for rationale.
>
> **Status:** drafting. New module — no v1 spec equivalent (the Welcome Panel from `15-welcome-panel.md` was cut). The Arrival is the default canvas state when no scene is loaded: a dark, candlelit "Welcome to Swan's Crossing" splash with motes, corner ornaments, and a background image.
>
> **Companion docs:** [`post-mvp-design-patch.md`](./post-mvp-design-patch.md) §2 (the spec), [`patch-preview-post-mvp.html`](./patch-preview-post-mvp.html) §i (the visual reference), [`patch-integration-checklist.md`](./patch-integration-checklist.md) §1 (shared rules).
>
> **Repo target:** `module/apps/arrival.js` (new) + `templates/apps/arrival.hbs` (new) + `styles/apps/_arrival.css` (new) + small registration changes to `module/good-society.js`.

---

## 1. Goals

1. **Cover the empty-canvas state.** When a player or GM opens the world and no scene is active, Foundry shows a blank canvas with no character. The Arrival fills that gap with a deliberate, on-theme splash.
2. **Welcome the player into the world by name.** "Welcome to Swan's Crossing" reinforces the world identity (per `29-world-identity.md`).
3. **Get out of the way as soon as a scene loads.** The Arrival is purely the empty-canvas state; the moment any scene is activated, it disappears.
4. **Easy to customize.** Background image and corner ornaments are CSS-variable asset slots — Natalie can swap in real artwork without touching the JS.

---

## 2. Scope

### In scope

- A frameless ApplicationV2 window pinned to the canvas viewport.
- Title text "Welcome to Swan's Crossing" centered in the viewport.
- Floating mote particles.
- Asset slots for background image and four corner ornaments.
- Trigger logic via `canvasReady` and scene-change hooks.

### Out of scope

- Scene-specific welcome text (e.g., "Welcome to the Lefroy Estate" when a scene loads). Out of v1.
- Sound effects on first appearance (per `29-world-identity.md`'s suggestion of an audible chime). Out of v1; can be a future enhancement.
- Player-specific personalization (e.g., "Welcome back, Margaret"). Out of v1.
- Any interactive elements (buttons, links, scene picker). It's a passive splash.

---

## 3. Architecture

### 3.1 Class

```js
// module/apps/arrival.js

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class Arrival extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: "gs-arrival",
    classes: ["good-society", "gs-arrival"],
    window: { frame: false, positioned: true },
    position: { width: "100%", height: "100%", left: 0, top: 0 },
  };

  static PARTS = {
    arrival: { template: "systems/good-society-homebrew/templates/apps/arrival.hbs" },
  };

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    ctx.title = game.settings.get("good-society-homebrew", "arrivalTitle")
              ?? "Welcome to Swan's Crossing";
    ctx.bgUrl = game.settings.get("good-society-homebrew", "arrivalBackgroundUrl") ?? null;
    ctx.cornerUrl = game.settings.get("good-society-homebrew", "arrivalCornerOrnamentUrl") ?? null;
    return ctx;
  }
}

let arrivalInstance = null;

/**
 * Show or hide the Arrival based on canvas state.
 */
export function syncArrivalToCanvas() {
  const enabled = game.settings.get("good-society-homebrew", "arrivalEnabled");
  if (!enabled) {
    if (arrivalInstance) { arrivalInstance.close(); arrivalInstance = null; }
    return;
  }

  const sceneActive = !!game.scenes?.active;
  if (sceneActive) {
    if (arrivalInstance) { arrivalInstance.close(); arrivalInstance = null; }
    return;
  }

  // No scene active — show Arrival
  if (!arrivalInstance) {
    arrivalInstance = new Arrival();
    arrivalInstance.render(true);
  }
}
```

### 3.2 Template

```hbs
{{!-- templates/apps/arrival.hbs --}}
<div class="gs-arrival-stage">
  {{#if bgUrl}}
    <div class="gs-arrival-bg" style="background-image: url('{{bgUrl}}');"></div>
  {{else}}
    <div class="gs-arrival-bg gs-arrival-bg--default"></div>
  {{/if}}

  <div class="gs-arrival-motes" aria-hidden="true">
    <span class="mote m1"></span>
    <span class="mote m2"></span>
    <span class="mote m3"></span>
    <span class="mote m4"></span>
    <span class="mote m5"></span>
    <span class="mote m6"></span>
  </div>

  {{#if cornerUrl}}
    <img class="gs-arrival-corner gs-arrival-corner--tl" src="{{cornerUrl}}" alt="" aria-hidden="true">
    <img class="gs-arrival-corner gs-arrival-corner--tr" src="{{cornerUrl}}" alt="" aria-hidden="true">
    <img class="gs-arrival-corner gs-arrival-corner--bl" src="{{cornerUrl}}" alt="" aria-hidden="true">
    <img class="gs-arrival-corner gs-arrival-corner--br" src="{{cornerUrl}}" alt="" aria-hidden="true">
  {{/if}}

  <div class="gs-arrival-title">
    <h1>{{title}}</h1>
    <div class="gs-arrival-rule"></div>
  </div>
</div>
```

### 3.3 Styling

`styles/apps/_arrival.css` per the patch preview's §i. Key pieces:

```css
.gs-arrival {
  position: fixed;
  inset: 0;
  z-index: 30;        /* above canvas; below sidebar/sheets */
  pointer-events: none;
}

.gs-arrival-stage {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: linear-gradient(180deg, #1f1a14 0%, #2c241a 50%, #14100c 100%);
}

.gs-arrival-bg {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  opacity: 0.85;
}
.gs-arrival-bg--default {
  background:
    radial-gradient(ellipse at 50% 30%, rgba(244,236,216,0.12) 0%, transparent 60%),
    repeating-linear-gradient(45deg, rgba(255,255,255,0.012) 0 6px, transparent 6px 12px);
}

/* Floating motes */
.gs-arrival-motes { position: absolute; inset: 0; pointer-events: none; }
.gs-arrival-motes .mote {
  position: absolute;
  width: 4px; height: 4px;
  background: rgba(244,236,216,.6);
  border-radius: 50%;
  filter: blur(.5px);
  animation: gs-arrival-drift linear infinite;
}
@keyframes gs-arrival-drift {
  0%   { transform: translate3d(0, 0, 0); opacity: 0; }
  20%  { opacity: 1; }
  100% { transform: translate3d(20px, -200px, 0); opacity: 0; }
}
.gs-arrival-motes .m1 { left: 18%; top: 80%; animation-duration: 14s; }
.gs-arrival-motes .m2 { left: 32%; top: 90%; animation-duration: 18s; animation-delay: 3s; }
.gs-arrival-motes .m3 { left: 56%; top: 86%; animation-duration: 12s; animation-delay: 1s; }
.gs-arrival-motes .m4 { left: 71%; top: 92%; animation-duration: 16s; animation-delay: 5s; }
.gs-arrival-motes .m5 { left: 84%; top: 78%; animation-duration: 20s; animation-delay: 2s; }
.gs-arrival-motes .m6 { left: 45%; top: 95%; animation-duration: 13s; animation-delay: 4s; }

/* Corner ornaments — single asset, mirrored per corner */
.gs-arrival-corner {
  position: absolute;
  width: 96px; height: 96px;
  opacity: 0.5;
  pointer-events: none;
}
.gs-arrival-corner--tl { top: 18px; left: 18px; }
.gs-arrival-corner--tr { top: 18px; right: 18px; transform: scaleX(-1); }
.gs-arrival-corner--bl { bottom: 18px; left: 18px; transform: scaleY(-1); }
.gs-arrival-corner--br { bottom: 18px; right: 18px; transform: scale(-1, -1); }

/* Title */
.gs-arrival-title {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 0 24px;
}
.gs-arrival-title h1 {
  font-family: var(--gs-display);
  font-weight: 500;
  font-size: 42px;
  color: #F1E5C8;
  margin: 0;
  letter-spacing: .015em;
  text-shadow: 0 1px 0 rgba(0,0,0,.4), 0 0 32px rgba(201,165,92,.18);
}
.gs-arrival-rule {
  width: 120px; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(201,165,92,.6), transparent);
  margin: 18px 0 0;
}
```

`pointer-events: none` on the root is crucial — the splash should NOT intercept clicks. Foundry's underlying canvas / scene-picker buttons should still be reachable through it. (If the GM wants to click "open scene XYZ" from the sidebar, the click goes through the splash to the sidebar.)

### 3.4 Z-index considerations

Per CLAUDE.md anti-patterns log §16 ("Don't ship a transient overlay opened from inside an `ApplicationV2` sheet with `z-index < 500`"), the Arrival sits between canvas and sheets:

- Canvas: ~0
- Arrival: 30
- Sidebar / players list / hotbar: ~50
- Sheets (when opened): 100+
- Tooltips / overlays: 500+

So sheets, sidebar, sheets opened over the empty canvas all sit ABOVE the Arrival. The Arrival is purely a canvas-replacement layer.

---

## 4. Trigger logic

### 4.1 Initial render on system ready

```js
// module/good-society.js — add to ready hook

import { syncArrivalToCanvas } from "./apps/arrival.js";

Hooks.once("ready", () => {
  // existing wiring...
  syncArrivalToCanvas();
});
```

### 4.2 React to scene activation / canvas changes

```js
// module/hooks/arrival-sync.js (new)

import { syncArrivalToCanvas } from "../apps/arrival.js";

export function register() {
  // Fires when a scene's active flag changes
  Hooks.on("updateScene", (scene, changes) => {
    if ("active" in changes) syncArrivalToCanvas();
  });

  // Fires when canvas finishes loading (or unloads)
  Hooks.on("canvasReady", syncArrivalToCanvas);
  Hooks.on("canvasInit",  syncArrivalToCanvas);

  // Foundry sometimes deactivates all scenes — fires on scene delete too
  Hooks.on("deleteScene", () => setTimeout(syncArrivalToCanvas, 0));
}
```

Wire `register()` from `module/good-society.js`'s ready hook.

### 4.3 Manual hide

GMs may want to dismiss the Arrival while leaving the canvas blank. Add a tiny "× close" button at the top-right? Probably no — that's a sheet behavior, not a splash behavior. The Arrival self-dismisses when a scene activates; otherwise it stays.

If desired, the user setting `arrivalEnabled` can be flipped to false in the system settings to disable globally.

---

## 5. Settings

```js
// module/settings.js — add to registerSettings()

game.settings.register("good-society-homebrew", "arrivalEnabled", {
  name: "GOODSOCIETY.settings.arrivalEnabled.name",
  hint: "GOODSOCIETY.settings.arrivalEnabled.hint",
  scope: "world",
  config: true,
  type: Boolean,
  default: true,
  onChange: () => syncArrivalToCanvas(),
});

game.settings.register("good-society-homebrew", "arrivalTitle", {
  name: "GOODSOCIETY.settings.arrivalTitle.name",
  hint: "GOODSOCIETY.settings.arrivalTitle.hint",
  scope: "world",
  config: true,
  type: String,
  default: "Welcome to Swan's Crossing",
  onChange: () => syncArrivalToCanvas(),
});

game.settings.register("good-society-homebrew", "arrivalBackgroundUrl", {
  name: "GOODSOCIETY.settings.arrivalBackgroundUrl.name",
  hint: "GOODSOCIETY.settings.arrivalBackgroundUrl.hint",
  scope: "world",
  config: true,
  type: String,
  default: "",
  filePicker: "image",
  onChange: () => syncArrivalToCanvas(),
});

game.settings.register("good-society-homebrew", "arrivalCornerOrnamentUrl", {
  name: "GOODSOCIETY.settings.arrivalCornerOrnamentUrl.name",
  hint: "GOODSOCIETY.settings.arrivalCornerOrnamentUrl.hint",
  scope: "world",
  config: true,
  type: String,
  default: "",
  filePicker: "image",
  onChange: () => syncArrivalToCanvas(),
});
```

Four world-scope settings, all editable via Foundry's standard Configure Settings dialog. `filePicker: "image"` gives a file-picker button (per Foundry's settings API).

---

## 6. Localization

```json
{
  "GOODSOCIETY.settings.arrivalEnabled.name": "Show the Arrival splash",
  "GOODSOCIETY.settings.arrivalEnabled.hint": "When no scene is active, show a 'Welcome to Swan's Crossing' splash on the canvas.",
  "GOODSOCIETY.settings.arrivalTitle.name": "Arrival title text",
  "GOODSOCIETY.settings.arrivalTitle.hint": "The text displayed on the Arrival splash. Defaults to 'Welcome to Swan's Crossing'.",
  "GOODSOCIETY.settings.arrivalBackgroundUrl.name": "Arrival background image",
  "GOODSOCIETY.settings.arrivalBackgroundUrl.hint": "Optional image file shown behind the title. Leave empty to use the default dark gradient.",
  "GOODSOCIETY.settings.arrivalCornerOrnamentUrl.name": "Arrival corner ornament",
  "GOODSOCIETY.settings.arrivalCornerOrnamentUrl.hint": "Optional decorative image used in all four corners (mirrored automatically). Leave empty for no ornament."
}
```

---

## 7. Edge cases

- **GM creates a scene but doesn't activate it.** Per Foundry, "active" means `scene.active === true`; only one scene can be active at a time. So having scenes exist but none active = Arrival shows. Correct.
- **Foundry shows a "no scene" message of its own.** If Foundry v13 has its own empty-canvas message, the Arrival's z-index of 30 should sit above it. **[FILL IN — confirm.]**
- **Multiple users.** All users see the Arrival when no scene is active. The setting is world-scope, so all users see the same title / bg / ornament.
- **Mid-session scene unload.** GM deactivates a scene during play → Arrival appears. Could be jarring. Consider a fade-in transition (e.g., 400 ms opacity transition).
- **Asset URLs that 404.** Browser shows broken-image icon for the corner ornament. Add `onerror="this.style.display='none'"` to the `<img>` tags as a graceful fallback.

---

## 8. Implementation order

1. Add settings (`arrivalEnabled`, `arrivalTitle`, `arrivalBackgroundUrl`, `arrivalCornerOrnamentUrl`) to `module/settings.js`.
2. Add localization keys to `lang/en.json`.
3. Create `module/apps/arrival.js` with the class skeleton.
4. Create `templates/apps/arrival.hbs` with the markup.
5. Create `styles/apps/_arrival.css`. Wire into `styles/good-society.css` import order.
6. Create `module/hooks/arrival-sync.js` with the trigger logic. Register from `module/good-society.js` ready hook.
7. Test: open the world with no active scene → Arrival should show. Activate a scene → Arrival should hide. Deactivate the scene → Arrival should show again.
8. Test setting changes take effect in-session (the `onChange` re-renders).
9. Test asset fallbacks (no bg URL, no corner URL) — should render with default gradient and no corner image.
10. Polish — fade-in transition, mote variation count, corner sizing for very small viewports.

---

## 9. Open questions

- **Empty canvas state in Foundry v13.** Does Foundry show its own splash / empty state when no scene is active? If yes, our z-index 30 should sit above it. **[FILL IN — verify.]**
- **Corner ornament asset format.** Single image mirrored per corner (current design) vs. four separate corner images? Single is simpler. **[Confirmed in spec preview — single asset, four CSS transforms.]**
- **Fade-in animation.** Worth adding for transition smoothness. **[FILL IN — out of v1 or include?]**
- **Player vs. GM behavior.** Should GMs be able to dismiss the Arrival temporarily without disabling the setting? Maybe a "right-click → dismiss for this session" gesture. **[FILL IN — out of v1.]**
- **Mote count and animation timing.** Six motes feels right per the preview. Does it perform well on long-running sessions? **[FILL IN — verify after implementation; cap if needed.]**

---

## 10. Decisions captured during build

(Empty — fill in as decisions are made during the work.)
