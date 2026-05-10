/**
 * Dock context — pure function that builds the data shape the My Characters
 * Dock template needs. Filtered to the current user's owned actors only.
 *
 * Per docs/design/09-my-characters-dock.md.
 * Per post-MVP §8.5 — all profile pic resolution goes through `profilePic()`
 * (token image, with persona override). Don't inline the persona chain.
 */

import { profilePic } from './profile-pic.js';
import { effectiveThemeOf } from './themed-wrap.js';

/**
 * Resolve an actor's active persona (or fall back to primary / first).
 * Used for IMAGE resolution where we always want some portrait to show.
 * @param {Actor} actor
 */
function _activePersona(actor) {
  const personas = actor?.system?.personas ?? [];
  if (!personas.length) return null;
  const activeId = actor.system?.activePersonaId;
  return (
    personas.find((p) => p.id === activeId) ??
    personas.find((p) => p.isPrimary) ??
    personas[0] ??
    null
  );
}

/**
 * Resolve an actor's EXPLICITLY-selected persona — null when the user has
 * picked "true identity" (i.e. activePersonaId is empty). Use for display
 * text decisions: name shown, "as <persona>" subtitle visibility, etc.
 * The fallback chain in `_activePersona()` is wrong for those cases —
 * "true identity" should mean exactly that, not "show me the primary".
 * @param {Actor} actor
 */
function _explicitPersona(actor) {
  const activeId = actor?.system?.activePersonaId;
  if (!activeId) return null;
  const personas = actor?.system?.personas ?? [];
  return personas.find((p) => p.id === activeId) ?? null;
}

/**
 * Build a row context for a Major actor.
 * @param {Actor} actor
 */
function _majorRow(actor) {
  // Image source: post-MVP §8.5 token-based resolution via profilePic().
  // Display text uses the explicit selection so "true identity" actually
  // shows true identity (not the primary-persona fallback).
  const explicitPersona = _explicitPersona(actor);
  const speakerName = explicitPersona?.name ?? actor.name;
  const portraitUrl = profilePic(actor);
  const resolve = actor.system?.tokens?.resolve ?? { current: 0, max: 5 };
  const pips = Array.from({ length: resolve.max ?? 5 }, (_, i) => i < (resolve.current ?? 0));

  // Active conditions sub-rail (post-MVP §3.3, §10.4 — dock parity).
  // Each entry is the underlying reputation-condition Item; we resolve by id
  // so the embedded copy on the actor stays the source of truth (name edits
  // on the source item flow through automatically).
  const conditionIds = actor.system?.reputation?.activeConditions ?? [];
  const positiveConditions = [];
  const negativeConditions = [];
  for (const condId of conditionIds) {
    const item = actor.items?.get(condId);
    if (!item) continue;
    const polarity = item.system?.polarity ?? 'positive';
    const entry = { id: item.id, name: item.name };
    if (polarity === 'negative') negativeConditions.push(entry);
    else positiveConditions.push(entry);
  }

  return {
    id: actor.id,
    type: 'major',
    name: actor.name,
    speakerName,
    // Editable subhead — title or quick description from system.bio.title.
    // Renders below the name in dock rows when set.
    title: (actor.system?.bio?.title ?? '').trim(),
    // "as <persona>" subtitle shows ONLY when an explicit persona is
    // selected and its name differs from the actor's. When the user
    // picks "true identity" no subtitle — that's the whole point.
    showPersonaLine: !!explicitPersona && explicitPersona.name !== actor.name,
    initial: (speakerName || '?').slice(0, 1).toUpperCase(),
    portraitUrl,
    theme: effectiveThemeOf(actor) || 'clayton',
    resolvePips: pips,
    mtActive: !!actor.system?.tokens?.major,
    monologueAvailable: !actor.system?.tokens?.monologuedThisCycle,
    activePersonaId: explicitPersona?.id || '',
    positiveConditions,
    negativeConditions,
    hasConditions: positiveConditions.length + negativeConditions.length > 0,
  };
}

/**
 * Build a row context for a Connection actor.
 * @param {Actor} actor
 */
function _connectionRow(actor) {
  // Image source: §8.5 token-based via profilePic(). Display text from
  // explicit persona selection. Same pattern as _majorRow above.
  const explicitPersona = _explicitPersona(actor);
  const speakerName = explicitPersona?.name ?? actor.name;
  const portraitUrl = profilePic(actor);
  const resolve = actor.system?.resolve ?? { current: 0, max: 5 };
  const pips = Array.from({ length: resolve.max ?? 5 }, (_, i) => i < (resolve.current ?? 0));
  // Two independent subtitle lines now that the dock renders bio.title:
  //   - `title` is the dossier subhead (bio.title — "Apprentice Alchemist")
  //   - `role`  is the relationship label only ("cousin", "stable hand")
  // Falling back `role` to `title` like we used to would double-print the
  // same string on the row, so they're kept disjoint.
  const title = (actor.system?.bio?.title ?? '').trim();
  const role  = (actor.system?.bio?.relationshipLabel ?? '').trim();
  return {
    id: actor.id,
    type: 'connection',
    name: actor.name,
    speakerName,
    role,
    title,
    initial: (speakerName || '?').slice(0, 1).toUpperCase(),
    portraitUrl,
    theme: effectiveThemeOf(actor) || 'connection-grey',
    resolvePips: pips,
    activePersonaId: explicitPersona?.id || '',
  };
}

/**
 * Build the full dock context for the current user.
 * @returns {{majors: object[], connections: object[], total: number, hasAny: boolean,
 *           activeSpeakerActorId: string, activeSpeakerPersonaId: string,
 *           speakerLabel: string|null, speakerOptions: object[]}}
 */
export function buildDockContext() {
  const ownedActors = game.actors?.filter((a) =>
    a.testUserPermission(game.user, 'OWNER'),
  ) ?? [];
  const majors = [];
  const connections = [];

  for (const actor of ownedActors) {
    if (actor.type === 'major-character') {
      majors.push(_majorRow(actor));
    } else if (actor.type === 'connection') {
      connections.push(_connectionRow(actor));
    }
  }

  // Sort: Majors by family then name; Connections by linkedMajorId then name.
  majors.sort((a, b) => a.name.localeCompare(b.name));
  connections.sort((a, b) => a.name.localeCompare(b.name));

  // Active speaker resolution (mirrors speaking-as.js).
  const activeSpeakerActorId = (() => {
    try { return game.settings.get('good-society-homebrew', 'activeSpeakerActorId') || ''; }
    catch { return ''; }
  })();
  const activeSpeakerPersonaId = (() => {
    try { return game.settings.get('good-society-homebrew', 'activeSpeakerPersonaId') || ''; }
    catch { return ''; }
  })();

  const speakerActor = activeSpeakerActorId ? game.actors.get(activeSpeakerActorId) : null;
  const speakerPersona = speakerActor?.system?.personas?.find((p) => p.id === activeSpeakerPersonaId) ?? null;
  const speakerLabel = speakerPersona?.name ?? speakerActor?.name ?? null;

  // Owned Majors (any type) feed the speaker popover, just like the chat-input
  // bar. Only Majors get speaker rights — Connections aren't player voices.
  const myMajors = ownedActors.filter((a) => a.type === 'major-character');

  return {
    majors,
    connections,
    total: majors.length + connections.length,
    hasMajors: majors.length > 0,
    hasConnections: connections.length > 0,
    hasAny: majors.length + connections.length > 0,
    activeSpeakerActorId,
    activeSpeakerPersonaId,
    speakerLabel,
    myMajors,
  };
}
