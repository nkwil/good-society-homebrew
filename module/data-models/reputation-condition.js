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
      // Archetype gating. Each entry is a major-character archetype id
      // (see ARCHETYPE_CHOICES). An EMPTY array means the condition is
      // universal — available to characters of any archetype. A non-empty
      // array restricts the condition to characters whose archetype matches.
      archetypes: new ArrayField(new StringField()),
    };
  }
}
