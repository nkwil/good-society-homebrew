/**
 * Story Beats Command Center — GM-only picker for the dramatic-moment
 * overlays in `STORY_BEATS`. Renders a grid of beat cards; clicking a card
 * opens a DialogV2 built from that beat's `formFields`, then EITHER triggers
 * the overlay via `playStoryBeat()` or saves the configured beat to the
 * `savedStoryBeats` world setting for later deployment.
 *
 * Saved beats are listed above the new-beat grid; each row has a "Play now"
 * and a "Delete" button. The list re-renders automatically on save/delete
 * via the setting's onChange.
 *
 * Wired into the Cabinet's GM Tools group under launcherKey `storyBeats`.
 */

import { STORY_BEATS, findStoryBeat } from '../data/story-beats.js';
import { playStoryBeat } from './story-beat-overlay.js';
import { SEAL_TYPES, STATIONERY_TYPES } from '../constants.js';
import {
  getSavedStoryBeats,
  saveStoryBeat,
  deleteSavedStoryBeat,
} from '../helpers/saved-story-beats.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

let _instance = null;

export class StoryBeatsCommandCenter extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'gs-story-beats-command-center',
    classes: ['good-society', 'gs-story-beats-cc'],
    window: { frame: true, positioned: true, title: 'GOODSOCIETY.storyBeats.commandCenterTitle' },
    position: { width: 560, height: 'auto' },
    actions: {
      pickBeat:    StoryBeatsCommandCenter.#pickBeat,
      deploySaved: StoryBeatsCommandCenter.#deploySaved,
      deleteSaved: StoryBeatsCommandCenter.#deleteSaved,
    },
  };

  static PARTS = {
    main: { template: 'systems/good-society-homebrew/templates/apps/story-beats-command-center.hbs' },
  };

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    ctx.beats = STORY_BEATS.map(b => ({
      id:           b.id,
      label:        b.label,
      icon:         b.icon,
      description:  b.description,
      paletteClass: b.paletteClass,
    }));

    // Saved-beat list: most-recently-saved first. Each entry is enriched
    // with the parent beat's display fields (icon, paletteClass) so the
    // list row can render the same visual language as the beat card.
    const saved = getSavedStoryBeats()
      .slice()
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    ctx.saved = saved.map(s => {
      const beat = findStoryBeat(s.beatId);
      return {
        id:           s.id,
        beatId:       s.beatId,
        label:        s.label || beat?.label || '(saved beat)',
        beatLabel:    beat?.label ?? s.beatId,
        icon:         beat?.icon ?? '✦',
        paletteClass: beat?.paletteClass ?? 'invitation',
      };
    });
    ctx.hasSaved = ctx.saved.length > 0;
    return ctx;
  }

  /** Click a beat card → open its config dialog → save or trigger. */
  static async #pickBeat(event, target) {
    const beatId = target.dataset.beatId;
    const beat   = findStoryBeat(beatId);
    if (!beat) return;

    const result = await _promptForBeatConfig(beat);
    if (!result) return; // cancelled

    if (result.action === 'save') {
      await saveStoryBeat(beat.id, result.payload);
      ui.notifications?.info(game.i18n.localize('GOODSOCIETY.storyBeats.savedToast'));
      return;
    }
    if (result.action === 'play') {
      await playStoryBeat(beat.id, result.payload);
    }
  }

  /** Deploy a saved beat directly — no dialog. */
  static async #deploySaved(event, target) {
    const id = target.dataset.savedId;
    const saved = getSavedStoryBeats().find(s => s.id === id);
    if (!saved) return;
    await playStoryBeat(saved.beatId, saved.payload);
  }

  /** Delete a saved beat with a confirm. */
  static async #deleteSaved(event, target) {
    const id = target.dataset.savedId;
    const saved = getSavedStoryBeats().find(s => s.id === id);
    if (!saved) return;
    const ok = window.confirm(
      game.i18n.format('GOODSOCIETY.storyBeats.deleteSavedConfirm', { label: saved.label }),
    );
    if (!ok) return;
    await deleteSavedStoryBeat(id);
  }
}

/**
 * Build a DialogV2 from a beat's `formFields`. Resolves with
 *   { action: 'save'|'play', payload: {...} }
 * on submit, or null on cancel.
 *
 * Two submit buttons: "Save for later" (no required-field enforcement —
 * the GM may save a partial draft and finish it before deploying) and
 * "Play now" (required-field enforcement applies, same as before).
 */
async function _promptForBeatConfig(beat) {
  const fieldsHtml = beat.formFields.map(f => _renderField(f)).join('\n');
  const required = beat.formFields.filter(f => f.required).map(f => f.name);

  const html = `
    <div class="gs-story-beat-form">
      ${fieldsHtml}
    </div>
  `;

  // Helper: read the form into a payload object.
  const readPayload = (dialog) => {
    const form = dialog.element?.querySelector('form, .gs-story-beat-form') ?? dialog.element;
    const out = {};
    for (const f of beat.formFields) {
      // Stationery is a radio-group thumbnail picker, not a single input.
      // Read the `:checked` one's value.
      if (f.type === 'stationery') {
        const el = form.querySelector(`[name="${f.name}"]:checked`);
        out[f.name] = el?.value ?? '';
      } else {
        const el = form.querySelector(`[name="${f.name}"]`);
        out[f.name] = el?.value?.trim() ?? '';
      }
    }
    return out;
  };

  try {
    const result = await foundry.applications.api.DialogV2.wait({
      window: {
        title: game.i18n.format('GOODSOCIETY.storyBeats.configTitle', { label: beat.label }),
      },
      content: html,
      buttons: [
        {
          action: 'save',
          label: game.i18n.localize('GOODSOCIETY.storyBeats.saveForLater'),
          callback: (event, button, dialog) => ({ action: 'save', payload: readPayload(dialog) }),
        },
        {
          action: 'play',
          label: game.i18n.localize('GOODSOCIETY.storyBeats.play'),
          default: true,
          callback: (event, button, dialog) => {
            const payload = readPayload(dialog);
            for (const name of required) {
              if (!payload[name]) {
                ui.notifications?.warn(game.i18n.localize('GOODSOCIETY.storyBeats.fillRequired'));
                return null;
              }
            }
            return { action: 'play', payload };
          },
        },
      ],
      rejectClose: false,
    });
    return result || null;
  } catch {
    return null;
  }
}

/** Build one form-row's HTML based on its `type`. */
function _renderField(field) {
  const required = field.required ? 'required' : '';
  const ph = field.placeholder ? `placeholder="${foundry.utils.escapeHTML(field.placeholder)}"` : '';
  const label = `<label class="gs-story-beat-form__label">${foundry.utils.escapeHTML(field.label)}${field.required ? ' <span class="gs-story-beat-form__required">*</span>' : ''}</label>`;

  switch (field.type) {
    case 'textarea': {
      // Line breaks in the textarea ARE preserved through to the overlay
      // (story-beat-overlay.js#_prepareContext escapes the text and
      // replaces \n with <br>, exposing the result as `<field>Html` for
      // the inner template to render via triple-stache). Default to 6
      // rows so the GM has visible room for an actual paragraph; per-
      // field `rows` overrides if a beat needs more or fewer.
      const rows = field.rows ?? 6;
      return `
        <div class="gs-story-beat-form__row">
          ${label}
          <textarea class="gs-story-beat-form__input" name="${field.name}" rows="${rows}" ${ph} ${required}></textarea>
        </div>`;
    }

    case 'majorActor':
    case 'actor': {
      const filterType = field.type === 'majorActor' ? 'major-character' : null;
      const actors = (game.actors?.filter(a => !filterType || a.type === filterType) ?? [])
        .sort((a, b) => a.name.localeCompare(b.name));
      const options = actors.map(a =>
        `<option value="${a.id}">${foundry.utils.escapeHTML(a.name)}</option>`,
      ).join('');
      return `
        <div class="gs-story-beat-form__row">
          ${label}
          <select class="gs-story-beat-form__input" name="${field.name}" ${required}>
            <option value="">—</option>
            ${options}
          </select>
        </div>`;
    }

    case 'stationery': {
      // Thumbnail-grid picker. Each entry is a <label> wrapping a hidden
      // radio + a visible thumbnail. The radio drives the form value via
      // its `name`/`value`; the thumbnail shows the actual stationery so
      // the GM picks visually. Plain (no overlay) is the default-checked
      // first option.
      const cards = STATIONERY_TYPES.map((s, i) => {
        const lk = `GOODSOCIETY.stationery.${s.label}`;
        const txt = game.i18n.localize(lk);
        const labelText = (txt && txt !== lk) ? txt : s.label;
        const checked = i === 0 ? 'checked' : '';
        const thumbStyle = s.asset
          ? `style="background-image: url('${s.asset}');"`
          : '';
        const thumbClass = s.asset
          ? 'gs-story-beat-form__stationery-thumb'
          : 'gs-story-beat-form__stationery-thumb gs-story-beat-form__stationery-thumb--plain';
        return `
          <label class="gs-story-beat-form__stationery-card" title="${foundry.utils.escapeHTML(labelText)}">
            <input type="radio" name="${field.name}" value="${s.id}" ${checked} />
            <span class="${thumbClass}" ${thumbStyle} aria-hidden="true"></span>
            <span class="gs-story-beat-form__stationery-label">${foundry.utils.escapeHTML(labelText)}</span>
          </label>`;
      }).join('');
      return `
        <div class="gs-story-beat-form__row">
          ${label}
          <div class="gs-story-beat-form__stationery-grid">${cards}</div>
        </div>`;
    }

    case 'seal': {
      // Picker for SEAL_TYPES — same vocabulary the letter composer uses.
      // Rendered as a <select> here (the command-center dialog is one-off
      // and doesn't justify a full button grid). The overlay later resolves
      // the chosen id → iconAsset/color via SEAL_TYPES.
      const options = SEAL_TYPES.map(s => {
        const lk = `GOODSOCIETY.seal.${s.label}`;
        const txt = game.i18n.localize(lk);
        const display = (txt && txt !== lk) ? txt : s.label;
        return `<option value="${s.id}">${foundry.utils.escapeHTML(display)}</option>`;
      }).join('');
      return `
        <div class="gs-story-beat-form__row">
          ${label}
          <select class="gs-story-beat-form__input" name="${field.name}" ${required}>
            <option value="">${game.i18n.localize('GOODSOCIETY.storyBeats.invitation.noSeal')}</option>
            ${options}
          </select>
        </div>`;
    }

    case 'text':
    default:
      return `
        <div class="gs-story-beat-form__row">
          ${label}
          <input type="text" class="gs-story-beat-form__input" name="${field.name}" ${ph} ${required} />
        </div>`;
  }
}

/** Public API — open the Command Center singleton. */
export function openStoryBeatsCommandCenter() {
  if (!game.user?.isGM) {
    ui.notifications?.warn(game.i18n.localize('GOODSOCIETY.storyBeats.gmOnly'));
    return;
  }
  if (!_instance) _instance = new StoryBeatsCommandCenter();
  _instance.render(true);
  return _instance;
}

/** Called from the savedStoryBeats setting onChange — refresh if open. */
export function refreshStoryBeatsCommandCenter() {
  if (_instance?.rendered) _instance.render();
}
