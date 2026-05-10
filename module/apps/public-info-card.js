/**
 * PublicInfoCard — a read-only "public face" view of a Major Character.
 *
 * Players don't necessarily own every Major; clicking a row in the Public
 * Info Dashboard for an unowned actor used to throw "no permission" errors
 * because we tried to open the full sheet. This card replaces that path
 * for non-owners, showing only fields that are publicly visible per the
 * actor's per-field visibility settings (rulebook: reputation always
 * public; desire/backstory/notes/magic per actor.visibility).
 *
 * Framed singleton ApplicationV2 — opens at a fixed default position;
 * subsequent opens replace the actor it's showing.
 */

import { profilePic } from '../helpers/profile-pic.js';
import { effectiveThemeOf } from '../helpers/themed-wrap.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

let _instance = null;

/** Strip HTML tags for plain-text rendering when needed. */
function _stripHtml(html) {
  if (!html) return '';
  return String(html).replace(/<[^>]*>/g, '').trim();
}

export class PublicInfoCard extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'gs-public-info-card',
    classes: ['good-society', 'gs-public-info-card'],
    window: {
      frame: true,
      positioned: true,
      title: 'GOODSOCIETY.publicInfoCard.windowTitle',
    },
    position: { width: 520, height: 'auto', left: 240, top: 100 },
  };

  static PARTS = {
    main: { template: 'systems/good-society-homebrew/templates/apps/public-info-card.hbs' },
  };

  /** The actor currently displayed; set via `show(actor)` before rendering. */
  _actor = null;

  /** @override */
  get title() {
    if (!this._actor) return game.i18n.localize('GOODSOCIETY.publicInfoCard.windowTitle');
    return game.i18n.format('GOODSOCIETY.publicInfoCard.windowTitleFor', {
      name: this._displayName(this._actor),
    });
  }

  _displayName(actor) {
    const sys = actor.system;
    const explicitPersona = sys.activePersonaId
      ? (sys.personas ?? []).find(p => p.id === sys.activePersonaId)
      : null;
    return explicitPersona?.name || actor.name;
  }

  /** @override */
  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    const actor = this._actor;
    if (!actor) return ctx;

    const sys = actor.system;
    const items = actor.items;
    const vis = sys.visibility ?? {};

    const explicitPersona = sys.activePersonaId
      ? (sys.personas ?? []).find(p => p.id === sys.activePersonaId)
      : null;
    const displayName = explicitPersona?.name || actor.name;
    const portraitUrl = profilePic(actor);
    const initial = (displayName || '?')[0].toUpperCase();

    const archetypeId = sys.bio?.archetype ?? '';
    const archetypeLabel = archetypeId
      ? game.i18n.localize(`GOODSOCIETY.major.archetype.${archetypeId}`)
      : '';
    const familyActor = sys.familyId ? game.actors?.get(sys.familyId) : null;
    const familyName  = familyActor?.name ?? '';
    const role = [archetypeLabel, familyName ? `· ${familyName}` : ''].filter(Boolean).join(' ');
    const title = (sys.bio?.title ?? '').trim();

    // Reputation tags (always public per rulebook p.92)
    const positiveTags = items
      .filter(i => i.type === 'reputation-tag' && i.system?.polarity === 'positive')
      .map(t => ({ id: t.id, name: t.name, description: t.system?.description ?? '' }));
    const negativeTags = items
      .filter(i => i.type === 'reputation-tag' && i.system?.polarity === 'negative')
      .map(t => ({ id: t.id, name: t.name, description: t.system?.description ?? '' }));

    // Active reputation conditions (always public)
    const positiveConditions = items
      .filter(i => i.type === 'reputation-condition' && i.system?.polarity === 'positive' && i.system?.active)
      .map(c => ({ id: c.id, name: c.name, description: c.system?.description ?? '' }));
    const negativeConditions = items
      .filter(i => i.type === 'reputation-condition' && i.system?.polarity === 'negative' && i.system?.active)
      .map(c => ({ id: c.id, name: c.name, description: c.system?.description ?? '' }));

    // Visibility-gated fields. We only render `public` content; `secret` and
    // `redacted` collapse the section entirely (the dashboard already conveys
    // "kept secret" affordance for non-public fields).
    const TextEditor =
      foundry.applications.ux?.TextEditor?.implementation
      ?? globalThis.TextEditor;
    const enrich = async (html) => {
      if (!html) return '';
      try { return await TextEditor.enrichHTML(html, { async: true, secrets: false }); }
      catch { return html; }
    };

    const fields = [];
    if (vis.desire === 'public' && sys.desire) {
      fields.push({
        labelKey: 'GOODSOCIETY.publicInfoCard.desire',
        html: await enrich(sys.desire),
      });
    }
    if (vis.backstory === 'public' && sys.backstory) {
      fields.push({
        labelKey: 'GOODSOCIETY.publicInfoCard.backstory',
        html: await enrich(sys.backstory),
      });
    }
    if (vis.adventurerSentiment === 'public' && sys.adventurerSentiment) {
      fields.push({
        labelKey: 'GOODSOCIETY.publicInfoCard.adventurerSentiment',
        html: await enrich(sys.adventurerSentiment),
      });
    }
    if (vis.notesObjectives === 'public' && sys.notesObjectives) {
      fields.push({
        labelKey: 'GOODSOCIETY.publicInfoCard.notesObjectives',
        html: await enrich(sys.notesObjectives),
      });
    }

    // Magic & Skills — entire collection visible only when magic visibility
    // is `public`. Each entry shows name + description.
    const magicSkills = (vis.magic === 'public')
      ? items
          .filter(i => i.type === 'magic-skill' && !i.system?.hidden)
          .map(m => ({ id: m.id, name: m.name, description: m.system?.description ?? '' }))
      : [];

    // Persona public summary — when an explicit persona is active and the
    // persona has its own hoverSummary, show that here.
    const personaSummary = explicitPersona?.hoverSummary ?? '';

    return {
      ...ctx,
      actor,
      theme: effectiveThemeOf(actor) || 'clayton',
      displayName,
      portraitUrl,
      initial,
      role,
      title,
      personaSummary,
      hasPositiveTags: positiveTags.length > 0,
      hasNegativeTags: negativeTags.length > 0,
      hasPositiveConditions: positiveConditions.length > 0,
      hasNegativeConditions: negativeConditions.length > 0,
      positiveTags,
      negativeTags,
      positiveConditions,
      negativeConditions,
      fields,
      hasFields: fields.length > 0,
      magicSkills,
      hasMagicSkills: magicSkills.length > 0,
    };
  }

  /** @override */
  _onRender(context, options) {
    super._onRender?.(context, options);
    if (!this.element) return;
    // Theme the card body so the cameo accent / eyebrow ornament match
    // the actor's effective theme. Same pattern as the actor sheet.
    this.element.classList.add('gs-themed');
    this.element.dataset.theme = context?.theme || 'clayton';
  }

  /** @override */
  async _onClose(options) {
    await super._onClose?.(options);
    this._actor = null;
    _instance = null;
  }
}

/**
 * Open the public-info card for `actor`. Singleton — re-opens with new
 * actor if already open. Brings to top if already showing the same actor.
 */
export function openPublicInfoCard(actor) {
  if (!actor) return;
  if (!_instance) _instance = new PublicInfoCard();
  if (_instance._actor?.id === actor.id && _instance.rendered) {
    _instance.bringToTop?.();
    return _instance;
  }
  _instance._actor = actor;
  _instance.render({ force: true });
  return _instance;
}
