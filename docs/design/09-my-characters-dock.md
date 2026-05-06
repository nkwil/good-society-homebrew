# 09 — My Characters Dock

**Status:** Locked — full dock specified; visual proof rendered with Avril (Major) and three Connections (green, yellow, purple)
**Date opened:** 2026-05-05
**Covers inventory entry:** #15 My Characters Dock

## Goal

Specify the My Characters Dock (Plan §12.1). It's a pinned compact panel showing only the actors *this user owns* — their Major(s), the Connections promoted to their ownership, optionally NPCs. Each row gives at-a-glance state and one-click access to the relevant sheet.

This is the most-used surface in the system during play. Players will look at the dock more than the dashboard, more than their own sheet (because their sheet is open in another window). The dock is *companion UI* — always there, never demanding attention, ready when needed.

The dock is functionally a player-scoped, narrower, vertical version of the Public Info Dashboard. Same hybrid theming pattern (house chrome + per-character accents). Same wrapper mechanism. Different scale, different audience.

## Where it lives

Foundry doesn't have a built-in dock area, so the dock attaches to a corner of the canvas — by default, the right side, vertically below the existing player list and macro hotbar.

Implementation choice: render as an `Application` (not `ApplicationV2` — keeps it lightweight), positioned with `position: { left: window.innerWidth - 310, top: 80 }` initially, and saved to user settings on drag (so each user's dock placement persists).

The dock is **draggable but not resizable**. Resizable docks invite tinkering and break visual consistency.

## Sheet dimensions

```
width: 290px (fixed)
height: auto, max-height: ~80% of viewport (scrolls internally if needed)
```

290px is wide enough for portrait + name + state but narrow enough to feel like a sidebar tool, not a panel. Comparable to Foundry's player list panel width.

## Visibility

- Visible by default for all users.
- A scene control toggle hides/shows it (per-user setting `dockVisible`).
- Hidden when there's nothing to show (user owns no actors). Show a small placeholder eyebrow then — "no characters yet" with a pointer to the actors sidebar.

## Top-level layout

```
┌──────────────────────────────────┐
│  MY CHARACTERS               4   │ ← header (count of owned)
├──────────────────────────────────┤
│  MAJOR                            │
│  ┌─[A]─ Avril Eclair ────────┐   │
│  │     as The Maid             │
│  │     ●●●○○ MT mono           │   ← Major row (full state)
│  └─────────────────────────────┘   │
│                                    │
│  ─── CONNECTIONS ───               │ ← divider eyebrow
│                                    │
│  ┌─[H]─ Mr. Hats McHats ──── ●○○○○┐│ ← Connection rows
│  ┌─[L]─ Miss Lavinia Fernvale ●○○○│
│  ┌─[L]─ Lady Mystery ───────── ●●○│
│                                    │
├──────────────────────────────────┤
│  click any to open · [speaking as▾]│ ← footer (footer + speaker switcher)
└──────────────────────────────────┘
```

## Header

CSS class root: `.gs-dock__header`

- Background: `var(--gs-paper)`.
- Padding: 14px 16px.
- 0.5px bottom border in `var(--gs-accent-2)`.
- Display: `flex; justify-content: space-between; align-items: baseline`.

### Content

- Title: "MY CHARACTERS" in 11px small caps, letter-spacing 0.18em, color `var(--gs-accent-2)`. Period-correct, restrained.
- Right: italic 10px count of owned actors, color `var(--gs-accent-2)`. Updates live.

## Body

CSS class root: `.gs-dock__body`

- Padding: 12px 14px.
- Display: `flex; flex-direction: column`.

The body has two zones: Majors first, then Connections. The Majors zone has a small eyebrow ("MAJOR" or "MAJORS" if multiple) above its rows; the Connections zone has a centered divider eyebrow ("─── CONNECTIONS ───") between the zones.

If a user owns only Majors, the Connections divider doesn't render. Vice versa for Connection-only owners.

## Major row spec

CSS class root: `.gs-dock__row--major`

Larger than Connection rows because Majors carry more state (resolve, MT, monologue dot, persona name).

```
┌─[portrait]─ Character name ───────────┐
│             italic persona name        │
│             ●●●○○ MT ●                 │
└────────────────────────────────────────┘
```

Layout: `display: grid; grid-template-columns: 36px 1fr; gap: 10px; padding: 10px 12px; background: var(--gs-paper-warm); border-radius: 8px; border-left: 2.5px solid var(--gs-brand);`

Wrapped in `.gs-themed[data-theme="{character-theme}"]`.

### Row content

1. **Portrait** — small oval, 32×38px. Theme paper background, 1px border in `var(--gs-brand)`. Initial in display type at 16px, color `var(--gs-brand)`. Active persona's portrait if available.

2. **Name + persona stack:**
   - Top: character name in display type, 15px, color `var(--gs-brand)` (theme-driven). Each character's display font asserts itself.
   - Middle: italic body type, 10px, color `var(--gs-accent-2)` (house — sage). Format: "as {persona name}". If no persona override, "as primary" or just role label.
   - Bottom: state strip — see below.

3. **State strip:**
   - Resolve track: 5-pip, 8px diameter, 2px gap. Filled = `var(--gs-brand)` (theme); empty = 0.5px outline.
   - MT badge: small pill, 9px display type, padding 1px 5px. Off = outline; On = filled `var(--gs-brand)` with paper text.
   - Monologue dot: 8px circle. Available = `var(--gs-accent-3)` (house honey/gold); spent = outlined.

The state strip is read-only at the dock. Click anywhere on the row to open the sheet.

## Connection row spec

CSS class root: `.gs-dock__row--connection`

Tighter than Major rows (Connections have less state to display).

```
┌─[H]─ Hats McHats ───────────── ●○○○○ ┐
│      a hatter                          │
└────────────────────────────────────────┘
```

Layout: `display: grid; grid-template-columns: 28px 1fr auto; gap: 10px; padding: 8px 12px; background: var(--gs-paper-warm); border-radius: 6px; border-left: 2.5px solid var(--gs-brand);`

Wrapped in `.gs-themed[data-theme="{connection-variant}"]`.

### Row content

1. **Portrait** — smaller oval, 26×30px, 0.5px border in `var(--gs-brand)`. Initial in display type at 13px.

2. **Name + role stack:**
   - Top: connection name in display type, 12px, color `var(--gs-ink)` (theme). Connections use ink color for the name (unlike Majors which use brand) — they're "of the world" rather than "voiced."
   - Bottom: italic body type, 10px, color `var(--gs-brand)` (theme). The connection's role label.

3. **Mini resolve track on the right** — 5-pip, 6px diameter, 2px gap. Same theming as Major's. Smaller because Connections rarely use resolve.

No MT badge or monologue dot — those are Major-only mechanics.

## Footer

CSS class root: `.gs-dock__footer`

- Background: `var(--gs-paper-warm)`.
- 0.5px top border in `var(--gs-accent-2)`.
- Padding: 10px 16px.
- Display: `flex; justify-content: space-between; align-items: center`.

### Content

- Left: italic 10px helper text in `var(--gs-accent-2)`. Reads "click any to open."
- Right: a small **Speaking-As switcher** button (Plan §12.1, inventory #27). 0.5px outline, 10px label "speaking as ▾". Click to open a small popup with the user's owned actors and personas; selecting one sets that as the active speaker for chat purposes.

The Speaking-As switcher lives in the dock footer because the dock is the natural home for "who am I right now?" decisions. (Alternative location: above the chat input itself. The dock is preferred because it keeps the chat input clean and the dock is already focused on owned actors.)

## Theme behavior

The dock chrome uses house style. Each row is wrapped in `.gs-themed[data-theme="{theme-id}"]` so its accents pull from the relevant character/connection theme.

The dock follows the same hybrid pattern as the Public Info dashboard. The same CSS gotcha applies: row backgrounds need to use hardcoded house values to avoid wrapper cascade. Document with a comment in the CSS file.

## Click and interaction behavior

- Click anywhere on a row → opens that actor's sheet.
- Right-click a row → quick-action context menu: "Open sheet", "Switch persona", "Speak as", "Hide from dock".
- Drag a row → reorders within its zone (Majors stay above Connections; can't reorder across zones).
- Hover → row gets a subtle border emphasis (0.5px `var(--gs-accent-2)`) without changing background.

## Dynamic behavior

### Real-time updates

The dock subscribes to `updateActor` hooks scoped to actors the user owns. State changes (resolve, MT, monologue, persona switch) update the row inline. Persona switch changes the portrait, the name (if persona-overridden), and the small "as {persona name}" line.

The count in the header updates when an actor is created/deleted/promoted to user ownership.

### Adding/removing actors

When a user is granted OWNER permission on a Connection (e.g. the GM promotes Hats McHats to Natalie's ownership mid-session), the Connection row appears in the dock without a page reload.

When ownership is revoked, the row disappears with a brief fade.

### Sort order

- Majors: by family then by character creation date (matches dashboard sort).
- Connections: by linked Major (so Connections cluster with their primary Major), then alphabetically. Suggested but adjustable per-user via drag-reorder (saved to user settings).

## Edge cases

### User owns no characters
Header still renders. Body is empty save a single italic placeholder: "No characters yet. Open the actors sidebar to create one." Footer hidden (no Speaking-As to switch to).

### User owns one character (common for new players)
Single Major row in the body. Connections section absent. Footer's Speaking-As switcher renders but is essentially redundant (only one speaker option).

### User owns many Connections
The body grows vertically. If it exceeds the viewport, internal scroll on the body section (header and footer always visible).

### User has GM permission on everything
For the GM, the dock is less useful — they own everything. **Tentative answer:** for GM users, default the dock to hidden, but allow opening it. The GM uses the Public Info dashboard for awareness, not the dock.

### Connection promoted from shared pool to user ownership mid-session
The row appears in the dock, sorted next to the linked Major (or at the bottom of Connections if not linked). A subtle 600ms highlight animation draws the eye so the user notices the new addition.

## Accessibility considerations

- Each row has an `aria-label`: "Avril Eclair, Major character, as The Maid. Resolve 3 of 5. MT inactive. Monologue available. Click to open sheet."
- Tab navigation works: rows are focusable, Enter opens the sheet, Space activates Speaking-As.
- The dock can be hidden via keyboard shortcut (configurable in user settings).

## Implementation notes for Claude Code

When prompted to build this dock:

1. Build the dock `Application` skeleton — opens, positions itself, saves position to user settings on drag.
2. Build the row partials (`templates/components/dock-major-row.hbs`, `templates/components/dock-connection-row.hbs`). These should reuse the dashboard row primitives where possible (resolve track, portrait frame, MT badge, monologue dot — same component CSS).
3. Wire `updateActor` and `createActor`/`deleteActor` hook subscriptions for live updates.
4. Build the Speaking-As switcher popup as a small `Application` opened from the footer button. Persists active speaker selection to user settings.
5. Add the scene control button to toggle dock visibility.

CSS organization:
- `styles/apps/_dock.css` — chrome, header, footer, dividers
- `styles/components/_dock-row-major.css` — Major row layout
- `styles/components/_dock-row-connection.css` — Connection row layout (smaller)
- Reuse: `_resolve-track.css`, `_mt-badge.css`, `_monologue-dot.css` from the dashboard

Testing path:
1. Open Foundry as Natalie. Verify the dock appears showing her Major (Avril) and her Connections (Hats, Lavinia, Lady Mystery).
2. Switch Avril's persona via the sheet. Verify the dock row updates the portrait and the "as {persona name}" line.
3. Click Avril's resolve from the dashboard (which is read-write there). Verify the dock row reflects the new value.
4. Click a Connection row. Verify the Connection sheet opens.
5. Drag the dock to a different position. Reload Foundry. Verify the position persists.

If 1–5 pass, the dock is production-ready.

## Open questions

1. **Should the dock support multiple per-user docks?** A user might want a "session 1 cast" dock and a "session 2 cast" dock. **Tentative answer: no for v1.** Single dock per user. Filtering can come later.

2. **Should NPCs appear in the dock if owned?** Currently no — NPCs are GM-controlled by default, and even if a player owns one, NPCs as voices feel off. **Tentative answer: yes if owned, but in a third tertiary section below Connections.** Most users won't own NPCs.

3. **Speaking-As switcher: keyboard shortcut?** Tab through the dock and press Space on a character to set them as speaker. **Tentative answer: yes, Space activates Speaking-As.** Enter opens the sheet (already specified). Space avoids accidental sheet opens when just trying to switch voice.

4. **Should the dock show a small badge when a character has a pending action (e.g. take monologue available, reputation change pending)?** **Tentative answer: yes, a small ● indicator on the row right edge when an action is available.** Defer specific design to v1.1.

5. **Dock width adjustability.** Some users might prefer a wider dock (showing more state per row) or narrower. **Tentative answer: fixed at 290px for v1.** If users complain, add a 240/290/340 width preset later.

## Visual proof

The dock in Natalie's view is rendered above (`good_society_my_characters_dock`). Shows: header with count, MAJOR section eyebrow, Avril's row in candlelight theme with full state, CONNECTIONS divider eyebrow, three Connection rows (Hats green, Lavinia yellow, Lady Mystery purple) each with their theme accents, footer with Speaking-As switcher.

Validates: hybrid theming at narrow width, three connection variants visually distinct in close proximity, vertical rhythm, the antique-but-clean principle holds even at compact scale.

## Changelog

| Date       | Change                                                                |
|------------|-----------------------------------------------------------------------|
| 2026-05-05 | File created. Pinned panel layout, Major and Connection row variants, Speaking-As switcher footer, dynamic behavior, edge cases all specified. Visual proof rendered with Natalie's likely cast. |
