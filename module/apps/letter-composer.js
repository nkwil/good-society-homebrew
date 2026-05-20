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
import { letterFolder, entryFlags } from '../helpers/journal-folders.js';
import { profileName, explicitPersona } from '../helpers/profile-pic.js';
import { SEAL_TYPES, SCRIPT_FONTS, scriptFontFamily } from '../constants.js';
import { parchmentVariantFor } from '../helpers/parchment.js';

const { HandlebarsApplicationMixin, ApplicationV2, DialogV2 } = foundry.applications.api;

const TEMPLATE   = 'systems/good-society-homebrew/templates/apps/letter-composer.hbs';
const LETTER_TPL = 'systems/good-society-homebrew/templates/chat-cards/letter.hbs';
const NS         = 'good-society-homebrew';

/**
 * Seal vocabulary — sourced from the typed registry in `module/constants.js`.
 * Per post-MVP §11.2 (expanded 2026-05), seals are real wax-seal assets that
 * also carry mechanical meaning when applicable (red-gold → invitation hook,
 * black → burn-after-reading; all others purely decorative). The composer's
 * picker renders the assets directly; behavior wiring lives in
 * `module/hooks/letter-seals.js` and reads from the registry.
 *
 * The registry's `label` and `description` are localization-key fragments
 * (resolved under GOODSOCIETY.seal.{key} — e.g. 'redGold' →
 * 'GOODSOCIETY.seal.redGold'); the composer resolves them at render time so
 * the language file owns the strings.
 */
const SEALS = SEAL_TYPES.map(s => ({
  id: s.id,
  color: s.color,
  iconAsset: s.iconAsset,
  behavior: s.behavior,
  // Resolved at render time via _prepareContext; kept here as a fallback for
  // any direct access (e.g. the legacy id→label lookup further down).
  label: s.label,
}));

const RECIPIENT_TYPES = ['major-character', 'connection', 'npc'];

/**
 * Salutation + sign-off registries.
 *
 * Each entry holds an id only; the human-readable picker label and the
 * substitution template ("Dear {name}," / "Yours faithfully,") live in
 * `lang/en.json` under `GOODSOCIETY.letterComposer.greetings.{id}.{label,template}`
 * and `…closings.{id}.{…}`. The composer resolves both at render time so the
 * language file owns the strings.
 *
 * Order here = picker order. `none` is the suppress option (empty template).
 */
const GREETING_IDS = [
  'dear', 'my-dear', 'dearest', 'my-dearest',
  'esteemed', 'to', 'beloved', 'honoured', 'none',
];
const CLOSING_IDS = [
  'faithfully', 'sincerely', 'ever', 'affectionately',
  'devoted', 'remain', 'regard', 'servant', 'none',
];

const DEFAULT_GREETING = 'dear';
const DEFAULT_CLOSING  = 'faithfully';

/** Resolve a greeting/closing template via i18n, substituting tokens. */
function _formatSalutation(kind, id, vars = {}) {
  if (!id || id === 'none') return '';
  const key = `GOODSOCIETY.letterComposer.${kind}.${id}.template`;
  const tpl = game.i18n.localize(key);
  if (!tpl || tpl === key) return ''; // missing key — fail silent
  return tpl
    .replace('{name}',   vars.name   ?? '')
    .replace('{sender}', vars.sender ?? '');
}

let _composer = null;

/**
 * Open the letter composer. Pass `fromActorId` to pre-select the sender — used
 * when launching from the Epistolary Wizard so the inbox's active character is
 * already chosen in the FROM dropdown. Ignored if the actor isn't a sendable
 * (owned Major/Connection).
 */
export function openLetterComposer(fromActorId = null) {
  if (!_composer) _composer = new LetterComposer();
  if (fromActorId) {
    const actor = game.actors?.get(fromActorId);
    if (actor?.isOwner && (actor.type === 'major-character' || actor.type === 'connection')) {
      _composer._state.fromActorId = fromActorId;
    }
  }
  _composer.render(true);
}

export class LetterComposer extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    // toActorId replaces the old toName free-text field
    this._state = {
      fromActorId: '',
      toActorId:   '',
      subject:     '',
      body:        '',
      seal:        '',
      greeting:    DEFAULT_GREETING,
      closing:     DEFAULT_CLOSING,
      scriptFont:  'none',
    };
    this._lastSaved       = null;
    this._draftInterval   = null;
    this._previewDebounce = null;
    this._formController  = null;
    this._restoreDraft();
  }

  static DEFAULT_OPTIONS = {
    id: 'gs-letter-composer',
    classes: ['good-society', 'gs-letter-composer'],
    // Width bumped to 1080 so the new two-page book layout has room for
    // the form (left page) + live preview (right page) side-by-side. On
    // narrow windows CSS falls back to a stacked layout automatically.
    position: { width: 1080, height: 720 },
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
        // Resolve persona/name via the explicit-only helpers — the data-model
        // `activePersona` getter falls back to the primary/first persona when
        // `activePersonaId` is empty (the "Mags stuck" bug).
        const persona     = explicitPersona(a);
        const displayName = profileName(a);
        const subtitle    = persona
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
        const displayName = profileName(a);
        const typeLabel   = game.i18n.localize(`TYPES.Actor.${a.type}`) || a.type;
        return { id: a.id, displayName, typeLabel };
      });

    if (!this._state.toActorId && recipientActors.length) {
      this._state.toActorId = recipientActors[0].id;
    }
    ctx.recipientActors = recipientActors.map(a => ({ ...a, selected: a.id === this._state.toActorId }));

    // Resolve the seal labels via i18n at render time. Each entry's `label`
    // in SEAL_TYPES is a key fragment (e.g. 'casual' → 'GOODSOCIETY.seal.casual').
    ctx.seals     = SEALS.map(s => ({
      ...s,
      label: game.i18n.localize(`GOODSOCIETY.seal.${s.label}`) || s.label,
      selected: s.id === this._state.seal,
    }));
    const selectedSeal = ctx.seals.find(s => s.id === this._state.seal);
    ctx.sealLabel = selectedSeal?.label || '';

    // Greeting + closing pickers — localized labels, current selection marked.
    const _optionFor = (kind, id, selected) => ({
      id,
      label: game.i18n.localize(`GOODSOCIETY.letterComposer.${kind}.${id}.label`) || id,
      selected,
    });
    ctx.greetings = GREETING_IDS.map(id => _optionFor('greetings', id, id === this._state.greeting));
    ctx.closings  = CLOSING_IDS .map(id => _optionFor('closings',  id, id === this._state.closing));

    // Script-font picker — calligraphy faces for the greeting + signature.
    ctx.scriptFonts = SCRIPT_FONTS.map(f => ({
      id: f.id,
      label: game.i18n.localize(`GOODSOCIETY.scriptFont.${f.label}`) || f.label,
      family: f.family,
      selected: f.id === this._state.scriptFont,
    }));

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
    const greeting = get('greeting');
    if (greeting) this._state.greeting = greeting;
    const closing  = get('closing');
    if (closing)  this._state.closing  = closing;
    const scriptFont = get('scriptFont');
    if (scriptFont) this._state.scriptFont = scriptFont;
  }

  /**
   * Assemble the canonical letter payload — fields stored in state plus the
   * resolved greeting/closing lines (rendered strings, already i18n + token-
   * substituted). Used by both the live preview and the send path so the
   * archive and the chat message render identically.
   */
  _buildLetterPayload() {
    const recipientName = this._resolveToName();
    const actor         = game.actors.get(this._state.fromActorId);
    const senderName    = actor ? profileName(actor) : '';
    // Resolve the localized seal label + the asset path so the preview +
    // archive render both the human-readable string and the actual wax-seal
    // image in the chat-card footer.
    let sealLabel     = '';
    let sealIconAsset = '';
    let sealAccent    = '';
    if (this._state.seal) {
      const entry = SEAL_TYPES.find(s => s.id === this._state.seal);
      if (entry) {
        const key = `GOODSOCIETY.seal.${entry.label}`;
        const txt = game.i18n.localize(key);
        sealLabel     = (txt && txt !== key) ? txt : (entry.label || this._state.seal);
        sealIconAsset = entry.iconAsset || '';
        sealAccent    = entry.color     || '';
      }
    }
    return {
      to:           recipientName,
      subject:      this._state.subject || '',
      body:         this._state.body    || '',
      seal:         this._state.seal    || '',
      sealLabel,
      sealIconAsset,
      sealAccent,
      greeting:     this._state.greeting || '',
      closing:      this._state.closing  || '',
      greetingLine: _formatSalutation('greetings', this._state.greeting, { name: recipientName }),
      closingLine:  _formatSalutation('closings',  this._state.closing,  { sender: senderName }),
      scriptFont:       this._state.scriptFont || 'none',
      scriptFontFamily: scriptFontFamily(this._state.scriptFont),
    };
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
    return actor ? profileName(actor) : '';
  }

  async _buildPreviewHtml(cycleNumber = null) {
    const actor       = game.actors.get(this._state.fromActorId) ?? null;
    const persona     = explicitPersona(actor);
    const speakerName = actor ? profileName(actor) : '—';
    const letter      = this._buildLetterPayload();
    const inner = await foundry.applications.handlebars.renderTemplate(LETTER_TPL, {
      actor, persona, letter, cycleNumber, speakerName,
    });
    // A parchment variant keyed to the sender — each character writes on
    // their own stable stationery in the preview (same logic the Epistolary
    // Wizard's inbox uses for delivered letters).
    const variant = parchmentVariantFor(actor?.id ?? 'no-actor');
    return themedWrap(actor, inner, ['gs-letter-card', `gs-parchment-v${variant}`]);
  }

  // ── Journal archive / inbox ───────────────────────────────────────────────

  async _archiveToJournal(actor, persona, letter, cycleNumber, recipientActor) {
    try {
      const speakerName    = profileName(actor);
      const recipientLabel = letter.to || game.i18n.localize('GOODSOCIETY.letterComposer.unknownRecipient');
      const cycleLabel     = game.i18n.localize('GOODSOCIETY.letterComposer.cycle');
      const entryName      = cycleNumber
        ? `${speakerName} → ${recipientLabel} (${cycleLabel} ${cycleNumber})`
        : `${speakerName} → ${recipientLabel}`;

      const inner = await foundry.applications.handlebars.renderTemplate(LETTER_TPL, {
        actor, persona, letter, cycleNumber, speakerName,
      });
      const html = themedWrap(actor, inner, ['gs-letter-card']);

      // Build ownership — sender is OWNER, recipient's owners get OBSERVER.
      // Use the sending user's id, but if archive is GM-delegated we keep the
      // sender in the ownership map so they retain OWNER on the entry.
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

      // GM-only privileges: creating folders and JournalEntries both require
      // permissions players don't have by default. If a non-GM user calls
      // this, delegate the whole archive step to the first GM client via the
      // system socket. The send-to-chat step itself already succeeded by the
      // time we get here; the archive is the only privileged write.
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

    // Explicit persona only — never the data-model getter's primary fallback.
    const persona = explicitPersona(actor);
    // Build via the same helper the preview uses so archived + chat-emitted
    // letters render identically. trim body to drop trailing whitespace
    // that snuck in via the textarea.
    const letter = this._buildLetterPayload();
    letter.body  = letter.body.trim();
    let cycleNumber = null;
    try { cycleNumber = game.settings.get('good-society-homebrew', 'cycleNumber'); } catch {}

    // Whisper targets: sender + recipient owners + GM (postLetterCard adds GM automatically)
    const whisperIds = Object.entries(recipientActor.ownership ?? {})
      .filter(([uid, lvl]) => uid !== 'default' && lvl >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER)
      .map(([uid]) => uid);

    // Run the send work and the fold-and-seal animation in parallel — the
    // visual finishes ~720ms after click, by which time the chat card and
    // journal archive are also done.
    const sendWork = (async () => {
      await postLetterCard({ actor, persona, letter, cycleNumber, whisper: true, whisperIds });
      await this._archiveToJournal(actor, persona, letter, cycleNumber, recipientActor);
      Hooks.callAll('goodSociety.epistolarySent', {
        actorId:          actor.id,
        actorName:        actor.name,
        speakerName:      profileName(actor),
        recipientActorId: recipientActor.id,
        letter,
        cycleNumber,
      });
    })();
    await Promise.all([sendWork, this._playSendAnimation()]);

    await this._clearDraft();
    this.close();
  }

  /**
   * Reverse of the Epistolary Wizard's "open letter" animation. The unfolded
   * parchment scales-and-fades away while a folded envelope crossfades in
   * with the chosen wax seal stamping on top. ~720ms total.
   */
  async _playSendAnimation() {
    const zone = this.element?.querySelector('.gs-letter-composer__preview-zone');
    if (!zone) return;

    const seal = SEAL_TYPES.find(s => s.id === this._state.seal);
    const sealAsset = seal?.iconAsset ?? '';
    const sealAccent = seal?.color ?? 'var(--gs-brand)';

    // Inject the folded-envelope overlay. The CSS-keyframes-driven animation
    // is gated on `.is-sending` on the preview zone.
    const overlay = document.createElement('div');
    overlay.className = 'gs-letter-composer__envelope-overlay';
    overlay.innerHTML = `
      <img class="gs-letter-composer__envelope-img"
           src="/systems/good-society-homebrew/assets/parchment/envelope.png" alt="" />
      ${sealAsset
        ? `<div class="gs-letter-composer__envelope-seal"
                 style="background-image: url('${sealAsset}'); --gs-seal-accent: ${sealAccent};"></div>`
        : ''}
    `;
    zone.appendChild(overlay);
    // One frame later so the keyframe transition fires from initial state.
    await new Promise(r => requestAnimationFrame(r));
    zone.classList.add('is-sending');
    await new Promise(r => setTimeout(r, 720));
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
