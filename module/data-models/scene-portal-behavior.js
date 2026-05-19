/**
 * ScenePortalBehaviorType — a custom Region Behavior that turns a Scene
 * Region into a portal to another scene.
 *
 * This is the system-native answer to "a hub scene with buttons that open
 * other scenes": the GM draws a Region over each doorway / button graphic on
 * a hub scene and attaches a "Travel to Scene" behavior pointing at the
 * destination. When a token moves into the region the destination scene is
 * activated, pulling the whole table to it — no third-party module required.
 *
 * Why a token-move trigger rather than a literal mouse click: the canvas
 * doesn't expose reliable per-element click handling without hacks, but
 * Region Behaviors are Foundry's supported, version-stable extension point
 * for "something happens when a token interacts with an area."
 *
 * Region events are dispatched on every connected client; only the active
 * GM performs the (table-wide) activation — the same single-writer pattern
 * core's PauseGame behavior uses.
 */

const { StringField, BooleanField } = foundry.data.fields;

export class ScenePortalBehaviorType extends foundry.data.regionBehaviors.RegionBehaviorType {
  /** Auto-localizes FIELDS.<field>.label / .hint from this prefix. */
  static LOCALIZATION_PREFIXES = ['GOODSOCIETY.scenePortal'];

  static defineSchema() {
    return {
      // Restricted to TOKEN_MOVE_IN only: it fires solely on movement that
      // crosses into the region. TOKEN_ENTER would also fire when a token is
      // already inside on scene load, which would make the hub un-stayable.
      events: this._createEventsField({
        events:  [CONST.REGION_EVENTS.TOKEN_MOVE_IN],
        initial: [CONST.REGION_EVENTS.TOKEN_MOVE_IN],
      }),
      sceneId: new StringField({
        required: true,
        blank:    true,
        initial:  '',
        choices:  () => Object.fromEntries(
          (game.scenes ?? []).map(s => [s.id, s.name]),
        ),
      }),
      confirm: new BooleanField({ initial: false }),
    };
  }

  /**
   * Region event handler — runs on every client. Only the active GM drives
   * the activation, since it changes the scene table-wide and needs GM
   * permission.
   *
   * @param {RegionEvent} event
   */
  async _handleRegionEvent(event) {
    if (!game.users.activeGM?.isSelf) return;

    const scene = game.scenes?.get(this.sceneId);
    if (!scene) {
      ui.notifications?.warn(game.i18n.localize('GOODSOCIETY.scenePortal.missingScene'));
      return;
    }
    if (scene.active) return; // already the active scene — nothing to do

    if (this.confirm) {
      const proceed = await foundry.applications.api.DialogV2.confirm({
        window:  { title: game.i18n.localize('GOODSOCIETY.scenePortal.confirmTitle') },
        content: `<p>${game.i18n.format('GOODSOCIETY.scenePortal.confirmBody', {
          scene: foundry.utils.escapeHTML(scene.name),
        })}</p>`,
      });
      if (!proceed) return;
    }

    await scene.activate();
  }
}
