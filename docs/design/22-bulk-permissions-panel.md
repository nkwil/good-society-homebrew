# 22 — Bulk Permissions Panel

**Status:** Locked — full grid layout specified, cell interactions specified, save flow specified
**Date opened:** 2026-05-05
**Covers inventory entry:** #19 Bulk Permissions Panel

## Goal

Specify the GM-only `ApplicationV2` window for setting actor ownership across all users in one screen (Plan §12.5). Replaces the friction of right-clicking 20+ actors and editing per-user permissions individually.

This is the GM's single-most-time-saving tool during campaign setup. A campaign with 4 players, 5 Majors, 8 Connections, and a few NPCs requires roughly 60 individual permission settings to fully configure ownership the right way. Without this panel: 60 right-click menus and 60 dialog confirms. With it: one screen, change-and-save.

The panel is also where the GM revisits permissions when a Connection gets promoted, when a player joins or leaves, or when an actor changes hands narratively (a Connection that was Hats's becomes Natalie's after a story beat).

## Why this is a primary surface, not a settings panel

Foundry's default per-actor right-click → Configure Ownership → modal flow is fine for occasional one-off changes. It's painful for bulk operations. A grid view inverts the orientation: instead of "for this actor, which users have which level," it shows "for all actors and all users, what's the permissions matrix."

Once a GM sees the matrix, they can spot patterns ("I forgot to give Paige observer on the Cloudcandle Family"), make corrections in seconds, and verify completeness at a glance.

## Sheet dimensions

```js
position: { width: 720, height: "auto" }
```

720px wide. Wide enough for the actor name column (220px) plus 4 user columns at ~110px each plus padding. Most tables won't need more than 4-6 user columns; if a campaign has more, horizontal scrolling within the body is acceptable.

Height auto with `max-height: 80vh` and internal scroll on the body when actor count grows.

## Visibility

GM-only. Opens via:
- A scene control button in the GM's left sidebar.
- A keyboard shortcut (configurable; default Ctrl+Shift+P).
- The Public Info Dashboard's GM bulk actions row gets a "permissions" link that opens this panel.

Players never see this panel; the scene control button is hidden for non-GM users.

## Top-level layout

```
┌────────────────────────────────────────────────────────┐
│ [GM] BULK PERMISSIONS                  7 actors · 4 users│ ← header
│ [search...]                              [filter type ▾]│
├────────────────────────────────────────────────────────┤
│ ACTOR              │ Opal │ Natalie │ Paige │ Michael │ ← user header
├────────────────────────────────────────────────────────┤
│                                                          │
│ MAJORS · 4                                                │
│ Lady Rose          │ OWN  │  read   │  OWN  │  read    │ ← rows
│ Roger Willowood    │ OWN  │  read   │  read │  OWN     │
│ Avril Eclair       │ OWN  │  OWN ←  │  read │  read    │
│ Dixon Cloudcandle  │ OWN  │  read   │  read │  read    │
│                                                          │
│ CONNECTIONS · 3                                           │
│ Mr. Hats McHats    │ OWN  │  OWN ←  │  read │  read    │
│ ...                                                      │
│                                                          │
├────────────────────────────────────────────────────────┤
│ [2 PENDING] Avril → Natalie · Hats → Natalie            │ ← footer
│                              [discard]  [save 2 changes ↗]│
└────────────────────────────────────────────────────────┘
```

## Header

CSS class root: `.gs-bulk-permissions__header`

- Background: `var(--gs-paper)`.
- Padding: 16px 22px.
- 0.5px bottom border in `var(--gs-accent-2)`.

### Top row — title and counts

- Left cluster: GM pill + "BULK PERMISSIONS" eyebrow in 11px small caps, letter-spacing 0.18em, color `var(--gs-accent-2)`.
- Right: italic 11px count summary. Format: "{N} actors · {M} users".

### Bottom row — filters

A single row with two filter controls:

- **Search input**: text input with placeholder "search actors...". Body type 12px. Filters rows in real-time as the user types (case-insensitive, matches actor name or any tag/role text on the actor).
- **Type filter dropdown**: dropdown showing "all types" / "Majors only" / "Connections only" / "Family only" / "NPCs only". When a specific type is selected, only that section renders.

Both filters apply additively. If the search matches nothing in the active type filter, an empty-state message appears in the body: "No actors match your filter."

## User column header

CSS class root: `.gs-bulk-permissions__user-row`

- Background: `var(--gs-paper-warm)`.
- Padding: 8px 22px.
- 0.5px bottom border in `var(--gs-accent-2)`.

### Layout

`grid-template-columns: 220px 1fr 1fr 1fr 1fr; gap: 8px; align-items: center;`

Column 1 ("ACTOR"): small caps eyebrow, 10px, letter-spacing 0.16em, `var(--gs-accent-2)`.

Columns 2–N (one per user): user name in display type Lora, 11px, color `var(--gs-ink)`, centered. Below the name in italic 9px: a small role label ("GM" for the GM, blank for players). The GM column is always first.

### Many users

If the campaign has more than ~5 users, the user columns become narrower (down to ~80px each). At 6+ users, the grid scrolls horizontally within the body. Header sticks via CSS `position: sticky; top: 0`.

## Body

CSS class root: `.gs-bulk-permissions__body`

- Padding: 6px 22px.
- Background: `var(--gs-paper)`.
- Display: stacked sections per actor type.

### Type section header

For each non-empty actor type, a small section header:

```
MAJORS · 4
```

- Display: small caps eyebrow, 10px, letter-spacing 0.18em, `var(--gs-accent-2)`.
- Padding: 14px 0 6px 0 (10px top for first; thicker before subsequent sections).
- 0.5px hairline above (when not the first section).

Section order: Majors → Connections → Family → NPCs. (Most-edited types first.)

If filtering by type, only one section renders.

### Actor row

Each actor is one grid row.

`grid-template-columns: 220px 1fr 1fr 1fr 1fr; gap: 8px; align-items: center; padding: 6px 0;`

#### Actor cell (column 1)

- Display: `display: flex; align-items: center; gap: 8px;`
- Portrait: 22×26px oval, themed paper background, themed brand-color border, initial in the actor's display type 12px. The portrait is wrapped in `.gs-themed[data-theme="..."]` so it picks up the actor's theme (cross-theme rendering, same pattern as dashboard rows).
- Actor name: in the actor's display type (Cormorant for Rose, Didot for Avril, Cinzel for Dixon, etc.), 13px, color `var(--gs-brand)`. The name is themed even though the panel chrome is house — same hybrid pattern.

#### Permission cell (columns 2–N)

Each cell shows the current permission level for that actor/user combination. Compact pill format:

- **NONE (0)**: dash glyph "—". Plain background, body type, color `var(--gs-accent-2)`.
- **LIMITED (1)**: "view". Paper-warm background, 0.5px border `var(--gs-accent-2)`, color `var(--gs-accent-2)`, body type.
- **OBSERVER (2)**: "read". Paper-warm background, 0.5px border `var(--gs-accent-2)`, color `var(--gs-accent-2)`, body type.
- **OWNER (3)**: "OWN". Brand-filled background (`var(--gs-brand)`), paper-color text, body type small caps, letter-spacing 0.06em. Visually distinct — owners stand out at a glance.

All pills are 10px size for compact rows. Padding 2×8px, border-radius 3px. Centered in the cell.

#### Click behavior

Click a permission cell → opens a small inline dropdown showing the four levels. Click a level to apply. The cell updates immediately (visually) and is marked as pending change (see Pending changes below).

Hover a cell → shows a faint outline indicating clickability.

#### Pending change indicator

Cells with unsaved changes have:
- A 2px outline in `var(--gs-accent-1)` (terracotta) around the pill.
- A small italic "changed" label floating above the cell, 8px text in `var(--gs-accent-1)`.
- The pill's filling color shifts subtly — owner pills use `var(--gs-accent-1)` instead of `var(--gs-brand)` while pending, to draw the eye.

The row containing pending changes also gets a subtle background tint (`var(--gs-paper)` with terracotta wash, ~3% opacity) so the changed rows stand out from the static rows.

## Per-row and per-column quick actions

### Per-row "set all to" action

When the GM hovers an actor row, a small action button appears at the right edge of the row: "set all ▾".

Click → opens a dropdown with the four permission levels. Selecting one sets *every user* in that row to that level (excluding the GM, who is always OWNER and not editable).

Use case: "Make Avril owned by Natalie, observer for everyone else." Set the row to "read" (which makes everyone observer except GM), then click Natalie's cell and set to OWN. Two clicks instead of four.

### Per-column "set all to" action

When the GM hovers a user column header, a similar "set all ▾" action appears below the user's name.

Click → opens the same dropdown. Selecting sets every actor in that column to the level. Use case: "Set Paige to observer on everything," then individual OWN-grants for her Major and her Connections.

### Per-section "reset to defaults" action

Each type section header gets a small "[reset section]" link on hover. Click → resets all permissions in that section to the type's default:
- Majors: GM is OWNER, all players are OBSERVER.
- Connections: GM is OWNER, all players are OBSERVER.
- Family: GM is OWNER, all players are OBSERVER.
- NPCs: GM is OWNER, all players are NONE.

Confirms before firing — this is destructive of explicit permissions.

## Footer

CSS class root: `.gs-bulk-permissions__footer`

- Background: `var(--gs-paper-warm)`.
- 0.5px top border in `var(--gs-accent-2)`.
- Padding: 14px 22px.
- Display: `flex; justify-content: space-between; align-items: center`.

### Pending changes summary (left)

When 0 pending: "No changes" in italic muted text.

When 1+ pending:
- A small "{N} PENDING" pill in `var(--gs-accent-1)` (terracotta) bg, paper text, 10px small caps, letter-spacing 0.06em.
- Italic 11px summary text listing the changes: "Avril → Natalie · Hats → Natalie · Lavinia → Paige". Truncates with "and {N} others" if too many.

### Action buttons (right)

- **discard changes** — secondary outline. Clears all pending changes, reverts visual state to what's on the server.
- **save {N} changes ↗** — primary filled. Persists all pending changes to the actor permissions. Label updates with the count. Disabled when N=0.

On save success, all pending indicators clear and the panel reflects the new server state. A toast appears in the bottom-right: "Permissions updated for {N} actors."

If save fails (network error, permission validation issue), an error toast appears: "Save failed. {error reason}. Please try again."

### Why save-once instead of per-cell auto-save

Auto-save on every cell change would generate dozens of network requests during bulk editing. Save-once batches the changes into a single update. The pending-change indicators give the user real-time feedback without the network cost.

The "discard changes" affordance is the safety net — if the GM realizes they made a wrong change before saving, undo is one click.

## Theme behavior

Panel chrome is **house style**. Each actor row's portrait + name uses the actor's character/connection theme via `.gs-themed[data-theme="..."]` wrappers (cross-theme rendering, same pattern as the dashboard).

Permission pills are house-styled regardless of the actor's theme — the OWN pill is always `var(--gs-brand)` (forest green), not the actor's theme color. This is a deliberate choice: permissions are system-level state, not character voice. House styling makes them scan consistently across all rows.

## Edge cases

### Actor with no portrait
Falls back to actor initial in display type. Same fallback as everywhere else.

### User leaves mid-edit (loses connection)
Their column persists in the grid until the GM closes the panel or the user is fully removed from the world. Pending changes for that user can still be saved — Foundry stores permissions by user ID, which persists even when the user is offline.

### New user joins mid-edit
The grid doesn't auto-add the new column. The GM closes and reopens the panel to refresh.

### Many actors (50+)
Body scrolls vertically. Type sections still render with their dividers; scrolling stays smooth via virtualization (only render visible rows + a buffer).

### Changing a Major's permissions affects who sees their sheet
That's the whole point. The panel is the canonical place to do this. Changes propagate immediately on save — sheets that were open for users with revoked permissions close on their end.

### GM column is read-only
The GM is always OWNER on every actor (Foundry default). The GM column shows OWN for every cell with no edit affordance. Saving doesn't change GM permissions even if attempted.

### Conflicting changes (two GMs in a co-GM session)
If two GMs both have the panel open and edit the same cell, the conflict-warning system (per `21-edit-conflict-warning.md`) catches it on save. Per-cell granularity in the conflict detection.

### Search returning 0 results
"No actors match your filter. [clear search]" — clear button resets the search input.

### Filter type with 0 actors of that type
"No {type} actors in this world." Message in the empty section.

## Accessibility considerations

- Each cell has an `aria-label`: "Lady Rose Willowood, Natalie, observer. Click to change."
- Tab navigation works: tab through cells in row order. Enter or Space opens the dropdown.
- The dropdown is keyboard-navigable (arrow keys + Enter to select).
- Color is not the sole signal — pill text labels distinguish the levels independently.
- The OWN pill's filled background ensures sufficient contrast even for users who can't distinguish the brand color from the surrounding paper.

## Implementation notes for Claude Code

When prompted to build the panel:

1. Build the `BulkPermissionsPanel` `ApplicationV2`. Open via scene control button + keyboard shortcut.
2. Build the data layer: collect all actors from `game.actors`, all users from `game.users` (excluding inactive/banned).
3. Build the header partial (search input, type filter dropdown).
4. Build the user-column-header partial. Sticky position when body scrolls.
5. Build the body. Group actors by type, render each row with the cross-theme wrapper.
6. Build the cell partial. Wire click → inline dropdown.
7. Build the pending-change tracking. Local state holds {actorId, userId, level} entries; cell rendering reads from local state with fallback to server state.
8. Build the per-row and per-column quick-set actions.
9. Build the footer with pending summary and save/discard.
10. Wire the save handler. Use `actor.update({ ownership: { ... } })` for each changed actor.
11. Test with multi-user scenarios: open as user A, see permission change reflect on user B's sheet visibility.

CSS organization:
- `styles/apps/_bulk-permissions.css` — full panel styling
- `styles/components/_permission-pill.css` — the pill primitive (reusable for any "permission level" display, e.g. on the actor sheet header for non-GM users to see their own permission)

### Test path

1. Open the Bulk Permissions Panel as GM. Verify all actors appear grouped by type.
2. Click Avril's cell for Natalie. Open the dropdown. Select OWN. Verify the cell updates with pending-change indicator.
3. Click Hats McHats's cell for Natalie. Set to OWN. Verify two pending changes shown in the footer.
4. Click "save 2 changes". Verify the save fires, pending indicators clear, footer resets to "No changes".
5. As Natalie (in another browser), open Avril's sheet. Verify Natalie can edit (she now has OWNER).
6. Back as GM, click "set all" on the Lavinia row. Set everyone to "read". Verify all four cells in that row show pending changes.
7. Click "discard changes". Verify the row reverts.
8. Use the search to find "Hats". Verify the grid filters to Hats's row only.
9. Use the type filter to show only Connections. Verify Majors section disappears.
10. Confirm conflict resolution: open the panel as a co-GM, change a cell, have the original GM also change it. Verify the conflict-warning system catches the conflict on save.

If 1–10 pass, the Bulk Permissions Panel is production-ready.

## Open questions

1. **Should the panel show a "permissions diff" view comparing current to default?** Useful for verifying coverage. **Tentative answer: defer to v1.1.** A small "show defaults" toggle could overlay the default values as a faded comparison.

2. **Should the panel allow exporting the permission matrix to CSV/JSON?** Useful for external campaign tracking. **Tentative answer: yes, GM-only export action in the header.** Small addition.

3. **Should there be a "permissions history" log?** Track when permissions changed and who changed them. **Tentative answer: no for v1.** Adds complexity; rarely needed in practice.

4. **Should the panel allow setting permissions on items (not just actors)?** Items are typically owned-by-actor. **Tentative answer: no for v1.** Items inherit permission from their actor.

5. **Should the Family type section be merged with the actor types it applies to?** A Family with no Majors yet might be confusing. **Tentative answer: keep Family as its own section.** Even empty families have ownership concerns.

6. **Should the panel auto-detect "stranded" actors (no owner among non-GM users)?** Could highlight orphaned actors that need attention. **Tentative answer: yes, with a small warning indicator next to such actors.** A 6×6 dot in `var(--gs-danger)` next to the actor name. Hovering explains.

7. **Should there be a way to assign permission templates (e.g. "this user is a primary player on this character")?** Useful for repetitive setup. **Tentative answer: defer to v1.1.** The per-row and per-column quick-set covers 80% of the templating use case.

## Visual proof

The Bulk Permissions Panel is rendered above (`good_society_bulk_permissions_panel_grid`). Validates: header with search and type filter, user-column header row, type-grouped actor sections (Majors and Connections), permission pills in four states (OWN filled, read outlined, no NONE/LIMITED in the visible rows for clarity), two pending-change cells with terracotta outlining and "changed" labels, row tinting on changed rows, footer with pending count pill and save/discard actions.

The cross-theme rendering on actor names (Cormorant for Rose, Didot for Avril, Cinzel for Dixon, Lora for connections) holds even at the panel's small actor-row scale. Each actor reads as themselves in the matrix even though the chrome is uniform.

## Changelog

| Date       | Change                                                                |
|------------|-----------------------------------------------------------------------|
| 2026-05-05 | File created. Full grid layout specified, cell interactions specified, save-once pending-change pattern specified, per-row and per-column quick actions specified. Visual proof rendered with two pending changes shown in highlighted state. |
