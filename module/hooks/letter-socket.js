/**
 * letter-socket.js — GM-side proxy for `letter.archiveRequest` socket payloads
 * emitted by players when they send a letter.
 *
 * JournalEntry.create + Folder.create both require GM-level permissions which
 * players don't have by default. The letter composer's archive step emits
 * over the system socket; this hook listens on every client and runs the
 * archive only on a GM client (first GM if multiple are connected).
 *
 * Shares the `system.good-society-homebrew` channel with rumour-socket and
 * random-event-socket. Payloads are dispatched via `payload.type`, so this
 * listener is no-op for everything except `letter.archiveRequest`.
 */

import { letterFolder, entryFlags } from '../helpers/journal-folders.js';

const NS = 'good-society-homebrew';
const SOCKET_NAME = `system.${NS}`;

async function _processArchive(payload) {
  if (!game.user?.isGM) return;
  const { entryName, html, ownership, recipientFolderKey, cycleNumber, speakerActorId } = payload;
  if (!entryName || !html) return;

  try {
    const folder = recipientFolderKey ? await letterFolder(recipientFolderKey) : null;
    await JournalEntry.create({
      name: entryName,
      ...(folder ? { folder: folder.id } : {}),
      ownership,
      flags: entryFlags({
        entryType: 'letter',
        cycleNumber,
        speakerActorId,
      }),
      pages: [{
        name: entryName,
        type: 'text',
        text: { content: html, format: CONST.JOURNAL_ENTRY_PAGE_FORMATS?.HTML ?? 1 },
      }],
    });
  } catch (err) {
    console.warn('[GS] Letter archive proxy failed:', err, payload);
  }
}

export function register() {
  Hooks.once('ready', () => {
    if (!game.socket) return;
    game.socket.on(SOCKET_NAME, async (payload) => {
      if (!payload || typeof payload !== 'object') return;
      if (payload.type !== 'letter.archiveRequest') return;
      await _processArchive(payload);
    });
  });
}
