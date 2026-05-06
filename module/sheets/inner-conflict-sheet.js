const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

export class InnerConflictSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ['good-society', 'sheet', 'item', 'inner-conflict'],
    position: { width: 540, height: 'auto' },
    window: { contentClasses: ['gs-item-sheet', 'gs-item-sheet--inner-conflict'] },
    actions: {
      toggleBox: InnerConflictSheet.#toggleBox,
      reopenConflict: InnerConflictSheet.#reopenConflict,
    },
  };

  static PARTS = {
    main: {
      template: 'systems/good-society-homebrew/templates/items/inner-conflict.hbs',
    },
  };

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    const sys = this.document.system;
    const leftCount = sys.leftBoxes.filter(Boolean).length;
    const rightCount = sys.rightBoxes.filter(Boolean).length;

    ctx.system = sys;
    ctx.document = this.document;
    ctx.itemId = this.document.id;
    ctx.leftLabel = sys.leftLabel;
    ctx.rightLabel = sys.rightLabel;
    ctx.leftBoxes = sys.leftBoxes;
    ctx.rightBoxes = sys.rightBoxes;
    ctx.completed = sys.completed;
    ctx.completedSide = sys.completedSide;
    ctx.leftCount = leftCount;
    ctx.rightCount = rightCount;
    ctx.totalCount = leftCount + rightCount;
    ctx.labelEditable = true;
    ctx.showPerSideCount = false;
    return ctx;
  }

  static async #toggleBox(event, target) {
    if (this.document.system.completed) return;
    const side = target.dataset.side;
    const index = parseInt(target.dataset.index, 10);
    const boxes = [...this.document.system[`${side}Boxes`]];
    boxes[index] = !boxes[index];

    const leftBoxes = side === 'left' ? boxes : [...this.document.system.leftBoxes];
    const rightBoxes = side === 'right' ? boxes : [...this.document.system.rightBoxes];
    const leftCount = leftBoxes.filter(Boolean).length;
    const rightCount = rightBoxes.filter(Boolean).length;
    const totalCount = leftCount + rightCount;

    const update = { [`system.${side}Boxes`]: boxes };

    // Completion: 6 total OR 5 on one side (homebrew rule, locked in §4)
    if (totalCount >= 6 || leftCount >= 5 || rightCount >= 5) {
      update['system.completed'] = true;
      update['system.completedSide'] = leftCount >= rightCount ? 'left' : 'right';
    }

    await this.document.update(update);
  }

  static async #reopenConflict() {
    await this.document.update({
      'system.completed': false,
      'system.completedSide': null,
    });
  }
}
