/**
 * edit-field-dialog.js — shared rich-text field editor.
 *
 * Foundry v13's `{{editor}}` Handlebars helper does NOT reliably open an
 * editor inside ApplicationV2 sheets (the auto edit-anchor never dispatches).
 * Every Good Society sheet that needs an editable HTML field instead renders
 * the field read-only (enriched) with a ✎ button that calls `openFieldEditor`.
 *
 * The editor itself is a DialogV2 hosting a format-button toolbar + a plain
 * `<textarea>`. ProseMirror-in-DialogV2 was tried repeatedly and abandoned —
 * the custom element wouldn't mount, and the programmatic path couldn't read
 * its content back. The textarea path is bulletproof: typed content lives in
 * `textarea.value`, Save returns it directly, no async lifecycle to fail.
 * The toolbar buttons wrap the selection in HTML tags so users rarely type
 * markup by hand.
 *
 * Worked example of the read-only render: see any item sheet's
 * `_prepareContext` enrich step + the template's `.gs-field-editblock`.
 */

/**
 * Open the rich-text editor for one HTML field on a document.
 *
 * @param {object}   opts
 * @param {Document} opts.document   The Actor or Item to update.
 * @param {string}   opts.field      System field path relative to `system`
 *                                   (e.g. 'description', 'bio.notes').
 * @param {string}   opts.label      Dialog-title label for the field.
 * @returns {Promise<void>}
 */
export async function openFieldEditor({ document: doc, field, label }) {
  if (!doc || !field) return;

  const current = foundry.utils.getProperty(doc.system ?? {}, field) ?? '';

  // Wire the format buttons once the dialog DOM is live. `mousedown`
  // (not click) preserves the textarea selection so we know what to wrap.
  Hooks.once('renderDialogV2', (app) => {
    const root = app.element;
    if (!root) return;
    const textarea = root.querySelector('textarea[name="content"]');
    if (!textarea) return;

    const wrapSelection = (open, close) => {
      const start = textarea.selectionStart;
      const end   = textarea.selectionEnd;
      const before = textarea.value.slice(0, start);
      const sel    = textarea.value.slice(start, end);
      const after  = textarea.value.slice(end);
      textarea.value = before + open + sel + close + after;
      textarea.setSelectionRange(start + open.length, start + open.length + sel.length);
      textarea.focus();
    };

    const wrapAsList = (tag) => {
      const start = textarea.selectionStart;
      const end   = textarea.selectionEnd;
      const sel   = textarea.value.slice(start, end);
      let listInner;
      if (sel.trim()) {
        const items = sel.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        listInner = items.map(it => `  <li>${it}</li>`).join('\n');
      } else {
        listInner = '  <li>First item</li>\n  <li>Second item</li>\n  <li>Third item</li>';
      }
      const block  = `\n<${tag}>\n${listInner}\n</${tag}>\n`;
      const before = textarea.value.slice(0, start);
      const after  = textarea.value.slice(end);
      textarea.value = before + block + after;
      const newPos = (before + block).length;
      textarea.setSelectionRange(newPos, newPos);
      textarea.focus();
    };

    const cmds = {
      bold:      () => wrapSelection('<strong>', '</strong>'),
      italic:    () => wrapSelection('<em>', '</em>'),
      underline: () => wrapSelection('<u>', '</u>'),
      heading:   () => wrapSelection('<h2>', '</h2>'),
      para:      () => wrapSelection('<p>', '</p>'),
      bullet:    () => wrapAsList('ul'),
      ordered:   () => wrapAsList('ol'),
      link:      () => {
        const url = window.prompt('Link URL:', 'https://');
        if (!url) return;
        wrapSelection(`<a href="${url}">`, '</a>');
      },
    };

    root.querySelectorAll('.gs-prose-toolbar [data-cmd]').forEach((btn) => {
      btn.addEventListener('mousedown', (ev) => {
        ev.preventDefault();
        const c = btn.dataset.cmd;
        try { cmds[c]?.(); } catch (e) { console.warn('[GS] format cmd failed:', c, e); }
      });
    });
  });

  const escapedCurrent = foundry.utils.escapeHTML(current);
  const dialogHtml = `
    <div class="gs-prose-toolbar" role="toolbar" aria-label="Formatting">
      <button type="button" data-cmd="bold"      title="Bold"          aria-label="Bold"><strong>B</strong></button>
      <button type="button" data-cmd="italic"    title="Italic"        aria-label="Italic"><em>I</em></button>
      <button type="button" data-cmd="underline" title="Underline"     aria-label="Underline"><u>U</u></button>
      <span class="gs-prose-toolbar__sep" aria-hidden="true"></span>
      <button type="button" data-cmd="heading"   title="Heading"       aria-label="Heading">H</button>
      <button type="button" data-cmd="para"      title="Paragraph"     aria-label="Paragraph">¶</button>
      <button type="button" data-cmd="bullet"    title="Bullet list"   aria-label="Bullet list">•</button>
      <button type="button" data-cmd="ordered"   title="Numbered list" aria-label="Numbered list">1.</button>
      <span class="gs-prose-toolbar__sep" aria-hidden="true"></span>
      <button type="button" data-cmd="link"      title="Insert link"   aria-label="Insert link">🔗</button>
    </div>
    <textarea name="content" class="gs-prose-textarea" rows="14"
              style="width:100%;min-height:320px;flex:1;font-family:var(--gs-body, Georgia, serif);font-size:14px;line-height:1.55;padding:12px;box-sizing:border-box;background:var(--gs-paper);color:var(--gs-ink);border:0;border-top:0.5px solid color-mix(in srgb, var(--gs-ink) 18%, transparent);outline:none;resize:vertical;">${escapedCurrent}</textarea>
  `;

  const newValue = await foundry.applications.api.DialogV2.wait({
    window: { title: `Edit — ${label}` },
    position: { width: 720, height: 560 },
    classes: ['gs-prose-dialog'],
    content: dialogHtml,
    buttons: [{
      action: 'save',
      label: 'Save',
      default: true,
      callback: (event, button, dialog) => {
        // Read straight from the textarea. If it's somehow gone, return
        // `current` (a no-op) rather than '' — never silently wipe.
        const ta = dialog.element?.querySelector?.('textarea[name="content"]');
        return ta ? ta.value : current;
      },
    }],
    rejectClose: false,
  });

  if (newValue === null || newValue === undefined) return;
  await doc.update({ [`system.${field}`]: newValue });
}
