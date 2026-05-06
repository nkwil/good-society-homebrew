# 25 — Backup & Export Utility

**Status:** Locked — full utility specified, file format specified, restore flow specified
**Date opened:** 2026-05-05
**Covers:** Plan §12.7 backup/export robustness feature (new inventory entry)

## Goal

Specify the GM-only utility for exporting the full state of a Good Society world to a single JSON file, plus the matching import flow for restoring from that file. Per Plan §12.7: "Foundry worlds can occasionally corrupt or get accidentally wiped; this is a five-minute feature that saves real grief."

This is robustness, not a feature. Most users will never click export. The ones who do — after a corrupted save, a misclicked delete, an accidental world wipe — will be enormously grateful it exists.

## When and how it opens

Triggered from the GM's settings menu under a "Good Society" section, or from a scene control button in the GM toolbar. A keyboard shortcut isn't needed — backup/export is rare enough that it doesn't earn a keystroke.

The utility opens as a small modal (~420px wide) themed in house style.

## Layout

```
┌──────────────────────────────────────┐
│ [GM]  BACKUP & EXPORT                  │
│ Save a complete archive of this world  │
│ ...                                     │
├──────────────────────────────────────┤
│ ┌──────────────────────────────────┐ │
│ │ export world data ↗      ~2.4 MB │ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │      import from JSON ↗           │ │
│ └──────────────────────────────────┘ │
├──────────────────────────────────────┤
│ last exported · 3 days ago             │
│              7 actors · 23 items · 4 logs│
└──────────────────────────────────────┘
```

CSS class root: `.gs-backup-export`

### Header

- Background: `var(--gs-paper)`.
- Padding: 16px 22px.
- 0.5px bottom border in `var(--gs-accent-2)`.
- GM pill + "BACKUP & EXPORT" eyebrow.
- Below: italic 12px description: "Save a complete archive of this world's actors, items, journals, and settings. Restore from a previous archive if needed."

### Body

Padding: 16px 22px. Two stacked buttons:

- **Export world data** — primary filled button, full width. Right-aligned italic showing the estimated archive size (e.g. "~2.4 MB").
- **Import from JSON** — secondary outline button, full width.

Both buttons are unusually tall (10px vertical padding) and use 13px text — they're consequential actions, not utility buttons, and their visual weight reflects that.

### Footer

- Background: `var(--gs-paper-warm)`.
- 0.5px top border in `var(--gs-accent-2)`.
- Padding: 12px 22px.
- Display: `flex; justify-content: space-between; align-items: center`.
- Left: italic "last exported · {time ago}". If never exported, "no exports yet".
- Right: italic content count summary — "{N} actors · {N} items · {N} logs". Updates live.

The footer's count summary is the at-a-glance "what would actually be exported" preview. Useful when a GM is wondering "is my world set up right" — if the count looks wrong (e.g. only 1 actor when expected 7), they catch the misconfiguration before exporting.

## Export flow

When the GM clicks "export world data ↗":

1. Confirm dialog: "Export the current world state to a JSON file? This may take a moment for large worlds."
2. The system collects:
   - All actors (Major, Connection, NPC, Family) with full data.
   - All items (Reputation Tags, Conditions, Inner Conflicts, Magic/Skills, Backstory Actions) on those actors.
   - All journal entries created by the system (Session Logs, Monologues archive, Letters archive). Foundry-default journal entries the user authored manually are NOT included by default — there's a checkbox in the confirm dialog to "include all journal entries" if desired.
   - All world-scoped settings under the `good-society-homebrew` namespace.
   - Active scenes' tagged region data (NPC placements per scene).
3. Wraps everything in a metadata envelope:
   ```json
   {
     "format": "good-society-homebrew/world-export",
     "version": "1.0.0",
     "exportedAt": 1746449632000,
     "exportedBy": "Opal",
     "world": {
       "id": "swans-crossing",
       "title": "Swan's Crossing"
     },
     "data": {
       "actors": [...],
       "items": [...],
       "journals": [...],
       "settings": {...}
     }
   }
   ```
4. Triggers a browser download for `good-society-{world-id}-{date}.json`.
5. Records the export in user settings (`flags.lastExportTimestamp`) so the footer's "last exported" updates.

For very large worlds (hundreds of actors, dozens of session logs), the export may take 10-20 seconds. A small progress indicator appears under the button while running.

## Import flow

When the GM clicks "import from JSON ↗":

1. File picker opens for the GM to select a `.json` file.
2. The system validates:
   - The file is valid JSON.
   - The format identifier matches `good-society-homebrew/world-export`.
   - The version is compatible (major version match required; minor version differences accepted with a warning).
   - Required keys are present.
3. Confirm dialog with a content summary:
   ```
   Import "good-society-swans-crossing-2026-04-12.json"
   
   This file contains:
   - 7 actors (4 Majors, 2 Connections, 1 Family)
   - 18 items
   - 3 journal entries
   - 12 settings
   
   Import options:
   ⊙ Merge with current world (additive — don't delete existing content)
   ○ Replace current world (delete existing system content first)
   
   [cancel]  [import]
   ```
4. On confirm, the system:
   - If "replace": deletes all existing system-owned actors, items, and journals first.
   - Creates each actor in the file with their full data (including ownership permissions).
   - Creates each item on the appropriate actor.
   - Creates each journal entry in the appropriate folder.
   - Restores world settings.
5. Posts a system chat card confirming: "World imported from {filename}. {N} actors restored."

The "merge" option is the safer default. It allows the GM to import a campaign template into a partially-populated world without nuking their work. The "replace" option is for full restores from backup.

### What import does NOT touch

- Foundry-default actors, items, journals authored manually outside the system.
- User settings (per-user preferences like dock position).
- Anything outside the `good-society-homebrew` namespace.

This means import is safely scoped — it won't clobber a GM's other content.

## Edge cases

### Import file from a future version
If the file's `version` is newer than the current system version, the import refuses with: "This archive was created with a newer version of the system ({fileVersion}). Update the system or use an older archive."

### Import file from a much older version
If the file's `version` is significantly older (e.g. major version mismatch), the import refuses with: "This archive was created with an older system version ({fileVersion}) that's no longer compatible. Some data may need manual migration."

For minor version mismatches (e.g. 1.0 file, 1.2 system), the import proceeds with a warning: "This archive is from system v1.0; current system is v1.2. Some newer fields will be initialized to defaults."

### Browser doesn't support file download
Foundry runs in browsers that all support `Blob` and `URL.createObjectURL`. This shouldn't happen in practice; if it does, fall back to displaying the JSON in a textarea for manual copy.

### Export interrupted (user closes the window mid-export)
The download either completes (if it was already streamed) or fails (if the user closed before the blob finished). No corrupted file because the JSON is generated as a single string and written atomically.

### Import partially fails (some actors fail validation)
Show a partial-success dialog: "Imported X of N actors. {failure count} actors failed to import. See console for details." The GM can investigate individual failures.

### Sensitive content in the export
The JSON is plain text — anyone with the file can read every actor's secret desires, GM notes, hidden personas. The confirm dialog includes a small italic note: "This file contains the full world state including secret fields. Store it securely."

## Theme behavior

Pure house style. Backup/Export is system-level and never themed.

## Implementation notes for Claude Code

When prompted to build:

1. Build the `BackupExport` `ApplicationV2` modal. Open from settings menu and scene control button.
2. Build the export collector (`module/helpers/world-export.js`). Iterates Foundry collections filtered to system-owned content. Returns the wrapped JSON string.
3. Build the export trigger. Generates blob, creates download link, clicks it programmatically.
4. Build the import validator. Parses file, checks format and version, returns content summary.
5. Build the import applier. Creates documents in the right order (Family before Majors that reference it; actors before items on those actors).
6. Wire the "last exported" timestamp to update on successful export.

CSS organization:
- `styles/apps/_backup-export.css` — small modal styling

### Test path

1. As GM, open the Backup & Export modal. Verify content count shows correctly.
2. Click "export world data". Confirm. Verify a JSON file downloads.
3. Open the file in a text editor. Verify the structure matches the metadata envelope spec.
4. Delete an actor. Click "import from JSON". Pick the exported file. Choose "merge". Verify the deleted actor is restored.
5. Make changes. Click "import from JSON". Choose "replace". Verify the world reverts to the export state.
6. Try importing a tampered file (modify the version field). Verify the validation rejects it.

If 1–6 pass, the backup/export utility is production-ready.

## Open questions

1. **Should there be auto-export on a schedule?** Once a week, save a backup automatically. **Tentative answer: defer to v1.1.** Browser-based scheduled tasks are unreliable in Foundry's iframe context.

2. **Should compendium content (Sample World) be excluded from export by default?** It's already in the system's bundled compendium — re-exporting it is redundant. **Tentative answer: yes, exclude by default with an "include compendium content" checkbox in the confirm dialog.**

3. **Should there be a partial-export option (e.g. only Majors, only Session Logs)?** **Tentative answer: defer to v1.1.** Full export is the safer default.

4. **Should the file be encrypted or password-protected?** **Tentative answer: no.** Standard JSON is simpler and more durable. The "store securely" warning in the confirm is the current safeguard.

## Visual proof

The Backup/Export modal is rendered above (`good_society_final_three_designs`, top section) showing the GM-only utility with both Export and Import buttons, the content count footer, and the last-exported timestamp.

## Changelog

| Date       | Change                                                                |
|------------|-----------------------------------------------------------------------|
| 2026-05-05 | File created. Export and import flows specified. File format envelope specified. Edge cases documented including version mismatches and partial failures. Visual proof rendered. |
