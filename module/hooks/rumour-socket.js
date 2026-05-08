/**
 * rumour-socket.js — bridge for player → GM rumour actions.
 *
 * World-scoped settings can only be written by the GM client. To support a
 * player-driven Rumour & Scandal phase, non-GM clients emit their intended
 * action over Foundry's system socket; the GM client listens and processes
 * each emitted action via the rumours.js helpers.
 *
 * system.json must have `"socket": true` for the system socket channel to be
 * available. Socket messages are best-effort fire-and-forget — the active
 * player sees their action take effect when the resulting setting onChange
 * re-renders the wizard.
 *
 * Per docs/design/32-rumour-wizard.md.
 */

import { _processAction } from '../helpers/rumours.js';

const NS = 'good-society-homebrew';
const SOCKET_NAME = `system.${NS}`;

/** Register the GM-side listener. Called from good-society.js Hooks.once('ready'). */
export function register() {
  // Every client subscribes, but only the GM acts. This is safer than relying
  // on `if (!game.user.isGM) return` at emit time, since multiple GMs are
  // possible (rare, but supported). The first GM to receive runs it.
  Hooks.once('ready', () => {
    if (!game.socket) return;
    game.socket.on(SOCKET_NAME, async (payload) => {
      if (!game.user?.isGM) return;
      try {
        await _processAction(payload);
      } catch (err) {
        console.warn('[good-society Rumour Socket] action failed:', err, payload);
      }
    });
  });
}
