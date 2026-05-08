/**
 * Session Events — tracks mechanical events during a play session.
 *
 * Events accumulate in a world-scoped setting ('sessionEvents') until the GM
 * clicks "End Session," at which point the Session Log preview modal reads them,
 * generates a journal entry, and calls clearSessionEvents() to reset for the
 * next session.
 *
 * Only GM clients append events. Non-GM users do not have world-setting write
 * access, so all appendSessionEvent calls are guarded by game.user.isGM.
 *
 * This module also calls appendPendingChange (from helpers/pending-changes.js)
 * to populate the per-actor reputation log that the Upkeep Wizard reads. That
 * call is also GM-gated (same single-writer rationale).
 *
 * Anti-pattern reminder (CLAUDE.md §16): events live on the world setting, NOT
 * on actor flags. Each actor's per-cycle reputation changes live on
 * actor.system.reputation.pendingChanges (populated by the same hooks here).
 */

import { appendPendingChange, buildSceneLabel, syncPendingChangeName } from '../helpers/pending-changes.js';

const NS = 'good-society-homebrew';
const KEY = 'sessionEvents';

/** Append one structured event to the world-scoped session event log. */
export async function appendSessionEvent(event) {
  if (!game.user?.isGM) return;
  const existing = (() => {
    try { return game.settings.get(NS, KEY); }
    catch { return []; }
  })();
  if (!Array.isArray(existing)) return;
  await game.settings.set(NS, KEY, [
    ...existing,
    { ...event, timestamp: Date.now() },
  ]);
}

/** Read all current session events. Returns an array (may be empty). */
export function getSessionEvents() {
  try { return game.settings.get(NS, KEY) ?? []; }
  catch { return []; }
}

/** Clear all session events after the log has been saved. */
export async function clearSessionEvents() {
  if (!game.user?.isGM) return;
  await game.settings.set(NS, KEY, []);
}

export function register() {
  // Cycle phase transitions — fired by good-society.js cyclePhase.onChange
  Hooks.on('goodSociety.cyclePhaseChanged', async ({ newPhase }) => {
    await appendSessionEvent({ type: 'phaseChange', details: { newPhase } });
  });

  // Reputation items created/removed on Major actors
  Hooks.on('createItem', async (item) => {
    if (item.parent?.type !== 'major-character') return;
    if (item.type === 'reputation-tag') {
      const polarity = item.system?.polarity ?? 'positive';
      await appendSessionEvent({
        type: 'tagAdded',
        actorId: item.parent.id,
        actorName: item.parent.name,
        details: {
          tagName: item.name,
          polarity,
          source: item.system?.source ?? '',
        },
      });
      await appendPendingChange(
        item.parent,
        polarity === 'positive' ? 'gained-positive' : 'gained-negative',
        item.name,
        buildSceneLabel(),
        item.id,  // tagId for rename-sync via updateItem hook below
      );
    } else if (item.type === 'reputation-condition') {
      await appendSessionEvent({
        type: 'conditionAdded',
        actorId: item.parent.id,
        actorName: item.parent.name,
        details: {
          conditionName: item.name,
          polarity: item.system?.polarity ?? 'positive',
        },
      });
    }
  });

  // Tag renames — re-sync any pendingChanges entry whose `value` was captured
  // at creation time with the placeholder name "New reputation-tag". The
  // createItem hook fires immediately, before the user has typed the real
  // name on the item sheet, so the entry is born stale. Listen on updateItem
  // and rewrite by tagId. GM-only (single-writer; matches appendPendingChange).
  Hooks.on('updateItem', async (item, change) => {
    if (item.type !== 'reputation-tag') return;
    if (item.parent?.type !== 'major-character') return;
    // Only react to name changes — other system field updates don't affect
    // pendingChanges value.
    if (!Object.prototype.hasOwnProperty.call(change, 'name')) return;
    await syncPendingChangeName(item.parent, item.id, item.name);
  });

  Hooks.on('deleteItem', async (item) => {
    if (item.type !== 'reputation-tag') return;
    if (item.parent?.type !== 'major-character') return;
    await appendSessionEvent({
      type: 'tagRemoved',
      actorId: item.parent.id,
      actorName: item.parent.name,
      details: {
        tagName: item.name,
        polarity: item.system?.polarity ?? 'positive',
      },
    });
    await appendPendingChange(item.parent, 'removed', item.name, buildSceneLabel());
  });

  // Monologues — fired from monologue-editor.js after posting the chat card
  Hooks.on('goodSociety.monologuePosted', async (data) => {
    await appendSessionEvent({
      type: 'monologue',
      actorId: data.actorId,
      actorName: data.actorName,
      details: { speakerName: data.speakerName, content: data.content },
    });
  });

  // Persona swaps — fired from persona-swap.js
  Hooks.on('goodSociety.personaSwitched', async (data) => {
    if (!data.personaName) return; // Clearing to true identity — not worth logging
    await appendSessionEvent({
      type: 'personaSwap',
      actorId: data.actorId,
      actorName: data.actorName,
      details: { personaName: data.personaName },
    });
  });
}
