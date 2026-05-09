const {
  SchemaField, StringField, NumberField, BooleanField,
  ArrayField, EmbeddedDataField, HTMLField,
} = foundry.data.fields;
import { PersonaModel } from './persona.js';

/** Valid theme choices for Major Characters — kept in sync with the schema. */
const MAJOR_THEMES = ['rose', 'roger', 'mags', 'avril', 'dixon', 'clayton'];

export class MajorCharacterDataModel extends foundry.abstract.TypeDataModel {
  /**
   * Coerce legacy data shapes before validation. Pre-A.5 majors had no
   * `theme` field. New StringField has `initial: 'clayton'` which Foundry
   * normally applies for missing values, but defensive migration here
   * guarantees the field exists with a valid choice for any actor written
   * before the field was added.
   */
  static migrateData(source) {
    if (source && !MAJOR_THEMES.includes(source.theme)) {
      source.theme = 'clayton';
    }
    return super.migrateData(source);
  }

  static defineSchema() {
    return {
      bio: new SchemaField({
        age: new NumberField({ integer: true, min: 0, initial: 30 }),
        peerage: new StringField({
          choices: ['heir', 'new-arrival', 'foreign'],
          initial: 'new-arrival',
        }),
        appearance: new StringField({ initial: '' }),
        temperamentGiven: new NumberField({ integer: true, initial: 0 }),
        temperamentTaken: new NumberField({ integer: true, initial: 0 }),
        portraitUrl: new StringField({ initial: '' }),
      }),
      theme: new StringField({
        required: true,
        choices: ['rose', 'roger', 'mags', 'avril', 'dixon', 'clayton'],
        initial: 'clayton',
      }),
      personas: new ArrayField(new EmbeddedDataField(PersonaModel)),
      activePersonaId: new StringField({ initial: '' }),
      desire: new HTMLField({ initial: '' }),
      notesObjectives: new HTMLField({ initial: '' }),
      backstory: new HTMLField({ initial: '' }),
      adventurerSentiment: new HTMLField({ initial: '' }),
      tokens: new SchemaField({
        resolve: new SchemaField({
          current: new NumberField({ integer: true, min: 0, initial: 3 }),
          max: new NumberField({ integer: true, min: 1, initial: 5 }),
        }),
        major: new BooleanField({ initial: false }),
        monologuedThisCycle: new BooleanField({ initial: false }),
      }),
      reputation: new SchemaField({
        positiveTags: new ArrayField(new StringField()),
        negativeTags: new ArrayField(new StringField()),
        activeConditions: new ArrayField(new StringField()),
        pendingChanges: new ArrayField(new SchemaField({
          kind: new StringField({ initial: '' }),
          value: new StringField({ initial: '' }),
          // tagId — source reputation-tag's ID; used by the updateItem hook
          // in session-events.js to re-sync `value` when a tag is renamed
          // after creation. Older entries (pre this field) default to '' and
          // simply won't get rename-synced — graceful.
          tagId: new StringField({ initial: '' }),
          scene: new StringField({ initial: '' }),
          ts: new NumberField({ integer: true, initial: 0 }),
        })),
      }),
      innerConflictsActiveIds: new ArrayField(new StringField()),
      innerConflictsCompletedIds: new ArrayField(new StringField()),
      connections: new ArrayField(new StringField()),
      familyId: new StringField({ initial: '' }),
      visibility: new SchemaField({
        desire: new StringField({
          choices: ['secret', 'public', 'redacted'],
          initial: 'secret',
        }),
        backstory: new StringField({
          choices: ['secret', 'public', 'redacted'],
          initial: 'secret',
        }),
        magic: new StringField({
          choices: ['secret', 'public', 'redacted'],
          initial: 'secret',
        }),
        adventurerSentiment: new StringField({
          choices: ['secret', 'public', 'redacted'],
          initial: 'public',
        }),
        notesObjectives: new StringField({
          choices: ['secret', 'public', 'redacted'],
          initial: 'secret',
        }),
        innerConflicts: new StringField({
          choices: ['secret', 'public', 'redacted'],
          initial: 'secret',
        }),
      }),
    };
  }

  /** Returns the active persona, falling back to primary, then first. */
  get activePersona() {
    return this.personas.find(p => p.id === this.activePersonaId)
      ?? this.personas.find(p => p.isPrimary)
      ?? this.personas[0]
      ?? null;
  }
}
