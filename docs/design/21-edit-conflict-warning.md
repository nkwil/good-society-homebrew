# 21 — Edit-Conflict Warning

**Status:** Locked — three-layer system specified, conflict resolution flow specified, fallback behavior specified
**Date opened:** 2026-05-05
**Covers inventory entry:** #24 Edit-conflict warning

## Goal

Specify the system that prevents simultaneous edits on shared Connection actors from silently clobbering each other (Plan §12.7). Without protection, two users editing the same field on a shared-pool Connection both type, both save, and the last save wins — the first user's work disappears with no notice.

The fix is a three-layer system, ordered by intrusiveness:

1. **Awareness banner** — a non-intrusive top-of-sheet banner showing other users currently viewing the same sheet.
2. **Field-level presence indicator** — a small inline badge on a specific field showing another user is actively editing it.
3. **Conflict warning toast** — a non-blocking warning that appears when a user's save would overwrite another user's saved-changes-since-they-opened, with three resolution options.

The three layers escalate from "informational" to "blocking-but-informative." Most edit conflicts get caught at layer 1 or 2; layer 3 is the safety net for the rare cases where two users are genuinely typing into the same field at the same time.

This is a *robustness* feature, not a performance feature. Edit conflicts on shared Connections are rare (Plan §12.7 calls them "particularly important" but acknowledges the typical frequency is low). The cost of the system is low; the value when conflicts do happen is significant.

## Why the layering matters

A single big "edit-locked by other user" modal would:
- Block productive solo editing 90% of the time when no conflict exists.
- Force users to coordinate ownership manually before editing.
- Add real friction to the shared-pool Connection model that's central to Good Society's structure.

A no-protection design (current Foundry default) would:
- Silently lose work in the rare conflict cases.
- Erode trust in the shared-pool model after the first lost edit.
- Force tables to stop using shared Connections out of self-preservation.

The three-layer approach is the middle path: most editing is unimpeded; conflict signals appear precisely when two users approach the same field; and the actual conflict resolution happens at save time with full information about what changed.

## Layer 1 — Awareness banner

CSS class root: `.gs-conflict-awareness-banner`

A small banner appearing at the top of any shared sheet when other users are also viewing/editing it.

### Layout

```
┌─────────────────────────────────────────────────┐
│ [O][N]  Opal and Natalie are also viewing Hats. │ ← banner
│                              shared connection   │
└─────────────────────────────────────────────────┘
```

- Background: `var(--gs-paper-warm)`.
- 0.5px border in `var(--gs-accent-3)` (honey-gold — informational).
- 2.5px left-edge accent in `var(--gs-accent-3)`.
- Padding: 8px 14px.
- `border-radius: 6px`.
- Sits at the very top of the sheet body, above all other content.

### Content

- **Avatar stack** on the left: small overlapping circles, one per other user currently viewing the sheet. Each circle 22×22px, 1.5px paper border (so they read as overlapping). Initial in display type 10px, color contrasting the user's chosen avatar color.
- **Banner text**: italic body type 12px, `var(--gs-ink)`. Format: "{User1} and {User2} are also viewing {actor name}." If only one other user, "{User} is also viewing {actor name}." If three or more, "{User1}, {User2}, and {N} others are viewing..."
- **Right-side label**: italic 10px in `var(--gs-accent-2)`, "shared connection" (or "shared NPC", "shared family" depending on actor type). The label confirms why this awareness is showing.

### Triggering

The banner appears when:
- The sheet is opened by the current user.
- One or more other users have the same sheet open.
- The sheet is on a shared-pool actor (any Connection, any NPC, any Family — not Major sheets, which have single-owner permissions).

### Real-time updates

The banner updates as users open/close the sheet. Subscribes to a custom socket message `goodSociety.sheetOpened` / `goodSociety.sheetClosed` that the sheet's `_onRender` and `_onClose` hooks emit.

### Dismissal

The banner is informational only — no action required. It dismisses when other users close the sheet, or when the current user closes their own.

A small × button in the corner lets the user manually dismiss for the current session if they find it distracting. The banner reappears on next sheet open.

## Layer 2 — Field-level presence indicator

CSS class root: `.gs-conflict-field-presence`

A small badge appearing next to a specific field when another user is actively editing it. "Actively" means: they have the field focused in their browser.

### Layout

The badge appears on the same row as the field's section header (top-right of the field):

```
┌─────────────────────────────────────────────┐
│ DESCRIPTION                  [O] Opal is editing ●
│                                                │
│ [textarea]                                     │
└─────────────────────────────────────────────┘
```

- Display: `display: flex; align-items: center; gap: 6px; padding: 2px 8px; background: var(--gs-paper-warm); border: 0.5px solid var(--gs-accent-3); border-radius: 100px;`
- Avatar circle: 14×14px, user's avatar color background, 9px display type initial in contrasting color.
- Italic 10px label: "{User} is editing".
- Pulsing dot (6×6px, `var(--gs-positive)` 80% opacity, very subtle pulse animation): visual cue that the indicator is *live*, not stale.

### Triggering

The badge appears when:
- Another user has the same sheet open.
- They have a focusable input on this specific field focused.

The badge disappears when:
- The other user blurs the field (clicks outside, switches fields, closes the sheet).
- The current user opens the same field for editing (the badge transfers to a different layer — see "Both users in same field" below).

### Real-time updates

Implementation uses a low-frequency custom socket message: when a user focuses a field, they emit `goodSociety.fieldFocused` with `{actorId, fieldName}`. Other clients listening to this socket update their indicators. On blur, `goodSociety.fieldBlurred` clears the indicator.

The 6×6px pulsing dot has a 1500ms pulse cycle to feel "breathing" without being attention-grabbing.

### Both users in the same field

If User A is editing a field and User B focuses the same field, B sees A's "Opal is editing" indicator. If both users start typing simultaneously:
- Their characters interleave in the input on their own screens (each user sees their own input).
- Neither user's typing is broadcast in real-time to the other (this isn't Google Docs).
- On save, the conflict-warning toast (Layer 3) catches the collision.

The indicator is a soft signal: "this might conflict, consider waiting" — not an enforcement.

### Why not real-time co-editing

True co-editing (operational transformation, CRDTs) would solve simultaneous edits but adds substantial implementation complexity. For Foundry's TTRPG context, two users typing into the same Description field on the same Connection is rare enough that the cost-benefit doesn't favor co-editing. The presence indicator + save-time warning is sufficient.

## Layer 3 — Conflict warning toast

CSS class root: `.gs-conflict-warning-toast`

The save-time warning that appears when a user's save would overwrite changes that another user has saved since the current user opened the sheet.

### Detection

When a user saves a field, the system compares:
- The field's value at the time the current user opened the sheet (stored as `originalValue` in the form's local state).
- The field's current value on the server.

If they differ, another user saved a change in the meantime. The current user's save would overwrite that change.

The check happens client-side using a version stamp on each field — Foundry's actor updates carry a timestamp that the form remembers at open time and compares against on save.

### Layout

```
┌──────────────────────────────────────────────────┐
│ [⚠]  Conflict detected                            ×│
│      Opal saved changes to Description while       │
│      you were editing. Saving now will overwrite  │
│      Opal's changes.                                │
│                                                      │
│      [keep mine ↗]  [use theirs]  [show diff]      │
└──────────────────────────────────────────────────┘
```

- Background: `var(--gs-paper)`.
- 0.5px border in `var(--gs-accent-3)`.
- 3px left-edge accent in `var(--gs-accent-1)` (terracotta — caution).
- `border-radius: 10px`.
- Padding: 14px 18px.
- Drop shadow: `box-shadow: 0 2px 8px rgba(20, 12, 14, 0.2);` — gives the toast lift over the underlying sheet.
- Width: 480px (smaller than a full modal — signals "non-blocking").

### Content

- **Warning icon**: 32×32px circle in `var(--gs-accent-1)` (terracotta) with a paper-color "!" character centered. Visual at-a-glance "this is important."
- **Title**: display type Lora, 15px, color `var(--gs-brand)`. "Conflict detected".
- **Body**: italic body type, 12px, line-height 1.55, color `var(--gs-ink)`. Format: "{User} saved changes to {field name} while you were editing. Saving now will overwrite {User}'s changes."
- **Three action buttons**:
  - **keep mine ↗** — primary filled. Saves the current user's value, overwriting the other's change. The arrow indicates this triggers a save.
  - **use theirs** — secondary outline. Reloads the other user's value into the form, discarding the current user's edits.
  - **show diff** — secondary outline. Opens a diff view (see below) for comparing both versions side by side.
- **× dismiss button**: top-right corner. Dismisses the toast without saving — the current user's edits remain in the form, the other user's value remains on the server. The user can edit further and save again later (with the conflict potentially re-detected).

### Position

The toast appears as a floating element in the bottom-right of the affected sheet (or center-screen for full-screen modals like the Upkeep Wizard). Doesn't block underlying sheet interaction — non-blocking.

If multiple conflict warnings stack (rare), they queue vertically with 8px gap.

### Auto-dismiss

The toast does NOT auto-dismiss on a timer. It stays until the user takes action. Auto-dismissing a conflict warning could result in lost edits if the user misses it.

### Why "non-blocking"

Plan §12.7 specifies non-blocking. The toast doesn't prevent the user from continuing to edit other fields, switching tabs, or doing anything else with the sheet. It's a *signal* that requires resolution, not a *gate* that blocks all action.

The trade-off: a user could continue editing and never resolve the conflict, leaving the toast indefinitely. **Tentative answer**: if the toast is dismissed without action and the user makes another save attempt, the conflict re-detects and a fresh toast appears.

## Diff resolution view

When the user clicks "show diff" on the conflict warning toast, a focused diff view opens.

CSS class root: `.gs-conflict-diff-view`

### Layout

```
┌────────────────────────────────────────────────────┐
│ Diff · Description on Mr. Hats McHats               │
├────────────────────────────────────────────────────┤
│ YOUR VERSION              │  OPAL'S VERSION         │
│ ┌─────────────────────┐ │ ┌─────────────────────┐ │
│ │ Skilled, reliable,  │ │ │ Skilled, reliable,  │ │
│ │ friendly. Began...  │ │ │ friendly. Began...  │ │
│ │                     │ │ │                     │ │
│ │ [+ added text]      │ │ │ [- removed text]    │ │
│ └─────────────────────┘ │ └─────────────────────┘ │
├────────────────────────────────────────────────────┤
│       [keep mine]  [use theirs]  [merge manually]  │
└────────────────────────────────────────────────────┘
```

A modal (this one *is* blocking — diff resolution requires focus). Two-column layout showing both versions side by side. Differences highlighted: additions in `var(--gs-positive)` background, removals in `var(--gs-danger)` background, line-by-line.

The diff uses a simple line-based comparison (no token-level diffing for v1 — line-based is sufficient for prose fields).

### Resolution actions

Three buttons in the diff modal footer:
- **keep mine** — saves the current user's version.
- **use theirs** — discards current user's changes and adopts the other version.
- **merge manually** — opens the field in an inline editor with both versions' text concatenated; the user can edit to a merged version and save.

### Why diff is optional

Most users will pick "keep mine" or "use theirs" without needing to see the diff. The diff is for the rare case where the changes are subtle enough that the user wants to inspect before deciding.

## Lock-based fallback

For users whose Foundry version doesn't support custom socket events reliably (older versions, certain hosting environments), the system falls back to a simpler lock-based approach:

- **Soft lock**: when a user opens a sheet, set a flag `flags["good-society-homebrew"].lockedBy: userId, lockedAt: timestamp`.
- **Lock timeout**: 5 minutes of inactivity, after which the lock expires automatically.
- **Lock indicator**: instead of awareness banner, display "Mr. Hats McHats is being edited by Opal." with an "edit anyway" override button.
- **Override**: clicking "edit anyway" sets the lockedBy to the current user, displacing the previous lock. The previous lock-holder's next save attempt triggers the conflict toast (Layer 3) as if real-time presence had been working.

This fallback works even without the socket event infrastructure. The trade-off: the awareness is sheet-level only (no field-level), and locks can stale before the timeout (e.g. user gets distracted but doesn't close the sheet).

The fallback is automatic — the system detects whether socket events are reaching other clients and falls back to locks if not.

## Theme behavior

All three layers are **house-styled chrome**. The conflict warning is system-level information, not a character voice.

The user avatars in the awareness banner use the user's own avatar color (Foundry's user system has a `color` field). The pulsing dot in the field presence indicator uses `var(--gs-positive)` (verdant) for visual liveness.

## Edge cases

### User edits a field and switches to another field without saving
Auto-saves on blur (Foundry default for most form fields). The save check runs at blur time. If a conflict is detected, the toast appears.

### Two users edit different fields simultaneously
No conflict. Layer 2's presence indicators show on the respective fields. Both saves succeed independently.

### Three or more users editing the same field
Same as two-user case for the conflict warning. The warning text updates to "{N} other users have changed this field."

### User opens a sheet, makes edits, gets disconnected, reconnects
On reconnect, the system re-evaluates the field's current server state. If changes have happened, the toast appears for fields where the local edits would conflict.

### User closes a sheet without saving (form has dirty changes)
Foundry's default behavior is to prompt "Save changes before closing?" If the user clicks Save, the standard conflict check runs. If Discard, the changes are lost; no conflict possible.

### Conflict on a HTML editor (rich text)
Same logic, but the diff view shows pre-rendered HTML for both versions. The "merge manually" path opens the HTML editor with both versions concatenated.

### Conflict on a non-text field (number, dropdown, toggle)
The diff view is simpler — just shows "Yours: {value}, Theirs: {value}". The "merge manually" option is hidden (no merge sense for atomic values).

### User saves their own changes twice in a row (no other user involved)
No conflict. Save just succeeds.

### Multiple conflicts on the same sheet save
Each conflicted field generates its own toast. Toasts queue vertically. Each is resolved independently.

## Implementation notes for Claude Code

When prompted to build the conflict warning system:

1. Build the socket event infrastructure first. Custom messages: `goodSociety.sheetOpened`, `goodSociety.sheetClosed`, `goodSociety.fieldFocused`, `goodSociety.fieldBlurred`. Handlers in `module/hooks/conflict-detection.js`.
2. Build the awareness banner partial. Wire to socket events for "sheet opened by other user." Test by opening the same Connection in two browser tabs as different users.
3. Build the field presence indicator. Wire to focus/blur events. Test by focusing a textarea in one tab and seeing the indicator appear in the other.
4. Build the conflict detection on save. Compare local `originalValue` against server timestamp. Show the conflict toast if mismatch.
5. Build the diff view modal. Use a simple line-based diff library (e.g. `diff-match-patch` or similar — small dependency).
6. Build the lock-based fallback. Detect socket reliability via a heartbeat ping.

CSS organization:
- `styles/components/_conflict-awareness-banner.css`
- `styles/components/_field-presence-indicator.css`
- `styles/apps/_conflict-warning-toast.css`
- `styles/apps/_conflict-diff-view.css`

### Test path

1. As GM, open Mr. Hats McHats's Connection sheet. Verify no banner.
2. As Opal (in another browser tab/profile), open the same sheet. Verify the awareness banner appears in both views.
3. As Opal, focus the Description field. Verify the presence indicator appears in the GM's view.
4. As Opal, type and save. As GM, type a different change and save. Verify the GM gets the conflict toast.
5. Click "show diff" in the toast. Verify the modal opens with both versions side by side.
6. Click "use theirs" — verify the GM's edits are discarded and Opal's value is loaded.
7. Test "merge manually" — verify both versions concatenate into the editor for hand-merging.
8. Test the lock-based fallback by disabling socket events. Verify the awareness banner is replaced by a sheet-level lock indicator.

If 1–8 pass, the conflict warning system is production-ready.

## Open questions

1. **Should the awareness banner show all online users viewing the sheet, or only those who've recently interacted (focused fields)?** **Tentative answer: all viewing.** Lurking observers are still relevant context.

2. **Should the field presence indicator persist briefly after the other user blurs?** A 2-second linger so the current user can see "Opal just edited this field" even after blur. **Tentative answer: 1500ms linger then dismiss.** Long enough to be informative, short enough not to be misleading.

3. **Should "merge manually" use an interactive diff editor (where the user picks each change) or just concatenate text?** **Tentative answer: concatenate for v1.** Interactive diff editors are complex; concatenation is functional and easy to use even if rough.

4. **Should the system track WHO has the lock for the sheet and surface "transfer ownership" actions?** **Tentative answer: no.** Ownership is GM-controlled; locks are usage hints only.

5. **Should conflicts auto-resolve in favor of the most recent edit when the warning is dismissed without action?** **Tentative answer: no — keep edits in form local state; require explicit user action to save.** Auto-resolution erodes trust.

6. **Should conflict detection apply to Major character sheets or just shared-pool sheets?** Major sheets are typically owned by one user, so conflicts are rare. **Tentative answer: enable for all actor types** so the protection generalizes; the system is no-op when only one user has access.

7. **Should the conflict toast also offer a "merge automatically" option for simple text additions?** If both users only added text (no overlapping edits), the system could auto-concatenate. **Tentative answer: defer to v1.1.** Auto-merge is hard to get right and may cause subtle lost edits if it merges wrong.

## Visual proof

Three layers of the conflict system are rendered above (`good_society_edit_conflict_warning_three_layers`):

1. **Awareness banner** — top-of-sheet banner showing two other users (Opal, Natalie) viewing Hats McHats. Avatar stack, italic banner text, "shared connection" label.
2. **Field-level presence indicator** — a Description field with a small "Opal is editing" badge in the section header row, including the pulsing dot.
3. **Conflict warning toast** — the warning that appears when save would clobber. Warning icon, title, body explaining the conflict, three resolution actions (keep mine / use theirs / show diff), dismiss button.

Validates: the visual hierarchy of the three layers (each more prominent than the last), the antique-but-clean restraint even on warnings, the actionability of the resolution options.

## Changelog

| Date       | Change                                                                |
|------------|-----------------------------------------------------------------------|
| 2026-05-05 | File created. Three-layer conflict system specified: awareness banner, field-level presence, and save-time conflict warning toast. Diff resolution view specified. Lock-based fallback for environments without reliable socket events. Visual proof rendered for all three layers. |
