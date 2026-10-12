const { StringField, HTMLField, ArrayField } = foundry.data.fields;

import { ARCHETYPE_CHOICES } from './major-character.js';

/**
 * Random Event — a GM-authored vignette pooled by archetype.
 *
 * The Event Command Center filters events by `archetype` matching the target
 * Major's `system.bio.archetype`. When launched, the player writes three
 * strategies and rolls 1d20 per strategy; average ≥ 11 = success.
 *
 * On success the player picks one tag from `positiveTagOptions`; on failure,
 * one from `negativeTagOptions`. The chosen tag becomes a new reputation-tag
 * Item on the actor (routed through the existing pendingChanges writer).
 */
export class RandomEventDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      archetype: new StringField({
        required: true,
        choices: ARCHETYPE_CHOICES,
        initial: 'new-arrival',
      }),
      description: new HTMLField({ initial: '' }),
      // Optional flavor image shown to the whole table in the launch
      // announce card and the resolution popover. Empty is fine.
      imageUrl: new StringField({ initial: '' }),
      // Positive/negative TAG SUGGESTIONS. These are optional GM-authored
      // prompts that pre-fill the player's tag input at resolution time; the
      // player can always type their own. Kept as `*TagOptions` for
      // back-compat with seeded data; relabeled in the UI as "suggestions".
      positiveTagOptions: new ArrayField(new StringField()),
      negativeTagOptions: new ArrayField(new StringField()),
    };
  }
}
