/**
 * Good Society (Homebrew) — system entry point.
 * Registers all Good Society document types (DataModels + sheets).
 */

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
};

Hooks.once('init', async function () {
  // ── Settings ─────────────────────────────────────────────────────────────
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
  const enabled = game.settings.get('good-society-homebrew', 'applyFoundryChrome');
  document.body.classList.toggle('gs-chrome-themed', enabled);
});
