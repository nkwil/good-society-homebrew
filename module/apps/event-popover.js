/**
 * EventPopover — modal player surface for resolving a random event.
 *
 * Flow (per the design Q&A):
 *   1. Three strategy textareas, each with its own Roll button.
 *   2. After all three rolls, average is computed and outcome shown.
 *   3. Tag-picker chips appear (positive shortlist on success / negative on
 *      failure). Player picks one; submit creates the reputation-tag Item
 *      and posts the themed chat card via resolveRandomEvent.
 *
 * Framed ApplicationV2 (NOT singleton) — opened in response to a socket
 * launch event handled by random-event.js.
 */

import { resolveRandomEvent, isSuccess } from '../helpers/random-event.js';

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ApplicationV2 }              = foundry.applications.api;

/**
 * Open a popover for the given event + actor pair. Multiple events can be
 * stacked — each opens its own window with a unique id.
 */
export function openEventPopover({ event, actor }) {
  if (!event || !actor) return null;
  const app = new EventPopover({ event, actor });
  app.render({ force: true });
  return app;
}

export class EventPopover extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    classes: ['good-society', 'gs-event-popover'],
    window: {
      frame: true,
      positioned: true,
      title: 'GOODSOCIETY.eventPopover.windowTitle',
    },
    position: { width: 560, height: 'auto' },
    actions: {
      rollStrategy: EventPopover.#rollStrategy,
      pickTag:      EventPopover.#pickTag,
      submit:       EventPopover.#submit,
      cancel:       EventPopover.#cancel,
    },
  };

  static PARTS = {
    main: {
      template: 'systems/good-society-homebrew/templates/apps/event-popover.hbs',
    },
  };

  /** @type {Item}  */ #event;
  /** @type {Actor} */ #actor;
  /** @type {{text:string, roll:number|null}[]} */ #strategies = [
    { text: '', roll: null },
    { text: '', roll: null },
    { text: '', roll: null },
  ];
  /** @type {string} */ #chosenTag = '';
  /** @type {boolean} */ #submitted = false;

  constructor(options = {}) {
    const { event, actor, ...rest } = options;
    // Per-event-id window so two simultaneous events on the same actor open
    // separate popovers rather than fighting for one window.
    rest.id = `gs-event-popover-${actor.id}-${event.id}`;
    super(rest);
    this.#event = event;
    this.#actor = actor;
  }

  // ── Context ────────────────────────────────────────────────────────────────

  async _prepareContext(_options) {
    const ev = this.#event;
    const actor = this.#actor;
    const sys = ev.system ?? {};
    const themeId = actor.system?.theme || 'clayton';
    const persona = actor.system?.activePersonaId
      ? (actor.system?.personas ?? []).find(p => p.id === actor.system.activePersonaId)
      : null;
    const speakerName = persona?.name || actor.name;
    const enriched = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      sys.description ?? '',
      { async: true },
    );

    const allRolled = this.#strategies.every(s => s.roll != null);
    const average = allRolled
      ? this.#strategies.reduce((a, s) => a + s.roll, 0) / 3
      : null;
    const success = average != null ? isSuccess(average) : null;

    const tagOptions = success === true
      ? (sys.positiveTagOptions ?? []).filter(Boolean)
      : success === false
        ? (sys.negativeTagOptions ?? []).filter(Boolean)
        : [];

    // The event may have no tag options authored for the rolled polarity.
    // In that case the player has nothing to pick — so Submit must be
    // enabled anyway (resolves with no tag) instead of soft-locking the
    // popover with a permanently-disabled button.
    const noTagOptions = allRolled && tagOptions.length === 0;
    const canSubmit = allRolled && (!!this.#chosenTag || noTagOptions);

    return {
      themeId,
      actorName: speakerName,
      eventName: ev.name,
      description: enriched,
      strategies: this.#strategies.map((s, i) => ({
        index: i + 1,
        text: s.text,
        roll: s.roll,
        rolled: s.roll != null,
        canRoll: i === this.#strategies.findIndex(x => x.roll == null),
      })),
      allRolled,
      average: average != null ? average.toFixed(1) : '',
      isSuccess: success === true,
      isFailure: success === false,
      tagOptions: tagOptions.map(t => ({
        text: t,
        selected: t === this.#chosenTag,
      })),
      hasChosenTag: !!this.#chosenTag,
      noTagOptions,
      canSubmit,
      submitted: this.#submitted,
    };
  }

  /** Capture textarea edits before each render so user input survives. */
  async _onRender(context, options) {
    super._onRender(context, options);
    const textareas = this.element?.querySelectorAll('textarea[data-strategy-index]') ?? [];
    for (const ta of textareas) {
      ta.addEventListener('input', (ev) => {
        const idx = Number(ev.target.dataset.strategyIndex);
        if (Number.isInteger(idx) && this.#strategies[idx]) {
          this.#strategies[idx].text = ev.target.value;
        }
      }, { passive: true });
    }
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  static async #rollStrategy(_ev, target) {
    const idx = Number(target.dataset.index);
    if (!Number.isInteger(idx) || !this.#strategies[idx]) return;
    if (this.#strategies[idx].roll != null) return; // already rolled
    // Capture the textarea value first — _onRender's input listener handles
    // most cases, but a click-without-blur on a fresh edit can otherwise miss.
    const ta = this.element?.querySelector(`textarea[data-strategy-index="${idx}"]`);
    if (ta) this.#strategies[idx].text = ta.value;
    if (!this.#strategies[idx].text.trim()) {
      ui.notifications?.warn(game.i18n.localize('GOODSOCIETY.eventPopover.strategyRequired'));
      return;
    }
    const roll = await new Roll('1d20').evaluate();
    this.#strategies[idx].roll = roll.total;
    // Post the roll to chat for table visibility.
    try {
      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.#actor }),
        flavor: game.i18n.format('GOODSOCIETY.eventPopover.rollFlavor', {
          n: idx + 1,
          event: this.#event.name,
        }),
      });
    } catch (err) { console.warn('GS | random-event roll toMessage failed:', err); }
    this.render();
  }

  static async #pickTag(_ev, target) {
    const tag = target.dataset.tag;
    if (!tag) return;
    this.#chosenTag = tag;
    this.render();
  }

  static async #submit() {
    if (this.#submitted) return;
    if (this.#strategies.some(s => s.roll == null)) {
      ui.notifications?.warn(game.i18n.localize('GOODSOCIETY.eventPopover.rollAllFirst'));
      return;
    }
    const average = this.#strategies.reduce((a, s) => a + s.roll, 0) / 3;
    const outcome = isSuccess(average) ? 'success' : 'failure';
    // Tag options for the rolled outcome. If the event authored none, the
    // player legitimately submits with no tag — only require a pick when
    // options actually exist.
    const sys = this.#event.system ?? {};
    const opts = (outcome === 'success'
      ? (sys.positiveTagOptions ?? [])
      : (sys.negativeTagOptions ?? [])).filter(Boolean);
    if (opts.length && !this.#chosenTag) {
      ui.notifications?.warn(game.i18n.localize('GOODSOCIETY.eventPopover.pickTagFirst'));
      return;
    }
    this.#submitted = true;
    await resolveRandomEvent({
      actor: this.#actor,
      event: this.#event,
      strategies: this.#strategies.map(s => s.text),
      rolls: this.#strategies.map(s => s.roll),
      chosenTag: this.#chosenTag,
      outcome,
    });
    this.close();
  }

  static async #cancel() {
    // Cancel discards in-flight strategies. The GM keeps a record of the
    // launch via the chat-card emitted at submit-time only — a cancelled
    // event leaves no trace, matching "ephemeral if not resolved".
    this.close();
  }
}
