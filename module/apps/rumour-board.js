/**
 * RumourBoard — always-available list view of rumours.
 * Per docs/design/32-rumour-wizard.md (B-12).
 *
 * Singleton ApplicationV2. Read-only for players (with the exception of
 * spending a spread rumour's resolve token, which any user can do via the
 * socket bridge). GM has admin actions: edit text, delete, mark faded.
 *
 * Opens from the Public Info Dashboard's `rumour ↗` button. The original
 * stub action has been replaced.
 */

import {
  groupRumours,
  requestUseRumour,
  editRumourText,
  deleteRumour,
} from '../helpers/rumours.js';

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ApplicationV2 }              = foundry.applications.api;

let _instance = null;

export function openRumourBoard() {
  if (!_instance) _instance = new RumourBoard();
  _instance.render({ force: true });
  return _instance;
}

export function refreshRumourBoard() {
  if (_instance?.rendered) _instance.render();
}

export class RumourBoard extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'gs-rumour-board',
    classes: ['good-society', 'gs-rumour-board-app'],
    window: {
      frame: true,
      positioned: true,
      title: 'GOODSOCIETY.rumourBoard.windowTitle',
    },
    position: { width: 540, height: 'auto' },
    actions: {
      useRumour:      RumourBoard.#useRumour,
      editRumour:     RumourBoard.#editRumourBegin,
      saveEditRumour: RumourBoard.#editRumourSave,
      cancelEditRumour: RumourBoard.#editRumourCancel,
      deleteRumour:   RumourBoard.#deleteRumour,
      toggleArchived: RumourBoard.#toggleArchived,
    },
  };

  static PARTS = {
    main: { template: 'systems/good-society-homebrew/templates/apps/rumour-board.hbs' },
  };

  constructor(options = {}) {
    super(options);
    this._editingId = null;
    this._showArchived = false;
  }

  /** @override */
  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    const isGM = game.user?.isGM ?? false;
    const { active, archived } = groupRumours();

    return {
      ...ctx,
      isGM,
      active:        active.map(r => _decorateRow(r, isGM, this._editingId === r.id)),
      archived:      archived.map(r => _decorateRow(r, isGM, false)),
      hasActive:     active.length > 0,
      archivedCount: archived.length,
      showArchived:  this._showArchived,
    };
  }

  /** @override */
  async _onClose(options) {
    _instance = null;
    return super._onClose?.(options);
  }

  // ── Actions ───────────────────────────────────────────────────────────

  static async #useRumour(ev, target) {
    const id = target.dataset.rumourId;
    if (!id) return;
    const ok = window.confirm(game.i18n.localize('GOODSOCIETY.rumourBoard.useConfirm'));
    if (!ok) return;
    await requestUseRumour({ rumourId: id });
  }

  static async #editRumourBegin(ev, target) {
    if (!game.user?.isGM) return;
    this._editingId = target.dataset.rumourId ?? null;
    this.render();
  }

  static async #editRumourCancel() {
    this._editingId = null;
    this.render();
  }

  static async #editRumourSave(ev, target) {
    if (!game.user?.isGM) return;
    const id = target.dataset.rumourId ?? this._editingId;
    if (!id) return;
    const input = this.element?.querySelector(`[data-rb-field="text"][data-rumour-id="${id}"]`);
    const text = (input?.value ?? '').trim();
    if (!text) return;
    await editRumourText(id, text);
    this._editingId = null;
    this.render();
  }

  static async #deleteRumour(ev, target) {
    if (!game.user?.isGM) return;
    const id = target.dataset.rumourId;
    if (!id) return;
    const ok = window.confirm(game.i18n.localize('GOODSOCIETY.rumourBoard.deleteConfirm'));
    if (!ok) return;
    await deleteRumour(id);
  }

  static async #toggleArchived() {
    this._showArchived = !this._showArchived;
    this.render();
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function _decorateRow(r, isGM, isEditing) {
  const stateClass = `gs-rumour-board__row--${r.state}`;
  const stateLabel = game.i18n.localize(`GOODSOCIETY.rumourWizard.state.${r.state}`);
  const canSpend   = r.state === 'spread';   // spending the resolve token
  const canEdit    = isGM && (r.state !== 'used' && r.state !== 'faded');
  return {
    ...r,
    stateClass,
    stateLabel,
    canSpend,
    canEdit,
    isEditing,
    isUnspread:  r.state === 'unspread',
    isSpread:    r.state === 'spread',
    isFading:    r.state === 'fading',
    isFaded:     r.state === 'faded',
    isUsed:      r.state === 'used',
  };
}
