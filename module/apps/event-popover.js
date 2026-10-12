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
  /** @type {string} */ #tagText = '';
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

    // Suggestions from the GM-authored shortlist for the rolled polarity.
    // These are PROMPTS, not the final choice — the player types their own
    // tag below (click a chip to prefill the input, or ignore and write
    // their own). This matches the "player chooses what sticks" direction.
    const tagSuggestions = success === true
      ? (sys.positiveTagOptions ?? []).filter(Boolean)
      : success === false
        ? (sys.negativeTagOptions ?? []).filter(Boolean)
        : [];

    const trimmedTag = (this.#tagText ?? '').trim();
    // Resolution requires a tag now — the player's writing it themselves,
    // so an empty submit is a mis-click to catch, not a feature.
    const canSubmit = allRolled && !!trimmedTag;

    return {
      themeId,
      actorName: speakerName,
      eventName: ev.name,
      description: enriched,
      imageUrl: sys.imageUrl ?? '',
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
      tagSuggestions: tagSuggestions.map(t => ({
        text: t,
        selected: t.toLowerCase() === trimmedTag.toLowerCase(),
      })),
      hasSuggestions: tagSuggestions.length > 0,
      tagText: this.#tagText,
      canSubmit,
      submitted: this.#submitted,
    };
  }

  /** Capture textarea and tag-input edits before each render so user input
   *  survives action-triggered re-renders. */
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
    const tagInput = this.element?.querySelector('input[data-gs-tag-input]');
    if (tagInput) {
      tagInput.addEventListener('input', (ev) => {
        this.#tagText = ev.target.value ?? '';
        // Toggle the submit button's disabled state live without a full
        // re-render — a re-render would blow away the input cursor.
        const submitBtn = this.element?.querySelector('button[data-action="submit"]');
        if (submitBtn) submitBtn.disabled = !this.#tagText.trim() || this.#strategies.some(s => s.roll == null);
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

  /** Click a GM-authored suggestion chip → prefill the tag input with that
   *  text. The player can accept it, edit it, or clear and write their own.
   *  Chip click re-renders so the input shows the new value and the chip's
   *  "selected" state updates. */
  static async #pickTag(_ev, target) {
    const tag = target.dataset.tag;
    if (!tag) return;
    this.#tagText = tag;
    this.render();
  }

  static async #submit() {
    if (this.#submitted) return;
    if (this.#strategies.some(s => s.roll == null)) {
      ui.notifications?.warn(game.i18n.localize('GOODSOCIETY.eventPopover.rollAllFirst'));
      return;
    }
    // Final tag read — pull from the live input if it exists so any
    // last-second edit lands (the input listener catches most cases, but
    // a submit-without-blur after focus-restore can slip past).
    const liveInput = this.element?.querySelector('input[data-gs-tag-input]');
    if (liveInput) this.#tagText = liveInput.value ?? this.#tagText;
    const chosenTag = (this.#tagText ?? '').trim();
    if (!chosenTag) {
      ui.notifications?.warn(game.i18n.localize('GOODSOCIETY.eventPopover.pickTagFirst'));
      return;
    }
    const average = this.#strategies.reduce((a, s) => a + s.roll, 0) / 3;
    const outcome = isSuccess(average) ? 'success' : 'failure';
    this.#submitted = true;
    await resolveRandomEvent({
      actor: this.#actor,
      event: this.#event,
      strategies: this.#strategies.map(s => s.text),
      rolls: this.#strategies.map(s => s.roll),
      chosenTag,
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
