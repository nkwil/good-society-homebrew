/**
 * Magic/Skill cast pipeline — shared by MajorCharacterSheet#castSkill and
 * MagicSkillSheet#cast so both entry points run identical logic.
 *
 * Per docs/design/12-item-sheets.md §"Cast pipeline" and CLAUDE.md §3
 * (Sequencer + JB2A are recommended, not required — degrade gracefully).
 *
 * Secret-cast Sequencer (GM-view-only effect) is deferred to v1.1;
 * for now, secret casts whisper the chat card but skip VFX entirely.
 */

import { switchPersona } from './persona-swap.js';
import { postSystemCard } from './chat-cards.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function _readSetting(key, fallback) {
  try { return game.settings.get('good-society-homebrew', key); }
  catch { return fallback; }
}

function _whisperTargets(actor) {
  const gmIds = (game.users?.filter(u => u.isGM) ?? []).map(u => u.id);
  const ownerIds = Object.entries(actor.ownership ?? {})
    .filter(([uid, lvl]) => uid !== 'default' && lvl >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER)
    .map(([uid]) => uid);
  return [...new Set([...gmIds, ...ownerIds])];
}

// ── Cast pipeline ─────────────────────────────────────────────────────────────

/**
 * Execute the full cast pipeline for a magic-skill item.
 *
 * @param {Item}        item   The magic-skill item being cast.
 * @param {Actor|null}  actor  The casting actor. Falls back to item.parent.
 */
export async function castMagicSkill(item, actor = null) {
  // Resolve actor — item.parent when called from the item sheet.
  if (!actor) actor = item.parent ?? null;
  if (!actor) {
    console.warn('[GS] castMagicSkill: no actor found for item', item.name);
    return;
  }

  // 1. Honour homebrewMagicEnabled — if the setting is off, the system is
  //    running without the homebrew magic rules; the button is still visible
  //    on sheets but the action is a no-op.
  if (!_readSetting('homebrewMagicEnabled', true)) return;

  // 2. Visibility confirm — if magic is secret, ask the player before
  //    broadcasting a public animation.
  const magicVisibility = actor.system?.visibility?.magic ?? 'secret';
  let isSecret = false;

  if (magicVisibility === 'secret') {
    const choice = await foundry.applications.api.DialogV2.wait({
      window: { title: game.i18n.format('GOODSOCIETY.castSkill.revealTitle', { skill: item.name }) },
      content: `<p>${game.i18n.format('GOODSOCIETY.castSkill.revealBody', { skill: item.name })}</p>`,
      buttons: [
        {
          action: 'public',
          label: game.i18n.localize('GOODSOCIETY.castSkill.castPublic'),
          default: true,
        },
        {
          action: 'secret',
          label: game.i18n.localize('GOODSOCIETY.castSkill.castSecret'),
        },
        {
          action: 'cancel',
          label: game.i18n.localize('GOODSOCIETY.castSkill.cancel'),
        },
      ],
    });
    if (!choice || choice === 'cancel') return;
    isSecret = choice === 'secret';
  }

  // 3. Sequencer VFX — public casts only.
  //    Secret-cast GM-view-only effect is deferred to v1.1.
  const vfxKey  = item.system?.vfxKey ?? '';
  const soundUrl = item.system?.soundUrl ?? '';
  const sequencerActive = !!game.modules.get('sequencer')?.active;

  if (!isSecret && sequencerActive && vfxKey) {
    try {
      const token = canvas.tokens?.placeables?.find(t => t.actor?.id === actor.id);
      if (token) {
        const s = new Sequence();
        s.effect().atLocation(token).file(vfxKey).scaleToObject(1.5);
        if (soundUrl) s.sound().file(soundUrl);
        await s.play();
      }
    } catch (err) {
      console.warn('[GS] castMagicSkill: Sequencer effect failed (non-fatal):', err);
    }
  }

  // 4. Persona swap — after VFX so the swap card doesn't bury the cast card.
  const swapTargetId = item.system?.triggersPersonaSwap?.targetPersonaId;
  if (swapTargetId) {
    await switchPersona(actor, swapTargetId);
  }

  // 5. Cast announcement card — whispered when cast secretly.
  const displayName = actor.system?.activePersona?.name || actor.name;
  const content = game.i18n.format('GOODSOCIETY.castSkill.castCard', {
    actor: displayName,
    skill: item.name,
  });
  const context = game.i18n.localize('GOODSOCIETY.castSkill.cardContext');
  const whisper = isSecret ? _whisperTargets(actor) : [];

  await postSystemCard({ content, context, whisper });
}
