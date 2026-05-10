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
import { SEAL_TYPES } from '../constants.js';

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
    },
  };

  static PARTS = {
    main: { template: TEMPLATE },
  };

  constructor(options = {}) {
    super(options);
    this.actorId = options.actorId ?? null;
    this._currentTab = 'inbox';
    this._sealFilter = null; // null | any seal id from SEAL_TYPES (see module/constants.js)
    this._listenerController = null;
  }

  /** Resolve the active actor from id (so re-renders pick up renames etc.). */
  get actor() {
    return this.actorId ? game.actors?.get(this.actorId) : null;
  }

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    const actor = this.actor;

    // Owned-Major picker — when the user owns multiple, the wizard shows a
    // top selector to switch between them.
    const myMajors = (game.actors?.filter(
      (a) => a.type === 'major-character' && a.testUserPermission(game.user, 'OWNER'),
    ) ?? []).map((a) => ({
      id: a.id,
      name: profileName(a),
      isActive: a.id === this.actorId,
    }));
    if (!this.actorId && myMajors.length) {
      this.actorId = myMajors[0].id;
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
        return {
          id: m.id,
          senderId,
          senderName,
          senderTheme: sender?.system?.theme ?? f.senderTheme ?? 'npc',
          senderPortrait: profilePic(sender),
          recipientName,
          // sealId carries the typed registry key (post-MVP §11.2). Older
          // letters lacked this flag; default to '' so the filter still works.
          sealId: f.letterSealId || f.sealId || '',
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
      // Best-effort match: persona name OR actor name OR (lower-cased forms).
      const personaName = actor.system?.activePersona?.name;
      const candidates = [actor.name, personaName].filter(Boolean).map((n) => n.toLowerCase().trim());
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
    ctx.showActorSwitcher = myMajors.length > 1;
    ctx.cycleNumber = cycleNumber;
    ctx.currentTab = this._currentTab;
    ctx.tabs = [
      { id: 'inbox',   label: game.i18n.localize('GOODSOCIETY.epistolary.tabs.inbox'),   badge: inbox.length },
      { id: 'compose', label: game.i18n.localize('GOODSOCIETY.epistolary.tabs.compose'), badge: 0 },
      { id: 'outbox',  label: game.i18n.localize('GOODSOCIETY.epistolary.tabs.outbox'),  badge: outbox.length },
    ];
    ctx.letters = applyFilter(this._currentTab === 'inbox' ? inbox : outbox);
    ctx.lettersEmpty = ctx.letters.length === 0;
    ctx.sealChips = sealChips;
    ctx.epistolaryDone = epistolaryDone;
    ctx.isComposeTab = this._currentTab === 'compose';
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
    openLetterComposer();
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
    // Expanding the chat log to surface the message is the simplest path —
    // ApplicationV2's notification API also works.
    if (typeof ui?.chat?.scrollBottom === 'function') {
      ui.chat.scrollBottom();
    }
    // Highlight the message in the chat log briefly.
    const node = document.querySelector(`[data-message-id="${id}"]`);
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      node.classList.add('gs-letter-highlight');
      setTimeout(() => node.classList.remove('gs-letter-highlight'), 1500);
    }
  }
}

function _snippet(html, maxLen = 110) {
  const text = html.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen).replace(/\s+\S*$/, '') + '…';
}

export function openEpistolaryWizard(actorId) {
  if (!_instance) _instance = new EpistolaryWizard({ actorId });
  else if (actorId) _instance.actorId = actorId;
  _instance.render(true);
  return _instance;
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
