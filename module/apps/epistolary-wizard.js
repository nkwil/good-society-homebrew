/**
 * Epistolary Wizard — post-MVP §11 / patch-epistolary-wizard.md.
 *
 * A phase environment wrapping the locked v1 letter composer + letter card.
 * Three tabs (Inbox / Compose / Outbox) per actor; per-actor "mark done"
 * flow that writes `flags.epistolaryDone[cycleNumber] = true`. The composer
 * itself is reused unmodified — clicking "Compose" opens it.
 *
 * Letters are surfaced from the Foundry chat log: every letter card carries
 * `flags['good-society-homebrew'].cardType === 'letter'` plus speaker /
 * recipient identifiers (per Session B-9 + post-MVP §11.2 wiring). Inbox
 * filters to messages whose recipient matches the active actor; Outbox to
 * those whose senderActorId matches.
 *
 * Per the patch-epistolary spec the wizard auto-opens for each owned-Major
 * user when cyclePhase becomes `epistolary`. That behavior is wired in
 * `module/hooks/cycle-phase-change.js` — kept light here.
 */

import { openLetterComposer } from './letter-composer.js';
import { profilePic, profileName } from '../helpers/profile-pic.js';
import { SEAL_TYPES, scriptFontFamily } from '../constants.js';
import { parchmentVariantFor } from '../helpers/parchment.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const FLAG_SCOPE = 'good-society-homebrew';
const TEMPLATE = 'systems/good-society-homebrew/templates/apps/epistolary-wizard.hbs';

let _instance = null;

export class EpistolaryWizard extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'gs-epistolary-wizard',
    classes: ['good-society', 'gs-epistolary-wizard'],
    window: {
      title: 'GOODSOCIETY.epistolary.wizard.title',
      icon: 'fa-solid fa-envelope',
      resizable: true,
    },
    position: { width: 760, height: 640 },
    actions: {
      switchTab:    EpistolaryWizard.#switchTab,
      composeNew:   EpistolaryWizard.#composeNew,
      switchActor:  EpistolaryWizard.#switchActor,
      filterBySeal: EpistolaryWizard.#filterBySeal,
      markDone:     EpistolaryWizard.#markDone,
      openLetter:   EpistolaryWizard.#openLetter,
      closeLetter:  EpistolaryWizard.#closeLetter,
      breakSeal:    EpistolaryWizard.#breakSeal,
    },
  };

  static PARTS = {
    main: { template: TEMPLATE },
  };

  constructor(options = {}) {
    super(options);
    this.actorId = options.actorId ?? null;
    this._currentTab = options.initialTab ?? 'inbox';
    this._sealFilter = null; // null | any seal id from SEAL_TYPES (see module/constants.js)
    this._listenerController = null;
    // Selected letter id for the in-wizard reader pane. null = list view.
    this._selectedLetterId = null;
    // Letters whose seal has been broken — they render already unfolded (no
    // re-played ceremony) when re-selected, and don't count toward the inbox
    // unread badge. Persisted per-user so the read state survives reload.
    let opened = [];
    try { opened = game.user?.getFlag(FLAG_SCOPE, 'openedLetters') ?? []; } catch {}
    this._openedLetterIds = new Set(opened);
  }

  /** Resolve the active actor from id (so re-renders pick up renames etc.). */
  get actor() {
    return this.actorId ? game.actors?.get(this.actorId) : null;
  }

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    const actor = this.actor;

    // Recipient picker — owned Majors AND owned Connections. Connections
    // can be addressed by letters too, so they need an inbox; the picker
    // groups them under their own optgroup. Same OWNER-permission rule as
    // Majors (GMs implicitly own everything; players see a Connection here
    // once it's been promoted to OWNER for them).
    const toPickerEntry = (a) => ({
      id: a.id,
      name: profileName(a),
      isActive: a.id === this.actorId,
    });
    const myMajors = (game.actors?.filter(
      (a) => a.type === 'major-character' && a.testUserPermission(game.user, 'OWNER'),
    ) ?? []).map(toPickerEntry);
    const myConnections = (game.actors?.filter(
      (a) => a.type === 'connection' && a.testUserPermission(game.user, 'OWNER'),
    ) ?? []).map(toPickerEntry);
    const pickerActors = [...myMajors, ...myConnections];
    if (!this.actorId && pickerActors.length) {
      this.actorId = pickerActors[0].id;
    }

    let cycleNumber = 1;
    try { cycleNumber = game.settings.get(FLAG_SCOPE, 'cycleNumber'); } catch {}

    // Find every letter chat-card. The Foundry chat log is the canonical
    // store — letters are also archived in journal folders, but for "what
    // arrived this cycle" the chat log is authoritative.
    const allLetters = (game.messages?.contents ?? [])
      .filter((m) => m.flags?.[FLAG_SCOPE]?.cardType === 'letter')
      .map((m) => {
        const f = m.flags[FLAG_SCOPE];
        const senderId = f.senderActorId || f.speakerActorId || null;
        const sender = senderId ? game.actors?.get(senderId) : null;
        const senderName = profileName(sender) || m.speaker?.alias || '';
        const recipientName = (f.recipientName || '').toString();
        // sealId carries the typed registry key (post-MVP §11.2). Older
        // letters lacked this flag; default to '' so the filter still works.
        const sealId = f.letterSealId || f.sealId || '';
        const sealDef = sealId ? SEAL_TYPES.find((s) => s.id === sealId) : null;
        return {
          id: m.id,
          senderId,
          senderName,
          senderTheme: sender?.system?.theme ?? f.senderTheme ?? 'npc',
          senderPortrait: profilePic(sender),
          recipientName,
          sealId,
          // Real wax-seal artwork for the row indicator; '' when the letter
          // predates the typed-seal registry.
          sealAsset: sealDef?.iconAsset ?? '',
          sealColor: sealDef?.color ?? '',
          // Optional calligraphy face for the greeting + signature.
          scriptFont: f.letterScriptFont || 'none',
          burned: !!f.burnedAt,
          createdAt: m.timestamp,
          // Truncate the body for the row preview; the full chat message is
          // still available via the click handler.
          snippet: _snippet(m.content || ''),
          subject: f.letterSubject || '',
          cycleNumber: f.cycleNumber ?? null,
        };
      });

    const matchesActor = (recipientName, actor) => {
      if (!actor) return false;
      // Best-effort match against the actor's true name AND every persona's
      // name — so a letter addressed to either "Rose Willowood" or "Mags"
      // still lands in Rose's inbox regardless of which persona is active.
      const personaNames = (actor.system?.personas ?? []).map((p) => p?.name);
      const candidates = [actor.name, ...personaNames]
        .filter(Boolean)
        .map((n) => n.toLowerCase().trim());
      return candidates.includes((recipientName || '').toLowerCase().trim());
    };

    const inbox = allLetters.filter((l) => matchesActor(l.recipientName, actor));
    const outbox = allLetters.filter((l) => l.senderId === this.actorId);

    // Apply seal filter if set.
    const applyFilter = (letters) =>
      this._sealFilter ? letters.filter((l) => l.sealId === this._sealFilter) : letters;

    // Eligible seal-filter chips — show every seal currently in use across
    // any letter (so the user only sees relevant filters).
    const usedSealIds = new Set([...inbox, ...outbox].map((l) => l.sealId).filter(Boolean));
    const sealChips = SEAL_TYPES
      .filter((s) => usedSealIds.has(s.id))
      .map((s) => ({
        id: s.id,
        color: s.color,
        label: game.i18n.localize(`GOODSOCIETY.seal.${s.label}`) || s.label,
        isActive: this._sealFilter === s.id,
      }));

    const epistolaryDone = !!actor?.flags?.[FLAG_SCOPE]?.epistolaryDone?.[cycleNumber];

    ctx.actor = actor;
    ctx.actorId = this.actorId;
    ctx.actorName = profileName(actor);
    ctx.actorPortrait = profilePic(actor);
    ctx.myMajors = myMajors;
    ctx.myConnections = myConnections;
    ctx.showActorSwitcher = pickerActors.length > 1;
    ctx.cycleNumber = cycleNumber;
    ctx.currentTab = this._currentTab;
    // Inbox badge counts UNREAD letters only — once a letter's seal is
    // broken it no longer notifies.
    const unreadCount = inbox.filter((l) => !this._openedLetterIds.has(l.id)).length;
    ctx.tabs = [
      { id: 'inbox',   label: game.i18n.localize('GOODSOCIETY.epistolary.tabs.inbox'),   badge: unreadCount },
      { id: 'compose', label: game.i18n.localize('GOODSOCIETY.epistolary.tabs.compose'), badge: 0 },
      { id: 'outbox',  label: game.i18n.localize('GOODSOCIETY.epistolary.tabs.outbox'),  badge: outbox.length },
    ];
    // `opened` gates the row preview — a still-sealed letter must not leak
    // its subject/snippet. Outbox letters are always "open" (the user wrote
    // them); inbox letters open once their seal is broken.
    const isOutboxTab = this._currentTab === 'outbox';
    ctx.letters = applyFilter(this._currentTab === 'inbox' ? inbox : outbox)
      .map((l) => ({ ...l, opened: isOutboxTab || this._openedLetterIds.has(l.id) }));
    ctx.lettersEmpty = ctx.letters.length === 0;
    ctx.sealChips = sealChips;
    ctx.epistolaryDone = epistolaryDone;
    ctx.isComposeTab = this._currentTab === 'compose';

    // Inline reader pane state. When _selectedLetterId points to a real
    // chat message, the reader renders the letter as a sealed tri-fold
    // parchment packet; breaking the seal unfolds it.
    const selectedLetter = this._selectedLetterId
      ? allLetters.find((l) => l.id === this._selectedLetterId)
      : null;
    if (selectedLetter) {
      const msg = game.messages?.get(this._selectedLetterId);
      // Pull the letter PROSE out of the chat-card HTML so the reader renders
      // a clean letter on parchment — not the chat-card chrome. The letter
      // card splits prose across .gs-letter-card__greeting / __body /
      // __closing; we reassemble all three (the old code grabbed only
      // __body, dropping the greeting + closing). Falls back to the whole
      // message content if no structured parts are found.
      // Optional calligraphy face for the greeting + signature.
      const scriptFam = scriptFontFamily(selectedLetter.scriptFont);
      const greetingStyle = scriptFam
        ? ` style="font-family: ${scriptFam}; font-size: 1.5em; line-height: 1.35;"`
        : '';
      const rawHtml = msg?.content ?? '';
      let bodyHtml = rawHtml;
      if (rawHtml) {
        const tmp = document.createElement('div');
        tmp.innerHTML = rawHtml;
        const parts = [];
        const greetingEl = tmp.querySelector('.gs-letter-card__greeting');
        const bodyEl = tmp.querySelector('.gs-letter-card__body');
        const closingEl = tmp.querySelector('.gs-letter-card__closing');
        if (greetingEl) parts.push(`<p class="gs-letter-sheet__greeting"${greetingStyle}>${greetingEl.innerHTML}</p>`);
        if (bodyEl) parts.push(bodyEl.innerHTML);
        if (closingEl) parts.push(`<p class="gs-letter-sheet__closing">${closingEl.innerHTML}</p>`);
        if (parts.length) bodyHtml = parts.join('\n');
      }
      const enriched = bodyHtml
        ? await foundry.applications.ux.TextEditor.implementation.enrichHTML(bodyHtml, { async: true })
        : '';
      // Resolve the seal's wax-disc asset + tint colour from the registry.
      const seal = SEAL_TYPES.find((s) => s.id === selectedLetter.sealId) ?? null;
      ctx.viewerLetter = {
        ...selectedLetter,
        body: enriched,
        sealAsset: seal?.iconAsset ?? '',
        sealColor: seal?.color ?? '#7a4a2e',
        // Already-opened letters render unfolded immediately (no animation);
        // unopened ones render sealed and animate on breakSeal.
        isOpen: this._openedLetterIds.has(this._selectedLetterId),
        // One of the three real torn-edge parchment textures, hashed from the
        // letter id so it's stable per-letter.
        parchmentVariant: parchmentVariantFor(this._selectedLetterId),
        // Calligraphy face for the signature line (greeting is styled inline
        // during body assembly above).
        scriptFontFamily: scriptFam,
      };
      ctx.isReaderView = true;
    } else {
      ctx.viewerLetter = null;
      ctx.isReaderView = false;
    }
    return ctx;
  }

  // ── Render lifecycle ─────────────────────────────────────────────────────

  /**
   * Bind a `change` listener on the actor-select <select> after every render.
   * AbortController-scoped so re-renders don't leak listeners (same pattern
   * the letter composer uses for its preview inputs).
   *
   * Why not data-action? ApplicationV2's data-action dispatcher fires on
   * click, which on a <select> triggers before the user picks an option —
   * and the re-render that follows closes the dropdown mid-flight.
   */
  _onRender(context, options) {
    super._onRender?.(context, options);
    // Tear down any prior listener (re-renders happen on every tab switch
    // / actor change / filter change).
    this._listenerController?.abort();
    this._listenerController = new AbortController();

    const select = this.element?.querySelector?.('.gs-epistolary-wizard__actor-select');
    if (!select) return;
    select.addEventListener(
      'change',
      (ev) => {
        const id = ev.target.value;
        if (!id || id === this.actorId) return;
        this.actorId = id;
        this._currentTab = 'inbox';
        this._sealFilter = null;
        this.render({ parts: ['main'] });
      },
      { signal: this._listenerController.signal },
    );
  }

  _onClose(options) {
    this._listenerController?.abort();
    this._listenerController = null;
    return super._onClose?.(options);
  }

  // ── Action handlers ──────────────────────────────────────────────────────

  static #switchTab(event, target) {
    const tab = target?.dataset?.tab;
    if (!tab) return;
    this._currentTab = tab;
    this.render({ parts: ['main'] });
  }

  static #composeNew() {
    // Pre-select the wizard's active character as the letter's sender.
    openLetterComposer(this.actorId);
  }

  static async #switchActor(event, target) {
    const id = target?.dataset?.actorId || target?.value;
    if (!id) return;
    this.actorId = id;
    this._currentTab = 'inbox';
    this._sealFilter = null;
    this.render({ parts: ['main'] });
  }

  static #filterBySeal(event, target) {
    const sealId = target?.dataset?.sealId;
    this._sealFilter = sealId === this._sealFilter ? null : sealId;
    this.render({ parts: ['main'] });
  }

  static async #markDone() {
    const actor = this.actor;
    if (!actor) return;
    let cycleNumber = 1;
    try { cycleNumber = game.settings.get(FLAG_SCOPE, 'cycleNumber'); } catch {}
    const current = actor.flags?.[FLAG_SCOPE]?.epistolaryDone ?? {};
    await actor.update({ [`flags.${FLAG_SCOPE}.epistolaryDone`]: { ...current, [cycleNumber]: true } });
    this.render({ parts: ['main'] });
  }

  static #openLetter(event, target) {
    const id = target?.dataset?.messageId;
    if (!id) return;
    const msg = game.messages?.get(id);
    if (!msg) return;
    // Open the letter inline in the wizard's reader pane (replaces the list).
    this._selectedLetterId = id;
    this.render({ parts: ['main'] });
  }

  static #closeLetter() {
    this._selectedLetterId = null;
    this.render({ parts: ['main'] });
  }

  /**
   * Break the wax seal — plays the tri-fold unfold. We add `.is-open` to the
   * LIVE envelope DOM rather than re-rendering, so the CSS transitions
   * actually animate (a re-render would mount the open state instantly with
   * no motion). The letter id is also recorded in `_openedLetterIds` (and
   * persisted to a per-user flag) so a later re-render — or a fresh session —
   * shows it already-open and drops it from the unread badge.
   */
  static #breakSeal() {
    const id = this._selectedLetterId;
    if (!id) return;
    const wasUnread = !this._openedLetterIds.has(id);
    this._openedLetterIds.add(id);
    // Persist the read state per-user. Fire-and-forget — the animation below
    // shouldn't wait on the flag write.
    game.user?.setFlag(FLAG_SCOPE, 'openedLetters', [...this._openedLetterIds])
      ?.catch((err) => console.warn('[GS] Failed to persist opened-letter state:', err));

    const envelope = this.element?.querySelector('.gs-letter-envelope');
    if (!envelope) {
      // Envelope not in the DOM (shouldn't happen) — fall back to a render.
      this.render({ parts: ['main'] });
      return;
    }
    envelope.classList.add('is-open');

    // Decrement the inbox unread badge IN PLACE. A full re-render here would
    // remount the envelope already-open and skip the unfold animation, so we
    // patch the badge DOM directly instead.
    if (wasUnread) {
      const badge = this.element?.querySelector(
        '.gs-epistolary-wizard__tab[data-tab="inbox"] .gs-epistolary-wizard__badge',
      );
      if (badge) {
        const n = Math.max(0, (parseInt(badge.textContent, 10) || 0) - 1);
        if (n > 0) badge.textContent = String(n);
        else badge.remove();
      }
    }
  }
}

function _snippet(html, maxLen = 110) {
  // Strip the chat-card chrome — the "epistolary · cycle N" meta strip and
  // the seal footer — so the preview is just the letter's own prose. The
  // cycle number still shows in the row's meta line.
  const tmp = document.createElement('div');
  tmp.innerHTML = html || '';
  tmp.querySelectorAll('.gs-letter-card__header, .gs-letter-card__footer')
    .forEach((el) => el.remove());
  const text = (tmp.textContent || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen).replace(/\s+\S*$/, '') + '…';
}

export function openEpistolaryWizard(actorId, options = {}) {
  if (!_instance) _instance = new EpistolaryWizard({ actorId, ...options });
  else {
    if (actorId) _instance.actorId = actorId;
    if (options.initialTab) _instance._currentTab = options.initialTab;
    _instance._selectedLetterId = null;
  }
  _instance.render(true);
  return _instance;
}

/** Open the wizard directly on its Inbox tab — used by the Cabinet's
 *  cross-phase "Inbox" launcher so players can review past letters
 *  without waiting for an Epistolary phase. */
export function openEpistolaryInbox() {
  return openEpistolaryWizard(undefined, { initialTab: 'inbox' });
}

export function closeEpistolaryWizard() {
  if (_instance?.rendered) _instance.close();
}

/**
 * Minimal GM Roster — companion app showing each Major's mark-done status
 * for the current cycle. Auto-opens for the GM on phase begin.
 */
export class EpistolaryRoster extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'gs-epistolary-roster',
    classes: ['good-society', 'gs-epistolary-roster'],
    window: {
      title: 'GOODSOCIETY.epistolary.roster.title',
      icon: 'fa-solid fa-list-check',
      resizable: true,
    },
    position: { width: 420, height: 'auto' },
  };

  static PARTS = {
    main: { template: 'systems/good-society-homebrew/templates/apps/epistolary-roster.hbs' },
  };

  /**
   * Re-render whenever any Major's `epistolaryDone` flag changes — that's
   * how the wizard's mark-done button propagates to the open Roster window.
   * Watcher attached on first render, torn down on close. Same pattern as
   * the reputation-phase wizards (CLAUDE.md §15 B-6b/7 decision-log).
   */
  _onRender(context, options) {
    super._onRender?.(context, options);
    if (this._actorWatcher != null) return;
    this._actorWatcher = Hooks.on('updateActor', (actor, changes) => {
      if (actor?.type !== 'major-character') return;
      // Match any change that touches the epistolaryDone flag tree.
      const epistolaryDoneChanged =
        changes?.flags?.[FLAG_SCOPE]?.epistolaryDone !== undefined ||
        changes?.flags?.['good-society-homebrew']?.epistolaryDone !== undefined;
      if (epistolaryDoneChanged) {
        this.render({ parts: ['main'] });
      }
    });
  }

  _onClose(options) {
    if (this._actorWatcher != null) {
      Hooks.off('updateActor', this._actorWatcher);
      this._actorWatcher = null;
    }
    return super._onClose?.(options);
  }

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    let cycleNumber = 1;
    try { cycleNumber = game.settings.get(FLAG_SCOPE, 'cycleNumber'); } catch {}
    const majors = (game.actors?.filter((a) => a.type === 'major-character') ?? []).map((a) => ({
      id: a.id,
      name: profileName(a),
      theme: a.system?.theme ?? 'clayton',
      portrait: profilePic(a),
      done: !!a.flags?.[FLAG_SCOPE]?.epistolaryDone?.[cycleNumber],
    }));
    const doneCount = majors.filter((m) => m.done).length;
    ctx.cycleNumber = cycleNumber;
    ctx.majors = majors;
    ctx.summary = game.i18n.format('GOODSOCIETY.epistolary.roster.summary', {
      done: doneCount,
      total: majors.length,
    });
    return ctx;
  }
}

let _roster = null;

export function openEpistolaryRoster() {
  if (!game.user?.isGM) return null;
  if (!_roster) _roster = new EpistolaryRoster();
  _roster.render(true);
  return _roster;
}

export function closeEpistolaryRoster() {
  if (_roster?.rendered) _roster.close();
}
