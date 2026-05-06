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

Hooks.once('init', function () {
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

  // Placeholder sheets — replaced one by one as real sheets are built in Session B.
  foundry.documents.collections.Actors.registerSheet('good-society-homebrew', GoodSocietyActorSheetStub, {
    types: ['major-character', 'connection', 'family', 'npc'],
    makeDefault: true,
    label: 'GOODSOCIETY.sheets.stub',
  });
});
