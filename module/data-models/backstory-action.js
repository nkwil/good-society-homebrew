const { StringField, HTMLField, BooleanField } = foundry.data.fields;

export class BackstoryActionDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: new HTMLField({ initial: '' }),
      // ID of the inner-conflict item that earned this action
      sourceConflictId: new StringField({ initial: '' }),
      expanded: new BooleanField({ initial: false }),
      used: new BooleanField({ initial: false }),
    };
  }
}
