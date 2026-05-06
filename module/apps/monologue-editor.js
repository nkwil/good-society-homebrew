/**
 * MonologueEditor — Inner Monologue composition modal.
 * Opened when a player clicks "Take Monologue" on the Major Character strip.
 * On submit: marks monologue as spent, optionally archives to a JournalEntry,
 * then posts a monologue chat card via postMonologueCard.
 *
 * Per docs/design/10-chat-cards.md §"Inner Monologue editor flow".
 */

import { postMonologueCard } from '../helpers/chat-cards.js';
import { themedWrap } from '../helpers/themed-wrap.js';

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

    // Optional journal entry. In Foundry v10+ JournalEntry has no `content`
    // at the entry level — content lives in pages. The page is wrapped in
    // .gs-themed[data-theme="..."] with the actor's theme so the parchment
    // card surface and brand color match the chat monologue card.
    let journalEntryUuid = null;
    if (archive) {
      const cycleNumber = (() => {
        try { return game.settings.get('good-society-homebrew', 'cycleNumber'); } catch { return 1; }
      })();
      const persona = this.actor.system?.activePersona;
      const speakerName = persona?.name ?? this.actor.name;
      const bodyHtml = `<p>${text.replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
      const cardHtml = `
        <div class="gs-card gs-monologue-archive">
          <div class="gs-section-header">
            ${speakerName} — ${game.i18n.localize('GOODSOCIETY.monologueEditor.title')}
          </div>
          <div class="gs-monologue-archive__body">${bodyHtml}</div>
        </div>
      `.trim();
      const themedHtml = themedWrap(this.actor, cardHtml, ['gs-monologue-archive-wrap']);

      const entry = await JournalEntry.create({
        name: `${this.actor.name} — Cycle ${cycleNumber} Monologue`,
        pages: [{
          name: game.i18n.localize('GOODSOCIETY.monologueEditor.pageName') || 'Monologue',
          type: 'text',
          text: {
            content: themedHtml,
            format: CONST.JOURNAL_ENTRY_PAGE_FORMATS?.HTML ?? 1,
          },
        }],
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
