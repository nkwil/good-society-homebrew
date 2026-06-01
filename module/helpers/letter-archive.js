/**
 * letter-archive.js — archive a sent letter to the novel (a JournalEntry under
 * the recipient's letter folder).
 *
 * Shared by both delivery paths so they archive identically:
 *   - the in-phase Send button (module/apps/letter-composer.js)
 *   - the queued off-phase delivery prompt (module/hooks/epistolary-phase.js)
 *
 * Creating folders + JournalEntries needs GM permissions players don't have, so
 * a non-GM caller delegates the whole archive to the first GM client over the
 * system socket (the chat card itself already posted by the time we reach here;
 * the archive is the only privileged write). letter-socket.js runs the proxy.
 */

import { themedWrap } from './themed-wrap.js';
import { letterFolder, entryFlags } from './journal-folders.js';
import { profileName } from './profile-pic.js';

const NS = 'good-society-homebrew';
const LETTER_TPL = 'systems/good-society-homebrew/templates/chat-cards/letter.hbs';

/**
 * Archive a letter to the novel. Best-effort and non-fatal — a failed archive
 * never blocks the chat-card delivery that already happened.
 *
 * @param {object}      opts
 * @param {Actor}       opts.actor          The sending actor (real sender).
 * @param {object|null} opts.persona        Resolved explicit persona (for template render).
 * @param {object}      opts.letter         The letter payload (carries signatureName, anonymous, letterId, …).
 * @param {number|null} opts.cycleNumber    Current cycle, for the entry name + flags.
 * @param {Actor|null}  opts.recipientActor Recipient actor (for ownership + folder), or null.
 */
export async function archiveLetterToJournal({ actor, persona, letter, cycleNumber, recipientActor }) {
  try {
    const speakerName    = letter.signatureName || actor.name;
    const recipientLabel = letter.to || game.i18n.localize('GOODSOCIETY.letterComposer.unknownRecipient');
    const cycleLabel     = game.i18n.localize('GOODSOCIETY.letterComposer.cycle');
    const entryName      = cycleNumber
      ? `${speakerName} → ${recipientLabel} (${cycleLabel} ${cycleNumber})`
      : `${speakerName} → ${recipientLabel}`;

    const inner = await foundry.applications.handlebars.renderTemplate(LETTER_TPL, {
      actor, persona, letter, cycleNumber, speakerName,
    });
    // Anonymous letters wrap house-neutral (theme=null → 'npc') so the archived
    // novel entry can't be matched to the sender by its theme.
    const html = themedWrap(letter.anonymous ? null : actor, inner, ['gs-letter-card']);

    // Build ownership — sender is OWNER, recipient's owners get OBSERVER.
    const ownership = { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE };
    ownership[game.user.id] = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
    if (recipientActor) {
      Object.entries(recipientActor.ownership ?? {})
        .filter(([uid, lvl]) => uid !== 'default' && lvl >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER)
        .forEach(([uid]) => {
          if (!(uid in ownership)) ownership[uid] = CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER;
        });
    }

    const recipientFolderKey = recipientActor
      ? profileName(recipientActor)
      : recipientLabel;

    // Non-GM → delegate the privileged write to the first GM client.
    if (!game.user?.isGM) {
      if (game.socket) {
        game.socket.emit(`system.${NS}`, {
          type: 'letter.archiveRequest',
          entryName,
          html,
          ownership,
          recipientFolderKey,
          cycleNumber,
          speakerActorId: actor.id,
          letterId: letter.letterId ?? '',
          requestedBy: game.user.id,
        });
      }
      return;
    }

    // GM-side direct write.
    const folder = await letterFolder(recipientFolderKey);
    await JournalEntry.create({
      name: entryName,
      ...(folder ? { folder: folder.id } : {}),
      ownership,
      flags: entryFlags({
        entryType: 'letter',
        cycleNumber,
        speakerActorId: actor.id,
        letterId: letter.letterId ?? '',
      }),
      pages: [{
        name: entryName,
        type: 'text',
        text: { content: html, format: CONST.JOURNAL_ENTRY_PAGE_FORMATS?.HTML ?? 1 },
      }],
    });
  } catch (err) {
    console.warn('[GS] Letter journal archive failed (non-fatal):', err);
  }
}
