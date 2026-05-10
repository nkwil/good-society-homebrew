const { StringField, NumberField, ArrayField, SchemaField, EmbeddedDataField, HTMLField } = foundry.data.fields;
import { PersonaModel } from './persona.js';

/**
 * Connection theme choices — the 5 dedicated connection variants PLUS every
 * Major theme (including secret) so connections can pick from the full
 * palette. Default stays at `connection-green` for fresh actors. The Major
 * themes use light cream paper or dark themes (avril/pearlinda/secret) and
 * cascade through the same .gs-themed wrapper plumbing as Majors.
 */
const CONNECTION_THEMES = [
  // Connection-dedicated variants
  'connection-green', 'connection-purple', 'connection-blue',
  'connection-yellow', 'connection-grey',
  // Major themes — connections may opt into the full palette
  'rose', 'roger', 'clayton', 'dixon', 'avril', 'pearlinda', 'secret',
];

export class ConnectionDataModel extends foundry.abstract.TypeDataModel {
  /**
   * Coerce only when `theme` is explicitly present and invalid. Foundry calls
   * migrateData on PARTIAL change payloads during updates, not just full
   * source data — auto-defaulting missing keys would silently overwrite the
   * actor's actual theme on every persona switch or other partial update.
   * The StringField's `initial: 'connection-green'` handles the fresh-actor
   * case at construction time.
   */
  static migrateData(source) {
    if (source && 'theme' in source && !CONNECTION_THEMES.includes(source.theme)) {
      source.theme = 'connection-green';
    }
    return super.migrateData(source);
  }

  static defineSchema() {
    return {
      bio: new SchemaField({
        pronouns: new StringField({ initial: '' }),
        relationshipLabel: new StringField({ initial: '' }),
        // Editable subhead displayed directly under the name on the cameo.
        // Free-form: title, brief description, anything the GM wants.
        // Empty by default.
        title: new StringField({ initial: '' }),
        description: new StringField({ initial: '' }),
        portraitUrl: new StringField({ initial: '' }),
      }),
      linkedMajorId: new StringField({ initial: '' }),
      impressions: new ArrayField(
        new SchemaField({
          majorId: new StringField({ initial: '' }),
          text: new StringField({ initial: '' }),
        })
      ),
      resolve: new SchemaField({
        current: new NumberField({ integer: true, min: 0, initial: 1 }),
        max: new NumberField({ integer: true, min: 1, initial: 5 }),
      }),
      sceneInfo: new SchemaField({
        // Post-MVP §10.2: hover-card subtitle line (italic Crimson; ~50 chars).
        subtitle: new StringField({ initial: '' }),
        // Post-MVP §10.2: hoverSummary upgrades from StringField to HTMLField
        // so GMs can author rich text (italic, bold, links, inline images).
        // Plain-text strings are valid HTML — no data migration needed.
        hoverSummary: new HTMLField({ initial: '' }),
        publicTags: new ArrayField(new StringField()),
      }),
      theme: new StringField({
        required: true,
        // Full registry: 5 connection variants + 7 Major themes (incl. secret).
        // Keep this list synchronized with CONNECTION_THEMES at the top of
        // this file — they're the same source of truth.
        choices: [...CONNECTION_THEMES],
        initial: 'connection-green',
      }),
      personas: new ArrayField(new EmbeddedDataField(PersonaModel)),
      activePersonaId: new StringField({ initial: '' }),
    };
  }
}
