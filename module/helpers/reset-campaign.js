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
  for (const k of ['sessionEvents', 'rumours', 'calendarEvents']) {
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
  for (const actor of majors) {
    // Drop embedded reputation tags + conditions.
    const repIds = actor.items
      .filter(i => i.type === 'reputation-tag' || i.type === 'reputation-condition')
      .map(i => i.id);
    if (repIds.length) await actor.deleteEmbeddedDocuments('Item', repIds);

    // Reset inner-conflict boxes (keep the conflict items themselves).
    const conflicts = actor.items.filter(i => i.type === 'inner-conflict');
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
    });

    // Clear cycle-bound flags.
    for (const flag of ['pickerResolved', 'reputationPhaseCompletedAt',
                        'upkeepCompletedAt', 'epistolaryDone']) {
      try { await actor.unsetFlag(SYS, flag); } catch {}
    }
  }

  // ── Connections — refresh resolve ─────────────────────────────────────────
  const connections = game.actors.filter(a => a.type === 'connection');
  for (const c of connections) {
    const max = c.system?.resolve?.max ?? 5;
    await c.update({ 'system.resolve.current': max });
  }

  ui.notifications?.info(
    game.i18n.format('GOODSOCIETY.resetCampaign.success', {
      majors: majors.length,
      connections: connections.length,
    }),
  );
}
