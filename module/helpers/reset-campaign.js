/**
 * reset-campaign.js — one-shot "back to cycle 1" helper.
 *
 * GM-only. Shows a confirm dialog that explains exactly what will be cleared
 * vs. kept, then resets cycle settings, world history arrays, all chat
 * messages, system-tagged journals, and every Major + Connection's per-cycle
 * state. Character identities, families, magic skills, and inner-conflict /
 * backstory item definitions are preserved.
 *
 * Wired into the Cabinet's GM Tools group via the `resetCampaign` launcherKey
 * (see `module/apps/cabinet.js` and `module/constants.js#COWORK_SURFACES`).
 *
 * The confirm dialog carries a fixed `id` so the Cabinet's launcher toggle
 * can detect "a reset confirm is on screen" and cancel it on a second click.
 */

const SYS = 'good-society-homebrew';
const CONFIRM_ID = 'gs-reset-campaign-confirm';

/** Public entry — opens the confirm dialog and (on yes) runs the reset. */
export async function openResetCampaign() {
  if (!game.user?.isGM) {
    ui.notifications?.error(game.i18n.localize('GOODSOCIETY.resetCampaign.gmOnly'));
    return;
  }

  const proceed = await foundry.applications.api.DialogV2.confirm({
    id: CONFIRM_ID,
    window: { title: game.i18n.localize('GOODSOCIETY.resetCampaign.title') },
    content: `
      <p>${game.i18n.localize('GOODSOCIETY.resetCampaign.confirmBody')}</p>
      <ul style="margin:8px 0;padding-left:18px;font-size:13px">
        <li>${game.i18n.localize('GOODSOCIETY.resetCampaign.bullet1')}</li>
        <li>${game.i18n.localize('GOODSOCIETY.resetCampaign.bullet2')}</li>
        <li>${game.i18n.localize('GOODSOCIETY.resetCampaign.bullet3')}</li>
        <li>${game.i18n.localize('GOODSOCIETY.resetCampaign.bullet4')}</li>
      </ul>
      <p style="font-size:12px;opacity:0.78">${game.i18n.localize('GOODSOCIETY.resetCampaign.confirmFooter')}</p>
    `,
    yes: { label: game.i18n.localize('GOODSOCIETY.resetCampaign.yes') },
    no:  { label: game.i18n.localize('GOODSOCIETY.resetCampaign.no')  },
  });
  if (!proceed) {
    ui.notifications?.info(game.i18n.localize('GOODSOCIETY.resetCampaign.cancelled'));
    return;
  }

  try {
    await _runReset();
  } catch (err) {
    console.error('GS | resetCampaign failed:', err);
    ui.notifications?.error(game.i18n.localize('GOODSOCIETY.resetCampaign.error'));
  }
}

async function _runReset() {
  // ── Cycle settings ────────────────────────────────────────────────────────
  await game.settings.set(SYS, 'cycleNumber', 1);
  await game.settings.set(SYS, 'cyclePhase', 'pre-cycle');
  for (const [k, v] of [['cyclePosition', 0], ['isFinalCycle', false]]) {
    try { await game.settings.set(SYS, k, v); } catch {}
  }

  // ── World-scope history arrays ────────────────────────────────────────────
  // Every per-cycle setting whose value is a list of accumulated events,
  // queued items, or in-flight wizard state. Identity / config settings
  // (chrome toggles, arrival splash, novel title, default resolve, etc.)
  // are intentionally NOT cleared — they're table-level preferences, not
  // cycle state.
  for (const k of [
    'sessionEvents',     // session log entries
    'rumours',           // rumour board state
    'calendarEvents',    // event timeline entries
    'rumourPhaseState',  // in-flight R&S wizard turn/round tracking
    'letterQueue',       // letters drafted outside the Epistolary phase
    'savedStoryBeats',   // story-beat command-center history
  ]) {
    try { await game.settings.set(SYS, k, []); } catch {}
  }

  // ── Chat ──────────────────────────────────────────────────────────────────
  if (game.messages.size) {
    await ChatMessage.deleteDocuments(game.messages.map(m => m.id));
  }

  // ── System-created journals (by entryType flag) ───────────────────────────
  const tagged = game.journal.filter(j => j.getFlag(SYS, 'entryType'));
  if (tagged.length) await JournalEntry.deleteDocuments(tagged.map(j => j.id));

  // ── Per-Major reset ───────────────────────────────────────────────────────
  const majors = game.actors.filter(a => a.type === 'major-character');
  // Lazy import keeps the reset helper standalone (no top-level circular
  // imports between reset-campaign and pending-changes).
  const { beginUndoPending, endUndoPending } =
    await import('./pending-changes.js');
  for (const actor of majors) {
    // Silence the deleteItem hook for the duration of the per-actor reset.
    // Without this, deleting the embedded reputation tags below fires the
    // session-events hook → appendPendingChange races the actor.update
    // that empties `system.reputation.pendingChanges`, and the log ends up
    // refilled with stray "removed New reputation-tag" entries. The guard
    // is the same one used by Undo clicks — same semantics here ("this
    // isn't a user action that should be logged"). Wrapped in try/finally
    // so an exception inside the loop body can't leave the guard stuck on.
    beginUndoPending(actor.id);
    try {
    // Drop embedded reputation tags + conditions.
    const repIds = actor.items
      .filter(i => i.type === 'reputation-tag' || i.type === 'reputation-condition')
      .map(i => i.id);
    if (repIds.length) await actor.deleteEmbeddedDocuments('Item', repIds);

    // Reset inner-conflict boxes (keep the conflict items themselves).
    // Drop blank inner-conflict items (no labels on either side) — they
    // accumulate from accidental "+ Add conflict" clicks where the user
    // never typed a label, and would otherwise be surfaced into the active
    // list by the reset below as a row of empty "Left side vs. Right side"
    // boxes. Real, named conflicts stay and have their progress reset.
    const allConflicts = actor.items.filter(i => i.type === 'inner-conflict');
    const blankIds = allConflicts
      .filter(c => !c.system?.leftLabel?.trim() && !c.system?.rightLabel?.trim())
      .map(c => c.id);
    if (blankIds.length) await actor.deleteEmbeddedDocuments('Item', blankIds);
    const conflicts = allConflicts.filter(c => !blankIds.includes(c.id));
    if (conflicts.length) {
      await actor.updateEmbeddedDocuments('Item', conflicts.map(c => ({
        _id: c.id,
        'system.leftBoxes':  [false, false, false, false, false],
        'system.rightBoxes': [false, false, false, false, false],
        'system.completed':  false,
        'system.completedSide': null,
      })));
    }

    // Reset backstory-action `used` flags.
    const actions = actor.items.filter(i => i.type === 'backstory-action');
    if (actions.length) {
      await actor.updateEmbeddedDocuments('Item', actions.map(a => ({
        _id: a.id, 'system.used': false,
      })));
    }

    const maxResolve = actor.system?.tokens?.resolve?.max ?? 5;
    const startResolve = (() => {
      try { return game.settings.get(SYS, 'defaultStartingResolve'); }
      catch { return 3; }
    })();
    await actor.update({
      'system.tokens.major': true,
      'system.tokens.resolve.current': Math.min(startResolve, maxResolve),
      'system.tokens.monologuedThisCycle': false,
      'system.reputation.positiveTags':    [],
      'system.reputation.negativeTags':    [],
      'system.reputation.activeConditions': [],
      'system.reputation.pendingChanges':  [],
      'system.innerConflictsActiveIds':    conflicts.map(c => c.id),
      'system.innerConflictsCompletedIds': [],
      // Revert active persona to true identity. Doing the prototype-token
      // revert in the same .update keeps the actor's identity-on-canvas
      // consistent (otherwise newly-placed tokens after reset would still
      // pull the persona's image). Inline rather than via switchPersona()
      // so we don't fire `goodSociety.personaSwitched` and re-log a
      // session event into the array we just cleared.
      'system.activePersonaId': '',
      'prototypeToken.texture.src': actor.img,
      'prototypeToken.name': actor.name,
      // Tactical scratch space — not biographical, accumulates per cycle.
      'system.notesObjectives': '',
    });

    // Already-placed tokens on scenes carry their own texture/name (set
    // by switchPersona during play). Mirror the prototype revert across
    // every scene so the canvas matches the actor's true identity too.
    for (const scene of game.scenes ?? []) {
      const tokens = scene.tokens?.filter(t => t.actorId === actor.id) ?? [];
      if (!tokens.length) continue;
      try {
        await scene.updateEmbeddedDocuments('Token', tokens.map(t => ({
          _id: t.id,
          'texture.src': actor.img,
          name: actor.name,
        })));
      } catch (err) {
        console.warn(`GS | resetCampaign: token revert on scene "${scene.name}" failed (non-fatal):`, err);
      }
    }

    // Clear cycle-bound flags.
    for (const flag of ['pickerResolved', 'reputationPhaseCompletedAt',
                        'upkeepCompletedAt', 'epistolaryDone']) {
      try { await actor.unsetFlag(SYS, flag); } catch {}
    }
    } finally {
      endUndoPending(actor.id);
    }
  }

  // ── Connections — refresh resolve to STARTING value (1), not max ───────
  // Per CLAUDE.md §6.2: Connections default to `{ current: 1, max: 5 }` —
  // they start with one resolve and can refresh during play. Resetting to
  // max would give every Connection a full bar of resolve from day one,
  // which isn't how the game is supposed to start. Hard-coded 1 here
  // matches the DataModel's `initial: 1` on system.resolve.current.
  //
  // Also clear `impressions` (MCs' written observations accumulate during
  // play — cycle history, not bio) and revert any active persona to the
  // true identity (same prototype-token + scene-token sweep as Majors).
  const connections = game.actors.filter(a => a.type === 'connection');
  for (const c of connections) {
    await c.update({
      'system.resolve.current': 1,
      'system.impressions': [],
      'system.activePersonaId': '',
      'prototypeToken.texture.src': c.img,
      'prototypeToken.name': c.name,
    });
    for (const scene of game.scenes ?? []) {
      const tokens = scene.tokens?.filter(t => t.actorId === c.id) ?? [];
      if (!tokens.length) continue;
      try {
        await scene.updateEmbeddedDocuments('Token', tokens.map(t => ({
          _id: t.id,
          'texture.src': c.img,
          name: c.name,
        })));
      } catch (err) {
        console.warn(`GS | resetCampaign: connection token revert on scene "${scene.name}" failed (non-fatal):`, err);
      }
    }
  }

  // ── NPCs — clear active persona only ──────────────────────────────────
  // NPCs have no cycle-bound mechanics (no resolve track, no reputation,
  // no inner conflict) so all that needs resetting is any active persona
  // swap. Same identity-revert pattern as Majors + Connections.
  const npcs = game.actors.filter(a => a.type === 'npc');
  for (const npc of npcs) {
    if (!npc.system?.activePersonaId) continue;
    await npc.update({
      'system.activePersonaId': '',
      'prototypeToken.texture.src': npc.img,
      'prototypeToken.name': npc.name,
    });
    for (const scene of game.scenes ?? []) {
      const tokens = scene.tokens?.filter(t => t.actorId === npc.id) ?? [];
      if (!tokens.length) continue;
      try {
        await scene.updateEmbeddedDocuments('Token', tokens.map(t => ({
          _id: t.id,
          'texture.src': npc.img,
          name: npc.name,
        })));
      } catch (err) {
        console.warn(`GS | resetCampaign: NPC token revert on scene "${scene.name}" failed (non-fatal):`, err);
      }
    }
  }

  ui.notifications?.info(
    game.i18n.format('GOODSOCIETY.resetCampaign.success', {
      majors: majors.length,
      connections: connections.length,
    }),
  );
}
