const { StringField, BooleanField, ArrayField } = foundry.data.fields;

export class InnerConflictDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      leftLabel: new StringField({ initial: '' }),
      rightLabel: new StringField({ initial: '' }),
      leftBoxes: new ArrayField(new BooleanField({ initial: false }), {
        initial: () => [false, false, false, false, false],
      }),
      rightBoxes: new ArrayField(new BooleanField({ initial: false }), {
        initial: () => [false, false, false, false, false],
      }),
      completed: new BooleanField({ initial: false }),
      // null = not yet completed; "left" or "right" = which side filled
      completedSide: new StringField({
        nullable: true,
        choices: ['left', 'right'],
        initial: null,
      }),
    };
  }
}
