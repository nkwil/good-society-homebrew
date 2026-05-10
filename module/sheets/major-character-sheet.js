/**
 * @typedef {import('@league-of-foundry-developers/foundry-vtt-types').Actor} Actor
 */

import { MonologueEditor } from '../apps/monologue-editor.js';
import { openRevealControl } from '../apps/reveal-control.js';
import { openPersonaSwitcherPopover } from '../apps/persona-switcher-popover.js';
import { openActionsCheatSheet } from '../apps/actions-cheat-sheet.js';
import { openPersonaEditor } from '../apps/persona-editor.js';
import { switchPersona } from '../helpers/persona-swap.js';
import { isConflictComplete, checkThresholdAndPrompt } from '../helpers/reputation-rules.js';
import { postCompletionCard } from '../helpers/chat-cards.js';
import { castMagicSkill } from '../helpers/cast-magic.js';
import { THEME_REGISTRY } from '../constants.js';
import { profilePic } from '../helpers/profile-pic.js';
import { fitDossierNames } from '../helpers/responsive-name.js';
import { pronounsFor } from '../helpers/pronouns.js';
import { openMonologueTrigger } from '../apps/monologue-overlay.js';
import { ARCHETYPE_CHOICES } from '../data-models/major-character.js';

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

const PEERAGE_LABELS = {
  'royalty':       'Royalty',
  'nobility':      'Nobility',
  'gentry':        'Gentry',
  'commoner':      'Commoner',
  'impoverished':  'Impoverished',
};

/** Localized archetype label for a given archetype id. Resolves at call time
 *  so locale switches Just Work. */
function archetypeLabel(id) {
  if (!id) return '';
  return game.i18n.localize(`GOODSOCIETY.major.archetype.${id}`);
}

const PHASE_LABELS = {
  'pre-cycle': 'Pre-Cycle',
  'novel': 'Novel Chapter',
  'reputation': 'Reputation Phase',
  'rumour-scandal': 'Rumour & Scandal',
  'epistolary': 'Epistolary Phase',
  'upkeep': 'Upkeep',
};

export class MajorCharacterSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ['good-society', 'sheet', 'actor', 'major-character'],
    // Post-MVP §4 dossier — wider for the two-page spread layout (was 720).
    // Height bumped from 880 → 1040 so the right page's six sections (desire,
    // notes, sentiment, magic, connections, backstory) fit without forcing
    // an inner scroll on the .window-content container. Window remains
    // user-resizable; this is just the comfortable default.
    position: { width: 1140, height: 1040 },
    window: { contentClasses: ['gs-major-sheet'] },
    // ApplicationV2 sheets do NOT auto-submit form inputs by default.
    // Without `form.submitOnChange`, every native input/select on the sheet
    // (persona <select>, bio chips, name field, etc.) is visual-only — the
    // user's change never persists to actor.system. Standard ActorSheetV2
    // pattern is to opt in here.
    form: {
      submitOnChange: true,
      closeOnSubmit: false,
    },
    actions: {
      toggleResolvePip: MajorCharacterSheet.#toggleResolvePip,
      toggleMt: MajorCharacterSheet.#toggleMt,
      takeMonologue: MajorCharacterSheet.#takeMonologue,
      toggleBox: MajorCharacterSheet.#toggleBox,
      openItem: MajorCharacterSheet.#openItem,
      beginConflict: MajorCharacterSheet.#beginConflict,
      toggleVisibility: MajorCharacterSheet.#toggleVisibility,
      openActor: MajorCharacterSheet.#openActor,
      addConnection: MajorCharacterSheet.#addConnection,
      createItem: MajorCharacterSheet.#createItem,
      deleteItem: MajorCharacterSheet.#deleteItem,
      castSkill: MajorCharacterSheet.#castSkill,
      openPersonaSwitcher:      MajorCharacterSheet.#openPersonaSwitcher,
      openActionsCheatSheet:    MajorCharacterSheet.#openActionsCheatSheet,
      // Post-MVP §4 dossier refactor — spread navigation + theme switcher.
      setTheme:        MajorCharacterSheet.#setTheme,
      showSpread:      MajorCharacterSheet.#showSpread,
      backToDossier:   MajorCharacterSheet.#backToDossier,
      // Click cameo → Foundry FilePicker → write the picked image to
      // prototypeToken.texture.src. The post-MVP §8.5 profilePic() helper
      // resolves cameos from the token image, so this is the canonical path.
      pickToken:       MajorCharacterSheet.#pickToken,
      // Edit-button-next-to-eyebrow handler for HTML fields (desire, notes,
      // notesObjectives, backstory). Forwards the click to Foundry's
      // built-in {{editor}} edit anchor so we don't reimplement editor
      // lifecycle — we just relocate the trigger.
      editField:       MajorCharacterSheet.#editField,
      // Edit the actor's true-identity theme (system.theme) via a small
      // DialogV2 with a theme picker. Replaces the previous inline theme
      // dropdown that took up real estate in the cameo header. Personas
      // edit theme via the persona editor; this handler covers the
      // true-identity case where there's no persona to edit.
      editTrueIdentityTheme: MajorCharacterSheet.#editTrueIdentityTheme,
    },
  };

  // Post-MVP §4.4.1 — instance-tracked spread that survives ApplicationV2's
  // re-renders. Persists in-session only; resets to 'character' on close.
  _currentSpread = 'character';

  // Post-MVP §4 dossier — single `book` PART that emits the leather-book
  // shell with a two-page character spread. The `dossierExtras` PART
  // emits backstory + connection alt-spreads (rendered via CSS toggle when
  // `_currentSpread !== 'character'`).
  //
  // The legacy `header` / `public` / `private` / `strip` PARTs are
  // retired — their content lives inside `book.hbs` now, restructured for
  // the spread layout.
  static PARTS = {
    book: { template: 'systems/good-society-homebrew/templates/actors/major-character/book.hbs' },
    dossierExtras: { template: 'systems/good-society-homebrew/templates/actors/major-character/dossier-extras.hbs' },
  };

  tabGroups = { sheet: 'public' };

  // Used to attach the resolve pip contextmenu listener only once per window.
  #resolveListenerAttached = false;

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    const system = this.actor.system;
    const items = this.actor.items;

    // ── Portrait + identity ──────────────────────────────────────────────────
    // For sheet display, only honor an EXPLICIT persona selection (i.e.,
    // activePersonaId is set to a real persona id). The data-model's
    // `activePersona` getter has a fallback chain (primary → first), which
    // is correct for token rendering (always have SOMEONE to render) but
    // wrong for the cameo: when the user picks "true identity" we want the
    // cameo to read the actor's canonical name, not the first persona's.
    const explicitPersona = system.activePersonaId
      ? (system.personas ?? []).find(p => p.id === system.activePersonaId)
      : null;
    // Active persona for token / portrait fallback purposes — uses the
    // data-model getter (with its primary-persona fallback). Only used for
    // image resolution, NOT for the displayed name.
    const activePersona = system.activePersona;
    const displayName = explicitPersona?.name || this.actor.name;
    const portraitUrl = profilePic(this.actor);  // §8.5 token-based
    const portraitInitial = (displayName?.[0] ?? '?').toUpperCase();

    const familyActor = system.familyId ? game.actors?.get(system.familyId) : null;
    const peerageLabel = PEERAGE_LABELS[system.bio?.peerage] ?? '';
    const archetypeId = system.bio?.archetype ?? '';
    const archetypeLabelStr = archetypeLabel(archetypeId);
    const archetypeChoices = ARCHETYPE_CHOICES.map(id => ({
      id,
      label: archetypeLabel(id),
      selected: id === archetypeId,
    }));
    const familyName = familyActor?.name ?? '';
    // The dossier subtitle now leads with archetype (the more flavor-relevant
    // identity descriptor), with peerage tucked into the cameo bio line.
    const roleTitle = [archetypeLabelStr, familyName ? `· ${familyName}` : ''].filter(Boolean).join(' ');

    // ── Strip — resolve pips ─────────────────────────────────────────────────
    const resolveMax = system.tokens?.resolve?.max ?? 5;
    const resolveCurrent = system.tokens?.resolve?.current ?? 3;
    const resolvePips = Array.from({ length: resolveMax }, (_, i) => ({
      index: i,
      filled: i < resolveCurrent,
      label: `${i + 1} of ${resolveMax} resolve`,
    }));

    let cycleNumber = 1;
    let cyclePhase = 'Pre-Cycle';
    try {
      const rawNumber = game.settings.get('good-society-homebrew', 'cycleNumber');
      const rawPhase = game.settings.get('good-society-homebrew', 'cyclePhase');
      cycleNumber = rawNumber ?? 1;
      cyclePhase = PHASE_LABELS[rawPhase] ?? rawPhase ?? 'Pre-Cycle';
    } catch {
      // Settings not yet registered on first load — use defaults.
    }

    // ── Public tab — Reputation Criteria ─────────────────────────────────────
    const criteriaVisibility = familyActor?.system?.visibility?.uniqueNegativeRepCriteria ?? 'public';

    // ── Public tab — Reputation Tags ─────────────────────────────────────────
    const positiveTags = (system.reputation?.positiveTags ?? [])
      .map(id => items.get(id)).filter(i => i?.type === 'reputation-tag');
    const negativeTags = (system.reputation?.negativeTags ?? [])
      .map(id => items.get(id)).filter(i => i?.type === 'reputation-tag');

    // 3-pip meter: filled up to min(count, 3); beyond 3 = full/condition fired
    const buildMeterPips = count => Array.from({ length: 3 }, (_, i) => ({ filled: i < count }));

    // Post-MVP §4.1 dossier — open-slot placeholder count per polarity (max 3).
    const REP_SLOTS_MAX = 3;
    const openPositiveSlots = Math.max(0, REP_SLOTS_MAX - positiveTags.length);
    const openNegativeSlots = Math.max(0, REP_SLOTS_MAX - negativeTags.length);

    // ── Public tab — Active Conditions ───────────────────────────────────────
    const activeConditions = (system.reputation?.activeConditions ?? [])
      .map(id => items.get(id))
      .filter(i => i?.type === 'reputation-condition' && i.system?.active);

    // ── Public tab — Inner Conflicts (active) ────────────────────────────────
    const activeConflicts = (system.innerConflictsActiveIds ?? [])
      .map(id => items.get(id))
      .filter(i => i?.type === 'inner-conflict')
      .map(item => {
        const s = item.system;
        const leftCount = (s.leftBoxes ?? []).filter(Boolean).length;
        const rightCount = (s.rightBoxes ?? []).filter(Boolean).length;
        return {
          // Pass the actual stored values (may be empty strings); the
          // template's placeholder text covers the empty case visually.
          // Previously this used `|| 'Left side'` which made the input
          // *value* literally "Left side" — so users couldn't tell the
          // field was empty, and saving an unedited input persisted the
          // placeholder text as the real label.
          leftLabel: s.leftLabel ?? '',
          rightLabel: s.rightLabel ?? '',
          leftBoxes: s.leftBoxes ?? [false, false, false, false, false],
          rightBoxes: s.rightBoxes ?? [false, false, false, false, false],
          completed: s.completed ?? false,
          completedSide: s.completedSide ?? null,
          totalCount: leftCount + rightCount,
          leftCount,
          rightCount,
          itemId: item.id,
          labelEditable: false,
          showPerSideCount: true,
        };
      });

    // ── Public tab — Completed Conflicts ─────────────────────────────────────
    const completedConflicts = (system.innerConflictsCompletedIds ?? [])
      .map(id => items.get(id))
      .filter(i => i?.type === 'inner-conflict');

    // ── Private tab ───────────────────────────────────────────────────────────
    const connectionActors = (system.connections ?? [])
      .map(id => game.actors?.get(id))
      .filter(Boolean);

    const magicSkills = items.filter(i => i.type === 'magic-skill');

    // ── Dossier (post-MVP §4) ────────────────────────────────────────────────
    // Connection chips on the private spread are clickable; clicking a chip
    // navigates to a public-info spread for that actor. The Connections
    // section accepts both Connection AND NPC actors — both render the same
    // chip + alt-spread shape. NPCs branch out of the impressions/rep-tags/
    // tied-to data (they don't carry that schema); chips and spreads
    // gracefully render fewer sections.
    //
    // Pre-resolve the data the spread needs so the template can render
    // without async. Honors permission — game.actors.get returns null for
    // actors the user can't see, which we filter out.
    const connectionsResolved = (system.connections ?? [])
      .map((id) => game.actors?.get(id))
      .filter((a) => !!a)
      .filter((a) => a.type === 'connection' || a.type === 'npc')
      .map((conn) => {
        const isNpc = conn.type === 'npc';
        const persona = conn.system?.activePersona ?? null;

        // Connection-only fields (NPCs have no schema for these).
        const publicReputationTags = isNpc ? [] : (conn.items ?? [])
          .filter((i) => i?.type === 'reputation-tag')
          .map((i) => ({ name: i.name, polarity: i.system?.polarity ?? 'positive' }));
        // Public impressions display the true identity name of each author —
        // NOT the active persona's name. This surface is "what the world sees,"
        // and personas are intended to be secret identities. If Avril's
        // persona "Mags" wrote an impression, the public dossier still
        // attributes it to "Avril Eclair." (User-reported bug 2026-05-10.)
        const impressions = isNpc ? [] : (conn.system?.impressions ?? [])
          .map((imp) => {
            const major = imp.majorId ? game.actors?.get(imp.majorId) : null;
            return {
              majorName: major?.name || 'Unknown',
              text: imp.text || '',
            };
          })
          .filter((imp) => imp.text);
        // "Tied to" — other Majors who hold this actor in their connections
        // array. Works for both NPC and Connection (the lookup walks every
        // Major's `connections` array regardless of dropped actor type).
        // Same rule as the impressions block above: this surface is public-
        // facing, so attribution uses true identity names, not persona names.
        const tiedTo = (game.actors?.filter(
          (a) =>
            a.type === 'major-character'
            && a.id !== this.actor.id
            && (a.system?.connections ?? []).includes(conn.id),
        ) ?? []).map((m) => ({
          id: m.id,
          name: m.name,
          theme: m.system?.theme || 'clayton',
        }));
        // Drop Foundry's default placeholder paths (icons/svg/mystery-man.svg
        // etc.) so the chip renders the colored disc + initial fallback —
        // which matches the preview much better than a generic silhouette.
        const rawPortrait = profilePic(conn);
        const isPlaceholder = !rawPortrait || /^icons\/svg\//.test(rawPortrait);
        // NPCs use bio.role as the relationship label since they have no
        // bio.relationshipLabel schema. Theme defaults differ too: NPC
        // gets 'npc' (house style), Connection falls back to grey.
        return {
          id: conn.id,
          actorType: conn.type,                                       // 'connection' | 'npc'
          isNpc,
          displayName: persona?.name || conn.name,
          theme: conn.system?.theme || (isNpc ? 'npc' : 'connection-grey'),
          portraitUrl: isPlaceholder ? '' : rawPortrait,
          pronouns: conn.system?.bio?.pronouns || '',
          relationshipLabel: isNpc
            ? (conn.system?.bio?.role || '')
            : (conn.system?.bio?.relationshipLabel || ''),
          // Editable subhead (system.bio.title) — renders below the name
          // on the alt-spread cameo when set.
          title: (conn.system?.bio?.title ?? '').trim(),
          description: conn.system?.bio?.description || '',
          publicTags: conn.system?.sceneInfo?.publicTags ?? [],
          publicReputationTags,
          impressions,
          tiedTo,
        };
      });

    // Backstory pages — split by `<hr class="page-break">` (option B in the
    // patch). Authors insert page breaks deliberately; no migration needed.
    //
    // PLAIN-TEXT NORMALIZATION: the textarea editor stores raw text with
    // `\n` newlines and `\n\n` paragraph breaks. CSS columns on the
    // two-page backstory spread can only split content at block-element
    // boundaries — a single text node with internal newlines counts as
    // ONE indivisible block, so all the text would land in the left
    // column and the right page stays empty. We detect that case (no
    // block-level HTML tags present) and wrap each paragraph in <p> so
    // the column flow can split correctly. If the user typed actual HTML,
    // we leave it alone.
    const backstoryRaw = system.backstory || '';
    const hasBlockTags = /<(p|div|h[1-6]|ul|ol|li|hr|br|blockquote)\b/i.test(backstoryRaw);
    const backstoryNormalized = hasBlockTags
      ? backstoryRaw
      : backstoryRaw
          .split(/\n\s*\n/)
          .map((para) => para.trim())
          .filter((para) => para.length > 0)
          .map((para) => `<p>${para.replace(/\n/g, '<br>')}</p>`)
          .join('');

    // Auto-paginate: split the backstory into spreads (each spread is one
    // two-page book opening). Respect any manual <hr class="page-break">
    // breaks the author inserted, then within each user-defined chunk,
    // auto-split by paragraph when accumulated text exceeds the per-spread
    // budget. The budget is tuned to the 1080×500 reading area (two
    // columns × ~95 chars × ~20 lines ≈ 3800 chars) — conservative so
    // text rarely clips even with extra paragraph margins.
    //
    // Tuning knob: SPREAD_CHAR_BUDGET. Raise it if content feels sparse
    // per spread; lower it if you see clipping at the bottom.
    const SPREAD_CHAR_BUDGET = 3500;
    const _splitByBudget = (chunk) => {
      // Split on </p> boundaries so we never break mid-paragraph. If the
      // chunk has no <p> tags (a single block of HTML), it stays whole.
      const paraMatches = chunk.match(/<p\b[\s\S]*?<\/p>|<h[1-6]\b[\s\S]*?<\/h[1-6]>|<ul\b[\s\S]*?<\/ul>|<ol\b[\s\S]*?<\/ol>|<blockquote\b[\s\S]*?<\/blockquote>/gi);
      if (!paraMatches || paraMatches.length === 0) return [chunk];
      const out = [];
      let current = '';
      for (const block of paraMatches) {
        if (current && (current.length + block.length) > SPREAD_CHAR_BUDGET) {
          out.push(current);
          current = '';
        }
        current += block;
      }
      if (current) out.push(current);
      return out;
    };

    const userChunks = backstoryNormalized
      .split(/<hr\s+class=["']page-break["']\s*\/?>/i)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    const backstoryPages = userChunks.flatMap(_splitByBudget);
    const backstoryHasMultiplePages = backstoryPages.length > 1;
    // Teaser shown on the character spread — first ~280 chars of page 1, plain
    // text (HTML stripped). The full page 1 still renders on backstory-1.
    const backstoryTeaser = (() => {
      const firstPage = backstoryPages[0] || '';
      const stripped = firstPage.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      if (stripped.length <= 280) return stripped;
      return stripped.substring(0, 280).replace(/\s+\S*$/, '') + '…';
    })();

    // Theme registry for the inline swatch row (post-MVP §4.5b).
    const themeRegistry = THEME_REGISTRY.map((t) => ({
      ...t,
      label: game.i18n.localize(t.label) || t.id,
      isActive: system.theme === t.id,
    }));

    // Enrich HTML fields for read-only display. The {{editor}} helper in
    // ApplicationV2 + v13 doesn't reliably open the editor (the auto edit
    // anchor doesn't dispatch). We render enriched HTML in the body and
    // attach a custom edit button that opens a DialogV2 — see #editField.
    const TE = foundry.applications?.ux?.TextEditor?.implementation ?? globalThis.TextEditor;
    const enrich = async (html) => {
      if (!html) return '';
      try {
        return await TE.enrichHTML(html, {
          secrets: this.actor.isOwner,
          relativeTo: this.actor,
          async: true,
        });
      } catch {
        return html;
      }
    };
    const enrichedDesire = await enrich(system.desire);
    const enrichedNotes = await enrich(system.notesObjectives);
    const enrichedAdventurerSentiment = await enrich(system.adventurerSentiment);
    const enrichedBackstory = await enrich(system.backstory);

    return {
      ...ctx,
      actor: this.actor,
      system,
      tabGroups: this.tabGroups,
      // Identity
      portraitUrl,
      portraitInitial,
      displayName,
      roleTitle,
      peerageLabel,
      archetypeLabel: archetypeLabelStr,
      archetypeChoices,
      personas: system.personas ?? [],
      activePersonaId: system.activePersonaId ?? '',
      // True only when a persona is EXPLICITLY selected (activePersonaId is
      // set to a real persona id). When false, the cameo shows actor.name
      // and the input is editable + writes back to actor.name. When true,
      // the input is readonly + name-stripped to prevent silent rename.
      //
      // Both flags now key off explicit selection (not the data-model
      // fallback chain) — the fallback was causing "switch to true identity"
      // to keep showing the first persona's name.
      hasActivePersona: !!explicitPersona,
      activePersonaExplicit: !!(system.activePersonaId),
      // Strip
      resolvePips,
      cycleNumber,
      cyclePhase,
      // Public tab
      familyActor,
      familyName,
      criteriaVisibility,
      reputationCriteria: familyActor?.system?.uniqueNegativeRepCriteria ?? '',
      positiveTags,
      negativeTags,
      positiveMeterPips: buildMeterPips(positiveTags.length),
      negativeMeterPips: buildMeterPips(negativeTags.length),
      activeConditions,
      activeConflicts,
      completedConflicts,
      // Private tab
      visibility: system.visibility ?? {},
      connectionActors,
      magicSkills,
      // Post-MVP §4 dossier extras
      currentSpread: this._currentSpread,
      connectionsResolved,
      backstoryPages,
      backstoryHasMultiplePages,
      backstoryTeaser,
      themeRegistry,
      profilePicUrl: profilePic(this.actor),
      // Pronoun set parsed from system.bio.pronouns. Templates use this for
      // dynamic pronoun-aware copy (e.g. "{{pronouns.Possessive}} Present
      // Desire" → "Her" / "His" / "Their"). Always populated, even if
      // bio.pronouns is empty (falls back to they/them).
      pronouns: pronounsFor(this.actor),
      // Enriched HTML bodies for the read-only display on the dossier.
      // Edits flow through the editField action handler → DialogV2 with
      // <prose-mirror> rich-text editor.
      enrichedDesire,
      enrichedNotes,
      enrichedAdventurerSentiment,
      enrichedBackstory,
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);

    // Set theme scope on the outer window so CSS variables cascade to all children.
    // Active persona's theme (when set) overrides the actor's theme — the
    // "true identity" theme is `actor.system.theme`; per-persona themes are
    // stored on each persona and switch with the persona. Empty persona
    // theme means "inherit true identity theme".
    const sys = this.actor.system;
    const explicitPersonaForTheme = sys.activePersonaId
      ? (sys.personas ?? []).find(p => p.id === sys.activePersonaId)
      : null;
    const effectiveTheme = (explicitPersonaForTheme?.theme || sys.theme) || 'clayton';
    this.element.classList.add('gs-actor');
    this.element.dataset.theme = effectiveTheme;

    // Cameo name input — keeps the visible "slice" input and the hidden
    // full-name field in sync. Visible input shows everything after the
    // first letter (so the Lavishly Yours ornament IS the first letter,
    // not a duplicate of it). Hidden input carries the reconstructed full
    // name for form-submit. Wired on every render via AbortController so
    // re-renders don't leak listeners.
    if (this._nameSyncAbort) this._nameSyncAbort.abort();
    this._nameSyncAbort = new AbortController();
    const sliceInput = this.element.querySelector('.dossier-cameo__name-input');
    const hiddenFull = this.element.querySelector('input[data-name-full]');
    if (sliceInput && hiddenFull) {
      sliceInput.addEventListener('input', () => {
        const initial = sliceInput.dataset.nameInitial ?? '';
        hiddenFull.value = initial + sliceInput.value;
      }, { signal: this._nameSyncAbort.signal });
    }

    // Responsive name sizing — long names shrink so they don't overflow
    // the cameo's body column. Re-runs on every render and on every input
    // event (helper binds its own listener; reuses the same AbortController
    // so re-renders never leak handlers).
    fitDossierNames(this.element, { signal: this._nameSyncAbort.signal });

    // Theme select — kept OUT of the form serializer (no `name` attr).
    // Its change writes system.theme directly. See book.hbs comment for the
    // backstory on why we can't trust submitOnChange to handle this.
    const themeSelect = this.element.querySelector('select[data-theme-select]');
    if (themeSelect) {
      themeSelect.addEventListener('change', async (ev) => {
        const newTheme = ev.target.value;
        if (!newTheme) return;
        await this.actor.update({ 'system.theme': newTheme });
      }, { signal: this._nameSyncAbort.signal });
    }

    // Archetype select — same pattern as theme. No `name` attr; manual change
    // writer to system.bio.archetype. The select's value being a snapshot of
    // the last render's data means we cannot trust the form serializer here.
    const archetypeSelect = this.element.querySelector('select[data-archetype-select]');
    if (archetypeSelect) {
      archetypeSelect.addEventListener('change', async (ev) => {
        const newArchetype = ev.target.value;
        if (!newArchetype) return;
        await this.actor.update({ 'system.bio.archetype': newArchetype });
      }, { signal: this._nameSyncAbort.signal });
    }

    // Inline-editable inner-conflict side labels on the dossier. These
    // inputs belong to embedded Items, not the parent actor, so they
    // bypass the standard form serializer (which would route them to
    // actor.system.<...>). We listen on `input` (fires every keystroke)
    // with a 400 ms debounce per input, so saves happen while the user
    // is still typing — no reliance on blur/change firing in the right
    // order vs ApplicationV2's submitOnChange handler. Same
    // AbortController as the name-sync listener so re-renders don't leak.
    const conflictInputs = this.element.querySelectorAll('.dossier-inner-conflict__side-input');
    if (!this._conflictDebouncers) this._conflictDebouncers = new WeakMap();
    for (const input of conflictInputs) {
      const handler = () => {
        const prior = this._conflictDebouncers.get(input);
        if (prior) clearTimeout(prior);
        const timer = setTimeout(async () => {
          const itemId = input.dataset.conflictId;
          const side = input.dataset.conflictSide;
          if (!itemId || !side) return;
          const item = this.actor.items.get(itemId);
          if (!item) {
            console.warn('[GS] Inner-conflict label save: item not found', itemId);
            return;
          }
          const field = side === 'left' ? 'system.leftLabel' : 'system.rightLabel';
          try {
            await item.update({ [field]: input.value });
          } catch (err) {
            console.error('[GS] Inner-conflict label save failed:', err);
            ui.notifications?.error('Could not save the conflict label — see console.');
          }
        }, 400);
        this._conflictDebouncers.set(input, timer);
      };
      input.addEventListener('input', handler, { signal: this._nameSyncAbort.signal });
      // Also save immediately on blur, so a fast tab-out before the
      // debounce fires still persists.
      input.addEventListener('change', handler, { signal: this._nameSyncAbort.signal });
    }

    // Right-click on any resolve pip resets to the world's starting-resolve setting.
    // Attached once per window via event delegation on the stable outer element.
    if (!this.#resolveListenerAttached) {
      this.#resolveListenerAttached = true;
      this.element.addEventListener('contextmenu', async (ev) => {
        if (!ev.target.matches('.gs-resolve-pip')) return;
        ev.preventDefault();
        const def = (() => {
          try { return game.settings.get('good-society-homebrew', 'defaultStartingResolve') ?? 3; }
          catch { return 3; }
        })();
        await this.actor.update({ 'system.tokens.resolve.current': def });
      });

      // Post-MVP §4.4.6 — Esc on any non-character spread navigates back to
      // the character spread. Capture-phase listener bails on text editors
      // (so Esc still closes their menus / dropdowns first).
      this.element.addEventListener('keydown', (ev) => {
        if (ev.key !== 'Escape') return;
        if (this._currentSpread === 'character') return; // let Foundry's default close handler run
        const t = ev.target;
        if (t?.matches?.('input, textarea, select, [contenteditable="true"]')) return;
        if (t?.closest?.('[data-allow-esc], .ProseMirror, .editor, .tox')) return;
        ev.preventDefault();
        ev.stopPropagation();
        this._currentSpread = 'character';
        this._applyCurrentSpread();
      }, true);
    }

    // Re-apply the active spread after every render (ApplicationV2 resets
    // .is-active to the default in the HTML otherwise).
    this._applyCurrentSpread();
  }

  // ── Drop handler ──────────────────────────────────────────────────────────

  async _onDrop(event) {
    const data = TextEditor.getDragEventData(event);
    if (!data) return super._onDrop(event);

    if (data.type === 'Item') {
      const item = data.uuid ? await fromUuid(data.uuid) : null;
      if (item?.type === 'reputation-tag') {
        // Skip if this tag is already embedded on this actor.
        if (item.parent?.id === this.actor.id) return;
        const polarity = item.system?.polarity ?? 'positive';
        const [newItem] = await this.actor.createEmbeddedDocuments('Item', [{
          type: 'reputation-tag',
          name: item.name,
          system: foundry.utils.deepClone(item.system),
        }]);
        if (!newItem) return;
        const field = polarity === 'negative'
          ? 'system.reputation.negativeTags'
          : 'system.reputation.positiveTags';
        const current = polarity === 'negative'
          ? (this.actor.system.reputation?.negativeTags ?? [])
          : (this.actor.system.reputation?.positiveTags ?? []);
        await this.actor.update({ [field]: [...current, newItem.id] });
        await checkThresholdAndPrompt(this.actor, polarity);
        return;
      }
      return super._onDrop(event);
    }

    if (data.type === 'Actor') {
      const dropped = data.uuid ? await fromUuid(data.uuid) : null;
      // The Connections section accepts both Connection actors AND NPCs —
      // both render as chips that flip to a public-info alt-spread when
      // clicked. NPCs are facilitator-authored and may be GM-only by
      // default; the chip itself is hidden for users who can't see the
      // dropped actor (the post-prepareContext filter handles this).
      if (dropped?.type === 'connection' || dropped?.type === 'npc') {
        const current = this.actor.system.connections ?? [];
        if (!current.includes(dropped.id)) {
          await this.actor.update({ 'system.connections': [...current, dropped.id] });
        }
        return;
      }
    }

    return super._onDrop(event);
  }

  // ── Action handlers ────────────────────────────────────────────────────────

  // Toggle a single resolve pip. Click the highest-filled pip to lower by one;
  // click an empty pip to raise to that pip's position.
  static async #toggleResolvePip(event, target) {
    const pipIndex = Number(target.dataset.pip);
    const current = this.actor.system.tokens.resolve.current;
    const newValue = current === pipIndex + 1 ? pipIndex : pipIndex + 1;
    await this.actor.update({ 'system.tokens.resolve.current': newValue });
  }

  static async #toggleMt(event, target) {
    await this.actor.update({ 'system.tokens.major': !this.actor.system.tokens.major });
  }

  static async #takeMonologue(event, target) {
    // Per post-MVP §12.2 the monologue dot triggers the spend on someone else.
    // Older flow (pre-MVP) opened the modal directly on this actor — kept as
    // fallback when the overlay is disabled or world identity is off.
    if (!this.actor.system.tokens.major) {
      ui.notifications?.warn(game.i18n.localize('GOODSOCIETY.monologueEditor.alreadySpent'));
      return;
    }
    let overlayEnabled = true;
    try { overlayEnabled = game.settings.get('good-society-homebrew', 'monologueOverlayEnabled'); } catch {}
    const worldIdActive = document.body.classList.contains('gs-world-identity');
    if (overlayEnabled && worldIdActive) {
      await openMonologueTrigger(this.actor);
      return;
    }
    // Light tier — open the existing self-monologue editor as the fallback.
    new MonologueEditor(this.actor).render(true);
  }

  static async #toggleBox(event, target) {
    const itemId = target.dataset.itemId;
    const side = target.dataset.side;
    const index = parseInt(target.dataset.index, 10);

    const item = this.actor.items.get(itemId);
    if (!item || item.system.completed) return;

    const sys = item.system;
    const leftBoxes = [...(sys.leftBoxes ?? [false, false, false, false, false])];
    const rightBoxes = [...(sys.rightBoxes ?? [false, false, false, false, false])];

    if (side === 'left') leftBoxes[index] = !leftBoxes[index];
    else rightBoxes[index] = !rightBoxes[index];

    const leftCount = leftBoxes.filter(Boolean).length;
    const rightCount = rightBoxes.filter(Boolean).length;
    const nowComplete = isConflictComplete(leftBoxes, rightBoxes);

    const update = { 'system.leftBoxes': leftBoxes, 'system.rightBoxes': rightBoxes };
    if (nowComplete) {
      update['system.completed'] = true;
      update['system.completedSide'] = leftCount >= 5 ? 'left' : rightCount >= 5 ? 'right' : null;
    }

    await item.update(update);

    if (nowComplete) {
      const activeIds = (this.actor.system.innerConflictsActiveIds ?? []).filter(id => id !== itemId);
      const completedIds = [...(this.actor.system.innerConflictsCompletedIds ?? []), itemId];
      await this.actor.update({
        'system.innerConflictsActiveIds': activeIds,
        'system.innerConflictsCompletedIds': completedIds,
      });
      await postCompletionCard({ actor: this.actor, conflict: item, resolvedSide: update['system.completedSide'] });
    }
  }

  static async #openItem(event, target) {
    const item = this.actor.items.get(target.dataset.itemId);
    item?.sheet?.render(true);
  }

  static async #beginConflict(event, target) {
    const created = await this.actor.createEmbeddedDocuments('Item', [{
      type: 'inner-conflict',
      name: 'New Inner Conflict',
    }]);
    const item = created?.[0];
    if (!item) return;

    // Track the new conflict in the actor's active list so the Major sheet's
    // Inner Conflict section actually renders it. Without this, the item
    // exists but is invisible on the parent — labels and boxes save fine to
    // the item itself, but never surface on the dossier.
    const activeIds = [...(this.actor.system.innerConflictsActiveIds ?? []), item.id];
    await this.actor.update({ 'system.innerConflictsActiveIds': activeIds });

    item.sheet?.render(true);
  }

  static async #toggleVisibility(event, target) {
    if (!game.user?.isGM) return;
    openRevealControl(this.actor, target.dataset.field, target);
  }

  /**
   * Edit button next to the eyebrow on HTML fields (desire, notesObjectives,
   * adventurerSentiment, backstory). Opens a DialogV2 hosting Foundry v13's
   * `<prose-mirror>` custom element — a real WYSIWYG editor with toolbar
   * (bold/italic/headings/lists/links). The user never has to type HTML.
   *
   * The custom element is form-associated: when DialogV2 reads its form on
   * Save, the editor's value comes back via `form.elements.content.value`
   * (or, as a defensive fallback, via the element's own `value` getter).
   *
   * Field → label map drives the dialog title. Add new entries here if more
   * HTML fields gain edit affordances on the dossier.
   */
  static async #editField(event, target) {
    const field = target?.dataset?.field;
    if (!field) return;

    // Pronoun-aware label for the desire dialog. Other fields are
    // pronoun-neutral. `pronouns.Possessive` falls back to "Their" when
    // bio.pronouns is empty, so the label always reads cleanly.
    const pronouns = pronounsFor(this.actor);
    const labelByField = {
      desire: `${pronouns.Possessive} Present Desire`,
      notesObjectives: 'Notes & Objectives',
      adventurerSentiment: 'Adventurer Sentiment',
      backstory: 'Backstory',
    };
    const label = labelByField[field] ?? field;

    const current = foundry.utils.getProperty(this.actor.system, field) ?? '';

    // SIMPLE PATH: textarea + a small format-button row for B / I / U / H2
    // / Bullet List / Link. ProseMirror inside DialogV2 has been fragile
    // across multiple iterations (custom element didn't mount, then
    // programmatic create couldn't reliably read back the content). The
    // textarea path is well-trodden and bulletproof: typed content lives
    // in input.value, save returns it directly. Users edit raw HTML for
    // bold/italic/etc., but the format buttons wrap selected text in the
    // right tags so the user usually doesn't need to type the markup.
    const actor = this.actor;
    let editorInstance = null;     // unused; left as a no-op anchor for the
                                   // try/finally cleanup below.

    // No render hook needed for the simple path — the textarea is in the
    // initial dialog content. Set a no-op renderHookId so the finally
    // block below has something to clean up safely.
    const renderHookId = Hooks.once('renderDialogV2NoOp', () => {});

    // Wire format buttons after the dialog renders. Use the standard
    // renderDialogV2 hook to attach click handlers — the dialog DOM is
    // ready by then. The hook auto-removes after firing once.
    Hooks.once('renderDialogV2', (app) => {
      // Wire the format buttons to wrap the textarea selection in HTML
      // tags. `mousedown` (not click) keeps the textarea selection intact
      // so we know what range to wrap.
      const root = app.element;
      if (!root) return;
      const textarea = root.querySelector('textarea[name="content"]');
      if (!textarea) return;

      const wrapSelection = (open, close) => {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const before = textarea.value.slice(0, start);
        const sel = textarea.value.slice(start, end);
        const after = textarea.value.slice(end);
        textarea.value = before + open + sel + close + after;
        // Restore caret inside the wrapped selection so the user can
        // keep typing where they were.
        const newPos = start + open.length + sel.length + close.length;
        textarea.setSelectionRange(start + open.length, newPos - close.length);
        textarea.focus();
      };

      const insertAt = (snippet) => {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const before = textarea.value.slice(0, start);
        const after = textarea.value.slice(end);
        textarea.value = before + snippet + after;
        textarea.setSelectionRange(start + snippet.length, start + snippet.length);
        textarea.focus();
      };

      // Smart list builder: when there's a selection, treat each non-empty
      // line as a list item. When there's no selection, insert a 3-item
      // starter template the user can fill in. Either way, the result is
      // valid `<ul>` / `<ol>` markup that enrichHTML renders cleanly.
      const wrapAsList = (tag) => {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const sel = textarea.value.slice(start, end);
        let listInner;
        if (sel.trim()) {
          // Selected text: split by newlines, treat each non-empty line
          // as one <li>. Trim whitespace inside the list — leading spaces
          // would be rendered by `pre-wrap` on the body otherwise.
          const items = sel.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
          listInner = items.map(item => `  <li>${item}</li>`).join('\n');
        } else {
          listInner = `  <li>First item</li>\n  <li>Second item</li>\n  <li>Third item</li>`;
        }
        const block = `\n<${tag}>\n${listInner}\n</${tag}>\n`;
        const before = textarea.value.slice(0, start);
        const after = textarea.value.slice(end);
        textarea.value = before + block + after;
        // Drop the caret right after the closing tag so the user can keep
        // writing prose below the list.
        const newPos = (before + block).length;
        textarea.setSelectionRange(newPos, newPos);
        textarea.focus();
      };

      const cmds = {
        bold:      () => wrapSelection('<strong>', '</strong>'),
        italic:    () => wrapSelection('<em>', '</em>'),
        underline: () => wrapSelection('<u>', '</u>'),
        heading:   () => wrapSelection('<h2>', '</h2>'),
        bullet:    () => wrapAsList('ul'),
        ordered:   () => wrapAsList('ol'),
        link: () => {
          const url = window.prompt('Link URL:', 'https://');
          if (!url) return;
          wrapSelection(`<a href="${url}">`, '</a>');
        },
        para:      () => wrapSelection('<p>', '</p>'),
      };

      root.querySelectorAll('.gs-prose-toolbar [data-cmd]').forEach((btn) => {
        btn.addEventListener('mousedown', (ev) => {
          ev.preventDefault();
          const c = btn.dataset.cmd;
          try { cmds[c]?.(); } catch (e) { console.warn('[GS] format cmd failed:', c, e); }
        });
      });
    });

    // Build the dialog content: format-button toolbar + a real <textarea>
    // pre-filled with the field's existing HTML. Save reads textarea.value
    // directly — no editor instance, no async DOM scraping, no failure
    // modes from ProseMirror lifecycle quirks.
    const escapedCurrent = foundry.utils.escapeHTML(current);
    const dialogHtml = `
      <div class="gs-prose-toolbar" role="toolbar" aria-label="Formatting">
        <button type="button" data-cmd="bold"      title="Bold"        aria-label="Bold"><strong>B</strong></button>
        <button type="button" data-cmd="italic"    title="Italic"      aria-label="Italic"><em>I</em></button>
        <button type="button" data-cmd="underline" title="Underline"   aria-label="Underline"><u>U</u></button>
        <span class="gs-prose-toolbar__sep" aria-hidden="true"></span>
        <button type="button" data-cmd="heading"   title="Heading"     aria-label="Heading">H</button>
        <button type="button" data-cmd="para"      title="Paragraph"   aria-label="Paragraph">¶</button>
        <button type="button" data-cmd="bullet"    title="Bullet list" aria-label="Bullet list">•</button>
        <button type="button" data-cmd="ordered"   title="Numbered list" aria-label="Numbered list">1.</button>
        <span class="gs-prose-toolbar__sep" aria-hidden="true"></span>
        <button type="button" data-cmd="link"      title="Insert link" aria-label="Insert link">🔗</button>
      </div>
      <textarea name="content" class="gs-prose-textarea" rows="14"
                style="width:100%;min-height:320px;flex:1;font-family:var(--gs-body, Georgia, serif);font-size:14px;line-height:1.55;padding:12px;box-sizing:border-box;background:var(--gs-paper);color:var(--gs-ink);border:0;border-top:0.5px solid color-mix(in srgb, var(--gs-ink) 18%, transparent);outline:none;resize:vertical;">${escapedCurrent}</textarea>
    `;

    try {
      const newValue = await foundry.applications.api.DialogV2.wait({
        window: { title: `Edit — ${label}` },
        position: { width: 720, height: 560 },
        classes: ['gs-prose-dialog'],
        content: dialogHtml,
        buttons: [{
          action: 'save',
          label: 'Save',
          default: true,
          callback: (event, button, dialog) => {
            // Read straight from the textarea. No editor instance, no
            // async, no DOM scraping. If the textarea is gone for some
            // reason, fall back to `current` (no-op) rather than wiping
            // the field with ''.
            const ta = dialog.element?.querySelector?.('textarea[name="content"]');
            return ta ? ta.value : current;
          },
        }],
        rejectClose: false,
      });

      if (newValue === null || newValue === undefined) return;
      await actor.update({ [`system.${field}`]: newValue });
    } finally {
      // Clean up the no-op anchor hook + format-button hook if the dialog
      // dismissed before they fired.
      try { Hooks.off('renderDialogV2NoOp', renderHookId); } catch {}
    }
  }

  /**
   * Edit the actor's true-identity theme (`system.theme`) via a small
   * DialogV2 with a theme picker. Triggered by the ✎ button next to the
   * persona switcher when no persona is active. Replaces the inline
   * theme dropdown that previously sat in the cameo header.
   *
   * Personas edit their own theme via the persona editor (`PersonaEditor`).
   * This handler covers ONLY the true-identity case — when a persona is
   * active, the ✎ button is hidden and the user opens the persona editor
   * to change that persona's theme.
   */
  static async #editTrueIdentityTheme() {
    const current = this.actor.system?.theme || 'clayton';
    const options = THEME_REGISTRY.map((t) => ({
      id: t.id,
      label: game.i18n.localize(t.label) || t.id,
    }));
    const optionsHtml = options
      .map(o => `<option value="${o.id}"${o.id === current ? ' selected' : ''}>${foundry.utils.escapeHTML(o.label)}</option>`)
      .join('');

    const DialogV2 = foundry.applications.api.DialogV2;
    const newTheme = await DialogV2.prompt({
      window: { title: 'Edit true identity theme' },
      position: { width: 360 },
      content: `
        <p style="margin: 0 0 10px 0; font-size: 12px; opacity: 0.75;">
          <em>Sets the visual theme used when no persona is active.</em>
        </p>
        <select name="theme"
                style="width: 100%; padding: 6px 10px; font-family: var(--gs-body, serif); font-size: 14px;">
          ${optionsHtml}
        </select>
      `,
      ok: {
        label: 'Save',
        callback: (event, button) => button.form.elements.theme.value,
      },
      rejectClose: false,
    });
    if (!newTheme || newTheme === current) return;
    await this.actor.update({ 'system.theme': newTheme });
  }

  static async #openActor(event, target) {
    const actor = game.actors?.get(target.dataset.actorId);
    actor?.sheet?.render(true);
  }

  /**
   * Click the cameo → Foundry FilePicker → write the picked image to the
   * RIGHT place based on what's currently active:
   *
   *   - True identity active → write to BOTH `actor.img` AND
   *     `prototypeToken.texture.src`. `actor.img` is the canonical
   *     baseline that switchPersona falls back to when going to true
   *     identity (and when an active persona has no `tokenImageUrl`),
   *     so updating it is what makes the upload "stick" across every
   *     subsequent persona swap.
   *
   *   - Persona active → write to that persona's `tokenImageUrl` AND
   *     to the live prototype token (so the cameo updates instantly
   *     and the persona keeps the upload across switches).
   *
   * Earlier behavior wrote ONLY to `prototypeToken.texture.src` regardless
   * of state — every persona switch would then overwrite the upload with
   * `actor.img` (which was still Foundry's default mystery-man because
   * the cameo never updated it). That's why uploads kept disappearing.
   *
   * The FilePicker opens at a writable folder by default so uploads "just
   * work" — Foundry locks `/`, `/systems`, and `/modules` against uploads.
   * The world folder is always writable, so we point there unless the
   * actor already has a non-default token image (then open at its folder).
   */
  static async #pickToken(event, target) {
    const FP = foundry.applications.apps.FilePicker?.implementation ?? globalThis.FilePicker;
    if (!FP) {
      ui.notifications?.error('FilePicker is unavailable in this Foundry build.');
      return;
    }
    const stored = this.actor.prototypeToken?.texture?.src;
    const isCustomImage = stored && !stored.startsWith('icons/');
    const current = isCustomImage
      ? stored
      : `worlds/${game.world?.id ?? ''}/`;

    const sys = this.actor.system;
    const explicitPersona = sys?.activePersonaId
      ? (sys.personas ?? []).find(p => p.id === sys.activePersonaId)
      : null;

    const picker = new FP({
      type: 'image',
      current,
      callback: async (path) => {
        if (explicitPersona) {
          // Persona active: write to that persona's tokenImageUrl + the
          // live token. Normalize the array to plain objects (per CLAUDE.md
          // §16 anti-pattern — heterogeneous arrays of DataModel + plain
          // mix can drop fields silently on update).
          const toPlain = (p) => (p && typeof p.toObject === 'function') ? p.toObject() : { ...p };
          const updated = (sys.personas ?? []).map(p => {
            if (p.id !== explicitPersona.id) return toPlain(p);
            const plain = toPlain(p);
            plain.tokenImageUrl = path;
            return plain;
          });
          await this.actor.update({
            'system.personas': updated,
            'prototypeToken.texture.src': path,
          });
        } else {
          // True identity: update actor.img (the baseline) AND the live
          // token, so the upload survives every future persona switch.
          await this.actor.update({
            'img': path,
            'prototypeToken.texture.src': path,
          });
        }
      },
    });
    return picker.render(true);
  }

  // Stub — link picker (drag-onto-section) is the primary UX; this is a fallback.
  static async #addConnection(event, target) {
    ui.notifications?.info('Drag a Connection actor onto this section to link it.');
  }

  static async #createItem(event, target) {
    const type = target.dataset.itemType;
    const systemDefaults = {};
    if (target.dataset.itemPolarity) systemDefaults.polarity = target.dataset.itemPolarity;
    const created = await this.actor.createEmbeddedDocuments('Item', [{ type, name: `New ${type}`, system: systemDefaults }]);
    const item = created[0];
    if (!item) return;

    // Reputation tags must be registered in positiveTags / negativeTags or they
    // won't appear in the reputation grid (the sheet only renders IDs in those arrays).
    if (type === 'reputation-tag') {
      const polarity = target.dataset.itemPolarity ?? 'positive';
      const field = polarity === 'negative' ? 'system.reputation.negativeTags' : 'system.reputation.positiveTags';
      const current = polarity === 'negative'
        ? (this.actor.system.reputation?.negativeTags ?? [])
        : (this.actor.system.reputation?.positiveTags ?? []);
      await this.actor.update({ [field]: [...current, item.id] });
    }

    item.sheet?.render(true);
  }

  static async #deleteItem(event, target) {
    const id = target.dataset.itemId;
    if (!id) return;
    const item = this.actor.items.get(id);
    if (!item) return;

    // Remove from positiveTags / negativeTags index before deleting the item.
    if (item.type === 'reputation-tag') {
      const rep = this.actor.system.reputation ?? {};
      await this.actor.update({
        'system.reputation.positiveTags': (rep.positiveTags ?? []).filter(i => i !== id),
        'system.reputation.negativeTags': (rep.negativeTags ?? []).filter(i => i !== id),
      });
    }

    await this.actor.deleteEmbeddedDocuments('Item', [id]);
  }

  static async #castSkill(event, target) {
    const item = this.actor.items.get(target.dataset.itemId);
    if (!item) return;
    await castMagicSkill(item, this.actor);
  }

  static #openPersonaSwitcher(event, target) {
    openPersonaSwitcherPopover(
      this.actor,
      target,
      () => openPersonaEditor(this.actor),
    );
  }

  static #openActionsCheatSheet() {
    openActionsCheatSheet();
  }

  // ── Post-MVP §4 dossier — spread navigation + theme switcher ───────────

  /**
   * Activate a different `data-spread` on the dossier book. Tracks state on
   * the instance so the choice persists across ApplicationV2 re-renders
   * (which would otherwise reset the active spread to the default in HTML).
   */
  static #showSpread(event, target) {
    const name = target?.dataset?.goto || target?.dataset?.spread;
    if (!name) return;
    this._currentSpread = name;
    this._applyCurrentSpread();
  }

  /** Single-step return to the character spread (post-MVP §4.4.2). */
  static #backToDossier() {
    this._currentSpread = 'character';
    this._applyCurrentSpread();
  }

  /**
   * Apply this._currentSpread by toggling .is-active on .dossier-spread nodes
   * and flipping `is-on-alt-spread` on the sheet root. CSS hides the default
   * tab-public / tab-private / strip when the latter class is present.
   *
   * Foundry v13's ApplicationV2 puts `classes` on the outer `.application`
   * wrapper but `window.contentClasses` on the inner `.window-content`.
   * Our `gs-major-sheet` class lives on `.window-content`. The CSS uses
   * `.gs-major-sheet.is-on-alt-spread` (compound selector requiring both on
   * the SAME element), so we toggle `is-on-alt-spread` on BOTH the outer
   * wrapper AND the window-content element. Without this, the chip-click
   * → page-flip flow silently no-ops because the compound selector never
   * matches.
   */
  _applyCurrentSpread() {
    if (!this.element) return;
    const onAlt = this._currentSpread !== 'character';
    this.element.classList.toggle('is-on-alt-spread', onAlt);
    const wc = this.element.querySelector('.window-content');
    if (wc) wc.classList.toggle('is-on-alt-spread', onAlt);

    const all = this.element.querySelectorAll('.dossier-spread');
    let matched = false;
    all.forEach((el) => {
      const match = onAlt && el.dataset.spread === this._currentSpread;
      el.classList.toggle('is-active', match);
      if (match) matched = true;
    });
    // Fall back to character if the requested spread doesn't exist (e.g.,
    // user was viewing a connection that was just deleted).
    if (!matched && onAlt) {
      this._currentSpread = 'character';
      this._applyCurrentSpread();
    }
  }

  /**
   * Inline theme switcher — writes actor.system.theme so the entire sheet's
   * `data-theme` cascade re-resolves to the new palette.
   *
   * Defense: also flips the hidden `input[data-theme-pin]` value before the
   * actor.update fires, so any concurrent form-submit (e.g. a name input
   * blurring at the moment of the swatch click) carries the new theme value
   * rather than the stale one.
   */
  static async #setTheme(event, target) {
    const themeId = target?.dataset?.themeId;
    if (!themeId) return;
    const pin = this.element?.querySelector('input[data-theme-pin]');
    if (pin) pin.value = themeId;
    await this.actor.update({ 'system.theme': themeId });
  }
}
