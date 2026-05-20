/**
 * scene-defaults.js — sensible scene defaults for Good Society.
 *
 * Good Society is a social/narrative game: scenes are shared "drawing room"
 * spaces, not dungeons. Players need to SEE the scene whether or not they
 * have a token placed on it. Foundry's default `tokenVision: true` on new
 * scenes shows non-GM users an error ("There is no token in this scene
 * which gives you visibility of the area") unless they own a token with
 * sight enabled on that scene.
 *
 * This hook:
 *   - `preCreateScene` — every newly-created scene lands with
 *     `tokenVision: false` so players can view it immediately.
 *   - `ready` (GM only, one-time) — patches existing scenes whose
 *     `tokenVision` is true to false, so games-in-progress stop showing the
 *     error to players without needing the GM to edit every scene.
 *
 * Idempotent. GMs who want true vision-restricted scenes can re-enable
 * `tokenVision` on a per-scene basis via Scene Config; this only handles
 * the default and the historical bulk-fix.
 */

export function register() {
  // Default new scenes to no token-vision requirement so players can see
  // them without owning a placed token.
  Hooks.on('preCreateScene', (scene, data /* , options, userId */) => {
    // Only override when the creator hasn't explicitly set it — respect any
    // imported / duplicated scene that already specifies tokenVision.
    if (data && 'tokenVision' in data) return;
    try {
      scene.updateSource({ tokenVision: false });
    } catch (err) {
      console.warn('GS | preCreateScene default failed:', err);
    }
  });

  // One-time migration on ready: flip any existing scenes that still have
  // tokenVision enabled. Players in an in-progress game stop hitting the
  // visibility error immediately on next load.
  Hooks.once('ready', async () => {
    if (!game.user?.isGM) return;
    try {
      const stale = (game.scenes ?? []).filter((s) => s.tokenVision === true);
      if (!stale.length) return;
      const updates = stale.map((s) => ({ _id: s.id, tokenVision: false }));
      await Scene.updateDocuments(updates);
      console.log(`GS | Patched tokenVision on ${updates.length} existing scene(s).`);
    } catch (err) {
      console.warn('GS | scene tokenVision migration failed:', err);
    }
  });
}
