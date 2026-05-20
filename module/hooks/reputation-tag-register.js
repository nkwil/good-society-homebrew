/**
 * reputation-tag-register.js — keep `system.reputation.positiveTags` /
 * `negativeTags` ID arrays in sync with embedded reputation-tag Items on
 * Major actors.
 *
 * The Major sheet reads tags by mapping IDs from those arrays back to items
 * (see `MajorCharacterSheet#_prepareContext`). A tag that exists as an Item
 * but isn't in the appropriate ID array is invisible on the sheet.
 *
 * Most create/delete paths in the system explicitly maintain the array (the
 * sheet's "+ tag" button, the reputation phase wizards). The random-event
 * resolver and any future code that just calls `actor.createEmbeddedDocuments`
 * with a reputation-tag would otherwise orphan the tag.
 *
 * This hook is the safety net: GM-side single writer, idempotent, runs on
 * every `createItem` / `deleteItem`. If the array already has the ID (sheet
 * path already wrote it), the hook is a no-op.
 */

const NS = 'good-society-homebrew';

export function register() {
  Hooks.on('createItem', async (item /*, options, userId */) => {
    if (!game.user?.isGM) return;
    if (item?.type !== 'reputation-tag') return;
    const actor = item.parent;
    if (!actor || actor.type !== 'major-character') return;

    const polarity = item.system?.polarity === 'negative' ? 'negative' : 'positive';
    const field = `system.reputation.${polarity}Tags`;
    const current = actor.system?.reputation?.[`${polarity}Tags`] ?? [];
    if (current.includes(item.id)) return;  // already registered

    try {
      await actor.update({ [field]: [...current, item.id] });
    } catch (err) {
      console.warn('GS | reputation-tag register failed:', err);
    }
  });

  Hooks.on('deleteItem', async (item /*, options, userId */) => {
    if (!game.user?.isGM) return;
    if (item?.type !== 'reputation-tag') return;
    const actor = item.parent;
    if (!actor || actor.type !== 'major-character') return;

    const rep = actor.system?.reputation ?? {};
    const pos = rep.positiveTags ?? [];
    const neg = rep.negativeTags ?? [];
    const needPos = pos.includes(item.id);
    const needNeg = neg.includes(item.id);
    if (!needPos && !needNeg) return;

    try {
      await actor.update({
        ...(needPos ? { 'system.reputation.positiveTags': pos.filter((i) => i !== item.id) } : {}),
        ...(needNeg ? { 'system.reputation.negativeTags': neg.filter((i) => i !== item.id) } : {}),
      });
    } catch (err) {
      console.warn('GS | reputation-tag unregister failed:', err);
    }
  });

  // One-time GM reconciliation on ready — sweep every Major and align the
  // ID arrays against the actor's actual reputation-tag items. Catches:
  //   - tags previously orphaned by random events (now appearing on sheets)
  //   - stale IDs in the arrays whose items were deleted out from under them
  //   - duplicate IDs in the arrays (collapsed to one)
  Hooks.once('ready', async () => {
    if (!game.user?.isGM) return;
    try {
      const updates = [];
      for (const actor of game.actors ?? []) {
        if (actor.type !== 'major-character') continue;
        const items = actor.items ?? [];
        const liveTagIds = items.filter((i) => i.type === 'reputation-tag');
        const livePos = liveTagIds
          .filter((i) => (i.system?.polarity ?? 'positive') === 'positive')
          .map((i) => i.id);
        const liveNeg = liveTagIds
          .filter((i) => i.system?.polarity === 'negative')
          .map((i) => i.id);

        const arrPos = actor.system?.reputation?.positiveTags ?? [];
        const arrNeg = actor.system?.reputation?.negativeTags ?? [];

        // Reconcile: arrays should equal "every live tag of this polarity"
        // exactly once, in their existing order where present + appended
        // when missing.
        const reconcile = (arr, live) => {
          const seen = new Set();
          const out = [];
          for (const id of arr) {
            if (live.includes(id) && !seen.has(id)) { out.push(id); seen.add(id); }
          }
          for (const id of live) {
            if (!seen.has(id)) { out.push(id); seen.add(id); }
          }
          return out;
        };
        const nextPos = reconcile(arrPos, livePos);
        const nextNeg = reconcile(arrNeg, liveNeg);

        const posChanged = JSON.stringify(nextPos) !== JSON.stringify(arrPos);
        const negChanged = JSON.stringify(nextNeg) !== JSON.stringify(arrNeg);
        if (posChanged || negChanged) {
          updates.push({
            _id: actor.id,
            ...(posChanged ? { 'system.reputation.positiveTags': nextPos } : {}),
            ...(negChanged ? { 'system.reputation.negativeTags': nextNeg } : {}),
          });
        }
      }
      if (updates.length) {
        await Actor.updateDocuments(updates);
        console.log(`GS | Reconciled reputation-tag IDs on ${updates.length} Major(s).`);
      }
    } catch (err) {
      console.warn('GS | reputation-tag reconciliation failed:', err);
    }
  });
}
