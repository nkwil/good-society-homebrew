/**
 * Cycle divider helper — post-MVP §13.4 / patch-journal-elevation §7.
 *
 * On the first transition into upkeep each cycle, auto-creates a
 * "Cycle N — Reflections" JournalEntry under the "Cycle Reflections" folder.
 * Idempotent — re-running for the same cycleNumber is a no-op (the helper
 * checks for an existing entry with the matching `entryType: 'cycleDivider'`
 * + `cycleNumber: N` flag combination).
 *
 * GM-client-only single writer — non-GM clients short-circuit, mirroring
 * the pendingChanges single-writer pattern.
 *
 * Auto-summary content is template-driven from session-event data when
 * available; an empty cycle still creates the entry with a "(no events
 * recorded)" body so the GM can edit afterward.
 */

import { cycleReflectionFolder, entryFlags } from './journal-folders.js';
import { eventTypeHeading, formatSessionEventSummary } from '../hooks/session-events.js';

const FLAG_SCOPE = 'good-society-homebrew';

/**
 * Find an existing cycle divider for a given cycleNumber, or null.
 * @param {number} cycleNumber
 */
function _findExisting(cycleNumber) {
  return game.journal?.find(j => {
    const flag = j.getFlag(FLAG_SCOPE, 'entryType');
    const cn   = j.getFlag(FLAG_SCOPE, 'cycleNumber');
    return flag === 'cycleDivider' && cn === cycleNumber;
  }) ?? null;
}

/**
 * Render a starting-point body for the cycle divider entry.
 * Pulls from `sessionEvents` world setting if present; otherwise generates
 * an empty placeholder. The GM is encouraged to edit afterward.
 */
function _composeBody(cycleNumber) {
  let events = [];
  try {
    events = game.settings.get(FLAG_SCOPE, 'sessionEvents') ?? [];
  } catch { /* setting not yet registered */ }

  const cycleEvents = events.filter(e => (e?.cycleNumber ?? null) === cycleNumber);

  // No top-level <h2> — the Novel Reader / journal entry sheet already shows
  // the entry name ("Cycle N — Reflections") in its own header.
  if (!cycleEvents.length) {
    return `<p><em>${game.i18n.localize('GOODSOCIETY.cycleDivider.noEvents')}</em></p>`;
  }

  // Group by event type for a glanceable structure. Each group gets a
  // human-readable heading + items rendered via the session-events
  // formatter so we never leak raw enum values like "phaseChange" into the
  // novel.
  const groups = {};
  for (const ev of cycleEvents) {
    const type = ev.type ?? 'other';
    groups[type] ??= [];
    groups[type].push(ev);
  }

  const sections = Object.entries(groups).map(([type, list]) => {
    const items = list.map(ev => `<li>${formatSessionEventSummary(ev)}</li>`).join('');
    return `<h3>${eventTypeHeading(type)}</h3><ul>${items}</ul>`;
  }).join('');

  return sections;
}

/**
 * Create the cycle divider for `cycleNumber`. Idempotent + GM-only.
 * @param {number} cycleNumber
 * @returns {Promise<JournalEntry|null>}
 */
export async function createCycleDivider(cycleNumber) {
  if (!game.user?.isGM) return null;
  if (cycleNumber == null) return null;

  // Respect the auto-create setting.
  let enabled = true;
  try { enabled = game.settings.get(FLAG_SCOPE, 'autoCreateCycleDividers'); } catch {}
  if (!enabled) return null;

  // Idempotent.
  const existing = _findExisting(cycleNumber);
  if (existing) return existing;

  const folder = await cycleReflectionFolder();
  const name = game.i18n.format('GOODSOCIETY.cycleDivider.entryName', { cycle: cycleNumber });
  const body = _composeBody(cycleNumber);

  try {
    const entry = await JournalEntry.create({
      name,
      ...(folder ? { folder: folder.id } : {}),
      ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS?.OBSERVER ?? 2 },
      flags: entryFlags({
        entryType: 'cycleDivider',
        cycleNumber,
      }),
      pages: [{
        name,
        type: 'text',
        text: { content: body, format: CONST.JOURNAL_ENTRY_PAGE_FORMATS?.HTML ?? 1 },
      }],
    });
    return entry;
  } catch (err) {
    console.warn(`GS | cycle divider create failed for cycle ${cycleNumber} (non-fatal):`, err);
    return null;
  }
}

/**
 * Prompt the GM for a free-form cycle summary and append it to the cycle
 * divider entry. Called from upkeep phase start. GM-only; if the GM
 * cancels the dialog, no-op. If they've already written one this cycle
 * (the entry carries the `cycleSummaryWritten` flag), skip.
 *
 * @param {number} cycleNumber
 */
export async function promptCycleSummary(cycleNumber) {
  if (!game.user?.isGM) return;
  if (cycleNumber == null) return;

  // Get-or-create the entry. We need it to exist to know whether we've
  // prompted before.
  const entry = (await createCycleDivider(cycleNumber)) ?? _findExisting(cycleNumber);
  if (!entry) return;
  if (entry.getFlag(FLAG_SCOPE, 'cycleSummaryWritten')) return; // already done

  const { DialogV2 } = foundry.applications.api;

  let value;
  try {
    value = await DialogV2.prompt({
      window: {
        title: game.i18n.format('GOODSOCIETY.cycleSummary.title', { cycle: cycleNumber }),
      },
      content: `
        <p>${game.i18n.localize('GOODSOCIETY.cycleSummary.intro')}</p>
        <textarea name="summary" rows="8"
                  style="width:100%; box-sizing:border-box; padding:8px;"
                  placeholder="${game.i18n.localize('GOODSOCIETY.cycleSummary.placeholder')}"></textarea>
      `,
      ok: {
        label: game.i18n.localize('GOODSOCIETY.cycleSummary.save'),
        callback: (_ev, button) => button.form.elements.summary?.value ?? '',
      },
      rejectClose: false,
    });
  } catch { /* cancelled */ return; }
  const text = (value || '').trim();
  if (!text) return;

  const page = entry.pages?.contents?.[0];
  if (!page) return;
  const heading = game.i18n.localize('GOODSOCIETY.cycleSummary.sectionHeading');
  const html =
    `<h3>${heading}</h3>` +
    `<p>${foundry.utils.escapeHTML(text).replace(/\n+/g, '</p><p>')}</p>`;
  const next = (page.text?.content ?? '') + html;
  try {
    await page.update({ 'text.content': next });
    await entry.setFlag(FLAG_SCOPE, 'cycleSummaryWritten', true);
    ui.notifications?.info(game.i18n.localize('GOODSOCIETY.cycleSummary.saved'));
  } catch (err) {
    console.warn('GS | cycle summary append failed:', err);
  }
}
