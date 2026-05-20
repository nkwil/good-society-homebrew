/**
 * actor-data-migrate.js — one-shot data repairs for live actor documents.
 *
 * Different from journal-migrate.js (which fixes JournalEntry data). This
 * file is the home for actor-level migrations triggered on ready by the
 * GM client. Idempotent, conservative, GM-only.
 *
 * Currently migrates:
 *   - Connections stuck at `system.resolve.current === max` (legacy default
 *     of 5 from an older version of connection.js, before initial was
 *     changed to 1 per CLAUDE.md §6.2). Resets to 1.
 */

const FLAG_KEY = 'actorDataMigrationsRan';
const FLAG_SCOPE = 'good-society-homebrew';

/**
 * Reset any Connection whose `system.resolve.current` equals `max` back to
 * the documented starting value of 1. Heuristic: a Connection whose resolve
 * is exactly at max is either freshly created from a stale default OR has
 * been refreshed, and per the game's design starts at 1. GMs who intend a
 * Connection to be at max can re-fill via the sheet pips after migration.
 *
 * Idempotent — uses a per-actor flag so the migration only runs once per
 * connection (a GM legitimately filling a Connection's resolve later won't
 * be undone on the next world load).
 */
export async function migrateConnectionResolveDefaults() {
  if (!game.user?.isGM) return;

  const candidates = (game.actors?.contents ?? []).filter(a => {
    if (a.type !== 'connection') return false;
    if (a.getFlag(FLAG_SCOPE, FLAG_KEY)) return false; // already migrated
    const current = a.system?.resolve?.current ?? 0;
    const max     = a.system?.resolve?.max     ?? 5;
    return current >= max; // stuck at full → likely stale default
  });

  if (!candidates.length) return;

  for (const a of candidates) {
    try {
      await a.update({
        'system.resolve.current': 1,
        [`flags.${FLAG_SCOPE}.${FLAG_KEY}`]: true,
      });
    } catch (err) {
      console.warn(`GS | connection-resolve migration failed for ${a.name}:`, err);
    }
  }
  console.log(`GS | Reset resolve.current to 1 on ${candidates.length} Connection(s) carrying the legacy default.`);
}
