/**
 * inner-conflict-register.js — keep a Major actor's
 * `innerConflictsActiveIds` / `innerConflictsCompletedIds` arrays in sync
 * with the actual inner-conflict items on the actor, and deduplicate stale
 * entries.
 *
 * The Major sheet maps these ID arrays back to items for display. Two write
 * paths exist — the Major sheet's #toggleBox and the InnerConflictSheet's
 * #toggleBox — and neither de-dupes before appending, so under certain
 * timings (rapid clicks, multiple sheets open) an item's id can land in the
 * completed array twice → duplicate render.
 *
 * This hook is the safety net:
 *   - createItem (inner-conflict on a Major) → add to activeIds if missing.
 *   - deleteItem (inner-conflict on a Major) → remove from both arrays.
 *   - updateItem (inner-conflict on a Major, completed flag changed) → move
 *     between arrays.
 *   - ready (GM only, one-time) → dedupe and reconcile both arrays against
 *     the actor's actual inner-conflict items.
 *
 * GM-side single writer to avoid duplicate writes from multiple clients.
 */

export function register() {
  Hooks.on('createItem', async (item /*, options, userId */) => {
    if (!game.user?.isGM) return;
    if (item?.type !== 'inner-conflict') return;
    const actor = item.parent;
    if (!actor || actor.type !== 'major-character') return;

    const isCompleted = !!item.system?.completed;
    const targetField = isCompleted
      ? 'system.innerConflictsCompletedIds'
      : 'system.innerConflictsActiveIds';
    const targetArr = isCompleted
      ? (actor.system?.innerConflictsCompletedIds ?? [])
      : (actor.system?.innerConflictsActiveIds ?? []);
    if (targetArr.includes(item.id)) return;

    try {
      await actor.update({ [targetField]: [...targetArr, item.id] });
    } catch (err) {
      console.warn('GS | inner-conflict register failed:', err);
    }
  });

  Hooks.on('deleteItem', async (item /*, options, userId */) => {
    if (!game.user?.isGM) return;
    if (item?.type !== 'inner-conflict') return;
    const actor = item.parent;
    if (!actor || actor.type !== 'major-character') return;

    const active = actor.system?.innerConflictsActiveIds ?? [];
    const completed = actor.system?.innerConflictsCompletedIds ?? [];
    const needActive = active.includes(item.id);
    const needCompleted = completed.includes(item.id);
    if (!needActive && !needCompleted) return;

    try {
      await actor.update({
        ...(needActive ? { 'system.innerConflictsActiveIds': active.filter((i) => i !== item.id) } : {}),
        ...(needCompleted ? { 'system.innerConflictsCompletedIds': completed.filter((i) => i !== item.id) } : {}),
      });
    } catch (err) {
      console.warn('GS | inner-conflict unregister failed:', err);
    }
  });

  Hooks.on('updateItem', async (item, change /*, options, userId */) => {
    if (!game.user?.isGM) return;
    if (item?.type !== 'inner-conflict') return;
    // Only react when the completion flag changed.
    if (!('completed' in (change?.system ?? {}))) return;
    const actor = item.parent;
    if (!actor || actor.type !== 'major-character') return;

    const id = item.id;
    const isCompleted = !!item.system?.completed;
    const active = (actor.system?.innerConflictsActiveIds ?? []).filter((i) => i !== id);
    const completed = (actor.system?.innerConflictsCompletedIds ?? []).filter((i) => i !== id);
    const nextActive = isCompleted ? active : [...active, id];
    const nextCompleted = isCompleted ? [...completed, id] : completed;

    // Idempotent: only write if anything actually changed (deduped from the
    // current arrays).
    const cur = actor.system?.innerConflictsActiveIds ?? [];
    const curC = actor.system?.innerConflictsCompletedIds ?? [];
    const sameActive = JSON.stringify(cur) === JSON.stringify(nextActive);
    const sameCompleted = JSON.stringify(curC) === JSON.stringify(nextCompleted);
    if (sameActive && sameCompleted) return;

    try {
      await actor.update({
        'system.innerConflictsActiveIds': nextActive,
        'system.innerConflictsCompletedIds': nextCompleted,
      });
    } catch (err) {
      console.warn('GS | inner-conflict completion move failed:', err);
    }
  });

  // One-time reconciliation on ready — dedupe both arrays and route each
  // live inner-conflict item into the array that matches its current
  // `completed` flag. Catches duplicates already in the data.
  Hooks.once('ready', async () => {
    if (!game.user?.isGM) return;
    try {
      const updates = [];
      for (const actor of game.actors ?? []) {
        if (actor.type !== 'major-character') continue;
        const conflicts = (actor.items ?? []).filter((i) => i.type === 'inner-conflict');
        const liveActive = conflicts.filter((i) => !i.system?.completed).map((i) => i.id);
        const liveCompleted = conflicts.filter((i) => i.system?.completed).map((i) => i.id);

        const arrActive = actor.system?.innerConflictsActiveIds ?? [];
        const arrCompleted = actor.system?.innerConflictsCompletedIds ?? [];

        const reconcile = (arr, live) => {
          const seen = new Set();
          const out = [];
          // Preserve existing order where the id is still live.
          for (const id of arr) {
            if (live.includes(id) && !seen.has(id)) { out.push(id); seen.add(id); }
          }
          // Append any live ids that weren't in the array yet.
          for (const id of live) {
            if (!seen.has(id)) { out.push(id); seen.add(id); }
          }
          return out;
        };
        const nextActive = reconcile(arrActive, liveActive);
        const nextCompleted = reconcile(arrCompleted, liveCompleted);

        const aChanged = JSON.stringify(nextActive) !== JSON.stringify(arrActive);
        const cChanged = JSON.stringify(nextCompleted) !== JSON.stringify(arrCompleted);
        if (aChanged || cChanged) {
          updates.push({
            _id: actor.id,
            ...(aChanged ? { 'system.innerConflictsActiveIds': nextActive } : {}),
            ...(cChanged ? { 'system.innerConflictsCompletedIds': nextCompleted } : {}),
          });
        }
      }
      if (updates.length) {
        await Actor.updateDocuments(updates);
        console.log(`GS | Reconciled inner-conflict IDs on ${updates.length} Major(s).`);
      }
    } catch (err) {
      console.warn('GS | inner-conflict reconciliation failed:', err);
    }
  });
}
