const { StringField, NumberField, ArrayField, SchemaField, HTMLField } = foundry.data.fields;

/**
 * Valid choices for `heirStatus`. Kept in sync with the StringField below;
 * also referenced by `migrateData` to coerce legacy values.
 */
const HEIR_STATUS_CHOICES = ['named-son', 'named-daughter', 'named-foster', 'vacant', 'contested'];

/** Valid origin values — must mirror Major.bio.peerage. The two share a
 *  conceptual social-standing axis; swapping them in lockstep keeps Family
 *  membership rules consistent. */
const ORIGIN_CHOICES = ['royalty', 'nobility', 'gentry', 'commoner', 'impoverished'];
const LEGACY_ORIGIN = new Set(['heir', 'new-arrival', 'foreign']);

export class FamilyDataModel extends foundry.abstract.TypeDataModel {
  /**
   * Coerce legacy data shapes before validation. Pre-A.6 the field was a
   * `BooleanField` with `initial: false` — any Family actor authored under that
   * schema still has `heirStatus: false` on disk, which fails the new enum
   * validation and breaks actor initialization. Map anything outside the enum
   * to the new default `'vacant'`. Foundry calls this prior to schema
   * validation, so the actor loads cleanly and the cleaned value persists on
   * the next user-driven save.
   *
   * IMPORTANT: only coerce when `heirStatus` is explicitly present and
   * invalid. migrateData runs on partial change payloads during updates, not
   * just full source data — auto-defaulting missing keys would silently
   * overwrite the family's actual heirStatus on every unrelated update.
   */
  static migrateData(source) {
    if (source && 'heirStatus' in source && !HEIR_STATUS_CHOICES.includes(source.heirStatus)) {
      source.heirStatus = 'vacant';
    }
    // Origin rename mirrors Major.bio.peerage: legacy heir|new-arrival|foreign
    // → 'gentry' as the neutral middle tier. §16 partial-update guard applies.
    if (source && 'origin' in source && LEGACY_ORIGIN.has(source.origin)) {
      source.origin = 'gentry';
    }
    return super.migrateData(source);
  }

  static defineSchema() {
    return {
      familyName: new StringField({ initial: '' }),
      origin: new StringField({
        choices: ORIGIN_CHOICES,
        initial: 'gentry',
      }),
      heirStatus: new StringField({
        required: true,
        choices: HEIR_STATUS_CHOICES,
        initial: 'vacant',
      }),
      establishedYear: new NumberField({ required: false, integer: true, nullable: true, initial: null }),
      heirStatusFlavor: new StringField({ required: false, initial: '' }),
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
