/**
 * upload-image.js — shared drop-and-paste upload for image slots.
 *
 * Foundry's default FilePicker makes the GM: click portrait → wait for
 * modal → navigate folders → pick → set. This helper lets any slot
 * accept a DRAG-AND-DROP file from the desktop or a PASTED image from
 * the clipboard, upload it to the world's `uploads/` subdir, and set
 * the resulting path via a caller-supplied callback.
 *
 * Usage from a sheet's `_onRender`:
 *
 *   bindImageUploadOn({
 *     element: this.element.querySelector('.my-cameo'),
 *     destSubdir: 'portraits',
 *     onUploaded: async (path) => {
 *       await this.actor.update({ 'prototypeToken.texture.src': path });
 *     },
 *   });
 *
 * The caller is responsible for undoing the binding when the sheet
 * closes (bindImageUploadOn returns a cleanup function). AbortController
 * -based re-render guards also work.
 */

const NS = 'good-society-homebrew';
const IMAGE_MIMES = /^image\//i;

/** Resolve the Foundry FilePicker implementation for both v12/v13. */
function _fp() {
  return foundry.applications.apps.FilePicker?.implementation
    ?? globalThis.FilePicker;
}

/** Get the world's upload folder, creating it + the subdir if missing.
 *  Returns the full path, e.g. "worlds/my-world/uploads/portraits". */
async function _ensureUploadDir(subdir = '') {
  const FP = _fp();
  if (!FP) throw new Error('FilePicker unavailable');
  const worldId = game.world?.id;
  if (!worldId) throw new Error('No active world');
  const root  = `worlds/${worldId}/uploads`;
  const full  = subdir ? `${root}/${subdir}` : root;
  // `browse` throws if the dir doesn't exist; `createDirectory` is a
  // no-op if it already does. Both calls are gated on GM permission by
  // Foundry; if a non-GM invokes this, the error surface is the same.
  async function ensure(dir) {
    try { await FP.browse('data', dir); }
    catch { await FP.createDirectory('data', dir, {}); }
  }
  await ensure(root);
  if (subdir) await ensure(full);
  return full;
}

/** Safe filename: strip anything that could escape the dest path. */
function _safeName(name) {
  return (name || 'upload').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

/** Upload a `File` or `Blob` to the world's uploads/{subdir}/.
 *  Returns the resulting path, or null on failure. */
export async function uploadImageFile({ file, destSubdir = '', notify = true }) {
  if (!file) return null;
  if (file.type && !IMAGE_MIMES.test(file.type)) {
    if (notify) ui.notifications?.warn(
      game.i18n.localize('GOODSOCIETY.upload.notAnImage'),
    );
    return null;
  }
  const FP = _fp();
  if (!FP) {
    if (notify) ui.notifications?.error('FilePicker unavailable in this Foundry build.');
    return null;
  }
  try {
    const dir = await _ensureUploadDir(destSubdir);
    const named = file.name
      ? _safeName(file.name)
      : `pasted-${Date.now()}.png`;
    // `new File(...)` wraps a Blob in a File when the clipboard produced
    // a Blob without a filename, so upload() gets consistent input.
    const toUpload = file instanceof File
      ? file
      : new File([file], named, { type: file.type || 'image/png' });
    const result = await FP.upload('data', dir, toUpload, {}, { notify: false });
    if (!result?.path) {
      if (notify) ui.notifications?.error(
        game.i18n.localize('GOODSOCIETY.upload.failed'),
      );
      return null;
    }
    if (notify) ui.notifications?.info(
      game.i18n.format('GOODSOCIETY.upload.done', { name: toUpload.name }),
    );
    return result.path;
  } catch (err) {
    console.error('GS | upload failed:', err);
    if (notify) ui.notifications?.error(
      game.i18n.format('GOODSOCIETY.upload.failedWithReason', {
        reason: err?.message ?? 'unknown',
      }),
    );
    return null;
  }
}

/**
 * Persona-aware actor portrait writer. Mirrors the logic every actor
 * sheet's #pickToken callback uses: if a persona is explicitly active,
 * write to THAT persona's tokenImageUrl; otherwise write to actor.img +
 * prototypeToken.texture.src for a baseline update that survives
 * future persona switches. Shared so the FP picker and the drag-drop
 * uploader stay in sync without duplicating the branching logic.
 */
export async function setActorPortrait(actor, path) {
  if (!actor || !path) return;
  const sys = actor.system ?? {};
  const explicitPersona = sys.activePersonaId
    ? (sys.personas ?? []).find(p => p.id === sys.activePersonaId)
    : null;
  if (explicitPersona) {
    // Normalize the array to plain objects so Foundry's update layer
    // doesn't drop newly-added schema fields on entries whose
    // materialization path differs (CLAUDE.md §16 anti-pattern).
    const toPlain = (p) => (p && typeof p.toObject === 'function') ? p.toObject() : { ...p };
    const updated = (sys.personas ?? []).map(p => {
      if (p.id !== explicitPersona.id) return toPlain(p);
      const plain = toPlain(p);
      plain.tokenImageUrl = path;
      return plain;
    });
    await actor.update({
      'system.personas': updated,
      'prototypeToken.texture.src': path,
    });
  } else {
    await actor.update({
      'img': path,
      'prototypeToken.texture.src': path,
    });
  }
}

/**
 * Wire an element to accept both drag-and-drop file uploads AND pasted
 * clipboard images. Returns a cleanup function that removes the listeners.
 *
 * The element gets `.is-drag-target` toggled during a drag so CSS can
 * draw a highlight. Paste only triggers when the element (or a
 * descendant) is focused — otherwise every Cmd+V on the sheet would try
 * to upload something, which breaks text pasting.
 *
 * @param {object} opts
 * @param {HTMLElement} opts.element      Element to wire (drop target + focus root for paste)
 * @param {string}      [opts.destSubdir] Subfolder under worlds/{id}/uploads/
 * @param {Function}    opts.onUploaded   async (path) => void — called with the uploaded path
 * @returns {Function} cleanup
 */
export function bindImageUploadOn({ element, destSubdir = '', onUploaded }) {
  if (!element || typeof onUploaded !== 'function') return () => {};

  // Make the element focusable so paste works even on non-input nodes.
  if (!element.hasAttribute('tabindex')) element.setAttribute('tabindex', '0');

  const abort = new AbortController();
  const { signal } = abort;

  const onDragEnter = (ev) => {
    if (!ev.dataTransfer?.types?.includes('Files')) return;
    ev.preventDefault();
    element.classList.add('is-drag-target');
  };
  const onDragOver = (ev) => {
    if (!ev.dataTransfer?.types?.includes('Files')) return;
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'copy';
  };
  const onDragLeave = (ev) => {
    // Only clear when leaving the element itself, not an inner child.
    if (ev.target !== element) return;
    element.classList.remove('is-drag-target');
  };
  const onDrop = async (ev) => {
    if (!ev.dataTransfer?.files?.length) return;
    ev.preventDefault();
    element.classList.remove('is-drag-target');
    const file = ev.dataTransfer.files[0];
    const path = await uploadImageFile({ file, destSubdir });
    if (path) await onUploaded(path);
  };
  const onPaste = async (ev) => {
    const items = ev.clipboardData?.items ?? [];
    const imgItem = Array.from(items).find(i => IMAGE_MIMES.test(i.type));
    if (!imgItem) return;  // not an image paste — leave normal handlers alone
    ev.preventDefault();
    const file = imgItem.getAsFile();
    if (!file) return;
    const path = await uploadImageFile({ file, destSubdir });
    if (path) await onUploaded(path);
  };

  element.addEventListener('dragenter', onDragEnter, { signal });
  element.addEventListener('dragover',  onDragOver,  { signal });
  element.addEventListener('dragleave', onDragLeave, { signal });
  element.addEventListener('drop',      onDrop,      { signal });
  element.addEventListener('paste',     onPaste,     { signal });

  return () => abort.abort();
}
