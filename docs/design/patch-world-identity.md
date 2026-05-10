# Patch: world identity surfaces

> **Status:** drafting. Supersedes and absorbs `patch-arrival.md`. Reconciles with v1's locked `29-world-identity.md` — covers three world-level identity surfaces under a single visual language, and explicitly maps which v1 §29 surfaces are superseded by this patch (and by `patch-foundry-chrome-icons.md`).
>
> **Companion docs:** [`29-world-identity.md`](./29-world-identity.md) (v1 — locked, but two of its three surfaces are superseded; see §3 below), [`patch-arrival.md`](./patch-arrival.md) (predecessor — content absorbed here; doc retained for back-compat with prior references), [`patch-foundry-chrome-icons.md`](./patch-foundry-chrome-icons.md) (covers the toolbar/scene-control icons that v1 §29 surface 3 originally specified), [`post-mvp-design-patch.md`](./post-mvp-design-patch.md) §2 (master spec summary).
>
> **Repo target:** `module/apps/arrival.js` (carry forward), `module/hooks/pause-overlay.js` (new), `templates/apps/arrival.hbs` (carry forward), `templates/apps/pause-overlay.hbs` (new), `styles/apps/_arrival.css` (carry forward, with shared rules extracted to `styles/_world-identity-shared.css`), `styles/apps/_pause-overlay.css` (new), small registration touches in `module/good-society.js`.

---

## 1. Goals

1. **Cover the empty-canvas state.** When a player or GM opens the world and no scene is active, fill the canvas with a deliberate, on-theme splash (the Arrival).
2. **Replace Foundry's pause overlay** with a system-voiced equivalent that shares visual language with the Arrival.
3. **Reconcile with v1 §29.** v1 §29 specifies three world-identity surfaces: a "Good Society" splash, a pause overlay, and a toolbar icon set. This patch supersedes the splash (replaced by the Arrival) and the toolbar icon set (covered by `patch-foundry-chrome-icons.md`); the pause overlay is kept and refined.
4. **Single shared visual register.** All three world-identity surfaces (Arrival, pause overlay, future variants) read as members of one family. Same dark candlelit register, same mote particles, same corner ornaments, same display-type treatment.
5. **Easy to customize.** Background image, corner ornaments, pause cameo image — all CSS-variable asset slots — Natalie can swap in real artwork without touching the JS.

---

## 2. Surfaces in scope

This patch defines three world-identity surfaces:

| # | Surface | When it appears | Status |
|---|---|---|---|
| 1 | **The Arrival** | Empty-canvas state — no scene active | New (carries forward from `patch-arrival.md`). Supersedes v1 §29 surface 1. |
| 2 | **Pause overlay** | GM has paused the game | Reskin of v1 §29 surface 2 — kept, but reframed under the shared visual register. |
| 3 | **Toolbar / scene-control icons** | Always (when chrome theming is on) | Out of scope here — owned by `patch-foundry-chrome-icons.md`. v1 §29 surface 3 is superseded by that patch. |

All three are world-level chrome (per the v1 §29 principle). They use **house style only** — no per-actor theme cascade. This is uniform across all users and all themes.

---

## 3. Relationship to v1 §29

v1 §29 is locked but two of its three surfaces are superseded by this patch. The supersession map:

| v1 §29 surface | Status under this patch | Supersession source |
|---|---|---|
| Surface 1 — "Good Society" splash | **Superseded.** Replaced by the Arrival (this patch §4). | The Arrival is more flexible (per-world title via setting), uses a darker dramatic register, and aligns with the patch's mote / corner-ornament visual language. The "Good Society" wordmark is preserved as the *default* `arrivalTitle` for fresh installs (see §4.5). |
| Surface 2 — Pause overlay | **Kept and refined** (this patch §5). | Same conceptual treatment (cameo + eyebrow + title), now bound to the shared visual register and using the §8.1 eyebrow primitive. The "A moment's pause" / "The cycle is suspended." copy is preserved. |
| Surface 3 — Toolbar icons | **Superseded.** Covered by `patch-foundry-chrome-icons.md`. | The patch's chrome icons cover scene controls (the left toolbar). v1 §29 surface 3 is functionally identical and is now governed by the chrome-icons registry pattern. |

**v1 §29 should be amended in-place** with a one-line note at the top of each superseded section pointing here, so future readers don't follow the v1 spec and end up with conflicting work. This is the same pattern the patch uses for the v1 §23 eyebrow supersession.

---

## 4. Surface 1 — The Arrival

### 4.1 Behavior

- Triggered when `game.scenes.viewed` is null or the user logs in before any scene has been activated.
- Replaced as soon as a scene becomes active. Not persistent on top of scenes.
- One-and-done — no "tour" or "next" arrows. Just sits there until the user (or GM) loads something.

### 4.2 Visual

- Centered title in `--gs-display`, ~42 px, weight 500. Color: cream (`#F1E5C8`) on the dark backdrop. Subtle text-shadow + a faint gilt glow.
- Below the title, a 120 px gilt-fade hairline rule.
- Floating motes — six total at 3–5 px diameter, slightly blurred, slow upward drift, ~12–20 s duration each, staggered.
- Dark cinematic backdrop. Defaults to a charcoal gradient; a background image can be supplied via `--gs-arrival-bg` (CSS variable) or the `arrivalBackgroundUrl` setting.
- Four corner ornaments, one per corner. Single asset, mirrored per corner via CSS transforms. Asset slot: `--gs-arrival-corner` (or `arrivalCornerOrnamentUrl` setting).

### 4.3 Asset slots — pending

- `arrivalBackgroundUrl` — background image. **[FILL IN]** — Natalie sourcing.
- `arrivalCornerOrnamentUrl` — corner ornament. **[FILL IN]** — Natalie sourcing.

If neither asset is provided, the system falls back to an unornamented dark gradient + the welcome line. Nothing breaks.

### 4.4 Implementation

- Frameless `ApplicationV2` window pinned to the canvas viewport, `id: "gs-arrival"`, classes `["good-society", "gs-arrival", "gs-world-identity"]`.
- `position: fixed; inset: 0;` per the CLAUDE.md §16 anti-pattern for frameless apps.
- z-index: 30. Sits above canvas, below sidebar/sheets/tooltips.
- `pointer-events: none` on the root so clicks pass through to underlying canvas / Foundry chrome (so a GM can click "open scene XYZ" from the sidebar and have it work).

Trigger logic in `module/hooks/arrival-sync.js` listens for `canvasReady`, `canvasInit`, `updateScene` (when `active` changes), and `deleteScene`. A single `syncArrivalToCanvas()` function is the source of truth for show/hide.

The full class skeleton, template, and CSS are inherited from `patch-arrival.md` §3 unchanged. The shared world-identity visual rules (motes, corner ornaments, dark gradient, gilt rule) are extracted to `styles/_world-identity-shared.css` so the pause overlay can consume the same tokens.

### 4.5 Default title

The `arrivalTitle` setting defaults to **"Welcome to Good Society"** on a fresh install. This preserves v1 §29's intent (system-name treatment so the system identifies itself out of the box). Once a GM picks a world name, they update the setting to "Welcome to Swan's Crossing" or whatever fits their world. The default is the system signature; the setting is the world signature.

The "Welcome to Swan's Crossing" treatment shown throughout the patch preview reflects Natalie's specific test world, not the system default.

---

## 5. Surface 2 — Pause overlay

### 5.1 Behavior

- Replaces Foundry's default `<div id="pause">` element (orange D20 + "GAME PAUSED").
- Appears whenever `game.paused === true`.
- Disappears on unpause.

### 5.2 Visual

Reskin of v1 §29 surface 2, now bound to the shared world-identity register:

- **Backdrop:** 65% opacity ink-tone darkening of the canvas, identical to Arrival's dark gradient at 65% opacity. Same charcoal-to-warm gradient stops.
- **Motes:** half-density of Arrival (3 motes instead of 6), same drift animation. Reads as "a quieter version of the Arrival."
- **Corner ornaments:** same asset as Arrival, scaled to 64 px (vs. Arrival's 96 px). Same mirroring per corner.
- **Centered cameo:** 72 px circle with 3 px honey-gold border on a 1 px ink outer ring. Inside: an oxblood (`--gs-danger`) field with a small Lora "W" letter (or other configurable monogram) in honey-gold. Asset slot for a custom cameo image: `pauseCameoImageUrl`.
- **Eyebrow above the cameo:** "A MOMENT'S PAUSE" — uses the §8.1 standalone eyebrow primitive (Lora 600, 11.5 px, 0.18 em letter-spacing, gilt diamond ◆), color tuned for dark backdrop (`--gs-accent-3` honey-gold rather than brand).
- **Title below the cameo:** "The cycle is suspended." in 22 px italic Lora, paper color (`#F1E5C8`).

### 5.3 Implementation

A `Hooks.on("renderPause", ...)` handler swaps Foundry's default markup for our custom HTML. CSS in `styles/apps/_pause-overlay.css` scoped under `body.gs-world-identity #pause`.

```js
// module/hooks/pause-overlay.js
export function register() {
  Hooks.on("renderPause", (app, html, data) => {
    if (!game.settings.get("good-society-homebrew", "applyWorldIdentity")) return;
    // Replace contents of the pause element
    html.find(".pause-content").remove();
    html.append(renderTemplate("systems/good-society-homebrew/templates/apps/pause-overlay.hbs", {
      eyebrow: game.i18n.localize("GOODSOCIETY.pause.eyebrow"),
      title: game.i18n.localize("GOODSOCIETY.pause.title"),
      cameoUrl: game.settings.get("good-society-homebrew", "pauseCameoImageUrl") || null,
    }));
  });
}
```

z-index: 40 (above Arrival's 30 — the pause covers the Arrival when both are present, e.g. the GM pauses an empty-canvas world). Same `pointer-events: none` on the root so canvas clicks fall through; the cameo and copy are non-interactive.

### 5.4 Variants (deferred)

Per-cycle-phase eyebrow variants (e.g. "An interlude between letters" during epistolary phase) are deferred to v1.1. The setting `pauseEyebrowMode: "uniform" | "per-phase"` reserves the slot.

---

## 6. Shared visual register

To keep both surfaces visually unified, three CSS asset slots and tokens are shared. They live in `styles/_world-identity-shared.css` and are consumed by both Arrival and Pause overlay stylesheets.

### 6.1 Shared CSS variables

```css
:root {
  /* World identity backdrop */
  --gs-wi-bg-gradient: linear-gradient(180deg, #1f1a14 0%, #2c241a 50%, #14100c 100%);
  --gs-wi-bg-asset: var(--gs-arrival-bg, none);
  --gs-wi-corner-asset: var(--gs-arrival-corner, none);

  /* Mote tokens */
  --gs-wi-mote-color: rgba(244, 236, 216, .6);
  --gs-wi-mote-drift-distance: -200px;
  --gs-wi-mote-drift-x-skew: 20px;
}
```

### 6.2 Shared classes

- `.gs-wi-stage` — base wrapper for any world-identity surface. Provides the gradient backdrop and `overflow: hidden`.
- `.gs-wi-motes` + `.gs-wi-mote.m1`–`.m6` — the mote particle layer. Density (count of motes) is set by adding/omitting `.m1`...`.m6`.
- `.gs-wi-corners` + `.gs-wi-corner--tl`/`tr`/`bl`/`br` — corner ornament wrapper, single asset, four CSS transforms.

Both Arrival and Pause overlay templates compose these classes. New world-identity surfaces (cycle-end transitions, world-load splash variants) added in future patches inherit the same primitives.

---

## 7. Settings

Six world-scope settings cover both surfaces. The Arrival settings carry forward unchanged from `patch-arrival.md`; pause-related settings are new.

```js
// Arrival (carry forward)
arrivalEnabled: { default: true }
arrivalTitle: { default: "Welcome to Good Society" }   // CHANGED from "Welcome to Swan's Crossing"
arrivalBackgroundUrl: { default: "", filePicker: "image" }
arrivalCornerOrnamentUrl: { default: "", filePicker: "image" }

// Pause + world identity (new)
applyWorldIdentity: { default: true, scope: "client" }
pauseCameoImageUrl: { default: "", filePicker: "image", scope: "world" }
```

The `applyWorldIdentity` client setting toggles the body class `gs-world-identity` on/off. When off, Foundry's default pause overlay shows and the Arrival doesn't render; the world reverts to Foundry visuals for these surfaces. Toggleable at runtime — the body class adds/removes on `clientSettingChanged` and the Arrival's `syncArrivalToCanvas` re-runs.

---

## 8. `gs-world-identity` body class

A new body class added to the §15 registry in the master spec:

| Class | Scope | Toggled by | When applied | What it does |
|---|---|---|---|---|
| `gs-world-identity` | `body` | `applyWorldIdentity` setting | Page load + runtime via `clientSettingChanged` | Activates world identity surfaces (Arrival, pause overlay, future variants). When absent, Arrival doesn't render and Foundry's default pause overlay shows. Independent of `gs-chrome-themed` — they can each be on or off without affecting the other. |

Layering: independent of `gs-chrome-themed` and `gs-chrome-icons-on`. World identity surfaces work whether or not chrome theming is active (per v1 §29's edge case "User toggles `applyFoundryChrome` setting").

---

## 9. z-index layering across surfaces

Recap with all surfaces this patch introduces, in stacking order from canvas up:

| Layer | z-index | Notes |
|---|---|---|
| Canvas | 0 | Foundry baseline |
| Arrival | 30 | Above canvas, below most chrome |
| Pause overlay | 40 | Above Arrival (pause-during-empty-canvas case) |
| Sidebar / players list / hotbar | ~50 | Foundry chrome |
| Sheets | 100+ | Foundry sheets |
| Sheet-anchored overlays (popovers, persona switcher) | 500 | Per CLAUDE.md §16 anti-pattern |
| Tooltips | 10000 | Above everything |

The pause overlay at 40 means the GM pausing an empty-canvas world will see the pause overlay layered on top of the Arrival — both present, pause being more prominent. This is the correct visual: the world is paused, that's the dominant state. When unpaused, only the Arrival remains.

---

## 10. Localization

```json
{
  "GOODSOCIETY.settings.arrivalEnabled.name": "Show the Arrival splash",
  "GOODSOCIETY.settings.arrivalEnabled.hint": "When no scene is active, show a 'Welcome to ...' splash on the canvas.",
  "GOODSOCIETY.settings.arrivalTitle.name": "Arrival title text",
  "GOODSOCIETY.settings.arrivalTitle.hint": "The text displayed on the Arrival splash. Defaults to 'Welcome to Good Society' — change to your world's name.",
  "GOODSOCIETY.settings.arrivalBackgroundUrl.name": "Arrival background image",
  "GOODSOCIETY.settings.arrivalBackgroundUrl.hint": "Optional image file shown behind the title. Leave empty for the default dark gradient.",
  "GOODSOCIETY.settings.arrivalCornerOrnamentUrl.name": "Arrival corner ornament",
  "GOODSOCIETY.settings.arrivalCornerOrnamentUrl.hint": "Optional decorative image used in all four corners (mirrored automatically). Leave empty for no ornament.",
  "GOODSOCIETY.settings.applyWorldIdentity.name": "Apply world identity surfaces",
  "GOODSOCIETY.settings.applyWorldIdentity.hint": "When on, the system shows the Arrival splash and a custom pause overlay. When off, Foundry's defaults are used.",
  "GOODSOCIETY.settings.pauseCameoImageUrl.name": "Pause overlay cameo image",
  "GOODSOCIETY.settings.pauseCameoImageUrl.hint": "Optional image used as the small cameo on the pause overlay. Defaults to a 'W' monogram.",
  "GOODSOCIETY.pause.eyebrow": "A MOMENT'S PAUSE",
  "GOODSOCIETY.pause.title": "The cycle is suspended."
}
```

---

## 11. File-by-file plan

| File | Action |
|---|---|
| `module/apps/arrival.js` | Carry forward from `patch-arrival.md` §3.1. No changes. |
| `module/hooks/arrival-sync.js` | Carry forward from `patch-arrival.md` §4.2. No changes. |
| `module/hooks/pause-overlay.js` | **NEW.** Hooks `renderPause` to swap in our custom markup. Gates on `applyWorldIdentity`. |
| `templates/apps/arrival.hbs` | Carry forward, but adopt `gs-wi-stage` / `gs-wi-motes` / `gs-wi-corners` shared classes from §6.2. |
| `templates/apps/pause-overlay.hbs` | **NEW.** Cameo + eyebrow + title, composed from §6.2 shared classes. |
| `styles/_world-identity-shared.css` | **NEW.** Shared CSS variables (§6.1) + shared classes (§6.2). Imported before `_arrival.css` and `_pause-overlay.css` in `good-society.css`. |
| `styles/apps/_arrival.css` | Carry forward, but extract shared rules to `_world-identity-shared.css`. Arrival keeps Arrival-specific rules (title typography, gilt rule, mote density). |
| `styles/apps/_pause-overlay.css` | **NEW.** Pause-specific rules — cameo, eyebrow text, title position, half-density mote count. |
| `module/settings.js` | Add `applyWorldIdentity` (client) and `pauseCameoImageUrl` (world). Carry forward Arrival's four settings; change `arrivalTitle` default to `"Welcome to Good Society"`. |
| `module/good-society.js` | Register `pause-overlay.js` from the ready hook. Add `gs-world-identity` body class on init based on `applyWorldIdentity`; subscribe to `clientSettingChanged` for runtime toggle. |
| `lang/en.json` | Add the keys from §10. |
| `29-world-identity.md` (v1 spec) | Amend with three "superseded by patch §X" notes per the §3 supersession map. Don't delete content — leave as historical record. |
| `patch-arrival.md` | Add a one-line "Superseded by `patch-world-identity.md`" note at the top so prior references resolve. Don't delete. |

---

## 12. Implementation order

1. Create `styles/_world-identity-shared.css` with the shared variables and classes.
2. Migrate `templates/apps/arrival.hbs` to use the shared classes. Verify visual parity with current Arrival.
3. Create `templates/apps/pause-overlay.hbs` and `styles/apps/_pause-overlay.css`. Render the pause manually first (call the template via `renderTemplate` from a console one-liner) to verify visual.
4. Create `module/hooks/pause-overlay.js`. Register from `module/good-society.js`. Verify Foundry's default pause is replaced when the GM clicks pause.
5. Add settings — `applyWorldIdentity` and `pauseCameoImageUrl`. Wire the body-class toggle and `onChange` handlers.
6. Change `arrivalTitle` default to `"Welcome to Good Society"`. Test on a fresh world.
7. Verify z-index layering — pause an empty-canvas world; confirm pause overlay sits above Arrival.
8. Verify settings off-paths — `applyWorldIdentity=false` reverts to Foundry's default pause; `arrivalEnabled=false` hides the Arrival.
9. Amend v1 §29 with supersession notes per §3 above.
10. Add the one-line supersession note at the top of `patch-arrival.md`.

---

## 13. Edge cases

- **GM creates a scene but doesn't activate it.** Per Foundry, "active" means `scene.active === true`; only one scene can be active at a time. Scenes existing but none active = Arrival shows. Correct.
- **Multiple users.** All users see the Arrival when no scene is active; settings are world-scope. Pause overlay is also world-state.
- **GM pauses while a scene is active.** Pause overlay shows over the canvas (no Arrival present). Standard case.
- **GM pauses while no scene is active.** Both Arrival and Pause overlay render simultaneously; pause's z-index 40 puts it above Arrival's 30. Looks like "the empty canvas, paused" — correct.
- **Asset URLs that 404.** `<img>` elements get `onerror="this.style.display='none'"` as a graceful fallback. The pause cameo defaults to the inline "W" monogram if the image fails to load.
- **Foundry update changes pause-element structure.** The hook `renderPause` is a stable Foundry API; the markup inside is what may shift. If the hook fails to inject (e.g. Foundry renames `.pause-content`), the worst case is Foundry's default pause rendering through. No broken functionality. Worth a try-catch around the hook handler so a broken inject doesn't suppress Foundry's UI.
- **User has both `applyFoundryChrome` and `applyWorldIdentity` off.** Default Foundry visuals throughout. Correct fall-through.
- **User has `applyFoundryChrome` on but `applyWorldIdentity` off.** Chrome (titlebars, sidebar, etc.) is themed but pause + Arrival use Foundry defaults. Acceptable mixed state.

---

## 14. Open questions

- **§4.3** — Background image and corner ornament assets. Natalie sourcing.
- **§5.2** — Pause cameo default monogram letter. Currently "W"; should it be a more abstract glyph (a wax seal motif, a quill mark) that doesn't presume an initial? Lean: stay with the configurable letter for now; the `pauseCameoImageUrl` setting lets GMs override with art.
- **§5.4** — Per-cycle-phase pause eyebrow variants. Defer to v1.1.
- **§7** — Should `pauseCameoImageUrl` be world-scope or client-scope? World makes sense (the GM authors world identity). Lean: world-scope as written.
- **§9** — Pause overlay z-index 40 may clash with future canvas overlays added by other modules. If conflicts surface, bump to 45. Document the chosen value here.
- **§3** — Whether to leave v1 §29 as historical record (with supersession notes) or excise the superseded sections entirely. Lean: historical record. The notes prevent confusion; the original content has reference value.

---

## 15. Decisions log

- **2026-05-08 — `patch-arrival.md` is absorbed by this doc.** Single source of truth for world identity surfaces. The Arrival's content is reproduced here with minor adjustments (default title, shared visual register). `patch-arrival.md` is preserved with a top-of-file pointer for back-compat.
- **2026-05-08 — Arrival supersedes v1 §29 surface 1 ("Good Society" splash).** The dark dramatic register suits the empty-canvas state better than the parchment splash. The "Good Society" wordmark is preserved as the *default* `arrivalTitle` so fresh installs identify the system; GMs override to their world name.
- **2026-05-08 — Pause overlay is kept and refined.** v1 §29 surface 2's structure (cameo + eyebrow + title) is preserved. Visual register adopts the shared world-identity tokens (dark gradient, motes, corner ornaments). Eyebrow now uses the §8.1 primitive (Lora 600 + gilt diamond), color tuned to honey-gold for dark backdrop legibility.
- **2026-05-08 — Toolbar icon set is superseded by `patch-foundry-chrome-icons.md`.** v1 §29 surface 3 specified period-illustrative icons replacing Foundry's FA glyphs on the left toolbar. The chrome-icons patch covers exactly that surface (scene controls) under a registry-based extensibility pattern that's also used for sidebar tabs and the Cabinet rail. Single source of truth: chrome-icons patch.
- **2026-05-08 — Shared visual register extracted to its own stylesheet.** `styles/_world-identity-shared.css` carries the gradient, mote tokens, corner ornament classes. Arrival and pause both consume. Future world-identity surfaces (transitions, alternate splashes) inherit the same primitives without duplicating CSS.
- **2026-05-08 — `gs-world-identity` body class is the canonical toggle.** Independent of `gs-chrome-themed`. Added to the master spec §15 registry. Runtime-toggleable via `clientSettingChanged`.
- **2026-05-08 — Default `arrivalTitle` is "Welcome to Good Society", not "Welcome to Swan's Crossing".** Swan's Crossing is Natalie's specific test world. The system default is the system name; GMs personalize.
- **2026-05-08 — Pause overlay z-index sits above Arrival (40 vs 30).** The "empty canvas, paused" composition is intentional — pause is the dominant state when both are present.
