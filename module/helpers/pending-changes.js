/**
 * pending-changes.js — per-actor reputation change log helpers.
 *
 * `actor.system.reputation.pendingChanges` accumulates tag gains/removals
 * between Upkeep phases. The Upkeep Wizard's Reputation Review step reads the
 * array; this module writes it.
 *
 * All writes are GM-only (single-writer pattern, same as session-events.js).
 * The Foundry `createItem`/`deleteItem` hooks fire on every client; without the
 * GM guard, both the GM client and the owning player's client would append,
 * producing duplicate entries.
 */

const NS = 'good-society-homebrew';

/** Map cyclePhase setting values → their i18n key suffix. */
const PHASE_KEY = {
  'pre-cycle':      'preCycle',
  'novel':          'novel',
  'reputation':     'reputation',
  'rumour-scandal': 'rumourScandal',
  'epistolary':     'epistolary',
  'upkeep':         'upkeep',
  'ended':          'ended',
};

/**
 * Build a human-readable cycle + phase label for pendingChange entries.
 * Example: "Cycle 5 · Novel Phase"
 * Falls back to "—" if settings aren't registered yet (first load).
 */
export function buildSceneLabel() {
  try {
    const cycle = game.settings.get(NS, 'cycleNumber') ?? 1;
    const phase = game.settings.get(NS, 'cyclePhase') ?? 'pre-cycle';
    const keyPart = PHASE_KEY[phase] ?? phase;
    const phaseLabel = game.i18n.localize(`GOODSOCIETY.cyclePhase.${keyPart}`);
    const cycleLabel = game.i18n.localize('GOODSOCIETY.cycle.label');
    return `${cycleLabel} ${cycle} · ${phaseLabel}`;
  } catch {
    return '—';
  }
}

/**
 * Append one pending reputation change to a Major actor's log.
 *
 * `tagId` lets a later updateItem hook re-sync `value` when the source tag
 * gets renamed after creation (the createItem hook fires while the tag still
 * has its placeholder name "New reputation-tag", before the user has typed
 * the real name on the item sheet). When tagId is omitted (e.g. the entry
 * doesn't correspond to a single source item) the rename-sync simply skips it.
 *
 * @param {Actor}  actor      Must be type 'major-character'.
 * @param {string} kind       'gained-positive' | 'gained-negative' | 'removed'
 * @param {string} tagName    Display name of the tag at append time.
 * @param {string} sceneLabel Human-readable context (from buildSceneLabel()).
 * @param {string} [tagId]    Optional — the source reputation-tag's ID.
 */
export async function appendPendingChange(actor, kind, tagName, sceneLabel, tagId = '') {
  if (!game.user?.isGM) return;
  if (actor.type !== 'major-character') return;
  const current = actor.system.reputation?.pendingChanges ?? [];
  await actor.update({
    'system.reputation.pendingChanges': [
      ...current,
      { kind, value: tagName, tagId, scene: sceneLabel, ts: Date.now() },
    ],
  });
}

/**
 * Re-sync the `value` field of every pendingChange entry whose `tagId`
 * matches the given reputation-tag item. Called from session-events.js's
 * updateItem hook when a tag's name changes after creation. GM-only.
 *
 * @param {Actor}  actor       Major Character actor.
 * @param {string} tagId       The renamed item's ID.
 * @param {string} newTagName  New display name to write.
 */
export async function syncPendingChangeName(actor, tagId, newTagName) {
  if (!game.user?.isGM) return;
  if (actor.type !== 'major-character') return;
  if (!tagId) return;
  const current = actor.system.reputation?.pendingChanges ?? [];
  let dirty = false;
  const next = current.map(entry => {
    if (entry.tagId === tagId && entry.value !== newTagName) {
      dirty = true;
      return { ...entry, value: newTagName };
    }
    return entry;
  });
  if (!dirty) return;
  await actor.update({ 'system.reputation.pendingChanges': next });
}

/**
 * Clear all pending reputation changes on a Major actor.
 * Called by the Upkeep Wizard step 5 after the player acknowledges the review,
 * and by the Reputation Phase Wizard on completion.
 */
export async function clearPendingChanges(actor) {
  if (!game.user?.isGM) return;
  if (actor.type !== 'major-character') return;
  await actor.update({ 'system.reputation.pendingChanges': [] });
}
