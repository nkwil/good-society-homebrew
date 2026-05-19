/**
 * token-defaults.js — sensible prototype-token defaults for newly-created
 * Major Characters and Connections.
 *
 * Good Society is a social/narrative system where Major Characters are
 * always meant to be controllable by their owning player. Foundry's default
 * `preCreateActor` shapes don't enable vision on the prototype token, which
 * means a player joining a scene with their token sees a fully-dark canvas
 * (just token outlines) and no way to "see" the scene. This hook fixes
 * the prototype token's sight + disposition + display settings at create
 * time so every new Major spawns with a workable token out of the box.
 *
 * Connections also get a friendly disposition; NPCs intentionally keep
 * the neutral default (GM decides each NPC's stance).
 *
 * Idempotent — only sets fields the GM (or world data) hasn't already
 * customized. Players can still override per-token via the token HUD.
 */

const DEFAULT_MAJOR_TOKEN = {
  sight: {
    enabled: true,
    range: 0,          // 0 = unlimited (sees the whole scene); GM can dial back per-scene
    visionMode: 'basic',
  },
  // Friendly disposition + name plate visibility so players never lose
  // sight of their own characters.
  disposition: 1,      // CONST.TOKEN_DISPOSITIONS.FRIENDLY
  displayName: 30,     // CONST.TOKEN_DISPLAY_MODES.HOVER (name on hover)
  displayBars: 0,      // CONST.TOKEN_DISPLAY_MODES.NONE (no resource bars)
  // Default actor link so prototype edits propagate everywhere.
  actorLink: true,
};

const DEFAULT_CONNECTION_TOKEN = {
  disposition: 0,      // NEUTRAL
  displayName: 30,     // HOVER
  displayBars: 0,
  actorLink: true,
};

function _applyDefaults(actor, defaults) {
  // Only touch fields that aren't explicitly set in the existing source —
  // never clobber a deliberate setting from a duplicate or imported actor.
  const pt = actor.prototypeToken ?? {};
  const next = {};
  for (const [key, val] of Object.entries(defaults)) {
    // For nested objects (sight), shallow-merge any present subfields.
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const existing = pt[key] ?? {};
      const merged = { ...val, ...existing };
      // If anything in the merged object differs from existing, schedule a write.
      if (JSON.stringify(merged) !== JSON.stringify(existing)) {
        next[`prototypeToken.${key}`] = merged;
      }
    } else if (pt[key] !== val) {
      next[`prototypeToken.${key}`] = val;
    }
  }
  return next;
}

export function register() {
  // preCreateActor: mutate the source so the actor lands with our defaults
  // baked in from the first save.
  Hooks.on('preCreateActor', (actor, data /* , options, userId */) => {
    if (actor.type === 'major-character') {
      const src = foundry.utils.deepClone(data ?? {});
      src.prototypeToken = {
        ...(DEFAULT_MAJOR_TOKEN),
        ...(src.prototypeToken ?? {}),
        sight: {
          ...DEFAULT_MAJOR_TOKEN.sight,
          ...(src.prototypeToken?.sight ?? {}),
        },
      };
      actor.updateSource(src);
    } else if (actor.type === 'connection') {
      const src = foundry.utils.deepClone(data ?? {});
      src.prototypeToken = {
        ...DEFAULT_CONNECTION_TOKEN,
        ...(src.prototypeToken ?? {}),
      };
      actor.updateSource(src);
    }
  });

  // One-time GM migration on ready: patch existing Major actors whose
  // prototype tokens have sight.enabled=false. Without this, sessions in
  // progress would still suffer the dark-canvas problem until each token
  // was hand-fixed.
  Hooks.once('ready', async () => {
    if (!game.user?.isGM) return;
    try {
      const updates = [];
      for (const a of game.actors ?? []) {
        if (a.type === 'major-character') {
          const updates_for_actor = _applyDefaults(a, DEFAULT_MAJOR_TOKEN);
          if (Object.keys(updates_for_actor).length) {
            updates.push({ _id: a.id, ...updates_for_actor });
          }
        }
      }
      if (updates.length) {
        await Actor.updateDocuments(updates);
        console.log(`GS | Patched prototype-token defaults on ${updates.length} Major(s).`);
      }
    } catch (err) { console.warn('GS | token defaults migration failed:', err); }
  });
}
