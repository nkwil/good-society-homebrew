/**
 * Dock context — pure function that builds the data shape the My Characters
 * Dock template needs. Filtered to the current user's owned actors only.
 *
 * Per docs/design/09-my-characters-dock.md.
 */

/**
 * Resolve an actor's active persona (or fall back to primary / first).
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
 * Build a row context for a Major actor.
 * @param {Actor} actor
 */
function _majorRow(actor) {
  const persona = _activePersona(actor);
  const speakerName = persona?.name ?? actor.name;
  const portraitUrl = persona?.portraitUrl || actor.system?.bio?.portraitUrl || actor.img || '';
  const resolve = actor.system?.tokens?.resolve ?? { current: 0, max: 5 };
  const pips = Array.from({ length: resolve.max ?? 5 }, (_, i) => i < (resolve.current ?? 0));
  return {
    id: actor.id,
    type: 'major',
    name: actor.name,
    speakerName,
    showPersonaLine: !!persona && persona.name !== actor.name,
    initial: (speakerName || '?').slice(0, 1).toUpperCase(),
    portraitUrl,
    theme: actor.system?.theme || 'clayton',
    resolvePips: pips,
    mtActive: !!actor.system?.tokens?.major,
    monologueAvailable: !actor.system?.tokens?.monologuedThisCycle,
    activePersonaId: persona?.id || '',
  };
}

/**
 * Build a row context for a Connection actor.
 * @param {Actor} actor
 */
function _connectionRow(actor) {
  const persona = _activePersona(actor);
  const speakerName = persona?.name ?? actor.name;
  const portraitUrl = persona?.portraitUrl || actor.system?.bio?.portraitUrl || actor.img || '';
  const resolve = actor.system?.resolve ?? { current: 0, max: 5 };
  const pips = Array.from({ length: resolve.max ?? 5 }, (_, i) => i < (resolve.current ?? 0));
  const role = actor.system?.bio?.relationshipLabel || '';
  return {
    id: actor.id,
    type: 'connection',
    name: actor.name,
    speakerName,
    role,
    initial: (speakerName || '?').slice(0, 1).toUpperCase(),
    portraitUrl,
    theme: actor.system?.theme || 'connection-grey',
    resolvePips: pips,
    activePersonaId: persona?.id || '',
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
