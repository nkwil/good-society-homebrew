/**
 * Good Society (Homebrew) — system entry point.
 * Registers all Good Society document types (DataModels + sheets).
 */

import { register as registerSpeakingAs } from './hooks/speaking-as.js';
import { register as registerSceneControls } from './hooks/scene-controls.js';
import { register as registerCanvasContext } from './hooks/canvas-context.js';
import { register as registerTokenHoverCard } from './hooks/token-hover-card.js';
import { register as registerUpkeep, onUpkeepPhaseStart } from './hooks/upkeep.js';
import { register as registerReputationPhase, onReputationPhaseStart } from './hooks/reputation-phase.js';
import { register as registerSessionEvents } from './hooks/session-events.js';
import { register as registerRumourPhase, onRumourPhaseStart } from './hooks/rumour-phase.js';
import { register as registerRumourSocket } from './hooks/rumour-socket.js';
import { register as registerRandomEventSocket } from './hooks/random-event-socket.js';
import { register as registerChatPortraits } from './hooks/chat-portraits.js';
import { register as registerLetterSocket } from './hooks/letter-socket.js';
import { register as registerTokenDefaults } from './hooks/token-defaults.js';
import { migrateJournalEntryTypes } from './hooks/journal-migrate.js';
import { register as registerArrivalSync } from './hooks/arrival-sync.js';
import { register as registerPauseOverlay } from './hooks/pause-overlay.js';
import { register as registerChromeIcons } from './hooks/chrome-icons.js';
import { register as registerSidebarFilter, applySidebarFilter } from './hooks/sidebar-filter.js';
import { register as registerLetterSeals } from './hooks/letter-seals.js';
import { register as registerEpistolaryPhase } from './hooks/epistolary-phase.js';
import { runPhaseSplash } from './hooks/phase-splash.js';
import { registerMonologueSocket } from './apps/monologue-overlay.js';
import { registerNovelReaderHooks, openNovelReader } from './apps/novel-reader.js';
import { syncArrivalToCanvas } from './apps/arrival.js';
import { renderCabinet } from './apps/cabinet.js';
import { openNovelPhasePopup } from './apps/novel-phase-popup.js';
import { refreshEventCommandCenter } from './apps/event-command-center.js';
import { openPregameChecklist, maybeAutoOpenPregameChecklist } from './apps/pregame-checklist.js';
import { checkThresholdAndPrompt } from './helpers/reputation-rules.js';
import { renderDock } from './apps/my-characters-dock.js';
import { getDashboard } from './apps/public-info-dashboard.js';
import { initCycleHud, renderCycleHud } from './apps/cycle-hud.js';
import { renderOrganizer } from './apps/npc-organizer.js';
import { initTooltipSystem } from './helpers/rule-tooltip.js';
import { deriveInitialPosition } from './helpers/dashboard-context.js';
import { ReputationTagDataModel } from './data-models/reputation-tag.js';
import { RandomEventDataModel } from './data-models/random-event.js';
import { ReputationConditionDataModel } from './data-models/reputation-condition.js';
import { InnerConflictDataModel } from './data-models/inner-conflict.js';
import { MagicSkillDataModel } from './data-models/magic-skill.js';
import { BackstoryActionDataModel } from './data-models/backstory-action.js';
import { FamilyDataModel } from './data-models/family.js';
import { NpcDataModel } from './data-models/npc.js';
import { ConnectionDataModel } from './data-models/connection.js';
import { MajorCharacterDataModel } from './data-models/major-character.js';
import { ScenePortalBehaviorType } from './data-models/scene-portal-behavior.js';
import { MajorCharacterSheet } from './sheets/major-character-sheet.js';
import { ConnectionSheet } from './sheets/connection-sheet.js';
import { FamilySheet } from './sheets/family-sheet.js';
import { NpcSheet } from './sheets/npc-sheet.js';
import { ReputationTagSheet } from './sheets/reputation-tag-sheet.js';
import { RandomEventSheet } from './sheets/random-event-sheet.js';
import { ReputationConditionSheet } from './sheets/reputation-condition-sheet.js';
import { InnerConflictSheet } from './sheets/inner-conflict-sheet.js';
import { MagicSkillSheet } from './sheets/magic-skill-sheet.js';
import { BackstoryActionSheet } from './sheets/backstory-action-sheet.js';

/** Handlebars component partials — loaded once and registered for {{> partialName}} use. */
const GS_COMPONENT_PARTIALS = {
  'inner-conflict-grid':
    'systems/good-society-homebrew/templates/components/inner-conflict-grid.hbs',
  'dock-major-row':
    'systems/good-society-homebrew/templates/components/dock-major-row.hbs',
  'dock-connection-row':
    'systems/good-society-homebrew/templates/components/dock-connection-row.hbs',
  'dashboard-major-row':
    'systems/good-society-homebrew/templates/components/dashboard-major-row.hbs',
  'evt-row':
    'systems/good-society-homebrew/templates/components/evt-row.hbs',
  // Post-MVP §8.4 unified persona-switcher pill (template; popover behavior is
  // wired via the existing persona-switcher-popover.js delegated handler).
  'persona-switcher':
    'systems/good-society-homebrew/templates/partials/persona-switcher.hbs',
};

Hooks.once('init', async function () {
  // ── Settings ─────────────────────────────────────────────────────────────
  game.settings.register('good-society-homebrew', 'activeSpeakerActorId', {
    scope: 'client',
    config: false,
    type: String,
    default: '',
  });

  game.settings.register('good-society-homebrew', 'activeSpeakerPersonaId', {
    scope: 'client',
    config: false,
    type: String,
    default: '',
  });

  game.settings.register('good-society-homebrew', 'dockVisible', {
    scope: 'client',
    config: false,
    type: Boolean,
    default: true,
    onChange: () => renderDock(),
  });

  game.settings.register('good-society-homebrew', 'dockPosition', {
    scope: 'client',
    config: false,
    type: Object,
    default: null,
  });

  game.settings.register('good-society-homebrew', 'dockMinimized', {
    scope: 'client',
    config: false,
    type: Boolean,
    default: false,
  });

  // Per-user draft auto-saved by LetterComposer every 10s; restored on re-open.
  game.settings.register('good-society-homebrew', 'letterDraft', {
    scope: 'client',
    config: false,
    type: Object,
    default: null,
  });

  game.settings.register('good-society-homebrew', 'organizerMinimized', {
    scope: 'client',
    config: false,
    type: Boolean,
    default: false,
  });

  game.settings.register('good-society-homebrew', 'tooltipsEnabled', {
    name: 'GOODSOCIETY.settings.tooltipsEnabled.name',
    hint: 'GOODSOCIETY.settings.tooltipsEnabled.hint',
    scope: 'client',
    config: true,
    type: Boolean,
    default: true,
    onChange: (value) => {
      document.body.classList.toggle('gs-tooltips-disabled', !value);
    },
  });

  game.settings.register('good-society-homebrew', 'upkeepWizardEnabled', {
    name: 'GOODSOCIETY.settings.upkeepWizardEnabled.name',
    hint: 'GOODSOCIETY.settings.upkeepWizardEnabled.hint',
    scope: 'client',
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register('good-society-homebrew', 'reputationPhaseWizardEnabled', {
    name: 'GOODSOCIETY.settings.reputationPhaseWizardEnabled.name',
    hint: 'GOODSOCIETY.settings.reputationPhaseWizardEnabled.hint',
    scope: 'client',
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register('good-society-homebrew', 'applyFoundryChrome', {
    name: 'GOODSOCIETY.settings.applyFoundryChrome.name',
    hint: 'GOODSOCIETY.settings.applyFoundryChrome.hint',
    scope: 'client',
    config: true,
    type: Boolean,
    default: true,
    onChange: (value) => {
      document.body.classList.toggle('gs-chrome-themed', value);
    },
  });

  // ── World settings ───────────────────────────────────────────────────────
  game.settings.register('good-society-homebrew', 'cyclePhase', {
    scope: 'world',
    config: false,
    type: String,
    default: 'pre-cycle',
    onChange: (value) => {
      Hooks.callAll('goodSociety.cyclePhaseChanged', { newPhase: value });
      renderCycleHud();
      // Phase-cycling "oomph" — page-turn sound, close the active scene,
      // and show the phase splash on the Arrival. Runs on every client.
      try { runPhaseSplash(value); } catch (err) { console.warn('GS | phase splash failed:', err); }
      if (value === 'upkeep') onUpkeepPhaseStart();
      if (value === 'reputation') onReputationPhaseStart();
      if (value === 'rumour-scandal') onRumourPhaseStart();
      // Novel-chapter informational popup. Fires on every entry into the
      // novel phase (first AND second chapter share the 'novel' phase
      // identifier; the popup itself distinguishes via cyclePosition). The
      // per-Major "completed flag" clear on advance (cycle-advance.js)
      // doesn't apply here — this popup is a transient reminder, not a
      // per-actor wizard, so it always fires.
      if (value === 'novel') {
        try { openNovelPhasePopup(); } catch (err) { console.warn('GS | novel popup failed:', err); }
      }
    },
  });

  // cyclePosition (1-8 within a cycle, 0 = pre-cycle, 9 = ended). Drives the
  // 8-position cycle structure per rulebook p.112. cyclePhase is kept in sync
  // by the centralized advance helper (module/helpers/cycle-advance.js).
  // See docs/design/08-cycle-phase-hud.md and the running log for rationale.
  game.settings.register('good-society-homebrew', 'cyclePosition', {
    scope: 'world',
    config: false,
    type: Number,
    default: 0,
    onChange: () => renderCycleHud(),
  });

  // isFinalCycle — GM-toggleable. When true, advance logic skips positions
  // 3 (Rumour & Scandal) and 6 (2nd Reputation), then ends the game after
  // position 7 (the epilogue epistolary). Per rulebook p.114-115.
  game.settings.register('good-society-homebrew', 'isFinalCycle', {
    name: 'GOODSOCIETY.settings.isFinalCycle.name',
    hint: 'GOODSOCIETY.settings.isFinalCycle.hint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
    onChange: () => renderCycleHud(),
  });

  game.settings.register('good-society-homebrew', 'sessionEvents', {
    scope: 'world',
    config: false,
    type: Object,
    default: [],
  });

  // Rumour & Scandal phase storage — per docs/design/32-rumour-wizard.md.
  // Two world-scoped settings; player-driven turn handoff goes through the
  // system socket (system.json socket: true) since players can't write world
  // settings. Setting onChange triggers re-renders of any open wizard/board.
  game.settings.register('good-society-homebrew', 'rumours', {
    scope: 'world',
    config: false,
    type: Object,
    default: [],
    onChange: () => {
      import('./apps/rumour-wizard.js').then(m => m.refreshRumourWizard?.()).catch(() => {});
      import('./apps/rumour-board.js').then(m => m.refreshRumourBoard?.()).catch(() => {});
    },
  });

  game.settings.register('good-society-homebrew', 'rumourPhaseState', {
    scope: 'world',
    config: false,
    type: Object,
    default: { phase: 'idle', round: 0, turnOrder: [], currentIdx: 0, startedAtCycle: 0 },
    onChange: () => {
      import('./apps/rumour-wizard.js').then(m => m.refreshRumourWizard?.()).catch(() => {});
    },
  });

  // Event Timeline (in-fiction calendar) — per docs/design/31-event-timeline.md.
  // Stage-based bucketing model (rev. 2026-05-08): GM manually moves events
  // through coming-soon → today → past. No date-based auto-bucketing — Good
  // Society play uses loose in-fiction time. The legacy `currentInGameDate`
  // setting is no longer registered; if a world has it, it's harmless.
  game.settings.register('good-society-homebrew', 'calendarEvents', {
    scope: 'world',
    config: false,
    type: Object,
    default: [],
    onChange: () => {
      import('./apps/event-timeline.js').then(m => m.refreshEventTimeline()).catch(() => {});
    },
  });

  game.settings.register('good-society-homebrew', 'cycleNumber', {
    scope: 'world',
    config: false,
    type: Number,
    default: 1,
    onChange: () => renderCycleHud(),
  });

  game.settings.register('good-society-homebrew', 'autoRefreshOnUpkeep', {
    name: 'GOODSOCIETY.settings.autoRefreshOnUpkeep.name',
    hint: 'GOODSOCIETY.settings.autoRefreshOnUpkeep.hint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register('good-society-homebrew', 'promptOnThreeTags', {
    name: 'GOODSOCIETY.settings.promptOnThreeTags.name',
    hint: 'GOODSOCIETY.settings.promptOnThreeTags.hint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register('good-society-homebrew', 'defaultMaxResolve', {
    name: 'GOODSOCIETY.settings.defaultMaxResolve.name',
    hint: 'GOODSOCIETY.settings.defaultMaxResolve.hint',
    scope: 'world',
    config: true,
    type: Number,
    default: 5,
  });

  game.settings.register('good-society-homebrew', 'defaultStartingResolve', {
    name: 'GOODSOCIETY.settings.defaultStartingResolve.name',
    hint: 'GOODSOCIETY.settings.defaultStartingResolve.hint',
    scope: 'world',
    config: true,
    type: Number,
    default: 3,
  });

  game.settings.register('good-society-homebrew', 'homebrewMagicEnabled', {
    name: 'GOODSOCIETY.settings.homebrewMagicEnabled.name',
    hint: 'GOODSOCIETY.settings.homebrewMagicEnabled.hint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register('good-society-homebrew', 'organizerPlayerVisible', {
    name: 'GOODSOCIETY.settings.organizerPlayerVisible.name',
    hint: 'GOODSOCIETY.settings.organizerPlayerVisible.hint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
  });

  game.settings.register('good-society-homebrew', 'organizerPosition', {
    scope: 'client',
    config: false,
    type: Object,
    default: null,
  });

  // Post-MVP §10.2 token hover card v2 — two settings:
  //   hoverCardEnabled (client) — disables system hover card; falls back to
  //     Foundry's default token tooltip.
  //   hoverCardMajorAutoSummary (world) — when off, Major hover card renders
  //     header only (no auto-derived rep snapshot).
  game.settings.register('good-society-homebrew', 'hoverCardEnabled', {
    name: 'GOODSOCIETY.settings.hoverCardEnabled.name',
    hint: 'GOODSOCIETY.settings.hoverCardEnabled.hint',
    scope: 'client',
    config: true,
    type: Boolean,
    default: true,
  });
  game.settings.register('good-society-homebrew', 'hoverCardMajorAutoSummary', {
    name: 'GOODSOCIETY.settings.hoverCardMajorAutoSummary.name',
    hint: 'GOODSOCIETY.settings.hoverCardMajorAutoSummary.hint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
  });

  // Post-MVP §2 world identity surfaces — six settings.
  game.settings.register('good-society-homebrew', 'applyWorldIdentity', {
    name: 'GOODSOCIETY.settings.applyWorldIdentity.name',
    hint: 'GOODSOCIETY.settings.applyWorldIdentity.hint',
    scope: 'client',
    config: true,
    type: Boolean,
    default: true,
    onChange: (value) => {
      document.body.classList.toggle('gs-world-identity', !!value);
      // Re-sync the Arrival on toggle — it may need to render or close.
      try { syncArrivalToCanvas(); } catch {}
    },
  });

  game.settings.register('good-society-homebrew', 'arrivalEnabled', {
    name: 'GOODSOCIETY.settings.arrivalEnabled.name',
    hint: 'GOODSOCIETY.settings.arrivalEnabled.hint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
    onChange: () => { try { syncArrivalToCanvas(); } catch {} },
  });

  game.settings.register('good-society-homebrew', 'arrivalTitle', {
    name: 'GOODSOCIETY.settings.arrivalTitle.name',
    hint: 'GOODSOCIETY.settings.arrivalTitle.hint',
    scope: 'world',
    config: true,
    type: String,
    default: 'Welcome to Good Society',
    onChange: () => { try { syncArrivalToCanvas(); } catch {} },
  });

  game.settings.register('good-society-homebrew', 'arrivalBackgroundUrl', {
    name: 'GOODSOCIETY.settings.arrivalBackgroundUrl.name',
    hint: 'GOODSOCIETY.settings.arrivalBackgroundUrl.hint',
    scope: 'world',
    config: true,
    type: String,
    default: '',
    // 'imagevideo' lets the FilePicker show both still images and video
    // files. Video URLs render as a <video autoplay loop muted> element;
    // image URLs render as a CSS background-image. See `module/apps/arrival.js`
    // for the dispatch.
    filePicker: 'imagevideo',
    onChange: () => { try { syncArrivalToCanvas(); } catch {} },
  });

  // Playback rate for the Arrival video. 1.0 = real-time; 0.5 = half-speed
  // (gentler ambience); 0.25 = very slow. Range clamped to [0.1, 2.0]
  // by the rendering code defensively. World-scoped because the Arrival
  // is the shared empty-canvas state — every player should see the same.
  game.settings.register('good-society-homebrew', 'arrivalVideoPlaybackRate', {
    name: 'GOODSOCIETY.settings.arrivalVideoPlaybackRate.name',
    hint: 'GOODSOCIETY.settings.arrivalVideoPlaybackRate.hint',
    scope: 'world',
    config: true,
    type: Number,
    default: 0.5,
    range: { min: 0.1, max: 2.0, step: 0.05 },
    onChange: () => { try { syncArrivalToCanvas(); } catch {} },
  });

  // Whether to show the centred "Welcome" title on the Arrival. Off when
  // the GM wants the video to be the focus rather than overlaid copy.
  game.settings.register('good-society-homebrew', 'arrivalShowTitle', {
    name: 'GOODSOCIETY.settings.arrivalShowTitle.name',
    hint: 'GOODSOCIETY.settings.arrivalShowTitle.hint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
    onChange: () => { try { syncArrivalToCanvas(); } catch {} },
  });

  game.settings.register('good-society-homebrew', 'arrivalCornerOrnamentUrl', {
    name: 'GOODSOCIETY.settings.arrivalCornerOrnamentUrl.name',
    hint: 'GOODSOCIETY.settings.arrivalCornerOrnamentUrl.hint',
    scope: 'world',
    config: true,
    type: String,
    default: '',
    filePicker: 'image',
    onChange: () => { try { syncArrivalToCanvas(); } catch {} },
  });

  game.settings.register('good-society-homebrew', 'pauseCameoImageUrl', {
    name: 'GOODSOCIETY.settings.pauseCameoImageUrl.name',
    hint: 'GOODSOCIETY.settings.pauseCameoImageUrl.hint',
    scope: 'world',
    config: true,
    type: String,
    default: '',
    filePicker: 'image',
  });

  // Phase-cycling "oomph" — on a cycle phase change, play a page-turn sound,
  // close the active scene, and show a phase-specific splash on the Arrival.
  game.settings.register('good-society-homebrew', 'phaseSplashEnabled', {
    name: 'GOODSOCIETY.settings.phaseSplashEnabled.name',
    hint: 'GOODSOCIETY.settings.phaseSplashEnabled.hint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
  });

  // Post-MVP §12 token spend events — three settings.
  game.settings.register('good-society-homebrew', 'monologueOverlayEnabled', {
    name: 'GOODSOCIETY.settings.monologueOverlayEnabled.name',
    hint: 'GOODSOCIETY.settings.monologueOverlayEnabled.hint',
    scope: 'client',
    config: true,
    type: Boolean,
    default: true,
  });
  game.settings.register('good-society-homebrew', 'archiveMonologuesToJournal', {
    name: 'GOODSOCIETY.settings.archiveMonologuesToJournal.name',
    hint: 'GOODSOCIETY.settings.archiveMonologuesToJournal.hint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
  });
  game.settings.register('good-society-homebrew', 'resolveHandoffAnimationEnabled', {
    name: 'GOODSOCIETY.settings.resolveHandoffAnimationEnabled.name',
    hint: 'GOODSOCIETY.settings.resolveHandoffAnimationEnabled.hint',
    scope: 'client',
    config: true,
    type: Boolean,
    default: true,
  });

  // Post-MVP §13.5 journal elevation — three settings.
  game.settings.register('good-society-homebrew', 'novelTitle', {
    name: 'GOODSOCIETY.settings.novelTitle.name',
    hint: 'GOODSOCIETY.settings.novelTitle.hint',
    scope: 'world',
    config: true,
    type: String,
    default: '',
  });
  game.settings.register('good-society-homebrew', 'novelReaderEnabled', {
    name: 'GOODSOCIETY.settings.novelReaderEnabled.name',
    hint: 'GOODSOCIETY.settings.novelReaderEnabled.hint',
    scope: 'client',
    config: true,
    type: Boolean,
    default: true,
  });
  game.settings.register('good-society-homebrew', 'autoCreateCycleDividers', {
    name: 'GOODSOCIETY.settings.autoCreateCycleDividers.name',
    hint: 'GOODSOCIETY.settings.autoCreateCycleDividers.hint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
  });

  // Post-MVP §9 Cabinet — toggle the entire feature on/off.
  game.settings.register('good-society-homebrew', 'cabinetEnabled', {
    name: 'GOODSOCIETY.settings.cabinetEnabled.name',
    hint: 'GOODSOCIETY.settings.cabinetEnabled.hint',
    scope: 'client',
    config: true,
    type: Boolean,
    default: true,
    onChange: () => { try { renderCabinet(); } catch {} },
  });

  // Post-MVP §14 chrome icons. Stacks on top of `applyFoundryChrome`.
  game.settings.register('good-society-homebrew', 'applyChromeIcons', {
    name: 'GOODSOCIETY.settings.applyChromeIcons.name',
    hint: 'GOODSOCIETY.settings.applyChromeIcons.hint',
    scope: 'client',
    config: true,
    type: Boolean,
    default: true,
    onChange: (value) => {
      document.body.classList.toggle('gs-chrome-icons-on', !!value);
    },
  });

  // Sidebar tab filter — narrows the Foundry sidebar to the player allowlist
  // (chat / actors / items / macros / playlists). GM users always see the
  // full sidebar regardless of this setting. The Novel Reader (post-MVP
  // §13.3) provides player-facing access to letters / monologues / session
  // logs / cycle reflections; the Foundry journal directory is hidden for
  // players because the Reader supersedes it.
  game.settings.register('good-society-homebrew', 'playerSidebarFilter', {
    name: 'GOODSOCIETY.settings.playerSidebarFilter.name',
    hint: 'GOODSOCIETY.settings.playerSidebarFilter.hint',
    scope: 'client',
    config: true,
    type: Boolean,
    default: true,
    onChange: () => applySidebarFilter(),
  });

  // Load and register Handlebars partials for shared components.
  // Use the v13 namespaced helper — bare global is deprecated in v13 and
  // removed in v15 (CLAUDE.md §16).
  const loaded = await foundry.applications.handlebars.loadTemplates(GS_COMPONENT_PARTIALS);
  for (const [name, fn] of Object.entries(loaded)) {
    Handlebars.registerPartial(name, fn);
  }

  // Comparison helpers not guaranteed by Foundry's default set.
  Handlebars.registerHelper('gte', (a, b) => a >= b);
  Handlebars.registerHelper('gt',  (a, b) => a >  b);
  Handlebars.registerHelper('lte', (a, b) => a <= b);
  Handlebars.registerHelper('lt',  (a, b) => a <  b);

  // String / numeric helpers used by post-MVP §4 dossier templates and others.
  Handlebars.registerHelper('firstLetter', (str) => (str ?? '').toString().charAt(0));
  Handlebars.registerHelper('slice', (str, start, end) => {
    // Handlebars implicitly passes an `options` object as the LAST positional
    // argument when no `end` is provided in the template; type-check so
    // {{slice displayName 1}} actually works (was returning just the first
    // letter via substring(1, NaN) → swapped to substring(0, 1) — see
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/substring).
    const s = (str ?? '').toString();
    const startN = Number(start) || 0;
    const endN = typeof end === 'number' ? end : undefined;
    return endN != null ? s.substring(startN, endN) : s.substring(startN);
  });
  Handlebars.registerHelper('add', (a, b) => Number(a ?? 0) + Number(b ?? 0));
  Handlebars.registerHelper('sub', (a, b) => Number(a ?? 0) - Number(b ?? 0));
  // {{#repeat n}} … {{/repeat}} — render block N times. Index available as @index.
  Handlebars.registerHelper('repeat', function(n, options) {
    let out = '';
    const count = Math.max(0, Number(n ?? 0));
    for (let i = 0; i < count; i++) {
      out += options.fn({ index: i });
    }
    return out;
  });
  // ── Item DataModels ──────────────────────────────────────────────────────
  Object.assign(CONFIG.Item.dataModels, {
    'reputation-tag': ReputationTagDataModel,
    'reputation-condition': ReputationConditionDataModel,
    'inner-conflict': InnerConflictDataModel,
    'magic-skill': MagicSkillDataModel,
    'backstory-action': BackstoryActionDataModel,
    'random-event': RandomEventDataModel,
  });

  // ── Actor DataModels ─────────────────────────────────────────────────────
  Object.assign(CONFIG.Actor.dataModels, {
    'family': FamilyDataModel,
    'npc': NpcDataModel,
    'connection': ConnectionDataModel,
    'major-character': MajorCharacterDataModel,
  });

  // ── Region Behaviors ─────────────────────────────────────────────────────
  // "Travel to Scene" portal — see module/data-models/scene-portal-behavior.js.
  Object.assign(CONFIG.RegionBehavior.dataModels, {
    'scenePortal': ScenePortalBehaviorType,
  });
  CONFIG.RegionBehavior.typeIcons ??= {};
  CONFIG.RegionBehavior.typeIcons['scenePortal'] = 'fa-solid fa-door-open';

  // ── Actor sheets ─────────────────────────────────────────────────────────
  foundry.documents.collections.Actors.registerSheet('good-society-homebrew', MajorCharacterSheet, {
    types: ['major-character'],
    makeDefault: true,
    label: 'GOODSOCIETY.sheets.majorCharacter',
  });

  foundry.documents.collections.Actors.registerSheet('good-society-homebrew', ConnectionSheet, {
    types: ['connection'],
    makeDefault: true,
    label: 'GOODSOCIETY.sheets.connection',
  });

  foundry.documents.collections.Actors.registerSheet('good-society-homebrew', FamilySheet, {
    types: ['family'],
    makeDefault: true,
    label: 'GOODSOCIETY.sheets.family',
  });

  foundry.documents.collections.Actors.registerSheet('good-society-homebrew', NpcSheet, {
    types: ['npc'],
    makeDefault: true,
    label: 'GOODSOCIETY.sheets.npc',
  });

  // ── Item sheets ──────────────────────────────────────────────────────────
  foundry.documents.collections.Items.registerSheet('good-society-homebrew', ReputationTagSheet, {
    types: ['reputation-tag'],
    makeDefault: true,
    label: 'GOODSOCIETY.sheets.reputationTag',
  });

  foundry.documents.collections.Items.registerSheet('good-society-homebrew', ReputationConditionSheet, {
    types: ['reputation-condition'],
    makeDefault: true,
    label: 'GOODSOCIETY.sheets.reputationCondition',
  });

  foundry.documents.collections.Items.registerSheet('good-society-homebrew', InnerConflictSheet, {
    types: ['inner-conflict'],
    makeDefault: true,
    label: 'GOODSOCIETY.sheets.innerConflict',
  });

  foundry.documents.collections.Items.registerSheet('good-society-homebrew', MagicSkillSheet, {
    types: ['magic-skill'],
    makeDefault: true,
    label: 'GOODSOCIETY.sheets.magicSkill',
  });

  foundry.documents.collections.Items.registerSheet('good-society-homebrew', BackstoryActionSheet, {
    types: ['backstory-action'],
    makeDefault: true,
    label: 'GOODSOCIETY.sheets.backstoryAction',
  });

  foundry.documents.collections.Items.registerSheet('good-society-homebrew', RandomEventSheet, {
    types: ['random-event'],
    makeDefault: true,
    label: 'GOODSOCIETY.sheets.randomEvent',
  });
});

Hooks.once('ready', async () => {
  const chromeEnabled = game.settings.get('good-society-homebrew', 'applyFoundryChrome');
  document.body.classList.toggle('gs-chrome-themed', chromeEnabled);

  const tooltipsEnabled = game.settings.get('good-society-homebrew', 'tooltipsEnabled');
  document.body.classList.toggle('gs-tooltips-disabled', !tooltipsEnabled);

  // Post-MVP §2.4 world identity body class.
  let worldIdentityEnabled = true;
  try { worldIdentityEnabled = game.settings.get('good-society-homebrew', 'applyWorldIdentity'); } catch {}
  document.body.classList.toggle('gs-world-identity', !!worldIdentityEnabled);

  // Post-MVP §14 chrome icons body class. Stacks on top of gs-chrome-themed.
  let chromeIconsEnabled = true;
  try { chromeIconsEnabled = game.settings.get('good-society-homebrew', 'applyChromeIcons'); } catch {}
  document.body.classList.toggle('gs-chrome-icons-on', !!chromeIconsEnabled);

  // One-time migration: derive cyclePosition from cyclePhase for worlds that
  // pre-date the cyclePosition setting (added with the 8-position cycle work).
  // Idempotent: a world already on cyclePosition >= 1 is left alone. GM-only
  // because the setting is world-scoped.
  if (game.user?.isGM) {
    try {
      const pos   = game.settings.get('good-society-homebrew', 'cyclePosition');
      const phase = game.settings.get('good-society-homebrew', 'cyclePhase');
      if ((pos === 0 || pos == null) && phase && phase !== 'pre-cycle') {
        await game.settings.set('good-society-homebrew', 'cyclePosition', deriveInitialPosition(phase));
      }
    } catch (err) { console.warn('GS | cyclePosition migration failed:', err); }
  }

  // One-time migration: theme === 'mags' → 'secret' on all Majors.
  // Per post-MVP §6.5 (Mags renamed to Secret). Idempotent — actors already
  // on 'secret' (or never on 'mags') are skipped. GM-only single-writer.
  if (game.user?.isGM) {
    try {
      const stale = game.actors.filter(a =>
        a.type === 'major-character' && a._source?.system?.theme === 'mags'
      );
      if (stale.length) {
        await Actor.updateDocuments(
          stale.map(a => ({ _id: a.id, 'system.theme': 'secret' })),
        );
        console.log(`GS | Migrated ${stale.length} actor(s): theme 'mags' → 'secret'.`);
      }
    } catch (err) { console.warn('GS | mags→secret theme migration failed:', err); }
  }

  // One-time migration: peerage / origin rename (heir|new-arrival|foreign → gentry)
  // AND archetype seeding for Majors. Major.bio.peerage and Family.origin both
  // adopted a new five-tier social-standing enum (royalty / nobility / gentry /
  // commoner / impoverished); the legacy three values map to 'gentry'. While
  // migrating each Major we also seed bio.archetype from the legacy peerage:
  // heir → 'heir', new-arrival → 'new-arrival', foreign → 'new-arrival'.
  // Idempotent; GM-only single-writer. The DataModel migrateData also handles
  // both rewrites on read, so player clients render correctly before this
  // disk migration runs.
  if (game.user?.isGM) {
    try {
      const LEGACY = new Set(['heir', 'new-arrival', 'foreign']);
      const archetypeForLegacy = (v) => v === 'heir' ? 'heir' : 'new-arrival';
      const staleMajors = game.actors.filter(a =>
        a.type === 'major-character' && LEGACY.has(a._source?.system?.bio?.peerage)
      );
      const staleFamilies = game.actors.filter(a =>
        a.type === 'family' && LEGACY.has(a._source?.system?.origin)
      );
      const updates = [
        ...staleMajors.map(a => {
          const oldPeerage = a._source.system.bio.peerage;
          const update = { _id: a.id, 'system.bio.peerage': 'gentry' };
          // Only seed archetype if the field is missing/empty on disk; never clobber.
          if (!a._source?.system?.bio?.archetype) {
            update['system.bio.archetype'] = archetypeForLegacy(oldPeerage);
          }
          return update;
        }),
        ...staleFamilies.map(a => ({ _id: a.id, 'system.origin': 'gentry' })),
      ];
      if (updates.length) {
        await Actor.updateDocuments(updates);
        console.log(`GS | Migrated ${staleMajors.length} Major(s) + ${staleFamilies.length} Family(ies): legacy peerage/origin → 'gentry' (Major archetype seeded from old peerage).`);
      }
    } catch (err) { console.warn('GS | peerage/origin rename migration failed:', err); }
  }

  // One-time backfill: tag pre-patch journal entries with `entryType` flag.
  // Per post-MVP §13.1. Conservative pattern matching; idempotent; GM-only.
  await migrateJournalEntryTypes();

  // Initial Arrival sync — runs once after canvas first becomes available.
  // syncArrivalToCanvas itself reads `applyWorldIdentity` and `arrivalEnabled`
  // settings; the canvasReady hook also fires for subsequent state changes.
  try { syncArrivalToCanvas(); } catch {}

  // Open the My Characters Dock if the user owns any actors.
  renderDock();

  // Render the Cabinet (player module menu) — applies stored visibility flags
  // on first render so previously-hidden surfaces stay hidden.
  try { await renderCabinet(); } catch (err) { console.warn('GS | cabinet render failed:', err); }

  // Inject the Cycle Phase HUD strip above the scene navigation.
  initCycleHud();

  // Wire hover-tooltip system for all [data-tooltip-key] elements.
  initTooltipSystem();

  // Pre-game checklist — auto-pops on first login per user. Players who
  // dismissed it once never see it auto-open again, but can reopen from
  // the Cabinet anytime. Deferred to next tick so other ready-time UI
  // (dock, cabinet, sidebar) settles first; otherwise the modal can land
  // above a still-rendering canvas and feel disjointed.
  try { setTimeout(() => maybeAutoOpenPregameChecklist(), 500); }
  catch (err) { console.warn('GS | pregame auto-open failed:', err); }
});

// Reputation threshold check + dashboard refresh when a tag/condition changes on a Major.
Hooks.on('createItem', (item) => {
  // World-level random-event Items aren't actor-embedded — keep the Event
  // Command Center's pool counts live as the GM authors events.
  if (item.type === 'random-event' && !item.parent) {
    refreshEventCommandCenter();
    return;
  }
  if (item.parent?.type !== 'major-character') return;
  if (item.type === 'reputation-tag') {
    checkThresholdAndPrompt(item.parent, item.system?.polarity ?? 'positive');
  }
  getDashboard()?.rendered && getDashboard().refreshAndReset();
});
Hooks.on('updateItem', (item) => {
  if (item.type === 'random-event' && !item.parent) refreshEventCommandCenter();
});
Hooks.on('deleteItem', (item) => {
  if (item.type === 'random-event' && !item.parent) {
    refreshEventCommandCenter();
    return;
  }
  if (item.parent?.type !== 'major-character') return;
  // Removing a tag may drop the polarity below 3 — reconcile so the
  // pickerResolved flag self-heals and a future climb re-prompts.
  if (item.type === 'reputation-tag') {
    checkThresholdAndPrompt(item.parent, item.system?.polarity ?? 'positive');
  }
  getDashboard()?.rendered && getDashboard().refreshAndReset();
});

// Re-render the dock and dashboard whenever actor data changes.
Hooks.on('updateActor', () => {
  renderDock();
  getDashboard()?.rendered && getDashboard().refreshAndReset();
});
Hooks.on('createActor', () => {
  renderDock();
  getDashboard()?.rendered && getDashboard().refreshAndReset();
});
Hooks.on('deleteActor', () => {
  renderDock();
  getDashboard()?.rendered && getDashboard().refreshAndReset();
});
// Mirror speaker-changed events from the chat-input switcher.
Hooks.on('goodSociety.activeSpeakerChanged', () => renderDock());

// Re-render the organizer on relevant world events. It lists every character
// actor (not just scene tokens), plus a per-row "on scene" indicator, so it
// needs to refresh on both actor-list AND scene-token changes.
Hooks.on('createActor', () => renderOrganizer());
Hooks.on('deleteActor', () => renderOrganizer());
Hooks.on('updateActor', () => renderOrganizer());
Hooks.on('createToken', () => renderOrganizer());
Hooks.on('deleteToken', () => renderOrganizer());
Hooks.on('updateToken', () => renderOrganizer());
Hooks.on('canvasReady', () => renderOrganizer());

// Register hooks that must fire after init.
//
// Each register() call is wrapped in `safeRegister` so a runtime error inside
// one registration doesn't cascade and silently strip every later one. The
// classic failure mode the bare list had: a bug in (e.g.) registerChromeIcons
// would throw, and registerSidebarFilter / registerLetterSeals / etc. below
// it would never run — the user sees "chrome AND cabinet AND letter seals
// are gone" with no console message tying them together. With safeRegister,
// each failure is logged independently and the rest of the chain continues.
//
// Caveat: this catches RUNTIME errors inside register() bodies only. It does
// NOT catch ES-module import-resolution failures (e.g. a broken `import`
// path in a hook file) — those happen before this line ever runs and bring
// the whole module down. Surface those with `node --check` + a sanity import
// resolution check before claiming a feature is done.
function safeRegister(name, fn) {
  try { fn(); }
  catch (err) { console.error(`GS | ${name} registration failed:`, err); }
}
safeRegister('speakingAs',       registerSpeakingAs);
safeRegister('sceneControls',    registerSceneControls);
safeRegister('canvasContext',    registerCanvasContext);
safeRegister('tokenHoverCard',   registerTokenHoverCard);
safeRegister('upkeep',           registerUpkeep);
safeRegister('reputationPhase',  registerReputationPhase);
safeRegister('rumourPhase',      registerRumourPhase);
safeRegister('rumourSocket',     registerRumourSocket);
safeRegister('randomEventSocket', registerRandomEventSocket);
safeRegister('chatPortraits',    registerChatPortraits);
safeRegister('letterSocket',     registerLetterSocket);
safeRegister('tokenDefaults',    registerTokenDefaults);
safeRegister('sessionEvents',    registerSessionEvents);
safeRegister('arrivalSync',      registerArrivalSync);
safeRegister('pauseOverlay',     registerPauseOverlay);
safeRegister('chromeIcons',      registerChromeIcons);
safeRegister('sidebarFilter',    registerSidebarFilter);
safeRegister('letterSeals',      registerLetterSeals);
safeRegister('epistolaryPhase',  registerEpistolaryPhase);
// Monologue socket binds at ready time, after game.socket exists.
Hooks.once('ready', () => safeRegister('monologueSocket', registerMonologueSocket));
// Novel Reader auto-open on game-end hook.
safeRegister('novelReaderHooks', registerNovelReaderHooks);
