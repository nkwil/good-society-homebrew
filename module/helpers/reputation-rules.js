/**
 * Reputation rule helpers.
 *
 * Inner-conflict completion rule: 6 boxes total OR 5 on one side (§4 locked).
 * Reputation threshold trigger: fires ConditionPicker when a Major reaches
 * exactly 3 tags of one polarity and promptOnThreeTags is true.
 *
 * Exports:
 *   checkThresholdAndPrompt(actor, polarity)  — call after any tag-add event.
 *   isConflictComplete(leftBoxes, rightBoxes)  — pure rule check.
 */

// Lazy import to avoid loading the picker module until it's needed.
let _openConditionPickerFn = null;
async function _getOpenFn() {
  if (!_openConditionPickerFn) {
    const mod = await import('../apps/condition-picker.js');
    _openConditionPickerFn = mod.openConditionPicker;
  }
  return _openConditionPickerFn;
}

// ── Threshold check ────────────────────────────────────────────────────────

/**
 * Reconcile a Major actor's reputation-tag threshold for one polarity.
 *
 * Opens the Condition Picker when the actor has just reached exactly 3 tags
 * of the given polarity. Also self-heals the `pickerResolved` flag: when the
 * count drops below 3 the flag is cleared, so a fresh climb back to 3 will
 * re-prompt (tags get traded / erased every Reputation Phase).
 *
 * Safe to call after every tag-add OR tag-remove operation.
 *
 * @param {Actor}  actor    Major Character actor.
 * @param {string} polarity 'positive' | 'negative'
 */
export async function checkThresholdAndPrompt(actor, polarity) {
  // Only act for the actor's owner (not for every client seeing the hook)
  if (!actor?.isOwner) return;

  const resolvedFlag = `pickerResolved.${polarity}`;

  // Count tags of the matching polarity directly from embedded items
  const tags = actor.items?.filter(
    i => i.type === 'reputation-tag' && i.system?.polarity === polarity,
  ) ?? [];

  // Below threshold — clear any stale resolved flag so the next climb to 3
  // re-prompts. This is the only place the flag is auto-cleared.
  if (tags.length < 3) {
    if (actor.getFlag('good-society-homebrew', resolvedFlag)) {
      try {
        await actor.unsetFlag('good-society-homebrew', resolvedFlag);
      } catch { /* non-fatal */ }
    }
    return;
  }

  // At/above threshold — open the picker only at exactly 3, when enabled,
  // and when this polarity hasn't already been resolved.
  try {
    const enabled = game.settings.get('good-society-homebrew', 'promptOnThreeTags');
    if (!enabled) return;
  } catch { return; }

  if (tags.length !== 3) return;
  if (actor.getFlag('good-society-homebrew', resolvedFlag)) return;

  try {
    const open = await _getOpenFn();
    open(actor, polarity, tags);
  } catch (err) {
    console.error('GS | condition picker open failed:', err);
  }
}

// ── Inner conflict completion rule ─────────────────────────────────────────

/**
 * Returns true when an inner conflict should be marked complete.
 * Rule (§4 locked): 6 boxes total OR 5 on one side.
 *
 * @param {boolean[]} leftBoxes   Array of 5 booleans.
 * @param {boolean[]} rightBoxes  Array of 5 booleans.
 * @returns {boolean}
 */
export function isConflictComplete(leftBoxes, rightBoxes) {
  const leftCount  = leftBoxes.filter(Boolean).length;
  const rightCount = rightBoxes.filter(Boolean).length;
  return (leftCount + rightCount >= 6) || leftCount >= 5 || rightCount >= 5;
}
