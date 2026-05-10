/**
 * random-event.js — launch + resolution pipeline for the Random Event system.
 *
 * Two cross-client paths, both via Foundry's system socket on
 * `system.good-society-homebrew` (the same channel rumour-socket uses;
 * payloads are dispatched by `type` so they don't collide):
 *
 *   randomEvent.launch    GM → target Major's owner: open the player popover
 *   randomEvent.resolved  any client → GM: append a session-events entry
 *
 * On resolve, the player creates the reputation-tag Item directly on their
 * owned actor (createItem hook → existing pendingChanges writer kicks in) and
 * posts the themed chat card. The GM-side session-events append is the only
 * cross-client coordination needed.
 */

import { profilePic } from './profile-pic.js';
import { themedWrap } from './themed-wrap.js';
import { appendSessionEvent } from '../hooks/session-events.js';

const NS = 'good-society-homebrew';
const SOCKET_NAME = `system.${NS}`;

// ──────────────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────────────

/**
 * GM-side: launch a random event at a Major character's owner.
 * Emits the launch payload over the system socket. Every connected client
 * receives it; the handler in `_processIncoming` filters to the target's owner.
 *
 * @param {Item}  eventItem   the random-event Item
 * @param {Actor} targetActor the target Major character
 */
export async function launchRandomEvent(eventItem, targetActor) {
  if (!game.user?.isGM) return;
  if (!eventItem || !targetActor) return;
  const payload = {
    type: 'randomEvent.launch',
    eventId: eventItem.id,
    actorId: targetActor.id,
    requestedBy: game.user.id,
  };
  // Emit + also process locally so the GM client itself sees the popover if
  // the GM happens to own the actor (rare but supported).
  if (game.socket) game.socket.emit(SOCKET_NAME, payload);
  _processIncoming(payload);
}

/**
 * Player-side: resolve the event with the strategies, rolls, and chosen tag.
 * Creates the reputation-tag Item on the actor, posts the themed chat card,
 * and emits a session-events ping to the GM client.
 *
 * @param {object} args
 * @param {Actor}  args.actor          owner-controlled Major
 * @param {Item}   args.event          the random-event Item
 * @param {string[]} args.strategies   length 3
 * @param {number[]} args.rolls        length 3 (1d20 each)
 * @param {string} args.chosenTag      the picked positive or negative tag
 * @param {'success'|'failure'} args.outcome
 */
export async function resolveRandomEvent({ actor, event, strategies, rolls, chosenTag, outcome }) {
  if (!actor || !event) return;
  const polarity = outcome === 'success' ? 'positive' : 'negative';

  // Create the reputation-tag Item on the actor. The session-events createItem
  // hook will append a pendingChange (GM-side single-writer, per B-6b/1).
  await actor.createEmbeddedDocuments('Item', [{
    name: chosenTag,
    type: 'reputation-tag',
    system: {
      polarity,
      description: '',
      source: game.i18n.format('GOODSOCIETY.randomEvent.tagSource', { event: event.name }),
    },
  }]);

  // Post the themed chat card with strategies, rolls, average, outcome.
  await _postRandomEventCard({ actor, event, strategies, rolls, chosenTag, outcome });

  // Tell the GM client to append a session-events entry for this resolution.
  const payload = {
    type: 'randomEvent.resolved',
    actorId: actor.id,
    eventId: event.id,
    eventName: event.name,
    chosenTag,
    outcome,
    average: _averageOf(rolls),
    requestedBy: game.user.id,
  };
  if (game.socket) game.socket.emit(SOCKET_NAME, payload);
  // If the resolver is the GM, append directly.
  if (game.user?.isGM) {
    try {
      await appendSessionEvent({
        type: 'randomEventResolved',
        actorId: actor.id,
        actorName: actor.name,
        details: {
          eventName: event.name,
          chosenTag,
          outcome,
          average: payload.average,
        },
      });
    } catch (err) { console.warn('GS | session-event append failed:', err); }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Internal: socket dispatcher
// ──────────────────────────────────────────────────────────────────────────────

/** Process an incoming socket payload. Called both from the socket listener
 *  and from launchRandomEvent (so the local GM client opens the popover too
 *  when the GM owns the target actor). */
export function _processIncoming(payload) {
  if (!payload || typeof payload !== 'object') return;
  switch (payload.type) {
    case 'randomEvent.launch':   return _handleLaunch(payload);
    case 'randomEvent.resolved': return _handleResolved(payload);
    default: return;
  }
}

async function _handleLaunch({ eventId, actorId }) {
  const actor = game.actors?.get(actorId);
  const event = game.items?.get(eventId);
  if (!actor || !event) return;
  // Only the target's actual owner (not the GM, unless GM also owns) opens
  // the popover. testUserPermission returns true for the GM on every actor;
  // we want the player-driven flow when there's a non-GM owner present.
  const isOwnerForLocalUser = actor.testUserPermission(game.user, 'OWNER');
  if (!isOwnerForLocalUser) return;
  if (game.user?.isGM) {
    // If a non-GM owner exists and is online, let them handle it.
    const playerOwners = (game.users ?? []).filter(u =>
      !u.isGM && u.active && actor.testUserPermission(u, 'OWNER'));
    if (playerOwners.length) return;
  }
  // Lazy-import the popover to avoid a circular import (popover imports the
  // resolver from this file).
  const { openEventPopover } = await import('../apps/event-popover.js');
  openEventPopover({ event, actor });
}

async function _handleResolved(payload) {
  if (!game.user?.isGM) return;
  try {
    await appendSessionEvent({
      type: 'randomEventResolved',
      actorId: payload.actorId,
      actorName: game.actors?.get(payload.actorId)?.name ?? '',
      details: {
        eventName: payload.eventName,
        chosenTag: payload.chosenTag,
        outcome: payload.outcome,
        average: payload.average,
      },
    });
  } catch (err) { console.warn('GS | session-event append failed:', err); }
}

// ──────────────────────────────────────────────────────────────────────────────
// Internal: chat card
// ──────────────────────────────────────────────────────────────────────────────

async function _postRandomEventCard({ actor, event, strategies, rolls, chosenTag, outcome }) {
  const sys = actor.system ?? {};
  const persona = sys.activePersonaId
    ? (sys.personas ?? []).find(p => p.id === sys.activePersonaId)
    : null;
  const speakerName = persona?.name || actor.name;
  const themeId = sys.theme || 'clayton';
  const average = _averageOf(rolls);
  const outcomeLabel = outcome === 'success'
    ? game.i18n.localize('GOODSOCIETY.randomEvent.success')
    : game.i18n.localize('GOODSOCIETY.randomEvent.failure');
  const tagLabel = outcome === 'success'
    ? game.i18n.localize('GOODSOCIETY.randomEvent.gainsPositive')
    : game.i18n.localize('GOODSOCIETY.randomEvent.gainsNegative');

  const path = 'systems/good-society-homebrew/templates/chat-cards/random-event.hbs';
  const inner = await foundry.applications.handlebars.renderTemplate(path, {
    actorName: speakerName,
    portraitUrl: profilePic(actor),
    initial: (speakerName?.[0] ?? '?').toUpperCase(),
    eventName: event.name,
    eventDescription: event.system?.description ?? '',
    strategies: strategies.map((text, i) => ({
      index: i + 1,
      text,
      roll: rolls[i],
    })),
    average: average.toFixed(1),
    isSuccess: outcome === 'success',
    outcomeLabel,
    tagLabel,
    chosenTag,
  });
  const content = themedWrap(actor, inner);

  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    flags: {
      [NS]: {
        cardType: 'random-event',
        speakerActorId: actor.id,
        speakerTheme: themeId,
        speakerPersonaId: sys.activePersonaId ?? '',
        eventId: event.id,
        outcome,
        average,
      },
    },
  });
}

function _averageOf(rolls) {
  if (!rolls?.length) return 0;
  return rolls.reduce((s, n) => s + Number(n || 0), 0) / rolls.length;
}

/** Threshold: average ≥ 11 = success. Exposed so the player popover can
 *  classify outcomes consistently. */
export function isSuccess(average) {
  return Number(average) >= 11;
}
