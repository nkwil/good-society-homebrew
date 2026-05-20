/**
 * audio-defaults.js — apply Good Society's preferred audio defaults to each
 * user the first time they connect to this world.
 *
 * Foundry's out-of-box defaults for the global audio sliders:
 *   globalAmbientVolume:  0.5  (50%)
 *   globalInterfaceVolume: 0.5 (50%)
 *   globalPlaylistVolume: 1.0  (100%)
 *
 * Playlist music at 100% drowns out roleplay and chat alerts; this helper
 * tames it to 15% on first connection. Ambient is also pinned to 50% so
 * users who've previously cranked it up in another world land back at a
 * sensible level. Interface volume is intentionally left alone (Foundry's
 * 50% default is already appropriate).
 *
 * Apply-once-per-user: a flag on the User document records that the
 * defaults have been seeded for this world, so subsequent reconnects
 * respect whatever the player has tuned in the meantime.
 */

const NS = 'good-society-homebrew';
const FLAG = 'audioDefaultsApplied';

const DEFAULTS = {
  globalAmbientVolume:  0.5,
  globalPlaylistVolume: 0.15,
};

export function register() {
  Hooks.once('ready', _maybeApply);
}

async function _maybeApply() {
  const user = game.user;
  if (!user) return;
  // Already seeded — respect whatever the user has set since.
  try {
    if (user.getFlag(NS, FLAG)) return;
  } catch {
    return; // flag read failed; bail silently rather than re-applying every load
  }

  for (const [key, value] of Object.entries(DEFAULTS)) {
    try {
      await game.settings.set('core', key, value);
    } catch (err) {
      console.warn(`GS | audio-defaults: failed to set core.${key}:`, err);
    }
  }

  try {
    await user.setFlag(NS, FLAG, true);
  } catch (err) {
    // Best-effort flag write. If it fails, the worst case is we re-apply
    // the defaults next reconnect — not great, but not actively harmful.
    console.warn('GS | audio-defaults: failed to persist seeded flag:', err);
  }
}
