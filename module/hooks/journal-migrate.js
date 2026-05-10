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
