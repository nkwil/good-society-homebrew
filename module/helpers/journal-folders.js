/**
 * Journal folder helpers — centralized get-or-create for the four entry types
 * in the post-MVP journal elevation patch (§13.1).
 *
 * Each public function returns the resolved Folder (or null on failure) so the
 * calling write path can pass `folder: id` to `JournalEntry.create`. All folder
 * creates are wrapped in try/catch — players who lack folder-create permission
 * see a console.warn and the entry is created at root rather than blocking
 * the archive write.
 *
 * Folder-color hexes match the §13.1 table (forest green / terracotta /
 * subdued sage / gilt). Foundry stores folder colors as literal hex strings,
 * not CSS variables, so the values are inlined here. If the palette ever
 * changes (which the post-MVP patch did), update this file in lockstep.
 */

const TYPE = 'JournalEntry';

const COLORS = {
  letter:      '#2A3A2D', // --gs-brand
  monologue:   '#B85C3F', // --gs-accent-1
  sessionLog:  '#708060', // --gs-accent-2 (sage; "subdued sage" per spec)
  cycleReflection: '#C9A55C', // --gs-accent-3 (gilt)
};

/** Get-or-create a top-level (no parent) JournalEntry folder. */
async function _getOrCreateRoot(name, color = '') {
  const existing = game.folders?.find(
    f => f.type === TYPE && f.name === name && !f.folder,
  );
  if (existing) return existing;
  try {
    return await Folder.create({ name, type: TYPE, ...(color ? { color } : {}) });
  } catch (err) {
    console.warn(`[GS] Could not create root journal folder "${name}" (non-fatal):`, err);
    return null;
  }
}

/** Get-or-create a child JournalEntry folder under a given parent. */
async function _getOrCreateChild(parent, name, color = '') {
  if (!parent) return null;
  const existing = game.folders?.find(
    f => f.type === TYPE && f.name === name && f.folder?.id === parent.id,
  );
  if (existing) return existing;
  try {
    return await Folder.create({
      name,
      type: TYPE,
      folder: parent.id,
      ...(color ? { color } : {}),
    });
  } catch (err) {
    console.warn(`[GS] Could not create child journal folder "${name}" (non-fatal):`, err);
    return null;
  }
}

/**
 * Letters / {Recipient}'s Inbox — returns the inbox folder, or the root
 * "Letters" folder when no recipient name is provided.
 *
 * @param {string} recipientName Free-text recipient (per B-9 letter composer).
 * @returns {Promise<Folder|null>}
 */
export async function letterFolder(recipientName) {
  const root = await _getOrCreateRoot('Letters', COLORS.letter);
  if (!root) return null;
  if (!recipientName) return root;
  const inboxName = `${recipientName}'s Inbox`;
  return (await _getOrCreateChild(root, inboxName, COLORS.letter)) ?? root;
}

/**
 * Monologues / Cycle N — returns the per-cycle folder, or the root
 * "Monologues" folder when cycleNumber is missing.
 *
 * @param {number|string} cycleNumber
 * @returns {Promise<Folder|null>}
 */
export async function monologueFolder(cycleNumber) {
  const root = await _getOrCreateRoot('Monologues', COLORS.monologue);
  if (!root) return null;
  if (cycleNumber == null) return root;
  const cycleName = `Cycle ${cycleNumber}`;
  return (await _getOrCreateChild(root, cycleName, COLORS.monologue)) ?? root;
}

/**
 * Session Logs / {year} — returns the per-year folder.
 *
 * @param {number|string} year
 * @returns {Promise<Folder|null>}
 */
export async function sessionLogFolder(year) {
  const root = await _getOrCreateRoot('Session Logs', COLORS.sessionLog);
  if (!root) return null;
  if (year == null) return root;
  const yearName = String(year);
  return (await _getOrCreateChild(root, yearName, COLORS.sessionLog)) ?? root;
}

/**
 * Cycle Reflections — returns the root reflections folder. The patch's per-
 * cycle reflection entries live flat inside this folder rather than nested
 * by cycle, since cycle dividers are themselves the chapter markers.
 *
 * @returns {Promise<Folder|null>}
 */
export async function cycleReflectionFolder() {
  return _getOrCreateRoot('Cycle Reflections', COLORS.cycleReflection);
}

/**
 * Build the standard `flags['good-society-homebrew']` object for a journal
 * entry created by one of the patch's write paths. Every entry created via
 * the patch's archive flow carries this flag so the sidebar list and the
 * Novel Reader can dispatch on entry type.
 *
 * @param {Object} opts
 * @param {'letter'|'monologue'|'sessionLog'|'cycleDivider'} opts.entryType
 * @param {number|null} [opts.cycleNumber]
 * @param {string|null} [opts.speakerActorId]
 * @returns {Object} suitable for `flags` on a JournalEntry create
 */
export function entryFlags({ entryType, cycleNumber = null, speakerActorId = null }) {
  return {
    'good-society-homebrew': {
      entryType,
      ...(cycleNumber != null ? { cycleNumber } : {}),
      ...(speakerActorId ? { speakerActorId } : {}),
    },
  };
}
