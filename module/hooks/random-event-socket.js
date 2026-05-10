/**
 * random-event-socket.js — listener for randomEvent.* socket payloads.
 *
 * Shares the `system.good-society-homebrew` channel with rumour-socket;
 * payloads are dispatched via their `type` field, so unrelated messages
 * from this listener and the rumour listener pass each other without
 * collision.
 *
 * The actual handlers live in module/helpers/random-event.js so
 * launchRandomEvent (the GM-side caller) can also process its own emit
 * locally without going through the socket round-trip.
 */

import { _processIncoming } from '../helpers/random-event.js';

const NS = 'good-society-homebrew';
const SOCKET_NAME = `system.${NS}`;

export function register() {
  Hooks.once('ready', () => {
    if (!game.socket) return;
    game.socket.on(SOCKET_NAME, async (payload) => {
      // Only randomEvent.* payloads are ours; everything else is a no-op.
      if (!payload || typeof payload !== 'object') return;
      if (typeof payload.type !== 'string') return;
      if (!payload.type.startsWith('randomEvent.')) return;
      try {
        await _processIncoming(payload);
      } catch (err) {
        console.warn('[good-society Random Event Socket] handler failed:', err, payload);
      }
    });
  });
}
