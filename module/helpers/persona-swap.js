/**
 * Persona swap pipeline — Option B variant.
 *
 * DEPARTURE from CLAUDE.md §11 worked example: does NOT write actor.img.
 * actor.img is the canonical base-identity portrait and is never overwritten.
 * The "no persona" target for prototypeToken.texture.src and placed Token
 * textures is always actor.img. Surfaces resolve portraits as:
 *   activePersona?.portraitUrl || actor.img
 * Option B avoids needing a flag to preserve the original actor.img and
 * simplifies the reverse (clear-to-true-identity) path. See §15 running log.
 *
 * Callers:
 *   - persona-switcher-popover.js  (picker UI)
 *   - major-character-sheet.js     (castSkill action on triggersPersonaSwap items)
 *
 * @param {Actor}  actor       The actor whose persona is changing.
 * @param {string} toPersonaId The target persona id, or '' for true identity.
 */

import { postPersonaSwitchCard } from './chat-cards.js';

export async function switchPersona(actor, toPersonaId) {
  const fromPersona = actor.system?.activePersona ?? null;
  const toPersona   = toPersonaId
    ? (actor.system?.personas?.find(p => p.id === toPersonaId) ?? null)
    : null;

  if (toPersonaId && !toPersona) {
    console.warn(`[Good Society] switchPersona: persona "${toPersonaId}" not found on "${actor.name}"`);
    return;
  }

  // Resolve target texture + nameplate.
  // Option B: never use persona.portraitUrl as the token image source —
  // only persona.tokenImageUrl (or actor.img as fallback).
  const tokenSrc  = toPersona
    ? (toPersona.tokenImageUrl || actor.img)
    : actor.img;
  const tokenName = toPersona
    ? (toPersona.tokenName || toPersona.name || actor.name)
    : actor.name;

  // 1. Update actor — activePersonaId + prototypeToken only. NOT actor.img.
  try {
    await actor.update({
      'system.activePersonaId':     toPersonaId,
      'prototypeToken.texture.src': tokenSrc,
      'prototypeToken.name':        tokenName,
    });
  } catch (err) {
    console.error('[Good Society] switchPersona: actor.update failed:', err);
    ui.notifications?.error(game.i18n.localize('GOODSOCIETY.personaSwitcher.swapFailed'));
    return;
  }

  // 2. Chat announcement card (only when switching TO a persona, not when clearing).
  if (toPersona) {
    try {
      await postPersonaSwitchCard({ actor, fromPersona, toPersona });
    } catch (err) {
      console.warn('[Good Society] switchPersona: chat card failed (non-fatal):', err);
    }
  }

  // 3. Update every placed token across all scenes.
  for (const scene of game.scenes ?? []) {
    const tokens = scene.tokens?.filter(t => t.actorId === actor.id) ?? [];
    if (!tokens.length) continue;
    try {
      await scene.updateEmbeddedDocuments('Token', tokens.map(t => ({
        _id: t.id,
        'texture.src': tokenSrc,
        name: tokenName,
      })));
    } catch (err) {
      console.warn(`[Good Society] switchPersona: token update on scene "${scene.name}" failed (non-fatal):`, err);
    }
  }

  // 4. Optional VFX — Sequencer + JB2A, only when switching TO a persona.
  if (toPersona && game.modules.get('sequencer')?.active) {
    try {
      const placed = canvas.tokens?.placeables?.find(t => t.actor?.id === actor.id);
      if (placed) {
        new Sequence()
          .effect()
          .atLocation(placed)
          .file('jb2a.misty_step.01.blue')
          .play();
      }
    } catch (err) {
      console.warn('[Good Society] switchPersona: VFX failed (non-fatal):', err);
    }
  }
}
