/**
 * LetterComposer — Epistolary phase letter-writing window.
 * Two-zone layout: house chrome (form) + sender-themed live preview.
 * Per docs/design/05-epistolary-ui.md.
 *
 * Send flow: postLetterCard → journal archive (inbox folder) → epistolary-sent hook → clear draft → close.
 * Draft auto-saves every 10s (client setting); restored on re-open.
 */

import { postLetterCard } from '../helpers/chat-cards.js';
import { themedWrap } from '../helpers/themed-wrap.js';

const { HandlebarsApplicationMixin, ApplicationV2, DialogV2 } = foundry.applications.api;

const TEMPLATE   = 'systems/good-society-homebrew/templates/apps/letter-composer.hbs';
const LETTER_TPL = 'systems/good-society-homebrew/templates/chat-cards/letter.hbs';

const SEALS = [
  { id: 'oxblood',     color: '#8B2A2A', label: 'oxblood · burn after reading' },
  { id: 'sage',        color: '#708060', label: 'sage · press and keep' },
  { id: 'candlelight', color: '#C9A55C', label: 'candlelight · given in warmth' },
  { id: 'midnight',    color: '#16100E', label: 'midnight · guard with care' },
];

const RECIPIENT_TYPES = ['major-character', 'connection', 'npc'];

let _composer = null;

export function openLetterComposer() {
  if (!_composer) _composer = new LetterComposer();
  _composer.render(true);
}

export class LetterComposer extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    // toActorId replaces the old toName free-text field
    this._state = { fromActorId: '', toActorId: '', subject: '', body: '', seal: '' };
    this._lastSaved       = null;
    this._draftInterval   = null;
    this._previewDebounce = null;
    this._formController  = null;
    this._restoreDraft();
  }

  static DEFAULT_OPTIONS = {
    id: 'gs-letter-composer',
    classes: ['good-society', 'gs-letter-composer'],
    position: { width: 680, height: 'auto' },
    window: { title: 'GOODSOCIETY.letterComposer.windowTitle', resizable: true },
    actions: {
      selectSeal: LetterComposer.#selectSeal,
      send:       LetterComposer.#send,
      saveDraft:  LetterComposer.#saveDraft,
      cancel:     LetterComposer.#cancel,
    },
  };

  static PARTS = {
    main: { template: TEMPLATE },
  };

  // ── Context preparation ───────────────────────────────────────────────────

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);

    let cycleNumber = null;
    try { cycleNumber = game.settings.get('good-society-homebrew', 'cycleNumber'); } catch {}
    ctx.cycleLabel = cycleNumber
      ? `${game.i18n.localize('GOODSOCIETY.letterComposer.epistolary')} · ${game.i18n.localize('GOODSOCIETY.letterComposer.cycle')} ${cycleNumber}`
      : game.i18n.localize('GOODSOCIETY.letterComposer.epistolary');

    // FROM — owned Majors + owned Connections
    const ownedActors = game.actors
      .filter(a => a.isOwner && (a.type === 'major-character' || a.type === 'connection'))
      .map(a => {
        const persona     = a.system.activePersona;
        const displayName = persona?.name || a.name;
        const subtitle    = (persona && !persona.isPrimary)
          ? `${game.i18n.localize('GOODSOCIETY.letterComposer.as')} ${persona.name} · ${a.system.theme}`
          : a.system.theme;
        return { id: a.id, displayName, subtitle };
      });

    if (!this._state.fromActorId && ownedActors.length) {
      this._state.fromActorId = ownedActors[0].id;
    }
    ctx.ownedActors = ownedActors.map(a => ({ ...a, selected: a.id === this._state.fromActorId }));

    // TO — all visible MCs, Connections, NPCs except the FROM actor
    // Sorted: Majors first, then Connections, then NPCs; alpha within each group.
    const typeOrder = { 'major-character': 0, 'connection': 1, 'npc': 2 };
    const recipientActors = game.actors
      .filter(a => RECIPIENT_TYPES.includes(a.type) && a.id !== this._state.fromActorId)
      .sort((a, b) => {
        const td = (typeOrder[a.type] ?? 3) - (typeOrder[b.type] ?? 3);
        return td !== 0 ? td : (a.name || '').localeCompare(b.name || '');
      })
      .map(a => {
        const displayName = a.system.activePersona?.name || a.name;
        const typeLabel   = game.i18n.localize(`TYPES.Actor.${a.type}`) || a.type;
        return { id: a.id, displayName, typeLabel };
      });

    if (!this._state.toActorId && recipientActors.length) {
      this._state.toActorId = recipientActors[0].id;
    }
    ctx.recipientActors = recipientActors.map(a => ({ ...a, selected: a.id === this._state.toActorId }));

    ctx.seals     = SEALS.map(s => ({ ...s, selected: s.id === this._state.seal }));
    ctx.sealLabel = SEALS.find(s => s.id === this._state.seal)?.label || '';
    ctx.state     = { ...this._state };

    ctx.previewHtml = await this._buildPreviewHtml(cycleNumber);

    // canSend requires sender + recipient + body. The button is also updated
    // dynamically in _updateSendButton() after every form input.
    ctx.canSend    = !!(this._state.fromActorId && this._state.toActorId && this._state.body?.trim());
    ctx.statusText = game.i18n.localize('GOODSOCIETY.letterComposer.draftStatus');

    return ctx;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async _onRender(context, options) {
    await super._onRender(context, options);

    if (this._formController) this._formController.abort();
    this._formController = new AbortController();
    const { signal } = this._formController;

    const form = this.element.querySelector('form');
    if (form) {
      form.addEventListener('input',  this._debouncedPreview.bind(this), { signal });
      form.addEventListener('change', this._debouncedPreview.bind(this), { signal });
    }

    this._startDraftTimer();
  }

  async _onClose(options) {
    if (this._formController) { this._formController.abort(); this._formController = null; }
    this._stopDraftTimer();
    clearTimeout(this._previewDebounce);
    return super._onClose(options);
  }

  // ── Draft persistence ─────────────────────────────────────────────────────

  _restoreDraft() {
    try {
      const draft = game.settings.get('good-society-homebrew', 'letterDraft');
      if (draft && typeof draft === 'object' && draft.body) {
        const { ts, ...rest } = draft;
        Object.assign(this._state, rest);
        this._lastSaved = ts ?? null;
      }
    } catch { /* setting not yet registered at construction time */ }
  }

  async _saveDraft() {
    if (!this._state.body?.trim()) return;
    try {
      await game.settings.set('good-society-homebrew', 'letterDraft', {
        ...this._state, ts: Date.now(),
      });
      this._lastSaved = Date.now();
    } catch (err) {
      console.warn('[GS] Letter draft save failed:', err);
    }
  }

  async _clearDraft() {
    try { await game.settings.set('good-society-homebrew', 'letterDraft', null); } catch {}
  }

  _startDraftTimer() {
    if (this._draftInterval) return;
    this._draftInterval = setInterval(async () => {
      this._readFormState();
      await this._saveDraft();
    }, 10_000);
  }

  _stopDraftTimer() {
    if (this._draftInterval) { clearInterval(this._draftInterval); this._draftInterval = null; }
  }

  // ── Form state ────────────────────────────────────────────────────────────

  _readFormState() {
    const form = this.element?.querySelector('form');
    if (!form) return;
    const get = name => form.elements.namedItem(name)?.value ?? '';
    const fromActorId = get('fromActorId');
    if (fromActorId) this._state.fromActorId = fromActorId;
    this._state.toActorId = get('toActorId');
    this._state.subject   = get('subject');
    this._state.body      = get('body');
  }

  // ── Send button state ─────────────────────────────────────────────────────

  _updateSendButton() {
    const btn = this.element?.querySelector('[data-action="send"]');
    if (!btn) return;
    btn.disabled = !(this._state.fromActorId && this._state.toActorId && this._state.body?.trim());
  }

  // ── Live preview ──────────────────────────────────────────────────────────

  _debouncedPreview() {
    this._readFormState();
    this._updateSendButton();
    clearTimeout(this._previewDebounce);
    this._previewDebounce = setTimeout(() => this._refreshPreview(), 150);
  }

  async _refreshPreview() {
    const zone = this.element?.querySelector('#gs-letter-preview-zone');
    if (!zone) return;
    let cycleNumber = null;
    try { cycleNumber = game.settings.get('good-society-homebrew', 'cycleNumber'); } catch {}
    zone.innerHTML = await this._buildPreviewHtml(cycleNumber);
  }

  _resolveToName() {
    const actor = game.actors.get(this._state.toActorId);
    return actor ? (actor.system.activePersona?.name || actor.name) : '';
  }

  async _buildPreviewHtml(cycleNumber = null) {
    const actor       = game.actors.get(this._state.fromActorId) ?? null;
    const persona     = actor?.system?.activePersona ?? null;
    const speakerName = persona?.name || actor?.name || '—';
    const letter = {
      to:      this._resolveToName(),
      subject: this._state.subject || '',
      body:    this._state.body    || '',
      seal:    this._state.seal    || '',
    };
    const inner = await foundry.applications.handlebars.renderTemplate(LETTER_TPL, {
      actor, persona, letter, cycleNumber, speakerName,
    });
    return themedWrap(actor, inner, ['gs-letter-card']);
  }

  // ── Journal archive / inbox ───────────────────────────────────────────────

  async _archiveToJournal(actor, persona, letter, cycleNumber, recipientActor) {
    try {
      const speakerName    = persona?.name || actor.name;
      const recipientLabel = letter.to || game.i18n.localize('GOODSOCIETY.letterComposer.unknownRecipient');
      const cycleLabel     = game.i18n.localize('GOODSOCIETY.letterComposer.cycle');
      const entryName      = cycleNumber
        ? `${speakerName} → ${recipientLabel} (${cycleLabel} ${cycleNumber})`
        : `${speakerName} → ${recipientLabel}`;

      const inner = await foundry.applications.handlebars.renderTemplate(LETTER_TPL, {
        actor, persona, letter, cycleNumber, speakerName,
      });
      const html = themedWrap(actor, inner, ['gs-letter-card']);

      // Build ownership — sender is OWNER, recipient's owners get OBSERVER
      const ownership = { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE };
      ownership[game.user.id] = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
      if (recipientActor) {
        Object.entries(recipientActor.ownership ?? {})
          .filter(([uid, lvl]) => uid !== 'default' && lvl >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER)
          .forEach(([uid]) => {
            if (!(uid in ownership)) ownership[uid] = CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER;
          });
      }

      // Find or create Letters folder → recipient inbox sub-folder.
      // Folder creation may fail for players who lack that permission — non-fatal.
      let folderId = null;
      try {
        let lettersFolder = game.folders.find(
          f => f.type === 'JournalEntry' && f.name === 'Letters' && !f.folder,
        );
        if (!lettersFolder) {
          lettersFolder = await Folder.create({ name: 'Letters', type: 'JournalEntry', color: '#2A3A2D' });
        }
        if (lettersFolder && recipientActor) {
          const recipientDisplayName = recipientActor.system?.activePersona?.name || recipientActor.name;
          const inboxName            = `${recipientDisplayName}'s Inbox`;
          let inboxFolder = game.folders.find(
            f => f.type === 'JournalEntry' && f.name === inboxName && f.folder?.id === lettersFolder.id,
          );
          if (!inboxFolder) {
            inboxFolder = await Folder.create({ name: inboxName, type: 'JournalEntry', folder: lettersFolder.id });
          }
          folderId = inboxFolder?.id ?? lettersFolder.id;
        } else if (lettersFolder) {
          folderId = lettersFolder.id;
        }
      } catch (folderErr) {
        console.warn('[GS] Could not create letter inbox folder (non-fatal):', folderErr);
      }

      await JournalEntry.create({
        name: entryName,
        ...(folderId ? { folder: folderId } : {}),
        ownership,
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

  // ── Actions ───────────────────────────────────────────────────────────────

  static #selectSeal(event, target) {
    const sealId = target.dataset.sealId;
    this._state.seal = this._state.seal === sealId ? '' : sealId;

    this.element.querySelectorAll('.gs-letter-composer__seal-circle').forEach(el => {
      el.classList.toggle('gs-letter-composer__seal-circle--selected', el.dataset.sealId === this._state.seal);
    });
    const labelEl = this.element.querySelector('.gs-letter-composer__seal-label');
    if (labelEl) labelEl.textContent = SEALS.find(s => s.id === this._state.seal)?.label || '';

    clearTimeout(this._previewDebounce);
    this._previewDebounce = setTimeout(() => this._refreshPreview(), 150);
  }

  static async #send(event, target) {
    this._readFormState();

    const actor = game.actors.get(this._state.fromActorId);
    if (!actor) {
      ui.notifications?.warn(game.i18n.localize('GOODSOCIETY.letterComposer.noSender'));
      return;
    }
    const recipientActor = game.actors.get(this._state.toActorId) ?? null;
    if (!recipientActor) {
      ui.notifications?.warn(game.i18n.localize('GOODSOCIETY.letterComposer.noRecipient'));
      return;
    }
    if (!this._state.body?.trim()) {
      ui.notifications?.warn(game.i18n.localize('GOODSOCIETY.letterComposer.noBody'));
      return;
    }

    const persona = actor.system.activePersona ?? null;
    const toName  = recipientActor.system?.activePersona?.name || recipientActor.name;
    const letter  = {
      to:      toName,
      subject: this._state.subject || '',
      body:    this._state.body.trim(),
      seal:    this._state.seal    || '',
    };
    let cycleNumber = null;
    try { cycleNumber = game.settings.get('good-society-homebrew', 'cycleNumber'); } catch {}

    // Whisper targets: sender + recipient owners + GM (postLetterCard adds GM automatically)
    const whisperIds = Object.entries(recipientActor.ownership ?? {})
      .filter(([uid, lvl]) => uid !== 'default' && lvl >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER)
      .map(([uid]) => uid);

    await postLetterCard({ actor, persona, letter, cycleNumber, whisper: true, whisperIds });
    await this._archiveToJournal(actor, persona, letter, cycleNumber, recipientActor);

    Hooks.callAll('goodSociety.epistolarySent', {
      actorId:          actor.id,
      actorName:        actor.name,
      speakerName:      persona?.name || actor.name,
      recipientActorId: recipientActor.id,
      letter,
      cycleNumber,
    });

    await this._clearDraft();
    this.close();
  }

  static async #saveDraft(event, target) {
    this._readFormState();
    await this._saveDraft();
    ui.notifications?.info(game.i18n.localize('GOODSOCIETY.letterComposer.draftSaved'));
    this.close();
  }

  static async #cancel(event, target) {
    this._readFormState();
    const savedBody = (() => {
      try { return game.settings.get('good-society-homebrew', 'letterDraft')?.body?.trim() || ''; }
      catch { return ''; }
    })();
    const currentBody = this._state.body?.trim() || '';

    if (currentBody && currentBody !== savedBody) {
      const confirmed = await DialogV2.confirm({
        window: { title: game.i18n.localize('GOODSOCIETY.letterComposer.discardTitle') },
        content: `<p>${game.i18n.localize('GOODSOCIETY.letterComposer.discardBody')}</p>`,
      });
      if (!confirmed) return;
    }
    this.close();
  }
}
