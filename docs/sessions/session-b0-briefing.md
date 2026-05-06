# Session B-0 — CSS Architecture

**Goal:** establish the visual foundation. House CSS variables, font loading, the `.gs-themed[data-theme="..."]` wrapper mechanism (including the `themedWrap` JS helper), one card primitive in house style, three foundational components (card / section header / hairline divider), and one character preset (`clayton`) implemented as full overrides to validate the override pipeline. **No sheet templates yet** — those are Session B-1.

This session is short and high-leverage: it locks in the CSS architecture that every later visual surface will consume. Get this right and Session B-1 becomes mechanical. Get it wrong and every template will need rework.

**Source-of-truth design docs to keep open while you work:**
- `docs/design/decisions.md` — palette and type tokens, twelve-theme registry, antique-but-clean principle
- `docs/design/02-theme-architecture.md` — wrapper mechanism, scope boundaries, Foundry-specific notes
- `docs/design/03-component-inventory.md` — card (#33), section header (#34), hairline (#35) primitive specs
- `docs/design/05-epistolary-ui.md` §"The `.gs-themed` wrapper mechanism — full spec" — the canonical `themedWrap` JS helper signature and the persona-override behavior

**Implementation order is dictated** by `02-theme-architecture.md` §"Implementation order (recommended)". Don't reorder.

## Build steps

### 1. Install font packages

```bash
npm install --save \
  @fontsource/lora \
  @fontsource/crimson-text \
  @fontsource/cormorant-garamond \
  @fontsource/eb-garamond \
  @fontsource/dm-serif-display \
  @fontsource/cinzel
```

These cover all twelve registry themes. Didot and Bodoni are commercial and not on @fontsource — the registry uses them as first-choice fallbacks with DM Serif Display as the open substitute.

### 2. Create `styles/_variables.css`

Paste the full house CSS variables block from `docs/design/decisions.md` §"House style → CSS custom property mirror", plus the type-stack and type-scale variables:

```css
/* House CSS variables — Inkwell & Wildflower */
:root {
  --gs-paper:        #EFE6D2;
  --gs-paper-warm:   #F4ECD8;
  --gs-ink:          #3D2F26;
  --gs-brand:        #2A3A2D;
  --gs-accent-1:     #B85C3F;
  --gs-accent-2:     #708060;
  --gs-accent-3:     #C9A55C;
  --gs-muted:        rgba(112, 128, 96, 0.3);
  --gs-danger:       #8B2A2A;
  --gs-positive:     #4A7A4A;
  --gs-side-panel:   var(--gs-paper-warm);  /* themes override per-character */

  --gs-display:      'Lora', 'Palatino', 'Book Antiqua', Georgia, serif;
  --gs-body:         'Crimson Text', 'Palatino', Georgia, serif;
  --gs-italic:       'Crimson Text Italic', 'Palatino Italic', Georgia, serif;
  --gs-ui:           system-ui, 'Helvetica Neue', sans-serif;

  /* Type scale */
  --gs-size-window:  22px;
  --gs-size-section: 18px;
  --gs-size-label:   12px;
  --gs-size-body:    14px;
  --gs-size-ui:      11px;
  --gs-size-numeric: 16px;
}
```

### 3. Create `styles/_fonts.css`

```css
@import "@fontsource/lora/400.css";
@import "@fontsource/lora/500.css";
@import "@fontsource/lora/400-italic.css";
@import "@fontsource/crimson-text/400.css";
@import "@fontsource/crimson-text/600.css";
@import "@fontsource/crimson-text/400-italic.css";
@import "@fontsource/cormorant-garamond/400.css";
@import "@fontsource/cormorant-garamond/500.css";
@import "@fontsource/eb-garamond/400.css";
@import "@fontsource/eb-garamond/400-italic.css";
@import "@fontsource/dm-serif-display/400.css";
@import "@fontsource/cinzel/400.css";
@import "@fontsource/cinzel/600.css";
```

### 4. Create `styles/_house.css`

Antique-but-clean base styling. App container styles, basic typography:

```css
.gs-app {
  font-family: var(--gs-body);
  font-size: var(--gs-size-body);
  color: var(--gs-ink);
  background: var(--gs-paper);
  line-height: 1.55;
}

.gs-display {
  font-family: var(--gs-display);
  font-weight: 500;
  letter-spacing: 0.01em;
}
```

Don't put component primitives (cards, section headers, etc.) in here — they go in their own files under `styles/components/`.

### 5. Create `styles/_themed-wrapper.css`

The portable theme wrapper — the second locked architecture decision after the CSS variables:

```css
/* Portable theme wrapper for content that travels (chat, letters, board entries, dashboard rows). */
/* Per docs/design/02-theme-architecture.md §"Open Question 3 — Theme transitions": */
/* a 0.5px accent border carries content across the house ↔ character boundary. */
.gs-themed {
  border-left: 0.5px solid var(--gs-accent-1, var(--gs-brand));
  padding-left: 12px;
}

/* Per-theme overrides come from styles/themes/_theme-{id}.css files. */
/* This file is the wrapper plumbing only. */
```

### 6. Create the three foundational component primitives

Per `docs/design/03-component-inventory.md` rows #33, #34, #35. These three primitives are used by every later component, so build them now.

`styles/components/_card.css`:

```css
.gs-card {
  background: var(--gs-paper-warm);
  border: 0.5px solid var(--gs-muted);
  border-radius: 12px;
  padding: 20px 24px;
}
```

`styles/components/_section-header.css`:

```css
.gs-section-header {
  font-family: var(--gs-display);
  font-size: var(--gs-size-label);
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-feature-settings: 'smcp';
  color: var(--gs-brand);
  margin: 1.5em 0 0.5em;
}
```

`styles/components/_hairline.css`:

```css
.gs-hairline {
  border: none;
  border-top: 0.5px solid var(--gs-accent-2);
  margin: 1em 0;
}
```

### 7. Create `module/helpers/themed-wrap.js`

The canonical helper used by every chat card, letter card, dashboard row, dock row. Per `docs/design/05-epistolary-ui.md` §"Render-time wrapping" and the persona-override behavior:

```js
/**
 * Wrap content in a .gs-themed div using the given actor's theme.
 * If the actor has an active persona with a chatColor override,
 * applies it as inline style overriding only --gs-brand.
 *
 * @param {Actor} actor — the speaker/sender/originator
 * @param {string} content — HTML string to wrap
 * @param {string[]} [extraClasses=[]] — optional additional classes
 * @returns {string} HTML string with .gs-themed wrapper applied
 */
export function themedWrap(actor, content, extraClasses = []) {
  const themeId = actor?.system?.theme || "npc";
  const persona = actor?.system?.activePersonaId
    ? actor.system.personas.find(p => p.id === actor.system.activePersonaId)
    : null;
  const overrideColor = persona?.chatColor;
  const styleAttr = overrideColor ? ` style="--gs-brand: ${overrideColor};"` : "";
  const classList = ["gs-themed", ...extraClasses].join(" ");
  return `<div class="${classList}" data-theme="${themeId}"${styleAttr}>${content}</div>`;
}
```

This helper isn't consumed by anything in B-0 — it's set up here so B-1's chat cards and letter cards can import it. Verify it's syntactically valid (no exceptions on import) and matches the spec in `docs/design/05-epistolary-ui.md` §"Render-time wrapping".

### 8. Create `styles/themes/_theme-clayton.css`

The first character preset — the closest theme to house style (palette differs, type matches), so it's the safest validator for the override pipeline. Paste the `.gs-actor[data-theme="clayton"]` block from `docs/design/decisions.md` §"Theme registry → clayton". Add a parallel `.gs-themed[data-theme="clayton"]` selector with the same overrides:

```css
.gs-actor[data-theme="clayton"],
.gs-themed[data-theme="clayton"] {
  --gs-paper:       #F4F1E6;
  --gs-paper-warm:  #E8E4D6;
  --gs-side-panel:  #C9DABB;
  --gs-ink:         #2A332A;
  --gs-brand:       #4A6B3F;
  --gs-accent-1:    #708060;
  --gs-accent-2:    #C9A574;
  --gs-accent-3:    #9CB088;
  --gs-display:     'Lora', 'Palatino', Georgia, serif;
  --gs-body:        'Crimson Text', 'Palatino', Georgia, serif;
  --gs-italic:      'Crimson Text Italic', 'Palatino Italic', Georgia, serif;
}
```

The same selector list pattern (`.gs-actor[data-theme="..."], .gs-themed[data-theme="..."]`) repeats for every theme in Session B-2.

### 9. Create `styles/good-society.css` — entry point

Imports everything in order. The order matters — variables before house, house before themes, components after house.

```css
@import "./_fonts.css";
@import "./_variables.css";
@import "./_house.css";
@import "./_themed-wrapper.css";
@import "./components/_card.css";
@import "./components/_section-header.css";
@import "./components/_hairline.css";
@import "./themes/_theme-clayton.css";
```

In Session B-1 you'll add more imports for additional component files and sheet/app stylesheets. The entry point grows but stays declarative.

### 10. Wire it into `system.json`

Update the `styles` array:

```json
"styles": ["styles/good-society.css"]
```

If the boilerplate's Vite is set up to bundle CSS into a single file at build, the path should match Vite's output. Adjust accordingly.

### 11. Validate by themeing one card

Create a tiny test journal entry in the world. Edit source HTML. Paste:

```html
<div class="gs-card">
  <h2 class="gs-section-header">House style — default</h2>
  <p>The quick brown fox jumps over the lazy dog.</p>
</div>
<div class="gs-themed gs-card" data-theme="clayton">
  <h2 class="gs-section-header">Clayton — character theme</h2>
  <p>The quick brown fox jumps over the lazy dog.</p>
</div>
```

Save and view. The first card should be Inkwell & Wildflower (cream paper, forest brand). The second should be Clayton (lighter cream, sage-green brand) — same layout, different palette, identical type. **If both look identical, the wrapper mechanism isn't working** — diagnose before moving on.

## Starting prompt for Claude Code

> Phase 1b, Session B-0 — CSS architecture. Read `docs/sessions/session-b0-briefing.md` end-to-end. Also read `docs/design/decisions.md`, `docs/design/02-theme-architecture.md`, and `docs/design/05-epistolary-ui.md` §"The `.gs-themed` wrapper mechanism" — they are the source of truth for the values you'll be writing.
>
> Build, in this order, one step at a time, pausing for review after each:
>
> 1. `npm install` the @fontsource packages
> 2. `styles/_variables.css` with the house CSS variables and type scale
> 3. `styles/_fonts.css` with the @fontsource imports
> 4. `styles/_house.css` with antique-but-clean base styling (no component primitives — those go in their own files)
> 5. `styles/_themed-wrapper.css` with the .gs-themed plumbing
> 6. Three component primitives: `styles/components/_card.css`, `_section-header.css`, `_hairline.css`
> 7. `module/helpers/themed-wrap.js` with the themedWrap helper per docs/design/05-epistolary-ui.md
> 8. `styles/themes/_theme-clayton.css` with Clayton overrides for both .gs-actor and .gs-themed selectors
> 9. `styles/good-society.css` entry point importing everything in correct order
> 10. Update `system.json` to load the entry point
>
> Don't build any sheet templates this session. Don't add JavaScript hooks for theming beyond the helper. We're laying the foundation only.
>
> After step 10, confirm the file tree under `styles/` and the helper file exists. I'll handle validation in Foundry.

## End-of-session verification

1. Build runs without errors (`npm run build` or however Vite is wired in the boilerplate).
2. Restart Foundry world. Console (F12) → no red errors on load.
3. Create a test journal entry with the validation HTML from step 11 above. View it. House and Clayton variants should look distinct (different paper, different brand color), with identical type. Both should use the imported fonts (Lora display, Crimson Text body) — not browser defaults.
4. F12 console: `getComputedStyle(document.documentElement).getPropertyValue('--gs-paper')` → returns `#EFE6D2`.
5. F12 console (with the test entry visible): inspect the Clayton card's div in the Elements panel. Console: `getComputedStyle($0).getPropertyValue('--gs-paper')` → returns `#F4F1E6`. **This is the override pipeline working.** If it returns `#EFE6D2`, the selector or the wrapper isn't applying.
6. F12 console (verifying the helper imports cleanly):
   ```js
   const mod = await import("/systems/good-society-homebrew/module/helpers/themed-wrap.js");
   console.log(typeof mod.themedWrap);  // should print "function"
   console.log(mod.themedWrap({ system: { theme: "clayton" } }, "<p>test</p>"));
   // should print: <div class="gs-themed" data-theme="clayton"><p>test</p></div>
   ```

If validation passes, commit:

```bash
git add styles/ module/helpers/themed-wrap.js system.json package.json package-lock.json
git commit -m "Session B-0: CSS architecture, themedWrap helper, Clayton preset"
```

If validation fails, tell Claude Code: *"The Clayton-themed card looks identical to the house card in Foundry. The wrapper mechanism isn't applying. Check the selector pattern in `_theme-clayton.css` and the import order in `good-society.css`."*

## Update CLAUDE.md §13 after the session

```markdown
**Currently in:** Phase 1c — Sheet templates batch (next: Session B-1)

**Done:**
- Phase 0: fork, rename, verify load
- Session A: all 10 DataModels defined and registered
- Session A.5: theme field backfilled on Major/Connection/NPC
- Design integration v1 + v2: theming architecture, registry, antique-but-clean principle, per-component design docs (04-09) integrated into PLAN/CLAUDE
- Session B-0: CSS architecture
  - House variables (palette, type, scale)
  - @fontsource imports for all twelve themes
  - House base styling
  - .gs-themed wrapper mechanism (with 0.5px accent border)
  - Three foundational primitives: card, section header, hairline
  - themedWrap helper at module/helpers/themed-wrap.js (canonical wrapping for all themed content)
  - Clayton theme implemented as override on both .gs-actor and .gs-themed selectors
  - Validated: Clayton cards render distinctly from house cards, themedWrap returns expected HTML

**Next:**
- Session B-1 — sheet templates batch (Major, Connection, Family, NPC, item types) per docs/design/04 and 06
- Session B-2 — remaining eleven theme presets
```

Commit and push. Move on to Session B-1.
