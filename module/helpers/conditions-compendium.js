/**
 * conditions-compendium.js — GM helper to find-or-create the world
 * compendium that holds reputation-condition items, then open it.
 *
 * The Reputation Condition Picker (`module/apps/condition-picker.js`)
 * sources conditions from compendium packs only — never the Items
 * sidebar. Canonical condition content was cut from the system (GMs
 * author their own), so this helper gives the GM a one-click path to
 * the right pack from the Cabinet's GM Tools group.
 *
 * Resolution order:
 *   1. A world Item pack that already contains ≥1 reputation-condition.
 *   2. A world Item pack whose label is the canonical name (created by
 *      a previous run of this helper).
 *   3. Otherwise, create a fresh world Item pack.
 */

const CANONICAL_LABEL = 'Reputation Conditions';

/** Scan world-type Item compendiums; return the first that already holds a
 *  reputation-condition entry. Returns null if none do. */
async function _packWithConditions() {
  for (const pack of game.packs ?? []) {
    if (pack.documentName !== 'Item') continue;
    if (pack.metadata?.packageType !== 'world') continue;
    try {
      const index = pack.index?.size > 0
        ? pack.index
        : await pack.getIndex({ fields: ['type'] });
      if ([...index].some(e => e.type === 'reputation-condition')) return pack;
    } catch (err) {
      console.warn(`GS | conditions-compendium: index read failed for ${pack.collection}:`, err);
    }
  }
  return null;
}

/** Find a world Item pack matching the canonical label. */
function _packByLabel() {
  return (game.packs ?? []).find(p =>
    p.documentName === 'Item'
    && p.metadata?.packageType === 'world'
    && p.metadata?.label === CANONICAL_LABEL,
  ) ?? null;
}

/**
 * Synchronously find the conditions compendium without creating one — used by
 * the Cabinet to reflect the surface's open/closed toggle state. Returns the
 * canonical-label pack, or null if the GM hasn't opened it yet.
 *
 * @returns {CompendiumCollection|null}
 */
export function findConditionsCompendiumPack() {
  return _packByLabel();
}

/**
 * Open the reputation-conditions compendium, creating it first if no
 * suitable pack exists. GM-only — non-GMs can't create compendiums and
 * shouldn't be authoring conditions anyway.
 */
export async function openConditionsCompendium() {
  if (!game.user?.isGM) {
    ui.notifications?.warn(game.i18n.localize('GOODSOCIETY.conditionsCompendium.gmOnly'));
    return;
  }

  // 1. Prefer a pack that already has conditions in it.
  let pack = await _packWithConditions();

  // 2. Else a pack we created earlier (matched by label).
  if (!pack) pack = _packByLabel();

  // 3. Else create a fresh world Item compendium.
  if (!pack) {
    try {
      pack = await foundry.documents.collections.CompendiumCollection.createCompendium({
        type: 'Item',
        label: CANONICAL_LABEL,
      });
      ui.notifications?.info(game.i18n.localize('GOODSOCIETY.conditionsCompendium.created'));
    } catch (err) {
      console.error('GS | conditions-compendium: createCompendium failed:', err);
      ui.notifications?.error(game.i18n.localize('GOODSOCIETY.conditionsCompendium.createFailed'));
      return;
    }
  }

  // Open the compendium directory window.
  try {
    pack.render(true);
  } catch (err) {
    console.warn('GS | conditions-compendium: pack.render failed:', err);
  }
  return pack;
}
