const { StringField, ArrayField, SchemaField, EmbeddedDataField, HTMLField } = foundry.data.fields;
import { PersonaModel } from './persona.js';

export class NpcDataModel extends foundry.abstract.TypeDataModel {
  /**
   * Coerce only when `theme` is explicitly present and invalid. migrateData
   * runs on partial change payloads during updates — auto-defaulting missing
   * keys would write 'npc' on every unrelated update (harmless here since
   * 'npc' is the only valid value, but consistency with the other actor
   * data models matters).
   */
  static migrateData(source) {
    if (source && 'theme' in source && source.theme !== 'npc') {
      source.theme = 'npc';
    }
    return super.migrateData(source);
  }

  static defineSchema() {
    return {
      bio: new SchemaField({
        pronouns: new StringField({ initial: '' }),
        role: new StringField({ initial: '' }),
        // Editable subhead displayed directly under the name on the cameo.
        // Free-form: title, brief description, anything the GM wants. Empty
        // by default. Distinct from `role` which sits in the bio chip row.
        title: new StringField({ initial: '' }),
        description: new StringField({ initial: '' }),
        portraitUrl: new StringField({ initial: '' }),
      }),
      sceneInfo: new SchemaField({
        // Post-MVP §10.2: hover-card subtitle line (italic Crimson; ~50 chars).
        subtitle: new StringField({ initial: '' }),
        // Post-MVP §10.2: hoverSummary upgrades from StringField to HTMLField.
        hoverSummary: new HTMLField({ initial: '' }),
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
