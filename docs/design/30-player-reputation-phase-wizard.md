# 30 — Player Reputation Phase Wizard

**Status:** Drafted, ready for Claude Code implementation
**Date opened:** 2026-05-07
**Covers:** Player-facing counterpart to the GM-only Reputation Phase Wizard shipped in B-6b/2 (`c0d2592`). Adds a per-Major guided flow for non-GM users plus real-time sync between the player wizards and the GM's existing wizard.

## Why

B-6b/2 shipped the GM-driven shared wizard (`module/apps/reputation-phase-wizard.js`) per `29-reputation-batch.md` §2. Players currently see only a toast notification when the phase advances — the GM walks them through round-robin via the GM wizard.

Natalie wants players to drive their own reputation work for their assigned Majors, with the GM's wizard reflecting their progress in real time. This doc specifies that player-side flow.

The GM wizard stays as-is — it remains the facilitator's coach view. The player wizards are independent per-Major modals that share the same underlying data (everything mutates `actor.system` and embedded items), so Foundry's WebSocket replication handles cross-client data sync automatically. The "real-time" deliverable is making both wizards re-render when actor data changes, not implementing a new sync layer.

## Architecture

### Player wizard: per-Major queue (mirrors Upkeep)

Same shape as `module/apps/upkeep-wizard.js` + `module/hooks/upkeep.js`:

- New `PlayerReputationPhaseWizard` class — framed ApplicationV2, one instance per Major (id: `gs-player-rep-wizard-{actor.id}`).
- New `module/hooks/reputation-phase.js#onReputationPhaseStart()` branch:
  - GM (existing): opens the shared GM wizard.
  - Non-GM with owned Majors (new): opens the per-Major queue sequentially via the same Promise-chain pattern Upkeep uses (`_openSequential`).
  - Non-GM with no owned Majors (existing): toast.
- HUD re-open: clicking the `rep` marker on the Cycle HUD (positions 2 OR 6) re-opens the queue regardless of completion flag, mirroring the upkeep-marker click pattern shipped in `b0a601e`.

### Real-time sync (both directions)

Both wizards listen for `createItem` / `deleteItem` / `updateItem` hooks on Foundry's hook bus. When an event fires for a `reputation-tag` or `reputation-condition` whose parent actor is in the wizard's scope, the wizard re-renders. This is "real-time" within Foundry's WebSocket round-trip latency (~50-100ms).

No additional sync layer needed — every mutation in either wizard already goes through `createEmbeddedDocuments` / `deleteEmbeddedDocuments` / `actor.update`, which broadcast automatically.

## Steps

The player wizard runs per Major. Five steps, modeled on Upkeep's step pattern (welcome → work → complete):

1. **Welcome.** Brief explanation: "This is the Reputation phase for {character.name}. Update their reputation tags and conditions based on what's happened this cycle." Read-only summary card showing current tag counts (positive / negative) and any active conditions.

2. **Assess criteria.** Read-only display of the character's reputation criteria — both the universal four (act on desire vs duty, contravene convention, fulfill duty over desire, obey convention with hardship) and the family's two unique criteria (positive + negative, sourced from the Family actor's `uniqueNegativeRepCriteria` and a future positive counterpart). Player reflects; no input on this step.

3. **Add tags.** Inline tag-create form: name input + polarity radio (`▲ positive` / `▼ negative`) + Add button. Lists current tags with × buttons to remove. Mirrors the GM wizard's step 2 right-pane (`#addTag` / `#removeTag` actions). Actions hit the same `createEmbeddedDocuments` / `deleteEmbeddedDocuments` paths the GM wizard uses, so the GM's wizard re-renders on the events.

4. **Conditions.** Two sub-cards:
   - **Trigger:** if `tagCount(polarity) >= 3` for some polarity AND no active condition AND `pickerResolved.${polarity}` flag is unset, show a "Choose your reputation condition" button that opens the existing `ConditionPicker` for that polarity. Picker handles the rest (writes condition + sets resolved flag + posts chat card).
   - **Clear:** if an active condition exists AND `tagCount(polarity) < 3`, show "Clear: {condition.name}" button. Click deletes the condition + clears the resolved flag + posts a system card. Reuses the GM wizard's `#clearCondition` logic — extract to a helper if both wizards call it.

5. **Complete.** Summary list of what changed (tags added/removed, condition triggered, condition cleared) — derived from comparing pre-wizard state to current state. "Complete reputation phase" button:
   - Sets `reputationPhaseCompletedAt` flag on the actor (parallel to `upkeepCompletedAt`).
   - Posts system card via `postSystemCard`.
   - Closes wizard, advances queue to next owned Major.

When all owned Majors are complete, the queue ends with no further prompt. Players who reload mid-phase get re-queued via the `Hooks.once('ready')` re-open path in `register()`, but completed Majors are skipped (matching Upkeep's pattern).

## Files to add / change

| File | Action | Notes |
|---|---|---|
| `module/apps/player-reputation-phase-wizard.js` | NEW | ~280 lines. Mirrors `upkeep-wizard.js` structure. |
| `templates/apps/player-reputation-phase-wizard.hbs` | NEW | ~220 lines. Single-root `<section>`. |
| `styles/apps/_player-reputation-phase-wizard.css` | NEW | ~150 lines. |
| `styles/good-society.css` | MODIFY | `@import` the new CSS. |
| `module/hooks/reputation-phase.js` | MODIFY | Replace player toast with `_openSequential` queue (Upkeep pattern). Add `reopenReputationPhaseFlow()` export. |
| `module/apps/cycle-hud.js` | MODIFY | Add delegated click handler for `.gs-phase-marker[data-phase="reputation"]` → calls `reopenReputationPhaseFlow()`. Both occurrence positions (2 + 6) qualify since the marker uses the same `data-phase`. |
| `styles/components/_phase-marker.css` | MODIFY | Add cursor + hover styles for `[data-phase="reputation"]` matching the upkeep marker pattern. |
| `module/apps/reputation-phase-wizard.js` (GM) | MODIFY | Add hook listeners in `_onRender` / `_onClose` for `createItem`/`deleteItem`/`updateItem` on Majors in `_activeCharacters`. Re-render on match. Avoid hook-leak by tracking handler IDs and detaching in `_onClose`. |
| `module/data-models/major-character.js` | NO CHANGE NEEDED | `reputationPhaseCompletedAt` lives on flags, same pattern as `upkeepCompletedAt`. |
| `lang/en.json` | MODIFY | New `GOODSOCIETY.playerReputationPhaseWizard.*` keys. Validate top-level keys after edit per §16. |
| `CLAUDE.md` §14 | MODIFY | Add B-6b/7 entry under Done. |
| `CLAUDE.md` §15 | MODIFY | Log any non-trivial design decisions. |

## Real-time sync implementation detail

In both wizards' `_onRender`, attach hook listeners; in `_onClose`, detach. Track handler IDs as instance properties. Single capture-phase delegated approach is overkill for ApplicationV2 (re-renders are managed; refs stay valid for the lifetime of the instance) — direct `Hooks.on` works.

```js
/** @override */
_onRender(context, options) {
  super._onRender?.(context, options);
  this._attachActorWatchers();
}

/** @override */
async _onClose(options) {
  this._detachActorWatchers();
  return super._onClose(options);
}

_attachActorWatchers() {
  if (this._watchers) return;
  const onChange = (item, _change) => {
    if (item.parent?.type !== 'major-character') return;
    if (!this._isInScope(item.parent)) return;
    if (item.type !== 'reputation-tag' && item.type !== 'reputation-condition') return;
    this.render({ force: false });
  };
  this._watchers = [
    Hooks.on('createItem', onChange),
    Hooks.on('updateItem', onChange),
    Hooks.on('deleteItem', onChange),
  ];
}

_detachActorWatchers() {
  if (!this._watchers) return;
  Hooks.off('createItem', this._watchers[0]);
  Hooks.off('updateItem', this._watchers[1]);
  Hooks.off('deleteItem', this._watchers[2]);
  this._watchers = null;
}
```

For the GM wizard, `_isInScope(actor)` checks `this._activeCharacters.has(actor.id)`. For the player wizard, `_isInScope(actor)` is `actor.id === this._actor.id` (single-Major scope).

Render is debounced naturally by ApplicationV2's render queue, but if rapid bursts cause flicker, add a 50ms debounce wrapper.

## HUD re-open: handle both reputation positions

The HUD's `.gs-phase-marker` carries `data-phase="reputation"` on both position 2 AND position 6. The delegated click handler in `cycle-hud.js` only needs to match `[data-phase="reputation"]` — same as the existing upkeep-marker handler — and call `reopenReputationPhaseFlow()`.

Note: don't switch the player wizard's BEHAVIOR based on which position it is. Both reputation phases run the same 4 steps; the wizard doesn't need to know whether it's the first or second occurrence in the cycle. Position-awareness lives only in the HUD's display layer (`²` suffix, etc.).

## Coordination with the GM wizard's existing flow

The GM wizard remains exactly as it is. Its round-robin coach view stays useful as a parallel surface — the GM might want to "look in" on a player while they work. The two wizards don't lock each other out:

- A player adds a tag → both their wizard AND the GM's wizard re-render (if focused on that character).
- The GM adds a tag from their wizard → the player's wizard re-renders too (if open and focused).
- The GM and a player can both be on step 3 (conditions) for the same character simultaneously. The condition picker is per-actor + per-polarity (existing) so duplicate triggers are guarded.

The `pickerResolved.${polarity}` flag and the active-condition existence check together prevent double-creation. Both wizards check both before showing the trigger button.

## Anti-pattern reminders for this batch

Most of `CLAUDE.md` §16 already applies via the existing wizard. Specifically watch for:

- **Hook leak.** Always detach in `_onClose`. Wizards that fail to detach watcher hooks accumulate over re-renders and start firing stale handlers against closed instances.
- **`form.submitOnChange` audit.** The tag-name input on step 3 needs the same audit as everywhere else — if it has `name=""`, it must target the field whose value it displays. Recommended: leave the input nameless and read it imperatively from the action handler (matches the GM wizard's `#addTag`).
- **Single-root PART template.** New HBS file must have exactly one root element.
- **JSON nesting.** New `playerReputationPhaseWizard` block must land inside `GOODSOCIETY`, not at root. Validate with `python3 -c "import json; print(list(json.load(open('lang/en.json')).keys()))"` after edits — top-level keys must remain `['BOILERPLATE', 'GOODSOCIETY', 'TYPES']`.
- **Chat card flags.** Completion card and condition-clear card go through `postSystemCard` (sets `cardType` flag, prevents speaking-as hook from clobbering speaker).
- **No frameless wrapper for this wizard.** It's framed (window: { frame: true }) so the §16 frameless-positioning rules don't apply.

## Implementation order

Single commit, ~600 lines net. Suggested commit message: `B-6b/7: Player Reputation Phase Wizard + real-time sync`.

1. Build `PlayerReputationPhaseWizard` class + template + CSS.
2. Update `reputation-phase.js` to queue player wizards on phase advance.
3. Add the `reopenReputationPhaseFlow()` export and HUD click handler.
4. Add the `_attachActorWatchers` / `_detachActorWatchers` pattern to BOTH wizards (player and GM).
5. Add lang keys, validate JSON.
6. Sanity-check by opening two browser windows (GM + player) on the same world: player adds a tag → GM's wizard re-renders the affected pane; GM adds a tag → player's wizard re-renders.
7. Update CLAUDE.md §14 + §15.

## Out of scope

- **Push notification** ("Player2 finished their Reputation phase!" toast on the GM client). Could be added trivially via the same hooks (post a chat card on `reputationPhaseCompletedAt` flag set), but not required for v0.
- **Locking.** No locking prevents the GM and a player from both editing the same character's tags simultaneously. Foundry's last-write-wins on actor.update is fine for v0; the wizards re-render on changes so neither user sees stale data for long.
- **Replay / undo.** Once a tag is created, removing it is the player's only "undo." No history/audit beyond the existing pendingChanges array.
- **Per-cycle completion clearing.** `reputationPhaseCompletedAt` clears on the next phase advance (or on the next reputation phase) — same way `upkeepCompletedAt` clears in `upkeep-roster.js#advanceCycle`. Mirror that pattern.
