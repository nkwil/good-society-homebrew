/**
 * Good Society (Homebrew) — system entry point.
 * Registers all Good Society document types (DataModels + sheets).
 * Phase 1 Session A: DataModel registrations only — no sheets yet.
 */

// Placeholder sheet so new actor types open without errors until real sheets are built.
class GoodSocietyActorSheetStub extends foundry.appv1.sheets.ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['good-society', 'sheet', 'actor'],
      width: 480,
      height: 120,
    });
  }
  get template() {
    return 'systems/good-society-homebrew/templates/actors/placeholder.hbs';
  }
}

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

/** Handlebars component partials — loaded once and registered for {{> partialName}} use. */
const GS_COMPONENT_PARTIALS = {
  'inner-conflict-grid':
    'systems/good-society-homebrew/templates/components/inner-conflict-grid.hbs',
};

Hooks.once('init', async function () {
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

  // Real sheets (Session B-1+)
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

  // Placeholder stub for types that don't have a real sheet yet.
  foundry.documents.collections.Actors.registerSheet('good-society-homebrew', GoodSocietyActorSheetStub, {
    types: ['family', 'npc'],
    makeDefault: true,
    label: 'GOODSOCIETY.sheets.stub',
  });
});
