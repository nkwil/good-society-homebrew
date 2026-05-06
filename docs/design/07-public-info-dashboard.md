# 07 — Public Info / Facilitator Dashboard

**Status:** Locked — full dashboard specified; visual proof rendered with five themes cohabiting on a single shared surface
**Date opened:** 2026-05-05
**Covers inventory entry:** #14 Public Info / Facilitator Dashboard

## Goal

Specify the Public Info / Facilitator Dashboard (Plan §7, §12.5). This is the most-shared communal surface in the system — every player and the GM can open it. It shows the cycle phase, every Major character's at-a-glance state, and gives the GM bulk action controls.

It's also the hardest test of the multi-theme architecture: five Majors with five different themes have to cohabit on a single shared surface without making the dashboard look like a circus. The hybrid theming pattern (house chrome, per-row character accents) is the resolution — proven visually in the mockup above.

## Where it opens

Per Plan §7, the dashboard opens via a scene control button registered with `Hooks.on("getSceneControlButtons", ...)`. One click from the canvas — no menu diving.

The dashboard is a custom `ApplicationV2`, not an actor sheet. It reads from all Major actors and the world settings; it doesn't own any state of its own.

## Permissions

- Any user can open it (read-only by default for players).
- GM users see additional controls (the bulk actions row, the Advance Phase button, the Reveal Desire individual controls).
- Player users see the dashboard exactly as the GM does *minus* the GM-only controls.

## Sheet dimensions

```js
position: { width: 720, height: "auto" }
```

Same width as the Major sheet for consistency. Height grows with the number of Majors; the dashboard handles 6–12 rows comfortably without scrolling. Beyond 12, internal scroll on the rows section.

## Top-level layout

```
┌─────────────────────────────────────────────────────────────────┐
│  HEADER                                                           │
│  Public Info · Facilitator Dashboard                              │
│  All Major characters at a glance ·  cycle 3 · reputation phase   │
├─────────────────────────────────────────────────────────────────┤
│  GM BULK ACTIONS (GM-only)                                        │
│  GM ·  [refresh resolve] [clear monologues] ...  [advance phase ↗]│
├─────────────────────────────────────────────────────────────────┤
│  MAJOR CHARACTERS                                                 │
│                                                                    │
│  ┌─[●]─ Lady Rose Willowood ── ●●●○○ MT mono "to please her father"│
│  ┌─[●]─ Roger Willowood    ── ●●○○○ MT mono "to be allowed..."   │
│  ┌─[●]─ Avril Eclair        ── ●●●○○ MT mono — secret —         │
│  ┌─[●]─ Dixon Cloudcandle   ── ●●●○○ MT mono "to honor..."       │
│  ┌─[●]─ Clayton Trotwood    ── ●●○○○ MT mono "to be plainly..."  │
│                                                                    │
├─────────────────────────────────────────────────────────────────┤
│  FOOTER                                                           │
│  5 of 6 majors active · Mags is offline       last updated 3s ago│
└─────────────────────────────────────────────────────────────────┘
```

## Header

CSS class root: `.gs-dashboard__header`

- Background: `var(--gs-paper)` (house style throughout the dashboard chrome).
- Padding: 22px 28px.
- 0.5px bottom border in `var(--gs-accent-2)`.

### Content

- Title: "Public Info · Facilitator Dashboard" in display type, 22px, color `var(--gs-brand)`.
- Cycle indicator on the right: italic body type, 12px, color `var(--gs-accent-2)`. Format: "cycle {n} · {phase name}". Pulled from world settings (`game.settings.get("good-society-homebrew", "cyclePhase")` and `cycleNumber`).
- Subtitle below the title, full-width: body type, 13px, color `var(--gs-ink)`. Static text: "All Major characters at a glance · GM controls below · individual sheets remain authoritative." (Localized.)

The "individual sheets remain authoritative" line is a deliberate nudge — the dashboard is for awareness, not editing. Every clickable element on the dashboard either (a) opens the relevant Major's sheet, or (b) executes a GM bulk action that affects all Majors uniformly.

## GM bulk actions row (GM-only)

CSS class root: `.gs-dashboard__bulk`

For non-GM users, this section is hidden entirely (no empty band).

- Background: `var(--gs-paper-warm)` (slight tonal shift from the header).
- Padding: 14px 28px.
- 0.5px bottom border in `var(--gs-accent-2)`.
- Display: `flex; align-items: center; gap: 10px; flex-wrap: wrap`.

### Content

- Eyebrow: "GM ·" in 11px small-caps, letter-spacing 0.16em, color `var(--gs-accent-1)` (terracotta — pulls the eye to the GM-only zone).
- Bulk action buttons (secondary outline buttons, body type 12px):
  - **refresh resolve** — sets every Major's `tokens.resolve.current` to the default starting value. Confirms before firing.
  - **clear monologues** — sets every Major's `monologuedThisCycle` to false. Used at the start of a new cycle if `autoRefreshOnUpkeep` is off or fired manually.
  - **reveal desires** — toggles every Major's `visibility.desire` from "secret" to "public" (or vice versa, if all are already public). Confirms — this is a dramatic move.
  - **roll rumour ↗** — opens the Rumour & Scandal generator (out of scope for this doc; lives in `06-rumour-scandal.md` when written). The arrow indicates this opens a separate flow.
- A flex spacer pushes the next button to the right edge.
- **advance phase ↗** — primary filled button (`var(--gs-brand)` bg, paper text). Advances the world's `cyclePhase` setting through the sequence: pre-cycle → novel → reputation → rumour-scandal → epistolary → upkeep → novel (incrementing `cycleNumber`). Confirms before firing.

All bulk actions post a chat card describing what was done ("GM advanced cycle to Reputation Phase. Resolve refreshed for all Majors.") so non-GM players see the world state changing.

## Majors list

CSS class root: `.gs-dashboard__majors`

- Background: `var(--gs-paper)`.
- Padding: 18px 28px.

### Section header

Eyebrow: "MAJOR CHARACTERS" in small-caps, 11px, letter-spacing 0.18em, color `var(--gs-accent-2)`. Sits 12px above the rows.

### Major row

Each Major gets one row. The rows are the heart of the dashboard. Each row is a hybrid-themed component: house-style background and chrome, per-character accents.

CSS class root: `.gs-dashboard__row`

```html
<div class="gs-dashboard__row gs-themed" data-theme="rose">
  <div class="gs-dashboard__row-portrait">…</div>
  <div class="gs-dashboard__row-name">…</div>
  <div class="gs-dashboard__row-resolve">…</div>
  <div class="gs-dashboard__row-mt">…</div>
  <div class="gs-dashboard__row-monologue">…</div>
  <div class="gs-dashboard__row-desire">…</div>
</div>
```

The `.gs-themed[data-theme="..."]` wrapper lets each row pull its character's color and font tokens. The row's own structural CSS uses house variables only for spacing; only the *accent* properties (border-left color, name color, portrait border, resolve pip color, MT button styling) read from `var(--gs-brand)` and friends, which resolve to the character's theme inside the wrapper.

### Row layout

```
┌─[portrait]─ Character name ──── ●●●○○ ─ MT ─ ● ─ "public desire" ─┐
└──────────────────────────────────────────────────────────────────┘
```

`grid-template-columns: 44px 1fr auto auto auto auto; gap: 14px; align-items: center; padding: 10px 14px;`

- Background: `var(--gs-paper-warm)` (house) — every row has the same soft-paper bg.
- 2.5px left-edge accent stripe in `var(--gs-brand)` (theme).
- `border-radius: 8px`.
- 10px gap between rows.

### Row content (left to right)

1. **Portrait** — small oval, 38×44px. Background: theme's `var(--gs-paper)`, border 1px `var(--gs-brand)`. Initial in display type at 18px, color `var(--gs-brand)`. Shows the active persona's portrait if available; falls back to actor portrait, then to initial.

2. **Name + role** — two-line stack:
   - Top line: character name in display type, 16px, color `var(--gs-brand)` (theme-driven). Each character's display type asserts itself here — Rose's Cormorant alongside Avril's Didot alongside Dixon's Cinzel — visually distinguishing characters at a glance.
   - Bottom line: italic body type, 11px, color `var(--gs-accent-2)` (house — sage). The role/title in muted house color rather than theme color, so the eye lands on the character name first.

3. **Resolve track** — read-only 5-pip row. 10px diameter pips, 3px gap. Filled = theme `var(--gs-brand)`. Empty = 0.5px outline in theme `var(--gs-brand)`. Read-only on the dashboard — clicks open the Major sheet.

4. **MT badge** — small pill, "MT" in 10px display type. Off = outline in theme color. On = filled with theme `var(--gs-brand)` background and paper text. Read-only on the dashboard.

5. **Monologue dot** — 10px circle. Available = `var(--gs-accent-3)` (honey, theme-driven — most themes converge on a similar warm gold) filled. Spent = 0.5px outline in `var(--gs-accent-3)`. Tooltip explains.

6. **Public desire** — italic body type, 12px, max-width 200px, text-align right, color `var(--gs-ink)` (theme). If `visibility.desire === "public"`: shows the desire text in italic quotes. If `secret`: shows "— secret —" in muted color. If `redacted`: shows a small redaction bar.

### Click behavior

- Click anywhere on the row except the desire field → opens the Major sheet for that character.
- Click the desire field (GM-only) → opens a Reveal Control popover (inventory #20) for flipping that field's visibility.
- Hover anywhere on the row → row gets a subtle 0.5px border emphasis (`var(--gs-accent-2)`) without changing background.

### Why this layout works at scale

The hybrid theming means:

- The dashboard stays coherent (house chrome — same paper, same paddings, same gaps).
- Characters stay distinct (each row's accent stripe + name color + portrait border declares whose row this is, even at a glance).
- Type variation across rows (Cormorant, Didot, Cinzel, Lora, DM Serif Display) creates *interesting* visual rhythm rather than monotony — the dashboard reads like a guest list at a society event, where each name carries its own card stock.

## Footer

CSS class root: `.gs-dashboard__footer`

- Background: `var(--gs-paper-warm)`.
- 0.5px top border in `var(--gs-accent-2)`.
- Padding: 14px 28px.
- Display: `flex; justify-content: space-between; align-items: center`.

### Content

- Left: italic 11px body type, color `var(--gs-accent-2)`. Reads "{N} of {M} majors active · {names of inactive}". "Inactive" means the actor exists in the world but the owning user is offline. Optional but useful for the GM at session start.
- Right: 11px body type, letter-spacing 0.06em, color `var(--gs-accent-2)`. Reads "last updated {N}s ago" — the dashboard auto-refreshes every 5 seconds, and this counter shows the freshness. (Alternative: subscribe to actor updates and re-render on change. Defer to implementation.)

## Theme behavior

The dashboard chrome uses house style (Inkwell). Each Major row is wrapped in `.gs-themed[data-theme="{character-theme}"]`, which rebinds CSS variables to that character's palette only inside the row.

Variables that should pull from the theme inside each row:
- `--gs-brand` → name color, accent stripe, portrait border, resolve pips, MT badge color
- `--gs-accent-3` → monologue dot fill (honey/gold across themes converges to a similar warm color)
- `--gs-ink` → desire text color (only one row affected at a time, so contrast is fine)

Variables that should NOT pull from the theme inside each row (use house instead):
- `--gs-paper-warm` → row background (always house, for consistency)
- `--gs-accent-2` → muted text (role/title), borders (always house)

This means the row's CSS uses a deliberate mix:

```css
.gs-dashboard__row {
  background: var(--gs-paper-warm);  /* house — overridden by inner wrapper inheritance? */
  /* ... */
}

.gs-dashboard__row-name {
  color: var(--gs-brand);  /* theme — comes from .gs-themed wrapper */
  font-family: var(--gs-display);  /* theme */
}
```

To prevent the wrapper's `var(--gs-paper-warm)` from cascading into the row background, the dashboard's CSS hardcodes the house values for "always-house" properties:

```css
.gs-dashboard .gs-dashboard__row {
  /* explicitly use house values, not theme overrides */
  background: #F4ECD8;  /* hardcoded house --gs-paper-warm */
}
```

This is a small but real implementation gotcha. Document it in the dashboard's CSS file with a comment explaining why.

Alternative: the wrapper only redefines the variables that should be themed, leaving others alone. Implementation chooses based on which is easier to maintain.

## Dynamic behavior

### Real-time updates

The dashboard subscribes to `updateActor` hooks scoped to actors of type `major-character`. When a Major's `tokens.resolve.current`, `tokens.major`, `tokens.monologuedThisCycle`, `desire`, or `visibility.desire` changes, the corresponding row re-renders.

Re-render is incremental — only the affected row re-renders, not the entire dashboard.

The footer's "last updated" timer resets on any update.

### Phase change

When the world's `cyclePhase` setting changes, the header re-renders with the new phase name. If `autoRefreshOnUpkeep` is true and the new phase is Upkeep, the bulk action "refresh resolve" is suggested visually (a subtle pulse on the button). The GM still has to click — auto-firing would surprise people.

### Major added or removed

When a new Major actor is created in the world, it appears in the list automatically (sorted by family then by character creation date). When deleted, its row disappears.

## Edge cases

### No Majors yet
Show the section header "MAJOR CHARACTERS" and a placeholder card: italic "No Major characters yet. Create one in the actors sidebar." Don't hide the section.

### Many Majors (10+)
The list grows vertically. Beyond 12, scroll inside the majors section (preserve header and footer always visible).

### Major's user is offline
Render the row normally but with the portrait at 70% opacity and a small "offline" eyebrow above the name in italic muted text. The footer count reflects this.

### Major has no theme assigned
The wrapper falls back to house style. The row renders without distinct accents — just a uniform Inkwell row. Visually, this looks like the row is "less of a character" than themed rows, which is appropriate for an unfinished character.

### Visibility flag combinations
- `visibility.desire = "public"` → show the desire in italic quotes.
- `visibility.desire = "secret"` → show "— secret —" in muted color.
- `visibility.desire = "redacted"` → show a small redaction bar with width matching the typical desire length.

For non-GM viewers, the same rules apply but they can't toggle the visibility (GM-only action).

## Accessibility considerations

- The bulk action buttons confirm before firing (especially "reveal desires" — that's an irreversible dramatic moment).
- Every row has an `aria-label` summarizing its state for screen readers: "Lady Rose Willowood. Resolve 3 of 5. MT inactive. Monologue available. Desire: to please her father."
- Color is never the sole signal — every accent is paired with a position (left edge stripe), a name, and an icon.

## Implementation notes for Claude Code

When prompted to build this dashboard, the recommended order:

1. Build the dashboard `ApplicationV2` skeleton — opens via scene control button, renders empty.
2. Build the header partial — hardcoded title, cycle phase from settings.
3. Build the GM bulk actions row — hide for non-GM users, wire up confirm dialogs and bulk action handlers.
4. Build the Major row partial as a standalone component first (`templates/components/dashboard-major-row.hbs`), themed via `.gs-themed` wrapper. Render with hardcoded sample data to verify cross-theme styling.
5. Build the row collection in the dashboard, iterating `game.actors.filter(a => a.type === "major-character")`.
6. Wire `updateActor` subscriptions for incremental re-render.
7. Build the footer — count and freshness timer.
8. Wire the scene control button (`module/hooks/scene-controls.js`) to open the dashboard.

CSS organization:
- `styles/apps/_dashboard.css` — chrome, header, bulk row, footer, section header
- `styles/components/_dashboard-row.css` — the Major row, including the wrapper trick for hybrid theming

Test path:
1. Open the dashboard with one Major (Rose). Verify her row's accents are correctly themed.
2. Add a second Major with a different theme (Avril). Verify both rows coexist with distinct accents on a single shared chrome.
3. Add three more (Roger, Dixon, Clayton). Verify the visual rhythm holds — five themes on one surface should feel like a guest list, not chaos.
4. Toggle one Major's resolve from a player sheet. Verify the dashboard row updates within a second.
5. As GM, click "reveal desires." Confirm. Verify all desire fields flip to public and the chat announcement posts.

If 1–5 pass, the dashboard is production-ready and the hybrid theming pattern is validated for any future communal surface.

## Open questions

1. **Should the dashboard show Connections too?** Currently no — only Majors. Connections appear in the per-Major sheet's Connections list. **Tentative answer: keep Majors-only for v1.** Adding Connections would double the row count and dilute the focus. Consider a tab or toggle for v1.1.

2. **Should the dashboard be the GM's "session control center" or a player tool?** Currently both — GM gets bulk controls, players get awareness. **Tentative answer: keep both.** Splitting it would add a second app and confuse newcomers.

3. **Should Mags's row appear if her player isn't actively in the campaign?** The visual proof footnotes "Mags is offline" — if she's not playing this campaign, should her row still show? **Tentative answer: yes, until the actor is deleted.** "Offline" is a session state; "removed from campaign" is an actor-deletion state. The dashboard reflects reality — if Mags exists as an actor, she shows.

4. **Should the row show pending reputation changes since last Upkeep (Plan §12.3)?** The pending changes log is a per-sheet feature; on the dashboard, it would clutter rows. **Tentative answer: no, but show a small indicator dot (●) next to the row when pending changes exist.** Hover or click expands. Defer to v1.1.

5. **GM bulk action: roll Rumour & Scandal.** This depends on the Rumour & Scandal mechanics, which haven't been designed yet. **Tentative answer: stub the button for now.** It opens a placeholder dialog ("Rumour & Scandal generator coming soon") until the mechanics are ready.

## Visual proof

The dashboard with five Majors (Rose, Roger, Avril, Dixon, Clayton) is rendered above (`good_society_public_info_dashboard`). It validates: house chrome consistency, hybrid theming on each row (per-character accents, name colors, portrait borders, resolve pip colors, type variation), GM bulk actions row, footer state. All five themes coexist on a single shared surface without visual collision.

The design holds for 6 Majors. Beyond that, the rows section would scroll internally, but the chrome remains the same.

## Changelog

| Date       | Change                                                                |
|------------|-----------------------------------------------------------------------|
| 2026-05-05 | File created. Full dashboard layout specified. Hybrid theming pattern (house chrome + per-row character accents) documented. Visual proof rendered with five themes cohabiting. |
