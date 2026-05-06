const { StringField, NumberField, ArrayField, SchemaField, EmbeddedDataField } = foundry.data.fields;
import { PersonaModel } from './persona.js';

export class ConnectionDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      bio: new SchemaField({
        pronouns: new StringField({ initial: '' }),
        relationshipLabel: new StringField({ initial: '' }),
        description: new StringField({ initial: '' }),
        portraitUrl: new StringField({ initial: '' }),
      }),
      linkedMajorId: new StringField({ initial: '' }),
      impressions: new ArrayField(
        new SchemaField({
          majorId: new StringField({ initial: '' }),
          text: new StringField({ initial: '' }),
        })
      ),
      resolve: new SchemaField({
        current: new NumberField({ integer: true, min: 0, initial: 1 }),
        max: new NumberField({ integer: true, min: 1, initial: 5 }),
      }),
      sceneInfo: new SchemaField({
        hoverSummary: new StringField({ initial: '' }),
        publicTags: new ArrayField(new StringField()),
      }),
      theme: new StringField({
        required: true,
        choices: ['connection-green', 'connection-purple', 'connection-blue', 'connection-yellow', 'connection-grey'],
        initial: 'connection-green',
      }),
      personas: new ArrayField(new EmbeddedDataField(PersonaModel)),
      activePersonaId: new StringField({ initial: '' }),
    };
  }
}
