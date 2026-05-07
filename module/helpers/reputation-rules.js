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
 * Check whether a Major actor has just reached the reputation tag threshold
 * (exactly 3 tags of the given polarity) and open the Condition Picker if so.
 *
 * Safe to call after every tag-add operation — silently returns when the
 * threshold hasn't been hit or the setting is disabled.
 *
 * @param {Actor}  actor    Major Character actor.
 * @param {string} polarity 'positive' | 'negative'
 */
export async function checkThresholdAndPrompt(actor, polarity) {
  try {
    const enabled = game.settings.get('good-society-homebrew', 'promptOnThreeTags');
    if (!enabled) return;
  } catch { return; }

  // Only open for the actor's owner (not for every client seeing the hook)
  if (!actor.isOwner) return;

  // Skip if already resolved for this polarity (player chose "no condition")
  const resolvedFlag = `pickerResolved.${polarity}`;
  if (actor.getFlag('good-society-homebrew', resolvedFlag)) return;

  // Count tags of the matching polarity directly from embedded items
  const tags = actor.items?.filter(
    i => i.type === 'reputation-tag' && i.system?.polarity === polarity,
  ) ?? [];

  if (tags.length !== 3) return;

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
