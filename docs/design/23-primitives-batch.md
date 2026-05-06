# 23 — Primitives Batch

**Status:** Locked — 13 primitives specified with full visual + behavioral specs; canonical reference for the system's small components
**Date opened:** 2026-05-05
**Covers inventory entries:** #33 Card surface, #34 Section header, #35 Hairline divider, #36 Text input/textarea, #37 Dropdown, #38 Checkbox, #40 Primary button, #41 Secondary button, #42 GM-only button, #48 Visibility flag indicator, #52 Modal/dialog, #53 Tab navigation, #54 Icon button. Plus the GM pill primitive referenced across many earlier docs but not previously spec'd.

## Goal

Specify all the small primitives that compose the system's UI surfaces. These have been referenced extensively across all 22 prior design docs (every sheet uses cards and section headers; every modal uses buttons; every form uses inputs) but never given canonical specs of their own. This doc is the single source of truth for component-level styling, so per-sheet CSS can reference these primitives rather than redefining them.

The primitives are listed in implementation order — each can be built independently, but later primitives sometimes reference earlier ones. The doc structure mirrors a component library reference: each primitive gets a focused spec with visual, CSS sketch, behavior notes, and edge cases.

## Antique-but-clean rules these primitives honor

Every primitive in this doc honors:

- **Hairlines, not heavy borders.** All borders are 0.5px (rendering as 1px on standard displays). The only 2px border in the system is on the Welcome Panel's RECOMMENDED option card and on pending-change cells in the Bulk Permissions Panel.
- **Generous padding.** Even small components have 12-16px internal padding minimum.
- **Two type weights only.** 400 regular and 500 medium. Never 600+.
- **Sentence case for prose, small caps for labels.** Section headers and eyebrow labels use small caps with letter-spacing 0.12-0.18em; everything else is sentence case.
- **One ornament per surface, max.** No nested decorations. The dot fleuron on the Welcome Panel and the family crest on the Family sheet are exceptions because they're title-page moments.

## 1. Card surface (#33)

CSS class root: `.gs-card`

A soft-paper rectangular container for grouped content.

### Visual

```
┌──────────────────────────────────┐
│ Card title                          │
│ Body content...                     │
└──────────────────────────────────┘
```

### CSS

```css
.gs-card {
  background: var(--gs-paper-warm);
  border: 0.5px solid var(--gs-accent-2);
  border-radius: 8px;
  padding: 14px 16px;
}
```

### Variants

- `.gs-card--accent` — adds a 2.5px left-edge accent stripe in `var(--gs-brand)` (or themed accent). Used for highlighted/owned items (impressions in connection sheet, reputation tags, etc.).
- `.gs-card--featured` — replaces the 0.5px border with a 2px border in `var(--gs-brand)`. Reserved for "recommended" or "primary" cards in option lists. Used in the Welcome Panel.
- `.gs-card--inset` — slightly darker background (`var(--gs-paper)` instead of `var(--gs-paper-warm)`) for cards inside cards, e.g. the inner conflict box grid card inside the Inner Conflict section. Avoids visual collapse.

### Edge cases

- Cards inside themed wrappers (`.gs-themed[data-theme="..."]`) automatically pick up the theme's `--gs-paper-warm`. No additional class needed.
- Empty cards render at minimum content height (~30px effective). Not encouraged — show placeholder text instead.

## 2. Section header (#34)

CSS class root: `.gs-section-header`

A small-caps eyebrow label preceding a section's content. Often paired with a sentence-case title below.

### Visual

```
SECTION HEADER  ?
```

### CSS

```css
.gs-section-header {
  font-family: var(--gs-body);
  font-size: 12px;
  letter-spacing: 0.16em;
  color: var(--gs-brand);
  text-transform: uppercase;
  position: relative;
  display: inline-block;
}

.gs-section-header[data-tooltip-key]::after {
  content: '?';
  position: absolute;
  top: -2px;
  right: -14px;
  font-size: 8px;
  color: var(--gs-accent-3);
}
```

### Behavior

- The `?` glyph appears automatically on any section header with a `data-tooltip-key` attribute. See `20-rule-tooltips.md` for the full tooltip system.
- The eyebrow color comes from theme — `var(--gs-brand)` for default sections, but per-context overrides to `var(--gs-accent-2)` for muted sections (e.g. "no-content placeholder" labels).
- Letter-spacing varies slightly by context: 0.12em for tight contexts (chat cards, hover cards), 0.16em for standard sheets, 0.18em for the most ceremonial contexts (welcome panel, conflict picker).

### Variants

- `.gs-section-header--with-action` — flex layout with the action button (or "[+ add]" link) on the right of the same row. Used everywhere section headers carry inline actions.
- `.gs-section-header--with-count` — appends an italic count (e.g. "MAJORS · 4") in the same row.

## 3. Hairline divider (#35)

CSS class root: `.gs-divider`

A 0.5px horizontal rule. Sometimes ornamented with a single centered dot/glyph.

### Visual

```
─────────────────────────────────  (plain)

──────  ·  ──────                   (with dot ornament)
```

### CSS

```css
.gs-divider {
  height: 0.5px;
  background: var(--gs-accent-2);
  width: 100%;
  margin: 12px 0;
}

.gs-divider--ornamented {
  display: flex;
  align-items: center;
  gap: 8px;
  height: auto;
  background: transparent;
}

.gs-divider--ornamented::before,
.gs-divider--ornamented::after {
  content: '';
  flex: 1;
  height: 0.5px;
  background: var(--gs-accent-2);
}

.gs-divider--ornamented .gs-divider__ornament {
  font-family: var(--gs-display);
  font-size: 12px;
  color: var(--gs-accent-3);
}
```

### Variants

- `.gs-divider--ornamented` — with a centered dot (or other small glyph) flanked by hairlines. Used in the Welcome Panel title frame.
- `.gs-divider--gold` — uses `var(--gs-accent-3)` (honey-gold) instead of sage. For ceremonial contexts (Inner Conflict completion ceremony, Family sheet's reputation criteria card).

### Edge cases

- The ornamented variant defaults to a "·" glyph but accepts any character. Common alternatives: "❦" (fleuron — typographic, not emoji), "—" (em-dash, when more reserved), or no glyph at all (just the divider).
- Vertical dividers (between two columns) use `width: 1px; height: <Npx>` instead of `height: 0.5px; width: 100%`. Same color.

## 4. Text input and textarea (#36)

CSS class root: `.gs-input` (text), `.gs-textarea` (multi-line)

### Visual

```
┌──────────────────────────────────┐
│ Lady Rose Willowood                │  (text input)
└──────────────────────────────────┘

┌──────────────────────────────────┐
│ Multi-line content goes here...    │
│ wrapping naturally as needed.      │  (textarea)
│                                     │
└──────────────────────────────────┘
```

### CSS

```css
.gs-input,
.gs-textarea {
  background: var(--gs-paper-warm);
  border: 0.5px solid var(--gs-accent-2);
  border-radius: 4px;
  padding: 6px 12px;
  font-family: var(--gs-body);
  font-size: 13px;
  color: var(--gs-ink);
  outline: none;
  width: 100%;
  box-sizing: border-box;
}

.gs-textarea {
  min-height: 60px;
  line-height: 1.55;
  font-style: italic;
  resize: vertical;
}

.gs-input:focus,
.gs-textarea:focus {
  border-color: var(--gs-brand);
}

.gs-input:disabled,
.gs-textarea:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

### Behavior

- Auto-saves on blur (Foundry default for actor sheet inputs). Per-keystroke save isn't necessary; the network cost would be excessive.
- Display state (when not editing): the text appears with the input chrome. Some sheets remove the chrome entirely on display and only show it on hover/focus — that's a per-component choice, not a primitive default.
- Focus shifts the border color from sage to brand-color for clear focus indication.

### Variants

- `.gs-input--small` — 11px text, smaller padding (4px 10px). Used in compact contexts like the impressions Major-name pill.
- `.gs-input--large` — 16px text, larger padding (10px 16px). Used for prominent character names in sheet headers.
- `.gs-textarea--no-resize` — `resize: none` for fixed-height textareas (e.g. monologue editor).

## 5. Dropdown (#37)

CSS class root: `.gs-dropdown`

A styled select replacement. Foundry's default `<select>` doesn't match the antique-but-clean register, so we use a custom implementation that triggers Foundry's underlying select behavior.

### Visual

```
┌──────────────────────────────────┐
│ heir                          ▾   │
└──────────────────────────────────┘
```

### CSS

```css
.gs-dropdown {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: var(--gs-paper-warm);
  border: 0.5px solid var(--gs-accent-2);
  border-radius: 4px;
  font-family: var(--gs-body);
  font-size: 13px;
  color: var(--gs-ink);
  cursor: pointer;
  user-select: none;
}

.gs-dropdown__value {
  flex: 1;
}

.gs-dropdown__chevron {
  color: var(--gs-accent-2);
  font-size: 11px;
}

.gs-dropdown:hover {
  border-color: var(--gs-brand);
}
```

### Behavior

- Click → opens a small popover listing options. Each option has 6px 12px padding, body type, hover state with `var(--gs-paper)` background.
- Selecting an option closes the popover and updates the displayed value.
- Keyboard: Tab to focus, Enter to open, Arrow keys to navigate, Enter to select, Escape to close.

### Variants

- `.gs-dropdown--inline` — for inline dropdowns within a sheet field (e.g. visibility flag dropdowns). Smaller, no padding.
- `.gs-dropdown--with-icon` — accepts a small leading icon/glyph. Used for color-pickers (the chat color override).

## 6. Checkbox (#38)

CSS class root: `.gs-checkbox`

### Visual

```
☐ unchecked     ☑ checked
```

### CSS

```css
.gs-checkbox-wrapper {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.gs-checkbox {
  width: 14px;
  height: 14px;
  border: 0.5px solid var(--gs-accent-2);
  border-radius: 3px;
  background: transparent;
  cursor: pointer;
  appearance: none;
  position: relative;
}

.gs-checkbox:checked {
  background: var(--gs-brand);
  border-color: var(--gs-brand);
}

.gs-checkbox:checked::after {
  content: '✓';
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  color: var(--gs-paper);
  font-family: Georgia, serif;
  font-size: 10px;
}

.gs-checkbox-wrapper__label {
  font-family: var(--gs-body);
  font-size: 12px;
  color: var(--gs-ink);
}
```

### Behavior

- Standard checkbox semantics — keyboard accessible (Space toggles), screen-reader compatible.
- Click anywhere on the wrapper (checkbox or label) toggles the state.

### Variants

- `.gs-checkbox--large` — 18×18px, used for the inner conflict box grid (where boxes are checkboxes).
- `.gs-checkbox--gold` — uses `var(--gs-accent-3)` (honey) instead of brand on checked state. Used for "earned" toggles like the Backstory Action's "expanded" status.

## 7. Primary button (#40)

CSS class root: `.gs-button--primary`

Filled with the theme/house brand color. Used for the principal action in any context.

### Visual

```
┌────────────────┐
│   primary ↗    │
└────────────────┘
```

### CSS

```css
.gs-button--primary {
  background: var(--gs-brand);
  border: 0.5px solid var(--gs-brand);
  color: var(--gs-paper);
  font-family: var(--gs-display);
  font-size: 12px;
  padding: 5px 16px;
  border-radius: 4px;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: opacity 100ms;
}

.gs-button--primary:hover {
  opacity: 0.9;
}

.gs-button--primary:active {
  opacity: 0.8;
}

.gs-button--primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

### Variants

- `.gs-button--primary-emphasis` — slightly larger padding (8px 20px) and 14px text. Used for hero actions like "send letter" or "advance phase".
- `.gs-button--primary-warning` — uses `var(--gs-accent-1)` (terracotta) instead of brand. For consequential GM actions like "advance to next cycle".

## 8. Secondary button (#41)

CSS class root: `.gs-button--secondary`

Outlined. Used for cancel, discard, or secondary actions.

### Visual

```
┌────────────────┐
│   secondary    │
└────────────────┘
```

### CSS

```css
.gs-button--secondary {
  background: transparent;
  border: 0.5px solid var(--gs-accent-2);
  color: var(--gs-accent-2);
  font-family: var(--gs-display);
  font-size: 12px;
  padding: 5px 14px;
  border-radius: 4px;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: all 100ms;
}

.gs-button--secondary:hover {
  border-color: var(--gs-brand);
  color: var(--gs-brand);
}
```

### Variants

- `.gs-button--secondary-strong` — uses `var(--gs-brand)` for border and text directly (skip the accent-2 → brand transition on hover). For more prominent secondary actions.

## 9. GM-only button (#42)

CSS class root: `.gs-button--gm`

Distinguished by a small key icon and the terracotta accent color. Used for GM-only actions in shared contexts (where players might also see the button but can't activate it).

### Visual

```
┌────────────────┐
│ ⚿ GM only      │
└────────────────┘
```

### CSS

```css
.gs-button--gm {
  background: transparent;
  border: 0.5px solid var(--gs-accent-1);
  color: var(--gs-accent-1);
  font-family: var(--gs-display);
  font-size: 12px;
  padding: 5px 14px;
  border-radius: 4px;
  letter-spacing: 0.04em;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.gs-button--gm::before {
  content: '⚿';  /* or a custom SVG icon */
  font-size: 9px;
}

.gs-button--gm:hover {
  background: var(--gs-paper-warm);
}
```

### Behavior

- The ⚿ glyph is the visual signal of GM-only. Players viewing the sheet can see the button but it's disabled for them.
- Most GM-only buttons are GM-visible-only; they don't render at all for non-GM users. This variant is for the rare cases where the button needs to be visible to all (so players know it exists) but only the GM can press it.

### Variants

- `.gs-button--gm-action` — solid background (terracotta) with paper text. For prominent GM actions like "reveal to all".

## 10. Icon button (#54)

CSS class root: `.gs-icon-button`

Small square button with a single character or glyph. Used for "+ add", "× close", etc.

### Visual

```
┌─┐    ┌─┐
│+│    │×│
└─┘    └─┘
```

### CSS

```css
.gs-icon-button {
  background: transparent;
  border: 0.5px solid var(--gs-accent-2);
  color: var(--gs-accent-2);
  font-family: var(--gs-display);
  font-size: 12px;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  padding: 0;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.gs-icon-button:hover {
  background: var(--gs-paper-warm);
  border-color: var(--gs-brand);
  color: var(--gs-brand);
}
```

### Variants

- `.gs-icon-button--ghost` — no border, just the glyph. For very lightweight close affordances.
- `.gs-icon-button--small` — 22×22px, used in tight spaces (chip remove buttons).

## 11. Visibility flag indicator (#48)

CSS class root: `.gs-visibility-flag`

Inline three-state indicator showing whether a field is secret, public, or redacted. Click to cycle.

### Visual

```
○ secret      ● public      ⊘ redacted
```

### CSS

```css
.gs-visibility-flag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 10px;
  background: var(--gs-paper-warm);
  border: 0.5px solid var(--gs-accent-2);
  border-radius: 100px;
  font-family: var(--gs-body);
  font-size: 11px;
  font-style: italic;
  cursor: pointer;
}

.gs-visibility-flag--secret {
  color: var(--gs-accent-2);
  border-color: var(--gs-accent-2);
}

.gs-visibility-flag--public {
  color: var(--gs-positive);
  border-color: var(--gs-positive);
}

.gs-visibility-flag--redacted {
  color: var(--gs-danger);
  border-color: var(--gs-danger);
}

.gs-visibility-flag__glyph {
  font-size: 10px;
}
```

### Behavior

- Click cycles through secret → public → redacted → secret.
- Confirms before flipping from secret to public ("This will reveal {field} to all players. Continue?"). See `19-gm-tools.md` for the Reveal Control popover that handles this.
- Hover shows a tooltip explaining what the current state means.

## 12. GM pill

CSS class root: `.gs-gm-pill`

Small pill in terracotta marking a section, button, or field as GM-only.

### Visual

```
[GM]  Section header label
```

### CSS

```css
.gs-gm-pill {
  font-family: var(--gs-body);
  font-size: 10px;
  padding: 1px 7px;
  background: var(--gs-accent-1);
  color: var(--gs-paper);
  border-radius: 3px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  display: inline-block;
}
```

### Behavior

- Static — no interactive behavior. Just a visual label.
- Used in headers (NPC sheet, Family sheet GM Notes, GM Tools surfaces, Bulk Permissions Panel).
- Small enough to sit alongside section header text without dominating.

### Variants

- `.gs-gm-pill--filled` — current default (terracotta filled).
- `.gs-gm-pill--outline` — outlined version for less prominent GM markers. Rare; the filled version is preferred.

## 13. Modal / dialog (#52)

CSS class root: `.gs-modal`

A centered modal panel with backdrop. Used for confirmation dialogs, multi-step flows like the Upkeep Wizard, and other focused interactions.

### Visual

```
[backdrop, semi-transparent ink]

       ┌──────────────────────────┐
       │ Modal title               │
       │                            │
       │ Body content...            │
       │                            │
       │ [cancel]  [confirm]        │
       └──────────────────────────┘
```

### CSS

```css
.gs-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(20, 12, 14, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.gs-modal {
  background: var(--gs-paper);
  border: 0.5px solid var(--gs-accent-2);
  border-radius: 12px;
  padding: 0;
  max-width: 80vw;
  max-height: 80vh;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(20, 12, 14, 0.3);
}

.gs-modal__header {
  padding: 18px 26px;
  border-bottom: 0.5px solid var(--gs-accent-2);
}

.gs-modal__body {
  padding: 24px 28px;
  overflow-y: auto;
  max-height: 60vh;
}

.gs-modal__footer {
  padding: 14px 26px;
  background: var(--gs-paper-warm);
  border-top: 0.5px solid var(--gs-accent-2);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
```

### Behavior

- The backdrop opacity defaults to 0.45 (used in Upkeep Wizard, Welcome Panel). Lighter (0.30) for non-blocking modals like the Condition Picker.
- Click backdrop to close — for non-blocking modals only. Confirmation dialogs require explicit dismissal.
- Escape key closes the modal — same gating as backdrop click.
- Drop shadow at `0 4px 16px` (heavier than the token hover card's 2px shadow) gives the modal more lift, signaling "this is more important than the underlying surface."

### Variants

- `.gs-modal--small` — 360px max-width, used for compact confirms.
- `.gs-modal--non-blocking` — lighter backdrop (0.30), draggable, doesn't dismiss on backdrop-click.

## 14. Tab navigation (#53)

CSS class root: `.gs-tabs`

Horizontal tabs for sheet section navigation.

### Visual

```
─────────────────────────────────
 Public         Private    Notes
 ━━━━━━━
```

### CSS

```css
.gs-tabs {
  display: flex;
  gap: 0;
  border-bottom: 0.5px solid var(--gs-accent-2);
}

.gs-tabs__tab {
  padding: 8px 18px 10px 0;
  font-family: var(--gs-body);
  font-size: 13px;
  letter-spacing: 0.08em;
  color: var(--gs-accent-2);
  cursor: pointer;
  border-bottom: 1.5px solid transparent;
  margin-bottom: -0.5px;
  transition: color 100ms;
}

.gs-tabs__tab:not(:first-child) {
  padding-left: 18px;
}

.gs-tabs__tab--active {
  color: var(--gs-brand);
  border-bottom-color: var(--gs-brand);
}

.gs-tabs__tab:hover:not(.gs-tabs__tab--active) {
  color: var(--gs-brand);
}
```

### Behavior

- The active tab carries a 1.5px brand-color underline overlapping the 0.5px hairline rule (margin-bottom: -0.5px aligns them).
- Hover changes color but not the underline. Click activates the tab.
- Tabs are sentence case ("Public", "Private", not "PUBLIC" or "Public Tab").
- Typically 2-3 tabs per sheet. More than 3 tabs = consider whether the content can be reorganized.

## Implementation notes for Claude Code

CSS file structure:

```
styles/
├── primitives/
│   ├── _card.css
│   ├── _section-header.css
│   ├── _divider.css
│   ├── _input.css
│   ├── _dropdown.css
│   ├── _checkbox.css
│   ├── _button.css         # primary, secondary, GM, icon variants
│   ├── _visibility-flag.css
│   ├── _gm-pill.css
│   ├── _modal.css
│   └── _tabs.css
├── components/             # complex components built from primitives
└── sheets/                 # per-sheet layouts
```

Build order:
1. Card surface, hairline divider — foundational, no dependencies.
2. Section header (with tooltip integration via `data-tooltip-key`).
3. Form controls (input, dropdown, checkbox).
4. Buttons (all four variants in one file).
5. Status indicators (visibility flag, GM pill).
6. Modal/dialog.
7. Tab navigation.

Each primitive file is small (50-100 lines max). The whole batch should be ~1000 lines of CSS total.

### Test path

1. Create a "primitives showcase" page that renders one of every primitive in known states. Use it as a visual regression baseline.
2. Verify each primitive in light mode and (eventually) any theme variants — confirm they pick up CSS variables correctly.
3. Test focus states for accessibility — every interactive primitive should have a clear focus indicator.
4. Test keyboard navigation through tabs, dropdowns, checkboxes — should work without mouse.

If the showcase page renders correctly and the primitives compose into the locked sheet designs without per-sheet overrides, the batch is production-ready.

## Theme behavior

All primitives use CSS variables exclusively. They inherit from whatever theme context they're rendered in:
- Inside `.gs-themed[data-theme="..."]` wrappers, primitives pick up the theme's palette.
- Outside themed wrappers, they use house style.

No per-primitive theme code. The variables do all the work.

## Edge cases

### Primitive nested inside primitive of same type
E.g. a card inside a card (`.gs-card .gs-card`). The inner card uses `.gs-card--inset` to avoid visual collapse — slightly darker background to distinguish from the parent. CSS handles this automatically when the inset variant is applied.

### Disabled states on interactive primitives
All interactive primitives (button, input, dropdown, checkbox) support a disabled state via the `:disabled` pseudo-class or `[aria-disabled="true"]` attribute. Visual: 50% opacity, `cursor: not-allowed`, no hover effect.

### Loading states on buttons
Not currently spec'd — Foundry's interaction model is mostly synchronous within a single user's session. If async actions become common (e.g. compendium loading), a `.gs-button--loading` variant with a small spinner can be added.

### Internationalization with longer strings
Section headers in some languages might be longer than the English originals. The small caps treatment should still hold; if a label wraps, it does so cleanly (the eyebrow wraps with no special styling). Long labels in dropdowns truncate with ellipsis.

## Open questions

1. **Should there be a unified animation/transition primitive set?** All hover/focus transitions currently use 100ms. **Tentative answer: standardize at 100ms for hover, 400ms for state changes (e.g. modal open).** Document in this file's edge cases section if motion sickness accommodations are needed.

2. **Should there be a "loading" or "saving" indicator primitive?** A small spinner or "..." indicator. **Tentative answer: defer to v1.1.** Foundry's interaction model rarely requires loading states for sheet operations.

3. **Should buttons support icons?** Currently primary/secondary/GM accept text only; the GM button has a fixed key glyph; the primary supports `↗` arrow naturally as part of the label. **Tentative answer: extend primary and secondary to optionally accept a leading or trailing glyph via a `.gs-button__icon` child element.** Lightweight extension.

4. **Should the visibility flag have a fourth state for "limited" (Foundry's LIMITED level)?** Currently three states (secret/public/redacted) match Good Society's per-field visibility model. Foundry's LIMITED is for actor-level permissions. **Tentative answer: no — they're different domains.** Keep the visibility flag for the system's per-field model.

5. **Should the modal support a "draggable" mode?** Currently fixed-center. The Bulk Permissions Panel might benefit from draggability. **Tentative answer: yes, add `.gs-modal--draggable` variant** that allows the user to drag the modal by its header. Standard Foundry behavior.

6. **Should the GM pill have a colored variant for different GM-action severities?** E.g. "GM" for normal, "GM!" for destructive. **Tentative answer: no — destructive GM actions get confirmation dialogs, which is the right friction.** The pill stays uniform.

## Visual proof

The full primitives showcase is rendered above (`good_society_primitives_library_showcase`) organized by category (Surfaces, Typography, Form Controls, Buttons, Status Indicators, Navigation). Each primitive is shown in its default state and key variants. Validates the antique-but-clean register holds across the entire component library — every primitive is restrained, period-typographic, hairline-bordered, and visually consistent with the broader system.

## Changelog

| Date       | Change                                                                |
|------------|-----------------------------------------------------------------------|
| 2026-05-05 | File created. 13 primitives specified with full CSS sketches, behavior notes, variants, and edge cases. Single canonical reference for the design system's small components. Visual showcase rendered. |
