/**
 * Novel Phase popup — a small informational modal that fires on entry to
 * a Novel Chapter (1st or 2nd) and is also clickable from the Cycle HUD's
 * novel pip. House-styled, one screen, dismissable.
 *
 * Not a wizard — no steps, no inputs, no flags. Players see it every time
 * the phase begins so the table doesn't have to verbally remember what to
 * keep in mind during a Novel chapter.
 */

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ApplicationV2 }              = foundry.applications.api;

const NS = 'good-society-homebrew';

let _instance = null;

/** Open or focus the singleton. */
export function openNovelPhasePopup() {
  if (!_instance) _instance = new NovelPhasePopup();
  _instance.render({ force: true });
  return _instance;
}

export class NovelPhasePopup extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'gs-novel-phase-popup',
    classes: ['good-society', 'gs-novel-phase-popup'],
    window: {
      frame: true,
      positioned: true,
      title: 'GOODSOCIETY.novelPhase.popupTitle',
    },
    position: { width: 540, height: 'auto' },
    actions: {
      dismiss: NovelPhasePopup.#dismiss,
    },
  };

  static PARTS = {
    main: { template: 'systems/good-society-homebrew/templates/apps/novel-phase-popup.hbs' },
  };

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    let cycleNumber = 1;
    let cyclePosition = 1;
    try { cycleNumber = game.settings.get(NS, 'cycleNumber') ?? 1; } catch {}
    try { cyclePosition = game.settings.get(NS, 'cyclePosition') ?? 1; } catch {}
    // cyclePosition 1 = first Novel; cyclePosition 5 = second Novel ('novel²').
    ctx.cycleNumber = cycleNumber;
    ctx.isSecondNovel = cyclePosition === 5;
    ctx.heading = ctx.isSecondNovel
      ? game.i18n.localize('GOODSOCIETY.novelPhase.headingSecond')
      : game.i18n.localize('GOODSOCIETY.novelPhase.headingFirst');
    ctx.subhead = game.i18n.localize('GOODSOCIETY.novelPhase.subhead');
    ctx.bullets = [
      game.i18n.localize('GOODSOCIETY.novelPhase.bullet.desire'),
      game.i18n.localize('GOODSOCIETY.novelPhase.bullet.reputation'),
      game.i18n.localize('GOODSOCIETY.novelPhase.bullet.rumours'),
      game.i18n.localize('GOODSOCIETY.novelPhase.bullet.monologue'),
      game.i18n.localize('GOODSOCIETY.novelPhase.bullet.connections'),
      game.i18n.localize('GOODSOCIETY.novelPhase.bullet.choices'),
    ];
    return ctx;
  }

  static async #dismiss() {
    this.close();
  }
}
