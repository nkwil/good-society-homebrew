/**
 * MonologueEditor — Inner Monologue composition modal.
 * Opened when a player clicks "Take Monologue" on the Major Character strip.
 * On submit: marks monologue as spent, optionally archives to a JournalEntry,
 * then posts a monologue chat card via postMonologueCard.
 *
 * Per docs/design/10-chat-cards.md §"Inner Monologue editor flow".
 */

import { postMonologueCard } from '../helpers/chat-cards.js';

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ApplicationV2 } = foundry.applications.api;

const TEMPLATE = 'systems/good-society-homebrew/templates/apps/monologue-editor.hbs';

export class MonologueEditor extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @param {Actor} actor */
  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
  }

  static DEFAULT_OPTIONS = {
    id: 'gs-monologue-editor',
    classes: ['good-society', 'gs-monologue-editor'],
    position: { width: 480, height: 'auto' },
    window: {
      title: 'GOODSOCIETY.monologueEditor.title',
      resizable: false,
    },
    actions: {
      submit: MonologueEditor.#submit,
      cancel: MonologueEditor.#cancel,
    },
  };

  static PARTS = {
    main: { template: TEMPLATE },
  };

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    const persona = this.actor.system.activePersona;

    let cycleNumber = null;
    try { cycleNumber = game.settings.get('good-society-homebrew', 'cycleNumber'); } catch { /* not yet registered */ }

    ctx.actor = this.actor;
    ctx.speakerName = persona?.name ?? this.actor.name;
    ctx.portraitInitial = (persona?.name ?? this.actor.name)?.[0]?.toUpperCase() ?? '?';
    ctx.cycleNumber = cycleNumber;
    ctx.archiveByDefault = true;
    return ctx;
  }

  static async #submit(event, target) {
    const form = this.element.querySelector('form');
    if (!form) return;
    const text = form.querySelector('[name="monologueText"]')?.value?.trim() ?? '';
    if (!text) {
      ui.notifications?.warn(game.i18n.localize('GOODSOCIETY.monologueEditor.emptyWarning'));
      return;
    }
    const archive = form.querySelector('[name="archiveEntry"]')?.checked ?? true;

    // Mark monologue as spent.
    await this.actor.update({ 'system.tokens.monologuedThisCycle': true });

    // Optional journal entry.
    let journalEntryUuid = null;
    if (archive) {
      const cycleNumber = (() => {
        try { return game.settings.get('good-society-homebrew', 'cycleNumber'); } catch { return 1; }
      })();
      const entry = await JournalEntry.create({
        name: `${this.actor.name} — Cycle ${cycleNumber} Monologue`,
        content: `<p>${text.replace(/\n/g, '</p><p>')}</p>`,
      });
      journalEntryUuid = entry?.uuid ?? null;
    }

    // Post the chat card.
    await postMonologueCard({
      actor: this.actor,
      monologueText: text,
      journalEntryUuid,
      whisper: false,
    });

    this.close();
  }

  static async #cancel() {
    this.close();
  }
}
