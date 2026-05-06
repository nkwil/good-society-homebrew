# 04 — Major Character Sheet

**Status:** Open — sheet structure, header, and Public tab locked; Private tab and tokens strip specified; visual mockup proven for Public tab in Rose theme
**Date opened:** 2026-05-05
**Covers inventory entries:** #1 Sheet header, #2 Tab nav, #3 Public tab, #4 Private tab, #5 Tokens & Cycle

## Goal

Translate the Major Character schema (CLAUDE.md §6.1) into a complete sheet layout that honors the antique-but-clean design principle and adopts the locked character themes from `decisions.md`. This is the most-used surface in the system — every player will spend most of their session looking at their own sheet.

## Structural recommendation — two tabs plus a persistent tokens strip

The system plan (Plan §6.1) suggests Tokens & Cycle "could be a header, not a tab." The CLAUDE.md skeleton has it as a third tab. **Recommendation: persistent strip at the bottom**, not a tab.

Rationale:
- Resolve count, MT, and monologue state are referenced *constantly* during play. A player checking their resolve shouldn't have to leave the Public tab and lose context.
- Cycle phase indicator is read-only world state — players need it visible, not buried.
- Two tabs (Public, Private) is also a cleaner mental model that maps to the printed sheet's two physical sides.
- The persistent strip can be ~60–70px tall, which is small enough to never feel like wasted space.

This change doesn't affect the data model — `tokens.resolve`, `tokens.major`, `tokens.monologuedThisCycle` all stay where they are in the schema. Only the Handlebars composition changes: replace the `tokens` PART with a `strip` PART that renders below the active tab body.

If implementation surfaces a reason this won't work (e.g. ApplicationV2 doesn't compose three PARTS with a body that switches between tabs), fall back to a third tab. But default to the strip.

### PARTS composition (recommended)

```js
static PARTS = {
  header: { template: "systems/good-society-homebrew/templates/actors/major-character/header.hbs" },
  tabs:   { template: "systems/good-society-homebrew/templates/actors/major-character/nav.hbs" },
  public: { template: "systems/good-society-homebrew/templates/actors/major-character/tab-public.hbs" },
  private:{ template: "systems/good-society-homebrew/templates/actors/major-character/tab-private.hbs" },
  strip:  { template: "systems/good-society-homebrew/templates/actors/major-character/strip-tokens.hbs" },
};
```

## Sheet dimensions

```js
position: { width: 720, height: "auto" }
```

720px gives the two-column header (130px portrait + 590px main) breathing room and matches the proportions of the printed Good Society character sheet without cramping reputation tag pills. Height is auto so the sheet grows with content (especially when many reputation tags or completed conflicts accumulate).

## Top-level layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  HEADER (always visible)                                             │
│  ┌─────────┬───────────────────────────────────────────────────┐    │
│  │         │ eyebrow: MAJOR CHARACTER · theme · {theme-id}      │    │
│  │ portrait│ Lady Rose Willowood              ← character name  │    │
│  │  oval   │ The Heir · House Willowood       ← role/title      │    │
│  │         │                                                    │    │
│  │ chips   │ ─────────────────────────────────────────────────  │    │
│  │ persona │ [Public] [Private]              ← tab nav          │    │
│  │ switcher│                                                    │    │
│  └─────────┴───────────────────────────────────────────────────┘    │
│                                                                      │
│  TAB BODY (varies — Public OR Private)                               │
│  ...                                                                 │
│                                                                      │
│  TOKENS STRIP (always visible)                                       │
│  resolve ●●●○○  MT  monologue ●  | cycle 3 · novel chapter [take ↗] │
└─────────────────────────────────────────────────────────────────────┘
```

The header and tokens strip stay rendered across tab switches; only the tab body swaps.

## Header spec — locked

CSS class root: `.gs-major-sheet__header`

### Layout

```
┌───────────────┬──────────────────────────────────────────┐
│ side-panel    │ main                                     │
│ 130px         │ flex 1 (590px when sheet is 720px)       │
│ background:   │ background: var(--gs-paper)              │
│ var(--gs-     │ padding: 22px 28px                       │
│ side-panel)   │                                          │
│ padding:      │                                          │
│ 24px 14px     │                                          │
└───────────────┴──────────────────────────────────────────┘
```

### Side panel content (top to bottom)

1. **Portrait** — oval, 86×102px, `border-radius: 50%`, 1px border in `var(--gs-accent-3)` (or `--gs-brand` for some themes; see decisions). Renders the persona's `portraitUrl` or falls back to character initial in `var(--gs-display)` at 42px.
2. **Bio chips** — italic body type at 11px, line-height 1.6, centered. Three lines stacked: age, peerage label, family name.
3. **Hairline rule** — 0.5px `var(--gs-accent-3)`, full width of the side panel inset.
4. **"persona" eyebrow** — small caps, 10px, letter-spacing 0.12em, color `var(--gs-brand)`.
5. **Persona switcher** — italic display type at 14px, color `var(--gs-brand)`. Dropdown trigger styled as text with a small ▾ glyph. On click, opens a list of personas with portrait + name. "+ New persona" at the bottom of the list.

### Main column content (top to bottom)

1. **Eyebrow row** — between two text spans, justified.
   - Left: `major character` in 11px small-caps, letter-spacing 0.18em, color `var(--gs-brand)`.
   - Right: `theme · {theme-id}` in 11px italic, color `var(--gs-brand)`. Useful for debugging and for players to verify their theme assignment.
2. **Character name** — display type, 32px, line-height 1.05, color `var(--gs-brand)`. (Dixon's Cinzel is heavier; cap his name at 26px to compensate.)
3. **Role / title** — italic body type, 14px, color `var(--gs-brand)`. E.g. "The Heir · House Willowood", "The Maid · in service to Lady Rose".
4. **Tab nav** — see next section.

### Header background

The side panel uses `var(--gs-side-panel)`, which each theme defines as a slightly darker / more saturated companion to the paper color. Locked values are in `decisions.md`'s theme registry.

## Tab nav spec

CSS class root: `.gs-major-sheet__nav`

### Visual

A horizontal row at the bottom of the header, sitting on a 0.5px hairline rule.

```
─────────────────────────────────────────────────
 Public         Private
 ━━━━━━━
```

- Each tab is a clickable region with: padding 8px 18px, body type at 13px, letter-spacing 0.08em, color `var(--gs-accent-3)` for inactive tabs and `var(--gs-brand)` for active.
- Active tab carries a 1.5px solid `var(--gs-brand)` underline that extends below the hairline rule (z-axis: above it, by 0.5px). Margin-bottom: -0.5px so the underline cleanly overlaps the hairline.
- No filled backgrounds, no rounded backgrounds, no all-caps. Sentence case, restrained.

### Behavior

Standard ApplicationV2 tabs. The default tab is Public. Tab state persists across sheet open/close in the user's settings flag.

## Public tab spec — locked

CSS class root: `.gs-major-sheet__tab-public`

The tab body has 24px padding around its content and uses `var(--gs-paper)` as its background (inherited from the sheet root).

Five sections, top to bottom:

### 1. Reputation Criteria (read-only from Family)

Pulled from `actor.system.familyId → familyActor.system.uniqueNegativeRepCriteria`.

```
┌──────────────────────────────────────────────────────────┐
│ REPUTATION CRITERIA · HOUSE WILLOWOOD                     │
│                                                            │
│  ┌────────────────────────────────────────────────────┐  │
│  │ A daughter of Willowood is judged by her constancy │  │
│  │ of affection and her composure under scrutiny. To  │  │
│  │ equivocate is to dishonour the lineage.            │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

- Section header: small caps, 12px, letter-spacing 0.16em, color `var(--gs-brand)`. The family name appears in the header in the same style: `· HOUSE WILLOWOOD`.
- Body: a soft-paper card (`var(--gs-paper-warm)`, `border-radius: 8px`, padding 12px 16px). Italic body type, 13px, color `var(--gs-ink)` (slightly muted to read as quotation).
- Empty state: if no `familyId` is set, show italic "No family assigned." in muted color.
- Visibility flag: this field follows the Family's visibility, not the Major's. If `family.visibility.uniqueNegativeRepCriteria === "secret"`, hide the section entirely. If `redacted`, show the section header and a redaction bar instead of the body.

### 2. Reputation Tags grid (positive ▲ and negative ▼)

```
┌──────────────────────────────┬──────────────────────────────┐
│ POSITIVE ▲              ●●○  │ NEGATIVE ▼              ●○○  │
│                              │                              │
│ ▲ Restrained                 │ ▼ Naïve                       │
│ ▲ Dutiful                    │ ┌──┄ drag tag here ┄──┐      │
│                              │ └─────────────────────┘      │
└──────────────────────────────┴──────────────────────────────┘
```

- Two-column grid, `grid-template-columns: 1fr 1fr`, gap 20px.
- Each column has a header row: small-caps polarity label on the left (`var(--gs-brand)`), three-pip visual reputation meter on the right.
  - Positive meter: `var(--gs-positive)` for filled pips, `var(--gs-muted)` for empty.
  - Negative meter: `var(--gs-danger)` for filled pips, `var(--gs-muted)` for empty.
  - Meter pip count = number of tags of that polarity, capped at 3 (any beyond 3 the meter shows full and the condition trigger fires).
- Each tag pill: see component primitive #43/#44 in inventory. Pill shape, paper bg, polarity arrow on the left, 2.5px accent stripe (positive `var(--gs-positive)`; negative `var(--gs-danger)`), tag text in `var(--gs-ink)`, body type 13px.
- Drop zone: a dashed pill in `var(--gs-accent-3)` reading "drag tag here" in italic. Becomes an active drop target during drag operations.
- Click a tag → opens the Reputation Tag item sheet (house-styled, popup).
- Hover a tag → shows the tag's source field as a tooltip.
- When the third tag of a polarity is added, fire the Condition Picker (see plan §12.3 and inventory #20). The Condition Picker is a non-blocking modal, not a sheet section.

### 3. Active Conditions

```
┌──────────────────────────────────────────────────────────┐
│ ACTIVE CONDITIONS                                          │
│                                                            │
│ [Quite Indebted] [Unexpected Connection]                  │
└──────────────────────────────────────────────────────────┘
```

- Section header in the same style as Reputation Criteria.
- Conditions render as larger pills (slightly more padding than tag pills), with the condition name in display type at 13px and the polarity arrow as a left-edge accent (positive 2.5px `var(--gs-positive)`, negative 2.5px `var(--gs-danger)`).
- Click a condition pill → opens the Reputation Condition item sheet.
- Empty state: italic "None. Her reputation holds." in `var(--gs-accent-3)`.
- The "Possible Reputation Conditions" drag-drop target from the printed sheet is *not* on the Public tab in this design — it lives in the Condition Picker modal that appears on tag-threshold trigger. Cleaner.

### 4. Inner Conflict (active)

This is the most distinctive component on the sheet and gets a soft-paper card (`var(--gs-paper-warm)`, `border-radius: 8px`, padding 18px 22px) to set it apart visually.

```
┌──────────────────────────────────────────────────────────┐
│ INNER CONFLICT                complete at 6 total or 5 on one side │
│                                                                     │
│  ┌────────────────────────────────────────────────────┐            │
│  │            Family    │    Independence            │            │
│  │            3 of 5    │    1 of 5                  │            │
│  │                      │                            │            │
│  │      ■ ■ ■ □ □       │    ■ □ □ □ □               │            │
│  │                      │                            │            │
│  │           total 4 of 6 · the conflict is unresolved│            │
│  └────────────────────────────────────────────────────┘            │
└──────────────────────────────────────────────────────────┘
```

- Section header on the left, completion-rule eyebrow on the right. Both italic, 11–12px.
- Card content uses `display: grid; grid-template-columns: 1fr auto 1fr` for the labels and box rows; the center column is a vertical hairline divider.
- Left and right labels: display type at 18px, color `var(--gs-brand)`. Below each label, italic body type at 12px showing per-side count: "3 of 5".
- Center label: italic "vs." at 13px in `var(--gs-accent-3)`. (For the rules, "vs." is more period-correct than "or".)
- Box grid: 5 boxes per side, 18×18px, 1px border in `var(--gs-brand)` (filled state) or `var(--gs-accent-3)` (empty state), 2px corner radius. Filled boxes use `var(--gs-brand)` solid fill.
- Click a box → toggle. Right-click → reset row to zero.
- Below the grid: a 0.5px hairline divider, then the completion summary line: "total 4 of 6 · the conflict is unresolved" centered, 12px italic.
- When completion fires (6 total OR 5 on one side, per locked decision in CLAUDE.md §4):
  1. Card briefly highlights with a `var(--gs-accent-1)` glow (not a flash — a slow fade, 800ms).
  2. Inner conflict completion ceremony chat card posts (inventory #29).
  3. Conflict moves to Completed Conflicts section (next).
  4. A new active conflict slot appears with a "Begin a new conflict" prompt.

If multiple inner conflicts are active (the schema supports an array), stack them vertically with a 14px gap. Most of the time there will be one.

### 5. Completed Conflicts

```
┌──────────────────────────────────────────────────────────┐
│ COMPLETED CONFLICTS                                        │
│                                                            │
│ ⌜ Pride · Devotion (resolved on side of Devotion) ⌟       │
└──────────────────────────────────────────────────────────┘
```

- Section header in the same style.
- Each completed conflict renders as a smaller pill: italic body type 12px, 0.5px paper border, 2.5px left-edge `var(--gs-accent-3)` (honey/gold) accent — completed conflicts read as "earned merits" rather than positive/negative reputation.
- Click → opens the Inner Conflict item sheet, which records the resolved-side and any reflection text the player wrote.
- This section is the visible record of earned Backstory Actions; players who like ceremony will refer back to it.

## Private tab spec

CSS class root: `.gs-major-sheet__tab-private`

The Private tab holds the character's interiority — fields the player edits frequently and that are typically secret by default. The tab follows the same 24px padding and section-header conventions as Public.

Section order (top to bottom):

### 1. Bio header (compact)

```
┌──────────────────────────────────────────────────────────┐
│ age 22 · heir · gentle, composed, fragile · gave 4 · took 7 │
└──────────────────────────────────────────────────────────┘
```

A single inline row of bio chips. Each chip is editable inline (click to edit). Body type 13px, dot separators in `var(--gs-accent-3)`. The temperament given/taken count uses small ↑ and ↓ glyphs.

### 2. Desire

```
┌──────────────────────────────────────────────────────────┐
│ DESIRE                                          [👁 secret] │
│                                                            │
│ ┌────────────────────────────────────────────────────┐  │
│ │ {HTML editor — what Rose wants this cycle}          │  │
│ └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

- Section header on the left; visibility flag indicator on the right (inventory #48).
- HTML editor (Foundry's `editor` helper). Soft-paper card surface, 14px body type, italic when in display state. Click to edit.
- The visibility flag is interactive — click to cycle through secret → public → redacted → secret. Confirms before flipping if the change is from secret to public ("This will reveal Rose's desire to all players. Continue?").

### 3. Notes & Objectives

Same layout as Desire. HTML editor, visibility flag.

### 4. Connections

```
┌──────────────────────────────────────────────────────────┐
│ CONNECTIONS                                  [+ add]       │
│                                                            │
│ ┌─[Hats McHats]─┐  ┌─[Avril Eclair]─┐  ┌─[Mr. Trotwood]─┐ │
│ └────────────────┘  └─────────────────┘  └────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

- Section header with "+ add" action button on the right.
- Each connection renders as a small chip: connection's portrait (24×24px circular), name in body type 12px, a colored dot in the bottom-right corner of the chip showing the connection's theme color.
- Click → opens the Connection actor sheet.
- Drag a Connection actor from the sidebar onto this section to link.

### 5. Backstory

Section header, visibility flag, HTML editor. Same pattern as Desire.

### 6. Magic / Skills

```
┌──────────────────────────────────────────────────────────┐
│ MAGIC & SKILLS                  [👁 secret]   [+ add]      │
│                                                            │
│ ┌────────────────────────────────────────────────────┐  │
│ │ ✦ Mage Hand                                  [cast] │  │
│ │   A spectral hand for delicate intrigue.            │  │
│ └────────────────────────────────────────────────────┘  │
│ ┌────────────────────────────────────────────────────┐  │
│ │ ✦ Alter Self                              [cast ⚠]  │  │
│ │   Triggers persona swap → "The Hawk"                │  │
│ └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

- Section header, visibility flag, "+ add" action.
- Each magic-skill renders as a tile (inventory #58): name in display 14px, description in body 12px italic, Cast button on the right.
- The Cast button respects visibility: if `actor.system.visibility.magic === "secret"`, casting prompts a confirm dialog ("This will play a casting effect visible to all players. Reveal?") before firing the Sequencer effect.
- If a skill `triggersPersonaSwap`, a small `⚠` icon appears in the Cast button and the swap target is shown in the description: "Triggers persona swap → {persona name}".

### 7. Adventurer Sentiment

Single-line input or short textarea. Pure flavor text per locked decision (CLAUDE.md §4 #6). Section header, visibility flag, plain field. No HTML editor — single string field in the schema.

## Tokens & Cycle persistent strip spec

CSS class root: `.gs-major-sheet__strip`

```
┌──────────────────────────────────────────────────────────────────────┐
│ resolve ●●●○○   [MT]   monologue ●           cycle 3 · novel  [take↗] │
└──────────────────────────────────────────────────────────────────────┘
```

- Background: `var(--gs-paper-warm)` (slight tonal shift from the tab body's `var(--gs-paper)`).
- 0.5px top border in `var(--gs-accent-3)`.
- Padding: 14px 28px.
- Single horizontal row, justified between mechanical state (left) and cycle indicator + action (right).

### Left cluster — mechanical state

- **Resolve track** (inventory #45): "resolve" small-caps label + 5-pip row. Pip size 14px diameter. Filled = `var(--gs-brand)` solid; empty = 1px outline `var(--gs-accent-3)`. Click a pip to toggle. Right-click resets to default starting value (game setting).
- **MT toggle** (inventory #46): a small badge reading "MT" in 11px display type. Off state = outline only in `var(--gs-brand)`. On state = filled `var(--gs-brand)` background with paper-color text. Click to toggle.
- **Monologue dot** (inventory #47): "monologue" small-caps label + a single 12px circle. Available = `var(--gs-accent-3)` (honey/gold) filled. Spent = 1px outline only. Tooltip on hover: "Available this cycle" / "Spent this cycle".

### Right cluster — cycle indicator + action

- **Cycle phase indicator**: italic body type, 11px, `var(--gs-ink)` muted. Reads "cycle 3 · novel chapter" — pulls cycle number and phase from world settings (`game.settings.get("good-society-homebrew", "cyclePhase")`). Read-only on the Major sheet.
- **Take Monologue button**: secondary button (inventory #41 — outline, body type 12px, `var(--gs-brand)` border and text). Disabled state when `monologuedThisCycle === true` (lower opacity, no hover effect). Click → opens the Inner Monologue editor (inventory #28).

## Component usage map

This sheet uses the following primitives from `03-component-inventory.md`. Cross-reference the inventory for behavior specs.

| Primitive | Used in | Notes |
|-----------|---------|-------|
| #33 Card surface | Reputation Criteria, Inner Conflict, Magic/Skill tiles, editor cards | Soft-paper bg = `var(--gs-paper-warm)` |
| #34 Section header (small caps) | Every section | Letter-spacing 0.16em on Public; 0.16em on Private |
| #35 Hairline divider | Header bottom, between header and tab body, between tab body and strip, inside Inner Conflict card | 0.5px |
| #39 Inner Conflict box grid | Inner Conflict section | 5+5 boxes, 18×18px |
| #40 Button — primary | Take Monologue (when emphasized) | Currently designed as secondary; revisit if visibility needs |
| #41 Button — secondary | Take Monologue, "+ add" actions | Outline only |
| #43, #44 Reputation tag pills | Reputation Tags grid | Polarity-accented |
| #45 Resolve token track | Persistent strip | 5-pip clickable |
| #46 MT toggle | Persistent strip | Single badge |
| #47 Monologue dot | Persistent strip | Single circle |
| #48 Visibility flag indicator | Private tab fields | Three-state inline |
| #49 Visual reputation meter | Reputation Tags grid headers | 3-pip per polarity |
| #50 Portrait frame | Header side panel | Oval, 86×102px |
| #56 Persona switcher | Header side panel bottom | Italic dropdown |
| #58 Magic skill tile | Private tab Magic/Skills | With Cast button |
| #59 Family panel | Public tab Reputation Criteria | Read-only, themed wrapper |

## Theme behavior

The entire sheet is character-themed: `<form class="gs-major-sheet gs-actor" data-theme="{actor.system.theme}">`. The `data-theme` attribute drives CSS variable scoping per `02-theme-architecture.md`.

The portrait side panel uses `--gs-side-panel` (each theme defines this — see `decisions.md` registry).

Item sheets opened from this sheet (Reputation Tag, Inner Conflict, Magic/Skill) revert to house style — those are objects in the world, not voices. The transition is jarring if not designed for; mitigate by having item sheets open as small popups with their own modal backdrop, visually establishing them as "objects" rather than "extensions of this sheet."

## Edge cases

### No active inner conflict
Show a single card prompting "Begin a new inner conflict." with a "+ add" action. Clicking opens the Inner Conflict item sheet to set left/right labels.

### No family assigned
Reputation Criteria section shows "No family assigned." in italic muted text. Don't hide the section — leaving it visible reminds players (and GMs) that families exist.

### No connections
Connections section shows a single dashed drop zone: "Drag a Connection here, or click + to create one."

### Many tags / completed conflicts
The reputation tags grid wraps to multiple lines. The completed conflicts list can grow; if it exceeds ~6 items, render in a 2-column wrap. Sheet height grows accordingly.

### Visibility = redacted
For any field where the viewing user's permission level is below what's needed (and the field is `redacted`, not `secret`), render the section header + a redaction block (e.g. an opaque slate bar with "[redacted]" centered) instead of the field content.

For `secret`: hide the section entirely from non-permitted viewers.

## Open questions

1. **Should the persona switcher live in the side panel, the main column, or both?** Currently in the side panel only. Argument for main column: more visible, more important in play. Argument for side panel: less clutter at the top of the main column, where the character name should dominate. **Tentative answer: side panel only**, with a clear indicator (the "persona" eyebrow) so players can find it.

2. **Should the MT badge be themable per character?** Currently it inherits the character's theme. But MT is a meta-mechanic that applies universally. Consider: should MT, monologue dot, and resolve track all use a common "mechanical state" color (e.g. `var(--gs-accent-3)`) regardless of theme, so they read consistently across characters? **Tentative answer: keep them themed.** The point of per-character theming is that the *whole experience* of being that character is distinct. Mechanical state being themed reinforces this. Revisit after first playtest.

3. **Inner conflict card highlight color on completion** — `var(--gs-accent-1)` is a strong accent on most themes but feels off on Mags (the `accent-1` is blood-red). Consider using `var(--gs-accent-3)` for the completion glow on dark themes. **Tentative answer: use `var(--gs-accent-3)` universally for the glow.** It's the "honey/gold" slot in most themes and consistently feels celebratory.

4. **Bio chips temperament glyphs** — currently ↑ and ↓. These read as up/down arrows, but the source material is "temperament given" and "temperament taken." Consider ⇡ (gave) and ⇣ (took) or even text labels. **Tentative answer: stick with ↑ ↓ for compactness; tooltip explains.**

5. **Should the persistent strip stay at the *bottom* of the sheet, or move to the *top* under the header?** Top is more "dashboard-like"; bottom is more "footer-like" and stays out of the way during reading. **Tentative answer: bottom.** This keeps the player's eye flowing top-to-bottom through narrative content (reputation, inner conflict, backstory) before landing on the mechanical strip.

These are tentative — confirm during implementation.

## Implementation notes for Claude Code

When prompted to build this sheet, the recommended order:

1. Build header partial (`header.hbs`) and verify portrait + name + theme attribute render correctly.
2. Build tab nav (`nav.hbs`) and confirm tab switching works at the ApplicationV2 level.
3. Build persistent strip (`strip-tokens.hbs`) — it's small but has the highest density of clickable behavior. Get the resolve track working before anything else; that's the most-clicked element on the sheet.
4. Build Public tab (`tab-public.hbs`), one section at a time, top to bottom: Reputation Criteria, Tags grid, Conditions, Inner Conflict, Completed.
5. Build Private tab (`tab-private.hbs`), one section at a time: Bio header, Desire, Notes, Connections, Backstory, Magic/Skills, Adventurer Sentiment.

CSS organization:
- `styles/sheets/_major-character.css` — sheet-level layout
- `styles/components/_reputation-tags.css` — tag pill component (shared with item sheet)
- `styles/components/_inner-conflict.css` — box grid (shared with item sheet)
- `styles/components/_resolve-track.css` — pip row (shared with dock and dashboard)
- `styles/components/_magic-skill-tile.css` — magic tile

Test in Foundry after each section. The sheet is large enough that "looks right" doesn't survive contact with real data — verify with a fully populated sample character.

## Visual proof

The Public tab in Rose's theme is rendered above (`good_society_major_character_sheet_public_tab_rose`). Validates: header structure, side-panel proportions, section spacing, tag pills, inner conflict box grid, persistent strip placement, tokens row composition, theme color flow.

When implementation begins, render the same layout for Avril and Dixon as additional spot-checks — those are the two themes most likely to surface contrast or layout edge cases (Avril's dark paper, Dixon's heavy Cinzel display type).

## Changelog

| Date       | Change                                                                |
|------------|-----------------------------------------------------------------------|
| 2026-05-05 | File created. Sheet structure recommended (two tabs + persistent strip). Header, Public tab, Private tab, and tokens strip specified. Visual proof rendered in Rose theme. |
