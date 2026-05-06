# 28 — Foundry Chrome Theme

**Status:** Locked — scope decided, surfaces specified, opt-in approach specified
**Date opened:** 2026-05-05
**Covers:** new entry — re-theming Foundry's surrounding application chrome to match the Good Society design system

## Goal

Specify CSS overrides that re-theme Foundry's standard application chrome — window titlebars, sidebar, chat log surrounding area, scene navigation, default form controls, notifications — to match the Good Society house style. Closes the visual gap between custom system surfaces and the surrounding Foundry UI.

Without this, the system's beautiful themed sheets, dashboards, and chat cards sit inside Foundry's default dark-grey-and-orange chrome. The mismatch breaks immersion the moment a user's eye crosses a window titlebar or settings menu.

This doc is **scope-conscious** — Foundry's CSS class names and DOM structure occasionally change between versions, so heavy overrides are brittle. We target high-impact / low-risk surfaces and explicitly skip deep-internal Foundry UIs.

## The trade-off: aggressiveness vs. maintainability

Three scope tiers were considered:

### Light touch (rejected)
Only override window titlebars and the sidebar's color scheme. Most of Foundry's UI stays default. Lowest risk of Foundry-update breakage but leaves most of the visual mismatch unresolved.

### Medium override (chosen)
Re-theme all standard high-visibility Foundry surfaces — window chrome, sidebar tabs and backgrounds, scene navigation, chat log surrounding area, default form controls, notifications. Skip Foundry's deep-internal UIs (compendium browser internals, file picker, settings dialog forms, configure-token dialogs). Moderate maintenance burden — about 6-10 surfaces to track across Foundry versions.

### Heavy override / "skinned" mode (rejected)
Try to make Foundry feel like a custom application throughout. Replace nearly every surface. Highest risk; would likely break on every Foundry minor version.

The medium override is what this doc specifies. It captures the surfaces players see most often without committing to maintaining overrides for every internal Foundry dialog.

## Opt-in setting

The chrome theme is **opt-in via a system setting**, defaulted to **enabled for new worlds, but configurable per-user**.

```js
game.settings.register("good-society-homebrew", "applyFoundryChrome", {
  name: "GOODSOCIETY.settings.applyFoundryChrome.name",
  hint: "GOODSOCIETY.settings.applyFoundryChrome.hint",
  scope: "client",
  config: true,
  type: Boolean,
  default: true,
});
```

Reasoning: most users will appreciate the cohesive look. Some users (especially those running multiple systems in the same Foundry install) may prefer Foundry's defaults to avoid visual confusion when switching between worlds. The setting defers to user preference.

When the setting is enabled, the system loads `styles/foundry-chrome.css` (which contains the override rules). When disabled, the file is omitted from the loader.

Per Foundry conventions, the setting takes effect on next page reload. A small toast appears on toggle: "Reload to apply chrome theme change."

## Surfaces in scope

Each surface gets its own subsection below. For each: what's targeted, what the new look is, the CSS approach, and a risk note.

### 1. Window titlebar

**Foundry surface:** `.window-app .window-header` — every dialog, sheet, and ApplicationV2 window has one.

**Default look:** dark grey (#1c1c1c) background with white text and an orange (#ff6400) close button.

**Re-theme:**
- Background: `var(--gs-paper)` (cream).
- Text: `var(--gs-brand)` (forest green) in italic Lora.
- Close button: small × in `var(--gs-accent-2)` with a hover shift to `var(--gs-brand)`.
- Configure (gear) icon: replaced with the italic word "configure" in `var(--gs-accent-2)`. Subtle, period-correct.
- Border-bottom: 0.5px hairline in `var(--gs-accent-2)`.
- Border-radius: 8px (matches our sheet conventions).

```css
.window-app .window-header {
  background: var(--gs-paper);
  color: var(--gs-brand);
  font-family: var(--gs-display);
  font-size: 14px;
  font-style: italic;
  padding: 10px 18px;
  border-bottom: 0.5px solid var(--gs-accent-2);
  border-radius: 8px 8px 0 0;
}

.window-app .window-header .window-title {
  color: var(--gs-brand);
  font-style: italic;
}

.window-app .window-header .header-button {
  color: var(--gs-accent-2);
  font-family: var(--gs-body);
  font-size: 11px;
  font-style: italic;
  /* Replace the gear icon with text "configure" */
}

.window-app .window-header .header-button:hover {
  color: var(--gs-brand);
}
```

**Risk:** Low. Foundry's `.window-app` class structure has been stable for several major versions.

### 2. Sidebar (right panel)

**Foundry surface:** `#sidebar`, `.sidebar-tab`, `.sidebar-content`.

**Default look:** dark background, orange accent on active tab, sans-serif tab labels.

**Re-theme:**
- Sidebar background: `var(--gs-paper)`.
- Tab bar: house chrome with hairline divider.
- Active tab: forest green text with a 1.5px brand-color underline (matching our sheet tab nav).
- Inactive tabs: `var(--gs-accent-2)` text.
- Tab labels: Lora display font, 12px, sentence case ("Chat" not "CHAT").

```css
.sidebar-tab {
  background: var(--gs-paper);
  font-family: var(--gs-display);
  font-size: 12px;
  color: var(--gs-accent-2);
  letter-spacing: 0.04em;
  border: 0;
  padding: 6px 14px 8px;
}

.sidebar-tab.active {
  color: var(--gs-brand);
  border-bottom: 1.5px solid var(--gs-brand);
  margin-bottom: -0.5px;
}

#sidebar {
  background: var(--gs-paper);
  border-left: 0.5px solid var(--gs-accent-2);
}
```

**Risk:** Medium. Foundry's sidebar tab implementation has shifted between v11 and v13. v13 patterns should hold, but verify on Foundry version updates.

### 3. Chat log surrounding chrome

**Foundry surface:** `#chat-log`, `#chat-form`, `.chat-message` (the wrapper, not the content — our chat cards live inside).

**Default look:** dark background around chat messages, plain text input.

**Re-theme:**
- Chat log background: `var(--gs-paper)`.
- Chat input area: `var(--gs-paper-warm)` with house-styled input and primary button.
- Input border: 0.5px `var(--gs-accent-2)`.
- Send button: primary filled in `var(--gs-brand)` with paper text.
- Foundry's default chat message wrapper: minimal — let our themed cards inside speak.

```css
#chat-log {
  background: var(--gs-paper);
  padding: 8px 0;
}

#chat-form {
  background: var(--gs-paper-warm);
  border-top: 0.5px solid var(--gs-accent-2);
  padding: 10px 14px;
}

#chat-form textarea {
  background: var(--gs-paper);
  border: 0.5px solid var(--gs-accent-2);
  border-radius: 4px;
  font-family: var(--gs-body);
  font-size: 13px;
  color: var(--gs-ink);
  padding: 6px 12px;
}

#chat-form .send-button {
  /* Apply our primary button styling */
  background: var(--gs-brand);
  border: 0.5px solid var(--gs-brand);
  color: var(--gs-paper);
  font-family: var(--gs-display);
  font-size: 12px;
  padding: 6px 16px;
  border-radius: 4px;
  letter-spacing: 0.04em;
}
```

**Risk:** Low. Chat log surfaces are Foundry-stable.

### 4. Scene navigation (top of canvas)

**Foundry surface:** `#navigation`, `.scene-tabs`.

**Default look:** dark bar across the top of the canvas with bracketed scene names.

**Re-theme:**
- Background: `var(--gs-paper-warm)`.
- Scene tabs: italic body type, sentence case.
- Active scene: brand color with a 1.5px underline.
- Inactive scenes: `var(--gs-accent-2)`.

```css
#navigation {
  background: var(--gs-paper-warm);
  border-bottom: 0.5px solid var(--gs-accent-2);
}

#navigation .scene-tab {
  font-family: var(--gs-body);
  font-style: italic;
  font-size: 12px;
  color: var(--gs-accent-2);
  padding: 6px 14px 8px;
}

#navigation .scene-tab.active {
  color: var(--gs-brand);
  border-bottom: 1.5px solid var(--gs-brand);
}
```

**Risk:** Medium-low. Scene navigation has minor variations between Foundry versions.

### 5. Default form controls

**Foundry surface:** `input[type="text"]`, `select`, `textarea`, `button` — when not inside our explicit `.gs-input` etc. classes.

**Default look:** Foundry's defaults — varies by context, generally dark.

**Re-theme:** apply our primitive styling globally to default form controls. This is the most impactful single override because it cascades into Foundry's settings dialogs, the Configure Token dialog, the actor permissions dialog, etc.

```css
input[type="text"],
input[type="number"],
textarea,
select {
  background: var(--gs-paper-warm);
  border: 0.5px solid var(--gs-accent-2);
  border-radius: 4px;
  font-family: var(--gs-body);
  font-size: 13px;
  color: var(--gs-ink);
  padding: 6px 12px;
}

input[type="text"]:focus,
textarea:focus,
select:focus {
  border-color: var(--gs-brand);
  outline: none;
}

button {
  background: transparent;
  border: 0.5px solid var(--gs-accent-2);
  color: var(--gs-accent-2);
  font-family: var(--gs-display);
  font-size: 12px;
  padding: 5px 14px;
  border-radius: 4px;
  letter-spacing: 0.04em;
}

button:hover {
  border-color: var(--gs-brand);
  color: var(--gs-brand);
}

button.primary,
button[type="submit"] {
  background: var(--gs-brand);
  border-color: var(--gs-brand);
  color: var(--gs-paper);
}
```

**Risk:** Medium. Global form-control overrides can interact unexpectedly with embedded modules' UIs. If a module ships its own styles, ours may conflict. Mitigation: use specificity carefully (e.g. `.window-app input[type="text"]` instead of bare `input[type="text"]`) so module styles can still win where they explicitly assert.

### 6. Notification toasts

**Foundry surface:** `#notifications` (toast notifications that appear in the top-right).

**Default look:** colored bars (red for error, yellow for warning, etc.) with white text.

**Re-theme:**
- Background: `var(--gs-paper)` for default; semantic colors for warning/error/info.
- Border: 0.5px in semantic color.
- Text: appropriate semantic color in body type.
- Drop shadow: subtle (matches our token hover card pattern).

```css
#notifications .notification {
  background: var(--gs-paper);
  border: 0.5px solid var(--gs-accent-2);
  border-left: 2.5px solid var(--gs-accent-2);
  border-radius: 6px;
  padding: 10px 14px;
  font-family: var(--gs-body);
  font-size: 13px;
  color: var(--gs-ink);
  box-shadow: 0 2px 8px rgba(20, 12, 14, 0.2);
}

#notifications .notification.warning {
  border-left-color: var(--gs-accent-1);
  color: var(--gs-accent-1);
}

#notifications .notification.error {
  border-left-color: var(--gs-danger);
  color: var(--gs-danger);
}

#notifications .notification.success {
  border-left-color: var(--gs-positive);
  color: var(--gs-positive);
}

#notifications .notification.info {
  border-left-color: var(--gs-brand);
  color: var(--gs-brand);
}
```

**Risk:** Low. Notification structure is Foundry-stable.

### 7. Player list (bottom-left of screen)

**Foundry surface:** `#players`.

**Default look:** dark background with colored user names.

**Re-theme:**
- Background: `var(--gs-paper-warm)`.
- User name color: each user's chosen color is preserved (Foundry default), but on a paper background.
- Border: 0.5px hairline matching our other persistent UI.

```css
#players {
  background: var(--gs-paper-warm);
  border: 0.5px solid var(--gs-accent-2);
  border-radius: 8px;
  padding: 8px 12px;
}

#players .player-name {
  font-family: var(--gs-body);
  font-size: 12px;
}
```

**Risk:** Low.

### 8. Macro hotbar (bottom of screen)

**Foundry surface:** `#hotbar`.

**Re-theme:** Most narrative-game tables don't use macros. Apply minimal styling — house background, hairline border. Don't invest heavily here.

```css
#hotbar {
  background: var(--gs-paper-warm);
  border: 0.5px solid var(--gs-accent-2);
  border-radius: 8px;
}
```

**Risk:** Low.

## Surfaces explicitly out of scope

The following Foundry surfaces are NOT re-themed in v1:

- **Settings dialogs** (the multi-tab Configure Settings window) — too internal, varies across Foundry versions.
- **File picker** — Foundry's file browser. Out of scope; let it stay default.
- **Compendium browser** — too complex, varies between versions.
- **Configure Token dialog** — internal Foundry UI for token settings.
- **User Configuration** — internal user settings.
- **Hotbar Macro editor** — most users won't see this in a narrative game.

If a user encounters one of these surfaces, it'll look like default Foundry. That's acceptable — these are admin tools, not play surfaces.

The doc's section 5 (default form controls) does cascade into these surfaces in a limited way (their inputs and buttons inherit our styling), which mitigates the visual mismatch without requiring per-surface overrides.

## Implementation approach

### File structure

```
styles/
├── _variables.css            # already exists — house style CSS variables
├── primitives/               # already exists — our component primitives
├── themes/                   # already exists — character themes
├── components/
├── sheets/
├── apps/
└── foundry-chrome.css        # NEW — this doc's overrides
```

The `foundry-chrome.css` file is a single file containing all the override rules organized by surface (matching the section numbering above).

### Loading

The file is included in `system.json`'s `styles` array conditionally based on the `applyFoundryChrome` setting. Because Foundry processes `styles` at world-load time, runtime toggling requires a reload.

Alternative: always include the file but namespace all rules under a body class (e.g. `body.gs-chrome-themed`). The setting toggles the body class on/off without requiring reload. This is the cleaner approach.

```css
/* Wrap all rules in foundry-chrome.css */
body.gs-chrome-themed .window-app .window-header { ... }
body.gs-chrome-themed #sidebar { ... }
/* ... etc */
```

Then in `module/good-society.js`:

```js
Hooks.once("ready", () => {
  const enabled = game.settings.get("good-society-homebrew", "applyFoundryChrome");
  document.body.classList.toggle("gs-chrome-themed", enabled);
});

Hooks.on("clientSettingChanged", (key) => {
  if (key === "good-society-homebrew.applyFoundryChrome") {
    document.body.classList.toggle("gs-chrome-themed", 
      game.settings.get("good-society-homebrew", "applyFoundryChrome"));
  }
});
```

This makes the toggle instant — no reload needed.

### Specificity strategy

All override rules use `body.gs-chrome-themed` as their root selector for two purposes: (1) the runtime toggle, and (2) elevated specificity so our rules reliably win against Foundry's defaults without `!important`.

Avoid `!important` everywhere. If a Foundry rule wins despite our specificity, there's a real conflict — investigate and adjust selectors rather than adding `!important`.

### Maintenance approach

Each Foundry version (major and minor) — verify the override surfaces still work. Specifically test:

1. Open a sheet — verify the titlebar is themed.
2. Open the sidebar — verify tabs are themed and active-tab indicator works.
3. Send a chat message — verify the input and send button are themed.
4. Check scene navigation — verify it's themed.
5. Open Foundry's settings — verify form controls inside use our styling (not perfectly themed, but consistent type and colors).

If any selector breaks, document the change in this doc's changelog and update the affected rule.

## Theme behavior

Foundry chrome overrides use **house style only**. Character themes don't apply to Foundry's chrome — only to our system's surfaces (sheets, cards, etc.). This is intentional:

- House style on chrome means the application as a whole has one consistent visual identity.
- Per-character theming on character-bound surfaces means individual characters have distinct voices.
- The boundary is clear: open a window (house chrome) → see a themed sheet inside (character voice).

Don't try to theme Foundry's chrome per-active-character. It would create chaotic UX where the chrome shifts based on which sheet was last opened.

## Edge cases

### User installs another module that also re-themes Foundry chrome
CSS conflicts. Whichever module's stylesheet loads later wins. The system can use a body class wrapper (per Loading above) to make our rules conditional, allowing users to disable our chrome theme if another module is preferred.

### User runs a non-Good-Society world in the same Foundry install
The chrome theme only loads when a Good Society world is active. Other worlds get default Foundry chrome. The body class is only added on Good Society worlds, so the styles only apply when relevant.

### Foundry update breaks selectors
This is the documented risk. Mitigation: scope-limited override (only ~7 surfaces), maintenance pass on each Foundry version, ability for users to opt-out if their Foundry version is incompatible.

If a user reports the chrome looks broken after a Foundry update, the fix is: (1) GM disables `applyFoundryChrome` setting until the system is updated, (2) maintainer updates the affected selectors and ships a new version.

### High contrast accessibility mode
If a user has Foundry's accessibility "increase contrast" mode enabled, our chrome theme should respect it. The accessibility flag should override our theme variables.

```css
body.gs-chrome-themed.high-contrast {
  /* Override variables to high-contrast values */
  --gs-paper: #ffffff;
  --gs-ink: #000000;
  --gs-accent-2: #444444;
  /* ... */
}
```

Defer the high-contrast variant to v1.1 if it adds significant complexity.

## Implementation notes for Claude Code

When prompted to build:

1. Create `styles/foundry-chrome.css` with all override rules organized by surface section.
2. Wrap every rule under `body.gs-chrome-themed`.
3. Add the `applyFoundryChrome` setting in `module/settings.js`.
4. Wire the body-class toggle in `Hooks.once("ready", ...)` and on settings change.
5. Test with the test path below.

CSS organization within `foundry-chrome.css`:

```
/* === 1. Window titlebar === */
/* === 2. Sidebar === */
/* === 3. Chat log === */
/* === 4. Scene navigation === */
/* === 5. Default form controls === */
/* === 6. Notification toasts === */
/* === 7. Player list === */
/* === 8. Macro hotbar === */
```

### Test path

1. Load a Good Society world. Verify the chrome is themed (cream titlebars, cream sidebar, themed chat input).
2. Open the system settings. Toggle `applyFoundryChrome` off. Verify chrome reverts to default Foundry without page reload.
3. Toggle back on. Verify chrome re-themes instantly.
4. Open a sheet. Verify the titlebar is themed.
5. Click in the sidebar tabs. Verify active-tab styling.
6. Type in the chat input. Click send. Verify the form controls and button are themed.
7. Trigger a notification (e.g. fail to upload an asset). Verify the toast is themed.
8. Open a Foundry built-in dialog (e.g. Configure Token). Verify the form controls inside have our type and colors (without perfect overall theming).

If 1–8 pass, the Foundry chrome theme is production-ready.

## Open questions

1. **Should the system ship a "high contrast mode" variant of the chrome theme?** **Tentative answer: yes for v1.1.** Useful for accessibility; small implementation cost once the base theme is locked.

2. **Should Foundry's compendium browser be themed?** **Tentative answer: no for v1.** Too internal; high maintenance burden. Re-evaluate if user feedback specifically asks for it.

3. **Should the chrome theme support multiple house styles in the future (e.g. a "dark mode" variant)?** **Tentative answer: defer to v1.1.** Architecturally possible by adding a second body class (`gs-chrome-themed.gs-dark-mode`) with overrides; not in v1 scope.

4. **Should we suppress Foundry's audio cues that conflict with our system's tone?** Foundry plays default sound effects on certain UI events. **Tentative answer: no — leave audio alone.** Audio is highly user-specific; let users decide.

5. **Should we override Foundry's default font stack at the document root?** This is the most aggressive single change — every text on the page becomes Lora/Crimson by default. **Tentative answer: yes, but carefully scoped.** Apply at `body.gs-chrome-themed` to inherit through all UI; allow individual elements to override (which our primitive classes already do).

6. **Should we re-theme Foundry's loading screen?** The dark splash screen with the Foundry logo. **Tentative answer: no.** That's Foundry's brand moment; respect it.

7. **Can we re-theme the dice roll animation?** Foundry's dice-rolling chat cards have their own styling. **Tentative answer: irrelevant — Good Society has no dice.** The few system-emitted chat messages we generate use our own card primitives.

## Visual proof

Before/after comparison of three Foundry surfaces is rendered above (`good_society_foundry_chrome_before_after`):

- **Window titlebar** — default dark grey vs. cream with italic Lora character name and subtle hairline.
- **Sidebar tabs** — default orange-accented dark grey vs. forest-green active tab with our underline pattern.
- **Chat input area** — default dark with orange SEND button vs. paper-warm with house-styled input and themed primary button.

The contrast demonstrates the visual mismatch our overrides resolve: default Foundry chrome breaks the immersive aesthetic; our themed chrome maintains it.

## Changelog

| Date       | Change                                                                |
|------------|-----------------------------------------------------------------------|
| 2026-05-05 | File created. Eight Foundry chrome surfaces specified for re-theming via medium-scope overrides. Opt-in setting specified. Body-class wrapper approach for runtime toggling specified. Visual proof rendered with before/after comparison. |
