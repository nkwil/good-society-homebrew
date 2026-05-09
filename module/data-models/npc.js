const { StringField, ArrayField, SchemaField, EmbeddedDataField } = foundry.data.fields;
import { PersonaModel } from './persona.js';

export class NpcDataModel extends foundry.abstract.TypeDataModel {
  /** Defensive: ensure pre-A.5 NPCs without `theme` get the only valid choice. */
  static migrateData(source) {
    if (source && source.theme !== 'npc') {
      source.theme = 'npc';
    }
    return super.migrateData(source);
  }

  static defineSchema() {
    return {
      bio: new SchemaField({
        pronouns: new StringField({ initial: '' }),
        role: new StringField({ initial: '' }),
        description: new StringField({ initial: '' }),
        portraitUrl: new StringField({ initial: '' }),
      }),
      sceneInfo: new SchemaField({
        hoverSummary: new StringField({ initial: '' }),
        publicTags: new ArrayField(new StringField()),
      }),
      theme: new StringField({
        required: true,
        choices: ['npc'],
        initial: 'npc',
      }),
      personas: new ArrayField(new EmbeddedDataField(PersonaModel)),
      activePersonaId: new StringField({ initial: '' }),
    };
  }
}
