const { StringField, HTMLField, BooleanField, SchemaField } = foundry.data.fields;

export class MagicSkillDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: new HTMLField({ initial: '' }),
      referenceUrl: new StringField({ initial: '' }),
      // Custom icon shown on the character sheet's Magic & Skills row.
      // Set via FilePicker on the item sheet. Empty string falls back to
      // the generic ⊛ glyph in the row template.
      iconUrl: new StringField({ initial: '' }),
      // JB2A / Sequencer asset path, e.g. "jb2a.misty_step.01.blue"
      vfxKey: new StringField({ initial: '' }),
      soundUrl: new StringField({ initial: '' }),
      // Hidden from other players (e.g. Dixon's secret magic)
      hidden: new BooleanField({ initial: false }),
      // Empty targetPersonaId means this skill does not trigger a persona swap.
      triggersPersonaSwap: new SchemaField({
        targetPersonaId: new StringField({ initial: '' }),
      }),
    };
  }
}
