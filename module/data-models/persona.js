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
      // Per-persona theme override. Empty string = inherit the actor's
      // own `system.theme` ("true identity" theme). Set to a Major theme
      // id (rose / roger / clayton / dixon / avril / pearlinda / secret)
      // and the dossier swaps the visual cascade when this persona is
      // active. Post-MVP §4 / persona-folds-theme update.
      theme: new StringField({ initial: '' }),
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
