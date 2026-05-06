const { StringField, HTMLField } = foundry.data.fields;

export class ReputationTagDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      polarity: new StringField({
        required: true,
        choices: ['positive', 'negative'],
        initial: 'positive',
      }),
      description: new HTMLField({ initial: '' }),
      source: new StringField({ initial: '' }),
    };
  }
}
