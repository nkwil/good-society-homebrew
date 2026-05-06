const { StringField, BooleanField, ArrayField, SchemaField, HTMLField } = foundry.data.fields;

export class FamilyDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      familyName: new StringField({ initial: '' }),
      origin: new StringField({
        choices: ['heir', 'new-arrival', 'foreign'],
        initial: 'heir',
      }),
      heirStatus: new BooleanField({ initial: false }),
      // Pulled into member Majors' sheets as a read-only reputation criteria panel
      uniqueNegativeRepCriteria: new StringField({ initial: '' }),
      crest: new SchemaField({
        imageUrl: new StringField({ initial: '' }),
        motto: new StringField({ initial: '' }),
      }),
      notes: new HTMLField({ initial: '' }),
      memberMajorIds: new ArrayField(new StringField()),
      visibility: new SchemaField({
        uniqueNegativeRepCriteria: new StringField({
          choices: ['secret', 'public', 'redacted'],
          initial: 'secret',
        }),
        notes: new StringField({
          choices: ['secret', 'public', 'redacted'],
          initial: 'secret',
        }),
      }),
    };
  }
}
