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

import { appendPendingChange, buildSceneLabel, syncPendingChangeName, isUndoingPending } from '../helpers/pending-changes.js';

const NS = 'good-society-homebrew';
const KEY = 'sessionEvents';

/** Append one structured event to the world-scoped session event log.
 *  Auto-stamps `cycleNumber` (from the current world setting) and `timestamp`
 *  so consumers like the cycle divider can filter by cycle without callers
 *  having to remember to include it. Callers may pre-set either field to
 *  override. */
export async function appendSessionEvent(event) {
  if (!game.user?.isGM) return;
  const existing = (() => {
    try { return game.settings.get(NS, KEY); }
    catch { return []; }
  })();
  if (!Array.isArray(existing)) return;
  let cycleNumber = null;
  try { cycleNumber = game.settings.get(NS, 'cycleNumber'); } catch {}
  await game.settings.set(NS, KEY, [
    ...existing,
    { cycleNumber, ...event, timestamp: Date.now() },
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
      // Skip the append if THIS create is the result of an in-flight Undo
      // on this actor — otherwise undoing a "removed" entry would
      // immediately re-log it as "gained" and the cycle never settles.
      if (!isUndoingPending(item.parent.id)) {
        await appendPendingChange(
          item.parent,
          polarity === 'positive' ? 'gained-positive' : 'gained-negative',
          item.name,
          buildSceneLabel(),
          { tagId: item.id, polarity },
        );
      }
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
    if (!isUndoingPending(item.parent.id)) {
      await appendPendingChange(item.parent, 'removed', item.name, buildSceneLabel(), {
        tagId:    item.id,
        polarity: item.system?.polarity ?? 'positive',
      });
    }
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

/* ── Pretty-print helpers ─────────────────────────────────────────────────────
 *
 * Session events are stored as compact `{type, actorName, details}` objects
 * — the cycle divider (and any future log / digest surface) needs them as
 * readable prose. The map below translates each event type into a
 * (heading, summary) pair. Falls back to the raw type when an unknown
 * shape is encountered, so adding a new event type is a one-line addition
 * to the switch rather than a sprawl across renderers. */

/** Human-readable section heading for a given event type. */
export function eventTypeHeading(type) {
  const KEY = `GOODSOCIETY.sessionEvent.heading.${type}`;
  const txt = game.i18n.localize(KEY);
  return (txt && txt !== KEY) ? txt : type;
}

/** Build a single-line HTML-safe summary for an event row. */
export function formatSessionEventSummary(ev) {
  // If the event was already authored with a summary (e.g. random-event
  // resolved), respect it.
  if (typeof ev?.summary === 'string' && ev.summary.trim()) return ev.summary;

  const d = ev?.details ?? {};
  const actor = ev?.actorName ? `<strong>${ev.actorName}</strong>` : '';
  switch (ev?.type) {
    case 'phaseChange': {
      const phaseKey = `GOODSOCIETY.cyclePhase.${_phaseKey(d.newPhase)}`;
      const label = game.i18n.localize(phaseKey);
      const phaseLabel = (label && label !== phaseKey) ? label : (d.newPhase ?? 'unknown');
      return game.i18n.format('GOODSOCIETY.sessionEvent.fmt.phaseChange', { phase: phaseLabel });
    }
    case 'tagAdded': {
      const arrow = d.polarity === 'negative' ? '▼' : '▲';
      return game.i18n.format('GOODSOCIETY.sessionEvent.fmt.tagAdded', {
        actor: actor || '—',
        arrow,
        tag: d.tagName ?? '?',
      });
    }
    case 'tagRemoved': {
      const arrow = d.polarity === 'negative' ? '▼' : '▲';
      return game.i18n.format('GOODSOCIETY.sessionEvent.fmt.tagRemoved', {
        actor: actor || '—',
        arrow,
        tag: d.tagName ?? '?',
      });
    }
    case 'conditionAdded': {
      const arrow = d.polarity === 'negative' ? '▼' : '▲';
      return game.i18n.format('GOODSOCIETY.sessionEvent.fmt.conditionAdded', {
        actor: actor || '—',
        arrow,
        condition: d.conditionName ?? '?',
      });
    }
    case 'monologue':
      return game.i18n.format('GOODSOCIETY.sessionEvent.fmt.monologue', {
        actor: actor || '—',
      });
    case 'personaSwap':
      return game.i18n.format('GOODSOCIETY.sessionEvent.fmt.personaSwap', {
        actor: actor || '—',
        persona: d.personaName ?? '?',
      });
    default:
      return ev?.type ?? '—';
  }
}

/** Map a cyclePhase enum value to the lang-key fragment used by the registry
 *  (cyclePhase.preCycle / .rumourScandal etc.). */
function _phaseKey(phase) {
  switch (phase) {
    case 'pre-cycle':      return 'preCycle';
    case 'rumour-scandal': return 'rumourScandal';
    default:               return phase ?? '';
  }
}
