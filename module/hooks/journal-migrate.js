/**
 * Journal entry-type backfill — post-MVP §13.1 / patch-journal-elevation §4.5.
 *
 * Pre-patch journal entries (letters, monologues, session logs created before
 * this patch shipped) lack the `flags['good-society-homebrew'].entryType` flag
 * that the patch's sidebar list and Novel Reader use to dispatch on entry
 * type. This module runs once on `Hooks.once("ready", …)` for GM clients only
 * and conservatively backfills the flag based on entry-name pattern matching.
 *
 * Conservative — entries that don't match any known pattern stay untyped, and
 * the GM can manually flag them later. Idempotent — re-running on already-
 * tagged entries is a no-op.
 *
 * Patterns match the write-path naming conventions:
 *   - Letter:      "{Sender} → {Recipient}"            (with optional "(Cycle N)")
 *   - Monologue:   "{Actor} — Cycle N Monologue"
 *   - Session log: "Session N — {date}"
 */

const FLAG_KEY = 'entryType';
const SCOPE = 'good-society-homebrew';

const PATTERNS = [
  // "Session 1 — 2026-05-09" — note the en-dash, em-dash, or hyphen.
  { type: 'sessionLog', re: /^Session\s+\d+\s*[—–-]/i },
  // "Rose Whitcombe — Cycle 1 Monologue"
  { type: 'monologue',  re: /\sCycle\s+\d+\s+Monologue\b/i },
  // "Rose → Margaret" or "Rose → Margaret (Cycle 1)"  (rightwards arrow → U+2192)
  { type: 'letter',     re: /\s→\s/ },
];

function _detectType(entry) {
  for (const { type, re } of PATTERNS) {
    if (re.test(entry.name)) return type;
  }
  return null;
}

/**
 * One-time repair for old cycle-divider journal entries. Pre-2026-05-20
 * dividers were generated before `formatSessionEventSummary` /
 * `eventTypeHeading` shipped, so their stored HTML contains raw enum text
 * like `<h3>phaseChange</h3>` and `<li>phaseChange</li>` — rendered as
 * literal enum strings in the Novel Reader. Walk every cycleDivider
 * entry and swap the known raw enum chunks for their human-readable
 * equivalents. Idempotent — entries that don't contain the raw pattern
 * stay untouched, so re-running is a no-op.
 *
 * Conservative: we only replace the EXACT auto-generated pattern
 * (`<h3>{enum}</h3>` and `<li>{enum}</li>` with no other content),
 * which means GM-edited prose around those tokens stays intact.
 *
 * Bullet items for `phaseChange` lost their `details.newPhase` data
 * at write time, so we can't reconstruct which phase — they get
 * rewritten as "Advanced to (unknown phase)." so they read as
 * structured-but-stale rather than enum-string-leaking.
 */
const HEADING_MAP = {
  phaseChange:    'Phase changes',
  tagAdded:       'Reputation tags gained',
  tagRemoved:     'Reputation tags removed',
  conditionAdded: 'Reputation conditions triggered',
  monologue:      'Monologues',
  personaSwap:    'Persona switches',
};

export async function migrateCycleDividerBodies() {
  if (!game.user?.isGM) return;

  const dividers = game.journal?.filter(j =>
    j.getFlag(SCOPE, FLAG_KEY) === 'cycleDivider'
  ) ?? [];

  const updates = [];
  for (const entry of dividers) {
    const page = entry.pages?.contents?.[0];
    if (!page) continue;
    const original = page.text?.content ?? '';
    if (!original) continue;

    let next = original;

    // Rewrite raw enum <h3> section headings.
    for (const [enumVal, heading] of Object.entries(HEADING_MAP)) {
      next = next.replaceAll(`<h3>${enumVal}</h3>`, `<h3>${heading}</h3>`);
    }
    // Rewrite raw enum <li> bullets (no inner data to reconstruct, so
    // mark them as stale — better than leaking the enum string).
    for (const enumVal of Object.keys(HEADING_MAP)) {
      next = next.replaceAll(
        `<li>${enumVal}</li>`,
        `<li><em>(legacy ${enumVal} entry — original data not preserved)</em></li>`,
      );
    }

    if (next === original) continue; // nothing to do
    updates.push({ entryId: entry.id, pageId: page.id, content: next });
  }

  if (!updates.length) return;

  try {
    // Per-entry page update; we can't bulk-update embedded pages across
    // multiple parents in a single call. The set is small (one entry per
    // cycle) so per-entry overhead is fine.
    for (const u of updates) {
      const e = game.journal.get(u.entryId);
      const p = e?.pages?.get(u.pageId);
      if (!p) continue;
      await p.update({ 'text.content': u.content });
    }
    console.log(`GS | Repaired ${updates.length} pre-format cycle-divider entr${updates.length === 1 ? 'y' : 'ies'}.`);
  } catch (err) {
    console.warn('GS | cycle-divider body migration failed (non-fatal):', err);
  }
}

/**
 * Run the one-time backfill. Safe to call from inside an existing
 * `Hooks.once("ready", …)` handler — internally guards on isGM, idempotency,
 * and graceful failure.
 */
export async function migrateJournalEntryTypes() {
  if (!game.user?.isGM) return;

  const candidates = game.journal?.filter(j => {
    const flag = j.getFlag(SCOPE, FLAG_KEY);
    return !flag; // already tagged → skip
  }) ?? [];

  const updates = [];
  for (const entry of candidates) {
    const type = _detectType(entry);
    if (!type) continue;
    updates.push({
      _id: entry.id,
      [`flags.${SCOPE}.${FLAG_KEY}`]: type,
    });
  }

  if (!updates.length) return;

  try {
    await JournalEntry.updateDocuments(updates);
    console.log(`GS | Migrated entryType flag on ${updates.length} pre-patch journal entries.`);
  } catch (err) {
    console.warn('GS | journal entryType migration failed (non-fatal):', err);
  }
}
