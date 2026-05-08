/**
 * ConditionPicker — non-blocking modal for choosing a Reputation Condition
 * when a Major reaches 3 tags of one polarity.
 * Per docs/design/18-condition-picker.md.
 *
 * Framed ApplicationV2 — non-blocking (user can still interact with sheets
 * behind it). Per-actor + per-polarity instance ID prevents duplicates for
 * the same threshold.
 *
 * Compendium sourcing: queries all world-visible packs for reputation-condition
 * items matching the trigger polarity. Caches results per instance to avoid
 * repeated pack reads on re-render.
 *
 * Public API: openConditionPicker(actor, polarity, sourceTags).
 */

import { postSystemCard } from '../helpers/chat-cards.js';

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ApplicationV2 }              = foundry.applications.api;

export class ConditionPicker extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    classes: ['good-society', 'gs-condition-picker-app'],
    window: {
      frame: true,
      positioned: true,
      title: 'GOODSOCIETY.conditionPicker.windowTitle',
    },
    position: { width: 520, height: 'auto' },
    actions: {
      pickCondition: ConditionPicker.#pickCondition,
      dismissLater:  ConditionPicker.#dismissLater,
      dismissNone:   ConditionPicker.#dismissNone,
    },
  };

  static PARTS = {
    main: {
      template: 'systems/good-society-homebrew/templates/apps/condition-picker.hbs',
    },
  };

  /**
   * @param {Actor}    actor       Major Character actor.
   * @param {string}   polarity    'positive' | 'negative'
   * @param {Item[]}   sourceTags  The three tags that triggered the threshold.
   */
  constructor(actor, polarity, sourceTags) {
    super({ id: `gs-condition-picker-${actor.id}-${polarity}` });
    this._actor      = actor;
    this._polarity   = polarity;
    this._sourceTags = sourceTags;
    this._conditions = null; // cached after first fetch
  }

  /** @override */
  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);

    // Fetch conditions from packs once, then cache
    if (!this._conditions) {
      this._conditions = await _fetchConditions(this._polarity);
    }

    const polarity  = this._polarity;
    const isPositive = polarity === 'positive';

    return {
      ...ctx,
      themeId:    this._actor.system?.theme ?? 'npc',
      actorName:  this._actor.name,
      polarity,
      isPositive,
      polarityArrow: isPositive ? '▲' : '▼',
      polarityLabel: game.i18n.localize(
        `GOODSOCIETY.conditionPicker.polarity${isPositive ? 'Positive' : 'Negative'}`,
      ),
      title: game.i18n.localize(
        `GOODSOCIETY.conditionPicker.threshold${isPositive ? 'Positive' : 'Negative'}`,
      ),
      sourceTags: this._sourceTags.map(t => ({
        id:   t.id,
        name: t.name,
      })),
      conditions: this._conditions,
      hasConditions: this._conditions.length > 0,
    };
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  static async #pickCondition(ev, target) {
    const idx = Number(target.dataset.conditionIndex ?? -1);
    const condition = this._conditions?.[idx];
    if (!condition) return;

    const actor = this._actor;

    // Create the condition item on the actor
    try {
      await actor.createEmbeddedDocuments('Item', [{
        type:   'reputation-condition',
        name:   condition.name,
        system: {
          polarity:    this._polarity,
          description: condition.description ?? '',
          active:      true,
          sourceTagIds: this._sourceTags.map(t => t.id),
        },
      }]);
    } catch (err) {
      console.error('GS | condition create failed:', err);
      ui.notifications?.error(game.i18n.localize('GOODSOCIETY.conditionPicker.createError'));
      return;
    }

    // Mark threshold as resolved so the picker doesn't re-fire on next tag-add
    try {
      await actor.setFlag('good-society-homebrew', `pickerResolved.${this._polarity}`, true);
    } catch { /* non-fatal */ }

    // Post system chat card
    try {
      await postSystemCard({
        content: game.i18n.format('GOODSOCIETY.conditionPicker.gainedCard', {
          name:      actor.system?.activePersona?.name || actor.name,
          condition: condition.name,
        }),
        context: 'reputation',
      });
    } catch { /* non-fatal */ }

    await this.close();
  }

  static async #dismissLater() {
    // "Later" — close without resolving. Badge will appear in Public tab (future B-6).
    await this.close();
  }

  static async #dismissNone() {
    // "No condition" — mark threshold as explicitly resolved-without-condition.
    try {
      await this._actor.setFlag(
        'good-society-homebrew', `pickerResolved.${this._polarity}`, true,
      );
    } catch { /* non-fatal */ }
    await this.close();
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Open the Condition Picker for a Major actor at a polarity threshold.
 *
 * @param {Actor}  actor       Major actor.
 * @param {string} polarity    'positive' | 'negative'
 * @param {Item[]} sourceTags  The three tags that triggered the threshold.
 */
export function openConditionPicker(actor, polarity, sourceTags) {
  new ConditionPicker(actor, polarity, sourceTags).render({ force: true });
}

// ── Private helpers ────────────────────────────────────────────────────────

/**
 * Query all world-visible compendium packs for reputation-condition items
 * matching the given polarity. Returns condition data objects.
 *
 * @param {string} polarity 'positive' | 'negative'
 * @returns {Promise<object[]>}
 */
async function _fetchConditions(polarity) {
  const results = [];

  for (const pack of game.packs ?? []) {
    if (pack.documentName !== 'Item') continue;

    try {
      // Fetch index with type field (Foundry v13 supports indexed fields)
      const index = pack.index.size > 0 ? pack.index : await pack.getIndex({ fields: ['type', 'system.polarity', 'system.description'] });

      const matching = index.filter(e =>
        e.type === 'reputation-condition' &&
        (e.system?.polarity ?? '') === polarity,
      );

      for (const entry of matching) {
        try {
          const item = await pack.getDocument(entry._id);
          if (!item) continue;
          results.push({
            id:          item.id,
            name:        item.name,
            polarity:    item.system?.polarity ?? polarity,
            description: item.system?.description
              ? item.system.description.replace(/<[^>]*>/g, '').trim()
              : '',
            source: pack.metadata?.label ?? pack.collection,
            isHomebrew: pack.metadata?.type === 'world',
          });
        } catch { /* skip broken items */ }
      }
    } catch (err) {
      console.warn(`GS | condition fetch from pack ${pack.collection} failed:`, err);
    }
  }

  // Sort: canonical first, then homebrew; alphabetical within each group
  results.sort((a, b) => {
    if (a.isHomebrew !== b.isHomebrew) return a.isHomebrew ? 1 : -1;
    return a.name.localeCompare(b.name);
  });

  return results;
}
