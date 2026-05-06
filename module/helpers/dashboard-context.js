/**
 * dashboard-context.js — pure context builder for the Public Info Dashboard.
 *
 * No Foundry Document mutation here — read-only.
 * Called from PublicInfoDashboard._prepareContext() and from actor hooks.
 */

const NS = 'good-society-homebrew';

function _readSetting(key, fallback) {
  try { return game.settings.get(NS, key); }
  catch { return fallback; }
}

export const CYCLE_PHASES = [
  'pre-cycle',
  'novel',
  'reputation',
  'rumour-scandal',
  'epistolary',
  'upkeep',
];

export const NEXT_PHASE = {
  'pre-cycle':     'novel',
  'novel':         'reputation',
  'reputation':    'rumour-scandal',
  'rumour-scandal':'epistolary',
  'epistolary':    'upkeep',
  'upkeep':        'novel',
};

const PHASE_I18N = {
  'pre-cycle':      'GOODSOCIETY.cyclePhase.preCycle',
  'novel':          'GOODSOCIETY.cyclePhase.novel',
  'reputation':     'GOODSOCIETY.cyclePhase.reputation',
  'rumour-scandal': 'GOODSOCIETY.cyclePhase.rumourScandal',
  'epistolary':     'GOODSOCIETY.cyclePhase.epistolary',
  'upkeep':         'GOODSOCIETY.cyclePhase.upkeep',
};

/** Strip HTML tags from an HTMLField value to get plain text. */
function _stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').trim();
}

/**
 * Whether any non-GM user with OWNER access to `actor` is currently online.
 * Actors with no player-owner show as "inactive" in the footer count.
 */
function _ownerOnline(actor) {
  return game.users.some(u =>
    !u.isGM &&
    u.active &&
    actor.getUserLevel(u) >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER
  );
}

/**
 * Build the context data for a single Major Character row.
 * @param {Actor} actor
 * @returns {Object}
 */
function _buildRowData(actor) {
  const sys = actor.system;

  // Portrait: active persona first, then actor img
  const persona = sys.activePersona;
  const portraitUrl = persona?.portraitUrl || actor.img || '';
  const initial = (actor.name || '?')[0].toUpperCase();

  // Role subtitle: localized peerage
  const peerageLabelKey = `GOODSOCIETY.major.peerage.${sys.bio?.peerage ?? 'new-arrival'}`;
  const role = game.i18n.localize(peerageLabelKey);

  // Resolve pips — array of booleans (true = filled)
  const resolveMax = sys.tokens?.resolve?.max ?? 5;
  const resolveCurrent = sys.tokens?.resolve?.current ?? 0;
  const resolvePips = Array.from({ length: resolveMax }, (_, i) => i < resolveCurrent);

  const mtActive = sys.tokens?.major ?? false;
  const monologueAvailable = !(sys.tokens?.monologuedThisCycle ?? false);

  // Desire + visibility
  const desireVis = sys.visibility?.desire ?? 'secret';
  const desireText = _stripHtml(sys.desire ?? '');

  const ownerOnline = _ownerOnline(actor);

  // Accessible aria-label
  const desireDesc = desireVis === 'public' && desireText
    ? `Desire: ${desireText}`
    : `Desire: ${desireVis}`;
  const ariaLabel = [
    actor.name,
    `Resolve ${resolveCurrent} of ${resolveMax}`,
    mtActive ? 'MT active' : 'MT inactive',
    monologueAvailable ? 'Monologue available' : 'Monologue spent',
    desireDesc,
  ].join('. ');

  return {
    id: actor.id,
    name: actor.name,
    theme: sys.theme || 'clayton',
    portraitUrl,
    initial,
    role,
    resolvePips,
    resolveMax,
    resolveCurrent,
    mtActive,
    monologueAvailable,
    desireVis,
    desireText,
    ownerOnline,
    ariaLabel,
  };
}

/**
 * Build the complete context for PublicInfoDashboard._prepareContext().
 * @returns {Object}
 */
export function buildDashboardContext() {
  const majors = (game.actors?.filter(a => a.type === 'major-character') ?? [])
    .map(_buildRowData);

  const activeMajorCount = majors.filter(m => m.ownerOnline).length;
  const inactiveNames    = majors.filter(m => !m.ownerOnline).map(m => m.name);

  const cyclePhase     = _readSetting('cyclePhase', 'pre-cycle');
  const cycleNumber    = _readSetting('cycleNumber', 1);
  const phaseLabelKey  = PHASE_I18N[cyclePhase] ?? PHASE_I18N['pre-cycle'];
  const cyclePhaseName = game.i18n.localize(phaseLabelKey);

  return {
    majors,
    noMajors:         majors.length === 0,
    activeMajorCount,
    totalMajorCount:  majors.length,
    inactiveNames,
    cyclePhase,
    cycleNumber,
    cyclePhaseName,
    isGM: game.user?.isGM ?? false,
  };
}
