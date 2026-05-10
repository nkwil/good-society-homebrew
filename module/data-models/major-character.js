const {
  SchemaField, StringField, NumberField, BooleanField,
  ArrayField, EmbeddedDataField, HTMLField,
} = foundry.data.fields;
import { PersonaModel } from './persona.js';

/** Valid theme choices for Major Characters — kept in sync with the schema.
 *  Post-MVP §6.5: Mags renamed to Secret; Pearlinda added; six → seven themes. */
const MAJOR_THEMES = ['rose', 'roger', 'clayton', 'dixon', 'avril', 'pearlinda', 'secret'];

/** Valid peerage (social-standing) values — kept in sync with the schema.
 *  Replaces the legacy ['heir', 'new-arrival', 'foreign'] trio with a five-tier
 *  social-standing enum. Legacy values are mapped to 'gentry' on read by
 *  migrateData; the GM-side ready-hook in good-society.js persists the rename. */
const PEERAGE_CHOICES = ['royalty', 'nobility', 'gentry', 'commoner', 'impoverished'];
const LEGACY_PEERAGE = new Set(['heir', 'new-arrival', 'foreign']);

/** Valid archetype values — character role pool feeding the random-event system.
 *  Distinct from peerage (social standing). The legacy peerage values
 *  ['heir', 'new-arrival', 'foreign'] seed archetype: heir → 'heir',
 *  new-arrival → 'new-arrival', foreign → 'new-arrival'. */
export const ARCHETYPE_CHOICES = ['heir', 'new-arrival', 'hedonist', 'careerist', 'socialite', 'tutor'];

/** Map a legacy peerage value to its corresponding archetype seed. Used by
 *  both migrateData (for read-side coercion) and the GM ready-hook (for the
 *  one-time disk migration). */
function _archetypeFromLegacyPeerage(value) {
  if (value === 'heir') return 'heir';
  if (value === 'new-arrival' || value === 'foreign') return 'new-arrival';
  return null;
}

export class MajorCharacterDataModel extends foundry.abstract.TypeDataModel {
  /**
   * Coerce legacy data shapes before validation.
   *
   * Post-MVP rename: `mags` → `secret`. The Hooks.once('ready') GM migration
   * persists this to disk; this in-memory coercion keeps reads working before
   * the disk migration runs (and on player clients, which never persist).
   *
   * IMPORTANT: do NOT default missing/invalid `theme` to clayton here.
   * Foundry calls migrateData on partial change payloads during updates, not
   * just on full source data. A partial like `{system: {activePersonaId: ''}}`
   * has no theme key — coercing it to 'clayton' would WRITE clayton into the
   * update payload, silently overwriting the actor's actual theme on every
   * persona switch. The StringField's `initial: 'clayton'` already handles
   * the genuine "missing on a fresh actor" case at construction time.
   */
  static migrateData(source) {
    if (!source) return super.migrateData(source);
    if (source.theme === 'mags') source.theme = 'secret';
    // Peerage rename: legacy values map to 'gentry' as the neutral middle tier.
    // While we're here, seed archetype from the legacy peerage value (heir → heir,
    // new-arrival → new-arrival, foreign → new-arrival). This is a one-time data
    // conversion gated on present-and-legacy peerage; we never auto-default a
    // missing archetype on partial updates (per the §16 anti-pattern). The
    // `!('archetype' in source.bio)` guard prevents clobbering an explicit value.
    if (source.bio && 'peerage' in source.bio && LEGACY_PEERAGE.has(source.bio.peerage)) {
      const seedArchetype = _archetypeFromLegacyPeerage(source.bio.peerage);
      source.bio.peerage = 'gentry';
      if (seedArchetype && !('archetype' in source.bio)) {
        source.bio.archetype = seedArchetype;
      }
    }
    return super.migrateData(source);
  }

  static defineSchema() {
    return {
      bio: new SchemaField({
        age: new NumberField({ integer: true, min: 0, initial: 30 }),
        peerage: new StringField({
          choices: PEERAGE_CHOICES,
          initial: 'gentry',
        }),
        // Archetype — character role pool that drives the random-event system.
        // Distinct from peerage (social standing). The Event Command Center
        // filters its event list by this field.
        archetype: new StringField({
          choices: ARCHETYPE_CHOICES,
          initial: 'new-arrival',
        }),
        // Editable subhead displayed directly under the name on the cameo.
        // Free-form: a formal title ("Marquis of Westminster"), a quick
        // identity descriptor ("the family's bookish heir"), or anything
        // the player wants. Empty by default.
        title: new StringField({ initial: '' }),
        // Pronouns — free-form ("she/her", "they/them", "he/him", etc.).
        // Parsed by `module/helpers/pronouns.js` into a full pronoun set
        // (subject/object/possessive/possessivePronoun/reflexive) at render
        // time so dossier copy can adapt: "Her Present Desire" / "His
        // Present Desire" / "Their Present Desire" all flow from this one
        // field. Empty = "they/them" fallback.
        pronouns: new StringField({ initial: '' }),
        appearance: new StringField({ initial: '' }),
        // Free-text temperament descriptor (e.g. "guarded · ambitious", "warm
        // and quick to laugh"). Distinct from the rulebook's mechanical
        // temperamentGiven/Taken counters below — this is the dossier's
        // descriptive companion to `appearance`.
        temperamentDescription: new StringField({ initial: '' }),
        temperamentGiven: new NumberField({ integer: true, initial: 0 }),
        temperamentTaken: new NumberField({ integer: true, initial: 0 }),
        portraitUrl: new StringField({ initial: '' }),
      }),
      theme: new StringField({
        required: true,
        choices: MAJOR_THEMES,
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
        major: new BooleanField({ initial: true }),  // new characters start with MT available (unspent)
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
