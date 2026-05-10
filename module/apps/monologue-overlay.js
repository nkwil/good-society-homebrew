/**
 * Monologue scene-freeze overlay — post-MVP §12.2 / patch-token-events §4.
 *
 * Frameless full-viewport ApplicationV2 — the **fourth world-identity surface**
 * (alongside Arrival, pause overlay, and future cycle-end transition). Renders
 * synchronously on every connected client when a monologue is triggered, via
 * the system socket.
 *
 * Singleton — only one overlay can be open globally at a time. The `gs.monologueStart`
 * socket message carries `{ spenderActorId, targetActorId, question, byUserId }`;
 * the overlay's per-user view is computed from those + the local user's id.
 *
 * Submit / cancel / live-textarea-sync go back through the socket so every
 * client agrees on the body text + final state. The target's client (or GM
 * fallback) is the canonical writer.
 *
 * Activation gate: `monologueOverlayEnabled` client setting + `gs-world-identity`
 * body class. When either is off, the helper falls back to the chat-card-only
 * "Light tier" path (no overlay; same actor updates + chat card post).
 */

import { profilePic, profileName } from '../helpers/profile-pic.js';
import { postMonologueCard } from '../helpers/chat-cards.js';
import { themedWrap } from '../helpers/themed-wrap.js';
import { monologueFolder, entryFlags } from '../helpers/journal-folders.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

let _instance = null;
let _activeState = null;     // { spenderActorId, targetActorId, question, byUserId, body }
let _liveSyncTimer = null;   // debounce for textarea typing → socket emit

const SOCKET_NAME = 'system.good-society-homebrew';
const TEMPLATE = 'systems/good-society-homebrew/templates/apps/monologue-overlay.hbs';

export class MonologueOverlayApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'gs-monologue-overlay',
    classes: ['good-society', 'gs-monologue-overlay', 'gs-world-identity'],
    window: { frame: false, positioned: false, title: '' },
    position: { width: '100vw', height: '100vh' },
    actions: {
      submitMonologue: MonologueOverlayApp.#submitMonologue,
      cancelMonologue: MonologueOverlayApp.#cancelMonologue,
    },
  };

  static PARTS = {
    main: { template: TEMPLATE },
  };

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    const state = _activeState ?? {};
    const spender = state.spenderActorId ? game.actors?.get(state.spenderActorId) : null;
    const target  = state.targetActorId  ? game.actors?.get(state.targetActorId)  : null;

    const localUserId = game.user?.id;
    const isTarget = target?.testUserPermission?.(game.user, 'OWNER') ?? false;
    const isSpender = !isTarget && state.byUserId === localUserId;
    const isGM = !!game.user?.isGM;
    // Target offline / no local owner / not GM → role is "audience" (read-only).
    const role = isTarget ? 'target' : isSpender ? 'spender' : isGM ? 'gm' : 'audience';

    ctx.eyebrow      = game.i18n.localize('GOODSOCIETY.tokenEvents.monologue.eyebrow');
    ctx.targetName   = profileName(target);
    ctx.targetRole   = target?.system?.bio?.archetype
      ? game.i18n.localize(`GOODSOCIETY.major.archetype.${target.system.bio.archetype}`)
      : '';
    ctx.targetPortraitUrl = profilePic(target);
    ctx.targetInitial = (ctx.targetName?.[0] ?? '?').toUpperCase();
    ctx.spenderName  = profileName(spender);
    ctx.question     = state.question || '';
    ctx.body         = state.body ?? '';
    ctx.role         = role;
    ctx.isTarget     = role === 'target';
    ctx.isGM         = role === 'gm';
    ctx.audienceLine = role === 'spender'
      ? game.i18n.format('GOODSOCIETY.tokenEvents.monologue.spenderWatching', { target: ctx.targetName })
      : role === 'audience'
      ? game.i18n.format('GOODSOCIETY.tokenEvents.monologue.audienceWatching', {
          spender: ctx.spenderName,
          target:  ctx.targetName,
        })
      : '';
    return ctx;
  }

  /** Wire textarea live-sync via socket. */
  _onRender(ctx, options) {
    super._onRender?.(ctx, options);
    const ta = this.element?.querySelector('textarea[name="monologueBody"]');
    if (!ta) return;
    if (ta._gsBound) return;
    ta._gsBound = true;
    ta.addEventListener('input', () => {
      if (_liveSyncTimer) clearTimeout(_liveSyncTimer);
      _liveSyncTimer = setTimeout(() => {
        const text = ta.value;
        if (_activeState) _activeState.body = text;
        game.socket?.emit(SOCKET_NAME, {
          action: 'monologueLiveSync',
          body: text,
        });
      }, 250);
    });
  }

  // ── Action handlers ──────────────────────────────────────────────────────

  static async #submitMonologue() {
    if (!_activeState) return;
    const ta = this.element?.querySelector('textarea[name="monologueBody"]');
    const body = (ta?.value ?? _activeState.body ?? '').trim();
    if (!body) {
      ui.notifications?.warn(game.i18n.localize('GOODSOCIETY.monologueEditor.emptyWarning'));
      return;
    }
    // Persist via the canonical writer (target client, GM fallback).
    await _persistMonologueComplete({ ..._activeState, body, cancelled: false });
  }

  static async #cancelMonologue() {
    if (!_activeState) return;
    if (!game.user?.isGM) return; // only GM can cancel
    await _persistMonologueComplete({ ..._activeState, cancelled: true });
  }
}

/** Resolve the singleton, creating if needed. */
function _instanceApp() {
  if (!_instance) _instance = new MonologueOverlayApp();
  return _instance;
}

/**
 * Show the overlay locally in response to a `monologueStart` socket event.
 * Clamped to a single open instance — subsequent starts are rejected upstream.
 */
async function _showOverlay(state) {
  // Honor the `monologueOverlayEnabled` client setting; if off, the local
  // user gets no overlay even though others may.
  let enabled = true;
  try { enabled = game.settings.get('good-society-homebrew', 'monologueOverlayEnabled'); } catch {}
  if (!enabled) return;
  // Honor the `gs-world-identity` body class — overlay is part of that surface family.
  if (!document.body.classList.contains('gs-world-identity')) {
    console.warn('GS | monologue overlay: gs-world-identity disabled, falling back to chat-card-only flow');
    return;
  }

  _activeState = { body: '', ...state };
  const app = _instanceApp();
  if (app.rendered) {
    await app.render({ parts: ['main'] });
  } else {
    await app.render(true);
  }
}

/** Hide the overlay locally. */
async function _hideOverlay() {
  if (_instance?.rendered) await _instance.close();
  _activeState = null;
}

/**
 * Canonical writer for the submit + cancel flows. Runs on the target's
 * client (preferred) or the GM client (fallback). Other clients see the
 * end-state via the socket re-broadcast.
 */
async function _persistMonologueComplete({ spenderActorId, targetActorId, question, body, cancelled }) {
  const target = game.actors?.get(targetActorId);
  const spender = game.actors?.get(spenderActorId);
  const isTarget = target?.testUserPermission?.(game.user, 'OWNER') ?? false;
  const isGM = !!game.user?.isGM;
  if (!isTarget && !isGM) {
    // Not authorized — request the GM client to commit.
    game.socket?.emit(SOCKET_NAME, {
      action: 'monologueCommitRequest',
      payload: { spenderActorId, targetActorId, question, body, cancelled, requestedBy: game.user.id },
    });
    return;
  }

  if (cancelled) {
    // Refund the MT — no actor updates needed beyond clearing the overlay.
  } else {
    // Atomic actor updates: spender's MT spent, target's monologued flag set.
    if (spender) await spender.update({ 'system.tokens.major': false });
    if (target)  await target.update({ 'system.tokens.monologuedThisCycle': true });

    // Post the heavier monologue chat card.
    try {
      await postMonologueCard({
        actor: target ?? spender,
        monologueText: body,
        whisper: false,
      });
    } catch (err) {
      console.warn('GS | monologue chat card post failed (non-fatal):', err);
    }

    // Optional journal archive.
    let archive = true;
    try { archive = game.settings.get('good-society-homebrew', 'archiveMonologuesToJournal'); } catch {}
    if (archive && target) {
      try {
        let cycleNumber = 1;
        try { cycleNumber = game.settings.get('good-society-homebrew', 'cycleNumber'); } catch {}
        const folder = await monologueFolder(cycleNumber);
        const html = themedWrap(target, `
          <div class="gs-card gs-monologue-archive">
            <div class="gs-section-header">
              ${target.name} — ${game.i18n.localize('GOODSOCIETY.monologueEditor.title')}
            </div>
            <div class="gs-monologue-archive__body"><p>${body.replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>')}</p></div>
          </div>
        `, ['gs-monologue-archive-wrap']);

        await JournalEntry.create({
          name: `${target.name} — Cycle ${cycleNumber} Monologue`,
          ...(folder ? { folder: folder.id } : {}),
          ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS?.OBSERVER ?? 2 },
          flags: entryFlags({ entryType: 'monologue', cycleNumber, speakerActorId: target.id }),
          pages: [{
            name: game.i18n.localize('GOODSOCIETY.monologueEditor.pageName') || 'Monologue',
            type: 'text',
            text: { content: html, format: CONST.JOURNAL_ENTRY_PAGE_FORMATS?.HTML ?? 1 },
          }],
        });
      } catch (err) {
        console.warn('GS | monologue archive failed (non-fatal):', err);
      }
    }

    Hooks.callAll('goodSociety.monologuePosted', {
      actorId:   target?.id ?? null,
      actorName: target?.name ?? '',
      speakerName: profileName(target),
      content:   body,
    });
  }

  // Broadcast end state — every client closes the overlay.
  game.socket?.emit(SOCKET_NAME, {
    action: 'monologueEnd',
    payload: { spenderActorId, targetActorId, question, cancelled },
  });
  // Local close.
  await _hideOverlay();
}

/**
 * Public API — open the spend modal (target picker + question), validate,
 * and emit the start socket. Caller is the spender's client.
 */
export async function openMonologueTrigger(spender) {
  if (!spender) return;
  if (!spender.system?.tokens?.major) {
    ui.notifications?.warn(game.i18n.localize('GOODSOCIETY.monologueEditor.alreadySpent'));
    return;
  }

  // Singleton — reject if another monologue is in flight on this client.
  // (Cross-client race: another spender may have just emitted; the socket
  // acceptance below is idempotent — the second monologue start is dropped
  // when one is already active.)
  if (_activeState) {
    ui.notifications?.warn(game.i18n.localize('GOODSOCIETY.tokenEvents.monologue.alreadyInProgress'));
    return;
  }

  const eligibleTargets = (game.actors?.filter(
    a => a.type === 'major-character'
      && a.id !== spender.id
      && !a.system?.tokens?.monologuedThisCycle,
  ) ?? []).map(a => ({ id: a.id, label: profileName(a) }));

  if (!eligibleTargets.length) {
    ui.notifications?.info(game.i18n.localize('GOODSOCIETY.tokenEvents.monologue.alreadyInProgress'));
    return;
  }

  // Build a DialogV2 picker.
  const DialogV2 = foundry.applications.api.DialogV2;
  const html = `
    <div class="gs-monologue-trigger">
      <div class="gs-form-row">
        <label>${game.i18n.localize('GOODSOCIETY.tokenEvents.monologue.targetLabel')}</label>
        <select name="targetId">
          ${eligibleTargets.map(t => `<option value="${t.id}">${t.label}</option>`).join('')}
        </select>
      </div>
      <div class="gs-form-row">
        <label>${game.i18n.localize('GOODSOCIETY.tokenEvents.monologue.questionLabel')}</label>
        <input type="text" name="question" maxlength="160"
               placeholder="${game.i18n.localize('GOODSOCIETY.tokenEvents.monologue.questionPlaceholder')}" />
      </div>
    </div>
  `;

  const result = await DialogV2.prompt({
    window: { title: game.i18n.localize('GOODSOCIETY.tokenEvents.monologue.modalTitle') },
    content: html,
    ok: {
      label: game.i18n.localize('GOODSOCIETY.tokenEvents.monologue.trigger'),
      callback: (event, button, dialog) => {
        const form = dialog.element?.querySelector('form, .gs-monologue-trigger') ?? dialog.element;
        return {
          targetId: form.querySelector('[name="targetId"]')?.value ?? '',
          question: form.querySelector('[name="question"]')?.value?.trim() ?? '',
        };
      },
    },
    rejectClose: false,
  });

  if (!result?.targetId) return;

  // Emit the start socket to every connected client.
  const startState = {
    spenderActorId: spender.id,
    targetActorId:  result.targetId,
    question:       result.question,
    byUserId:       game.user.id,
  };
  game.socket?.emit(SOCKET_NAME, {
    action: 'monologueStart',
    payload: startState,
  });
  await _showOverlay(startState);
}

/** Register socket listeners. Called from good-society.js ready hook. */
export function registerMonologueSocket() {
  game.socket?.on(SOCKET_NAME, async (msg) => {
    if (!msg) return;
    switch (msg.action) {
      case 'monologueStart':
        if (_activeState) {
          // Reject — another monologue is open. The originating client's
          // _showOverlay call guards similarly; this catches cross-client
          // races where two starts collide.
          return;
        }
        await _showOverlay(msg.payload);
        break;
      case 'monologueLiveSync':
        if (!_activeState) return;
        _activeState.body = msg.body ?? '';
        // Update the textarea on read-only views; target's textarea has its
        // own input handler and shouldn't get clobbered.
        const ta = _instance?.element?.querySelector('textarea[name="monologueBody"]');
        if (ta && ta.readOnly) ta.value = _activeState.body;
        // Read-only display element used by audience/spender views.
        const ro = _instance?.element?.querySelector('.gs-monologue-overlay__readonly-body');
        if (ro) ro.textContent = _activeState.body;
        break;
      case 'monologueCommitRequest':
        // GM client picks up the canonical write when a non-target user submitted.
        if (game.user?.isGM) {
          await _persistMonologueComplete(msg.payload);
        }
        break;
      case 'monologueEnd':
        await _hideOverlay();
        break;
    }
  });
}
