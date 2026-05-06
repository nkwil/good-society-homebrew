# Session B-0 — CSS Architecture

**Goal:** establish the visual foundation. House CSS variables, font loading, the `.gs-themed[data-theme="..."]` wrapper mechanism, one card primitive in house style, and one character preset (`clayton`) implemented as full overrides to validate the override pipeline. **No sheet templates yet** — those are Session B-1.

This session is short and high-leverage: it locks in the CSS architecture that every later visual surface will consume. Get this right and Session B-1 becomes mechanical. Get it wrong and every template will need rework.

**Source-of-truth design docs to keep open while you work:**
- `docs/design/decisions.md` — palette and type tokens, twelve-theme registry
- `docs/design/02-theme-architecture.md` — wrapper mechanism, scope boundaries, Foundry-specific notes
- `docs/design/03-component-inventory.md` — card primitive (#33) and section header (#34) specs

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

These cover all twelve registry themes. Didot and Bodoni are not on @fontsource (they're commercial) — the registry uses them as first-choice fallbacks, with DM Serif Display as the open substitute. Crimson Text Italic is the italic of Crimson Text, included automatically.

### 2. Create `styles/_variables.css`

Paste the full house CSS variables block from `docs/design/decisions.md` §"House style → CSS custom property mirror". Plus the type-stack variables. Final file should look like:

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
  --gs-side-panel:   var(--gs-paper-warm);  /* themes override */

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

Import the @fontsource packages. Vite resolves these to actual font files at build:

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

Base typography + base layout rules using the variables. Honor the antique-but-clean principle:

```css
/* Antique-but-clean base styling */
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

.gs-hairline {
  border: none;
  border-top: 0.5px solid var(--gs-accent-2);
  margin: 1em 0;
}

.gs-card {
  background: var(--gs-paper-warm);
  border: 0.5px solid var(--gs-muted);
  border-radius: 12px;
  padding: 20px 24px;
}
```

This is the **card primitive** (#33 in component inventory) plus the **section header** (#34) and **hairline divider** (#35). All three are foundational — every later component composes from them.

### 5. Create `styles/_themed-wrapper.css`

The portable theme wrapper — the second locked architecture decision after the CSS variables:

```css
/* Portable theme wrapper for content that travels (chat, letters, board entries) */
.gs-themed {
  /* The wrapper rebinds palette via [data-theme="..."] selectors below. */
  /* A 0.5px accent border separates themed content from house chrome. */
  border-left: 0.5px solid var(--gs-accent-1, var(--gs-brand));
  padding-left: 12px;
}

/* Per-theme overrides come from styles/themes/_theme-{id}.css files. */
/* This file is the wrapper-mechanism plumbing only. */
```

Per `02-theme-architecture.md` §"Open Question 3 — Theme transitions — RESOLVED": the wrapper carries a 0.5px accent border in `--gs-accent-1` (or `--gs-brand` low-opacity) for soft envelopment. Specifics may refine when chat-card and letter-card components reach detailed design — leave this minimal for now.

### 6. Create `styles/themes/_theme-clayton.css`

The first character preset. Per `02-theme-architecture.md` §"Implementation order" step 5, `clayton` is the right choice (formerly `cashmere` in earlier docs — that name was dropped). It's the closest theme to house style — palette differs, type matches — so it's the safest validator for the override pipeline.

Paste the `.gs-actor[data-theme="clayton"]` block from `docs/design/decisions.md` §"Theme registry → clayton". Then **also** add a parallel `.gs-themed[data-theme="clayton"]` block with the same custom-property overrides — this enables Clayton-themed content to render correctly in chat cards and letter cards (using the wrapper mechanism).

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

The same selector list pattern (`.gs-actor[data-theme="..."], .gs-themed[data-theme="..."]`) will repeat for every theme in Session B-2. Keep it consistent.

### 7. Create `styles/good-society.css` — entry point

Imports everything in order:

```css
@import "./_fonts.css";
@import "./_variables.css";
@import "./_house.css";
@import "./_themed-wrapper.css";
@import "./themes/_theme-clayton.css";
```

### 8. Wire it into `system.json`

Update the `styles` array to include the entry point. The existing boilerplate already has a `styles` field — replace its values:

```json
"styles": ["styles/good-society.css"]
```

If Vite is set up to bundle CSS into a single file, the path should match Vite's output. Adjust accordingly.

### 9. Validate by themeing one card

Create a tiny test journal entry or chat message in the world that contains:

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

Open the world and view the entry. The first card should be Inkwell & Wildflower (cream paper, forest brand). The second should be Clayton (lighter cream, sage-green brand) — same layout, different palette, identical type. **If both look identical, the wrapper mechanism isn't working** — diagnose before moving on.

## Starting prompt for Claude Code

> Phase 1b, Session B-0 — CSS architecture. Read `session-b0-briefing.md` end-to-end. Also read `docs/design/decisions.md` and `docs/design/02-theme-architecture.md` — they're the source of truth for the values you'll be writing.
>
> Build, in this order, one step at a time, pausing for review after each:
>
> 1. `npm install` the @fontsource packages
> 2. `styles/_variables.css` with the house CSS variables
> 3. `styles/_fonts.css` with the @fontsource imports
> 4. `styles/_house.css` with antique-but-clean base styling and the card / section-header / hairline primitives
> 5. `styles/_themed-wrapper.css` with the .gs-themed plumbing
> 6. `styles/themes/_theme-clayton.css` with the Clayton overrides for both .gs-actor and .gs-themed selectors
> 7. `styles/good-society.css` entry point importing all of the above in correct order
> 8. Update `system.json` to load the entry point
>
> Don't build any sheet templates this session. Don't add JavaScript hooks for theming. We're laying the CSS foundation only.
>
> After step 8, confirm the file tree under `styles/`. I'll handle validation in Foundry.

## End-of-session verification

1. Build runs without errors (`npm run build` or however Vite is wired in the boilerplate).
2. Restart Foundry world. Console (F12) → no red errors.
3. Create a test journal entry with the validation HTML from step 9 above. View it. House and Clayton variants should look distinct (different paper, different brand color), with identical type. Both should use the imported fonts (Lora display, Crimson Text body) — not browser defaults.
4. F12 console: `getComputedStyle(document.documentElement).getPropertyValue('--gs-paper')` → returns `#EFE6D2`.
5. F12 console (with the test entry visible): inspect the Clayton card's div in the Elements panel. `getComputedStyle($0).getPropertyValue('--gs-paper')` → returns `#F4F1E6`. **This is the override pipeline working.** If it returns `#EFE6D2`, the selector or the wrapper isn't applying.

If validation passes, move on. If not, debug *here* before any sheet work — every Session B-1 template will multiply the bug.

## Update CLAUDE.md §13 after the session

```markdown
**Currently in:** Phase 1c — Sheet templates batch (next: Session B-1)

**Done:**
- Phase 0: fork, rename, verify load
- Session A: all 10 DataModels defined and registered
- Session A.5: theme field backfilled on Major/Connection/NPC
- Session B-0: CSS architecture
  - House variables (palette, type, scale)
  - @fontsource imports for all twelve themes
  - House base styling + card / section-header / hairline primitives
  - .gs-themed wrapper mechanism (with 0.5px accent border per theme-architecture §"transitions")
  - Clayton theme implemented as override on both .gs-actor and .gs-themed selectors
  - Validated: Clayton cards render distinctly from house cards in test journal entry

**Next:**
- Session B-1 — sheet templates batch (Major, Connection, Family, NPC, item types)
- Session B-2 — remaining eleven theme presets
```

Commit and push. Move on to Session B-1.
