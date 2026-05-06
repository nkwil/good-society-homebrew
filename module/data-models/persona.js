const { SchemaField, StringField, BooleanField, ArrayField } = foundry.data.fields;

export class PersonaModel extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      id: new StringField({ required: true, initial: '' }),
      name: new StringField({ required: true, initial: '' }),
      isPrimary: new BooleanField({ initial: false }),
      portraitUrl: new StringField({ initial: '' }),
      tokenImageUrl: new StringField({ initial: '' }),
      tokenName: new StringField({ initial: '' }),
      hoverSummary: new StringField({ initial: '' }),
      publicTags: new ArrayField(new StringField()),
      chatColor: new StringField({ initial: '' }),
      visibility: new SchemaField({
        desire: new StringField({
          choices: ['secret', 'public', 'redacted', 'inherit'],
          initial: 'inherit',
        }),
        backstory: new StringField({
          choices: ['secret', 'public', 'redacted', 'inherit'],
          initial: 'inherit',
        }),
        magic: new StringField({
          choices: ['secret', 'public', 'redacted', 'inherit'],
          initial: 'inherit',
        }),
      }),
    };
  }
}
