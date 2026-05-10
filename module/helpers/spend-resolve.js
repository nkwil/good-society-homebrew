/**
 * Resolve token spend — post-MVP §12.1 / patch-token-events §3.
 *
 * One helper for both spend paths (discard / handoff). Always-safe to call;
 * pool-full / pool-empty conditions short-circuit gracefully. The chat card
 * + actor update are atomic per spend.
 *
 * Cross-screen pip-clone animation (the visual choreography on handoff) is
 * additive polish handled by the dossier sheet's spend-pip click handler —
 * this helper does the data work; the surface does the animation.
 *
 * Anti-pattern guard: this helper writes via `actor.update`, never inline.
 */

import { postSystemCard } from './chat-cards.js';
import { profileName } from './profile-pic.js';

/**
 * Resolve discard — spend one resolve token, no handoff.
 *
 * @param {Actor} actor
 * @returns {Promise<boolean>} true if the spend went through
 */
export async function discardResolve(actor) {
  if (!actor) return false;
  const current = actor.system?.tokens?.resolve?.current ?? 0;
  if (current <= 0) {
    ui.notifications?.warn(
      game.i18n.format('GOODSOCIETY.resolve.noResolveToSpend', { name: profileName(actor) }),
    );
    return false;
  }

  await actor.update({ 'system.tokens.resolve.current': current - 1 });

  await postSystemCard({
    actor,
    content: game.i18n.format('GOODSOCIETY.resolve.discardCard', {
      name: profileName(actor),
      remaining: String(current - 1),
    }),
  });

  Hooks.callAll('goodSociety.resolveSpent', {
    actorId: actor.id,
    spend: 'discard',
    remaining: current - 1,
  });
  return true;
}

/**
 * Resolve handoff — spend from `from`'s pool and add to `to`'s pool. Both
 * actor updates are awaited; if `to`'s pool is at max, the spend is rejected
 * up-front (matches the picker's pool-full disable per §12.1).
 *
 * @param {Actor} from
 * @param {Actor} to
 * @returns {Promise<boolean>}
 */
export async function handoffResolve(from, to) {
  if (!from || !to || from.id === to.id) return false;

  const fromCurrent = from.system?.tokens?.resolve?.current ?? 0;
  const toCurrent   = to.system?.tokens?.resolve?.current ?? 0;
  const toMax       = to.system?.tokens?.resolve?.max ?? 5;

  if (fromCurrent <= 0) {
    ui.notifications?.warn(
      game.i18n.format('GOODSOCIETY.resolve.noResolveToSpend', { name: profileName(from) }),
    );
    return false;
  }
  if (toCurrent >= toMax) {
    ui.notifications?.warn(
      game.i18n.format('GOODSOCIETY.resolve.recipientFull', { name: profileName(to) }),
    );
    return false;
  }

  await from.update({ 'system.tokens.resolve.current': fromCurrent - 1 });
  await to.update(  { 'system.tokens.resolve.current': toCurrent + 1 });

  await postSystemCard({
    actor: from,
    content: game.i18n.format('GOODSOCIETY.resolve.handoffCard', {
      from: profileName(from),
      to: profileName(to),
    }),
  });

  Hooks.callAll('goodSociety.resolveSpent', {
    actorId: from.id,
    recipientId: to.id,
    spend: 'handoff',
    remaining: fromCurrent - 1,
  });
  return true;
}
