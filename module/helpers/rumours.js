/**
 * rumours.js — pure helpers for the GS Rumour & Scandal phase.
 *
 * State machine:
 *   unspread  — newly created, no token attached
 *   spread    — has resolve token, can be used to twist the story
 *   fading    — survived one R&S phase without being spread; symbol shown
 *   faded     — survived two R&S phases without being spread; archived
 *   used      — token spent during play; archived
 *
 * Storage: two world-scoped settings registered in good-society.js:
 *   rumours            — array of Rumour objects
 *   rumourPhaseState   — { phase, round, turnOrder, currentIdx, startedAtCycle }
 *
 * Player-driven turn handoff: only the GM client can `game.settings.set` on
 * world settings, so player actions emit a socket message that the GM client
 * processes. See module/hooks/rumour-socket.js. The exported `requestX()`
 * helpers branch automatically: GM → direct write, non-GM → socket emit.
 *
 * Per docs/design/32-rumour-wizard.md (B-12).
 */

const NS = 'good-society-homebrew';
const SOCKET_NAME = `system.${NS}`;

// ── Read paths (open) ──────────────────────────────────────────────────────

export function getRumours() {
  try {
    const raw = game.settings.get(NS, 'rumours');
    return Array.isArray(raw) ? raw.map(_normalize) : [];
  } catch { return []; }
}

export function getPhaseState() {
  try {
    const raw = game.settings.get(NS, 'rumourPhaseState');
    return _normalizePhaseState(raw);
  } catch { return _defaultPhaseState(); }
}

/** Group rumours by display bucket. */
export function groupRumours(rumours = getRumours()) {
  const active = [];
  const archived = [];
  for (const r of rumours) {
    if (r.state === 'used' || r.state === 'faded') archived.push(r);
    else active.push(r);
  }
  // Active sort: spread first (newest first), then unspread (newest first), then fading (newest first)
  active.sort((a, b) => {
    const order = { spread: 0, unspread: 1, fading: 2 };
    const oa = order[a.state] ?? 99;
    const ob = order[b.state] ?? 99;
    if (oa !== ob) return oa - ob;
    return (b.createdAt ?? 0) - (a.createdAt ?? 0);
  });
  archived.sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0));
  return { active, archived };
}

// ── Helper: which user is currently "up" in the round-robin ───────────────

export function isCurrentTurnUser(userId = game.user?.id) {
  const ps = getPhaseState();
  if (ps.phase !== 'active') return false;
  return ps.turnOrder?.[ps.currentIdx] === userId;
}

export function currentTurnUser() {
  const ps = getPhaseState();
  if (ps.phase !== 'active') return null;
  const id = ps.turnOrder?.[ps.currentIdx];
  return id ? game.users?.get(id) ?? null : null;
}

// ── Public actions (branch GM/socket) ──────────────────────────────────────

/**
 * Player or GM creates a new rumour. Used both during the wizard (round 1/2)
 * and freeform via the board (GM only — players go through the wizard).
 *
 * Wizard-driven creates ALSO advance the turn (`advanceTurn: true`).
 */
export async function requestCreateRumour({ text, advanceTurn = false }) {
  const payload = { type: 'createRumour', text, advanceTurn, requestedBy: game.user.id };
  if (game.user?.isGM) return _processAction(payload);
  game.socket.emit(SOCKET_NAME, payload);
  return null;
}

/** Player or GM spreads an existing unspread/fading rumour. Wizard advances turn. */
export async function requestSpreadRumour({ rumourId, advanceTurn = false }) {
  const payload = { type: 'spreadRumour', rumourId, advanceTurn, requestedBy: game.user.id };
  if (game.user?.isGM) return _processAction(payload);
  game.socket.emit(SOCKET_NAME, payload);
  return null;
}

/** Player or GM spends the resolve token on a spread rumour, marking it used. */
export async function requestUseRumour({ rumourId }) {
  const payload = { type: 'useRumour', rumourId, requestedBy: game.user.id };
  if (game.user?.isGM) return _processAction(payload);
  game.socket.emit(SOCKET_NAME, payload);
  return null;
}

// ── GM-only direct actions ─────────────────────────────────────────────────

/** GM begins the phase with a chosen turn order. */
export async function startPhase(turnOrder) {
  if (!game.user?.isGM) return null;
  if (!Array.isArray(turnOrder) || turnOrder.length === 0) return null;
  const cycleNumber = (() => {
    try { return game.settings.get(NS, 'cycleNumber'); }
    catch { return 1; }
  })();
  const next = {
    phase: 'active',
    round: 1,
    turnOrder: [...turnOrder],
    currentIdx: 0,
    startedAtCycle: cycleNumber,
  };
  await game.settings.set(NS, 'rumourPhaseState', next);
  return next;
}

/** GM advances the turn (wizard "next" / "skip" button). */
export async function advanceTurnGM() {
  if (!game.user?.isGM) return null;
  return _advanceTurn();
}

/** GM ends the phase: runs fadeout pass + posts completion. */
export async function finishPhase() {
  if (!game.user?.isGM) return null;
  await _runFadeout();
  await game.settings.set(NS, 'rumourPhaseState', _defaultPhaseState());
  try {
    const { postSystemCard } = await import('./chat-cards.js');
    const { active } = groupRumours();
    await postSystemCard({
      content: game.i18n.format('GOODSOCIETY.rumourWizard.completionCard', {
        n: active.length,
      }),
      context: 'rumour',
    });
  } catch { /* non-fatal */ }
}

/** GM-only: edit a rumour's text (board admin). */
export async function editRumourText(rumourId, newText) {
  if (!game.user?.isGM) return null;
  const all = getRumours();
  const idx = all.findIndex(r => r.id === rumourId);
  if (idx === -1) return null;
  const next = [...all];
  next[idx] = { ...next[idx], text: String(newText ?? '').trim() || next[idx].text };
  await game.settings.set(NS, 'rumours', next);
  return next[idx];
}

/** GM-only: delete a rumour (board admin). */
export async function deleteRumour(rumourId) {
  if (!game.user?.isGM) return false;
  const all = getRumours();
  const next = all.filter(r => r.id !== rumourId);
  if (next.length === all.length) return false;
  await game.settings.set(NS, 'rumours', next);
  return true;
}

// ── GM-side action processor (called by socket handler + direct path) ──────

/**
 * Process an action payload. Called both from socket handler (player-emitted)
 * and direct (GM-emitted via the request* helpers). Always GM-only.
 */
export async function _processAction(payload) {
  if (!game.user?.isGM) return null;
  if (!payload || typeof payload !== 'object') return null;

  switch (payload.type) {
    case 'createRumour':  return _handleCreate(payload);
    case 'spreadRumour':  return _handleSpread(payload);
    case 'useRumour':     return _handleUse(payload);
    default: return null;
  }
}

async function _handleCreate({ text, advanceTurn, requestedBy }) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return null;

  // If wizard-driven, only the active turn user may create.
  if (advanceTurn && !_isAllowedActor(requestedBy)) return null;

  const rumour = {
    id: foundry.utils.randomID(),
    text: trimmed,
    state: 'unspread',
    createdAt: Date.now(),
    spreadAt: 0,
    endedAt: 0,
    endedReason: '',
    createdBy: requestedBy,
  };
  await game.settings.set(NS, 'rumours', [...getRumours(), rumour]);
  if (advanceTurn) await _advanceTurn();
  return rumour;
}

async function _handleSpread({ rumourId, advanceTurn, requestedBy }) {
  if (advanceTurn && !_isAllowedActor(requestedBy)) return null;

  const all = getRumours();
  const idx = all.findIndex(r => r.id === rumourId);
  if (idx === -1) return null;
  const r = all[idx];
  if (r.state !== 'unspread' && r.state !== 'fading') return null; // can't spread a spread/used/faded

  const next = [...all];
  next[idx] = { ...r, state: 'spread', spreadAt: Date.now() };
  await game.settings.set(NS, 'rumours', next);
  if (advanceTurn) await _advanceTurn();
  return next[idx];
}

async function _handleUse({ rumourId, requestedBy }) {
  const all = getRumours();
  const idx = all.findIndex(r => r.id === rumourId);
  if (idx === -1) return null;
  const r = all[idx];
  if (r.state !== 'spread') return null;
  const next = [...all];
  next[idx] = { ...r, state: 'used', endedAt: Date.now(), endedReason: 'used' };
  await game.settings.set(NS, 'rumours', next);
  return next[idx];
}

// ── Turn advancement + fadeout ─────────────────────────────────────────────

async function _advanceTurn() {
  const ps = getPhaseState();
  if (ps.phase !== 'active') return;

  let { round, turnOrder, currentIdx } = ps;
  currentIdx += 1;

  if (currentIdx >= turnOrder.length) {
    if (round === 1) {
      // Reverse for round 2.
      turnOrder = [...turnOrder].reverse();
      round = 2;
      currentIdx = 0;
    } else {
      // End of round 2 → fadeout phase. GM clicks "Run fadeout" to finalize.
      const next = { ...ps, phase: 'fadeout', round: 2 };
      await game.settings.set(NS, 'rumourPhaseState', next);
      return;
    }
  }

  await game.settings.set(NS, 'rumourPhaseState', { ...ps, round, turnOrder, currentIdx });
}

async function _runFadeout() {
  const all = getRumours();
  const next = all.map(r => {
    if (r.state === 'unspread') return { ...r, state: 'fading' };
    if (r.state === 'fading')   return { ...r, state: 'faded', endedAt: Date.now(), endedReason: 'faded' };
    return r;
  });
  await game.settings.set(NS, 'rumours', next);
}

// ── Validation ─────────────────────────────────────────────────────────────

function _isAllowedActor(userId) {
  const ps = getPhaseState();
  if (ps.phase !== 'active') return false;
  return ps.turnOrder?.[ps.currentIdx] === userId;
}

// ── Normalization ──────────────────────────────────────────────────────────

const STATES = ['unspread', 'spread', 'fading', 'faded', 'used'];

function _normalize(r) {
  if (!r || typeof r !== 'object') return r;
  return {
    id:          r.id ?? foundry.utils.randomID(),
    text:        String(r.text ?? '').trim() || '(empty rumour)',
    state:       STATES.includes(r.state) ? r.state : 'unspread',
    createdAt:   Number.isFinite(r.createdAt) ? r.createdAt : 0,
    spreadAt:    Number.isFinite(r.spreadAt)  ? r.spreadAt  : 0,
    endedAt:     Number.isFinite(r.endedAt)   ? r.endedAt   : 0,
    endedReason: r.endedReason ?? '',
    createdBy:   r.createdBy ?? '',
  };
}

function _defaultPhaseState() {
  return { phase: 'idle', round: 0, turnOrder: [], currentIdx: 0, startedAtCycle: 0 };
}

function _normalizePhaseState(raw) {
  if (!raw || typeof raw !== 'object') return _defaultPhaseState();
  return {
    phase:          ['idle', 'active', 'fadeout'].includes(raw.phase) ? raw.phase : 'idle',
    round:          Number.isFinite(raw.round) ? raw.round : 0,
    turnOrder:      Array.isArray(raw.turnOrder) ? raw.turnOrder.slice() : [],
    currentIdx:     Number.isFinite(raw.currentIdx) ? raw.currentIdx : 0,
    startedAtCycle: Number.isFinite(raw.startedAtCycle) ? raw.startedAtCycle : 0,
  };
}
