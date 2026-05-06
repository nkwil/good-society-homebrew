const { StringField, ArrayField, SchemaField, EmbeddedDataField } = foundry.data.fields;
import { PersonaModel } from './persona.js';

export class NpcDataModel extends foundry.abstract.TypeDataModel {
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
      personas: new ArrayField(new EmbeddedDataField(PersonaModel)),
      activePersonaId: new StringField({ initial: '' }),
    };
  }
}
