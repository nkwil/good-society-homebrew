const { StringField, HTMLField, BooleanField, ArrayField } = foundry.data.fields;

export class ReputationConditionDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      polarity: new StringField({
        required: true,
        choices: ['positive', 'negative'],
        initial: 'positive',
      }),
      description: new HTMLField({ initial: '' }),
      active: new BooleanField({ initial: false }),
      sourceTagIds: new ArrayField(new StringField()),
    };
  }
}
