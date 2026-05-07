/**
 * Good Society (Homebrew) — system entry point.
 * Registers all Good Society document types (DataModels + sheets).
 */

import { register as registerSpeakingAs } from './hooks/speaking-as.js';
import { register as registerSceneControls } from './hooks/scene-controls.js';
import { register as registerCanvasContext } from './hooks/canvas-context.js';
import { register as registerTokenHoverCard } from './hooks/token-hover-card.js';
import { register as registerUpkeep, onUpkeepPhaseStart } from './hooks/upkeep.js';
import { register as registerSessionEvents } from './hooks/session-events.js';
import { checkThresholdAndPrompt } from './helpers/reputation-rules.js';
import { renderDock } from './apps/my-characters-dock.js';
import { getDashboard } from './apps/public-info-dashboard.js';
import { initCycleHud, renderCycleHud } from './apps/cycle-hud.js';
import { renderOrganizer } from './apps/npc-organizer.js';
import { initTooltipSystem } from './helpers/rule-tooltip.js';
import { ReputationTagDataModel } from './data-models/reputation-tag.js';
import { ReputationConditionDataModel } from './data-models/reputation-condition.js';
import { InnerConflictDataModel } from './data-models/inner-conflict.js';
import { MagicSkillDataModel } from './data-models/magic-skill.js';
import { BackstoryActionDataModel } from './data-models/backstory-action.js';
import { FamilyDataModel } from './data-models/family.js';
import { NpcDataModel } from './data-models/npc.js';
import { ConnectionDataModel } from './data-models/connection.js';
import { MajorCharacterDataModel } from './data-models/major-character.js';
import { MajorCharacterSheet } from './sheets/major-character-sheet.js';
import { ConnectionSheet } from './sheets/connection-sheet.js';
import { FamilySheet } from './sheets/family-sheet.js';
import { NpcSheet } from './sheets/npc-sheet.js';
import { ReputationTagSheet } from './sheets/reputation-tag-sheet.js';
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
      if (value === 'upkeep') onUpkeepPhaseStart();
    },
  });

  game.settings.register('good-society-homebrew', 'sessionEvents', {
    scope: 'world',
    config: false,
    type: Object,
    default: [],
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

  // Load and register Handlebars partials for shared components.
  const loaded = await loadTemplates(GS_COMPONENT_PARTIALS);
  for (const [name, fn] of Object.entries(loaded)) {
    Handlebars.registerPartial(name, fn);
  }

  // Comparison helpers not guaranteed by Foundry's default set.
  Handlebars.registerHelper('gte', (a, b) => a >= b);
  Handlebars.registerHelper('gt',  (a, b) => a >  b);
  Handlebars.registerHelper('lte', (a, b) => a <= b);
  // ── Item DataModels ──────────────────────────────────────────────────────
  Object.assign(CONFIG.Item.dataModels, {
    'reputation-tag': ReputationTagDataModel,
    'reputation-condition': ReputationConditionDataModel,
    'inner-conflict': InnerConflictDataModel,
    'magic-skill': MagicSkillDataModel,
    'backstory-action': BackstoryActionDataModel,
  });

  // ── Actor DataModels ─────────────────────────────────────────────────────
  Object.assign(CONFIG.Actor.dataModels, {
    'family': FamilyDataModel,
    'npc': NpcDataModel,
    'connection': ConnectionDataModel,
    'major-character': MajorCharacterDataModel,
  });

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
});

Hooks.once('ready', () => {
  const chromeEnabled = game.settings.get('good-society-homebrew', 'applyFoundryChrome');
  document.body.classList.toggle('gs-chrome-themed', chromeEnabled);

  const tooltipsEnabled = game.settings.get('good-society-homebrew', 'tooltipsEnabled');
  document.body.classList.toggle('gs-tooltips-disabled', !tooltipsEnabled);

  // Open the My Characters Dock if the user owns any actors.
  renderDock();

  // Inject the Cycle Phase HUD strip above the scene navigation.
  initCycleHud();

  // Wire hover-tooltip system for all [data-tooltip-key] elements.
  initTooltipSystem();
});

// Reputation threshold check — fires when a reputation-tag is embedded on a Major.
Hooks.on('createItem', (item) => {
  if (item.type !== 'reputation-tag') return;
  if (item.parent?.type !== 'major-character') return;
  checkThresholdAndPrompt(item.parent, item.system?.polarity ?? 'positive');
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

// Re-render the organizer when the token list on the active scene changes.
Hooks.on('createToken', () => renderOrganizer());
Hooks.on('deleteToken', () => renderOrganizer());
Hooks.on('updateToken', () => renderOrganizer());
Hooks.on('canvasReady', () => renderOrganizer());

// Register hooks that must fire after init.
registerSpeakingAs();
registerSceneControls();
registerCanvasContext();
registerTokenHoverCard();
registerUpkeep();
registerSessionEvents();
