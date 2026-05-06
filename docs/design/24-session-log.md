# 24 — Session Log Auto-Generator

**Status:** Locked — full event-tracking spec, generation flow, output format, and journal placement specified
**Date opened:** 2026-05-05
**Covers inventory entry:** new entry to be added — referenced in Plan §12.2 but not in original 59-entry inventory

## Goal

Specify the GM-only feature that compiles a markdown summary of everything mechanical that happened during a session — cycle phase changes, monologues taken (with full text), reputation changes, conditions added/cleared, inner conflicts resolved, persona swaps, magic cast, letters sent — and saves it as a dated journal entry in a "Session Logs" folder.

Per Plan §12.2: "Excellent for absent players catching up and for end-of-campaign retrospectives." It's the mechanical record that complements players' personal note-taking. Together they form a complete session archive.

## When and how it triggers

The GM clicks "End Session" from one of two places:

- **Scene control button** in the GM's left sidebar (per the same pattern as the dashboard and bulk permissions panel) — a small "end session" action grouped with other GM tools.
- **Cycle Phase HUD strip** — when the cycle phase reaches Upkeep, the HUD's GM area shows a small secondary action: "[end session ↗]" as a follow-up to "advance phase". Optional but convenient.

The action opens the **Session Log preview modal** (described below) showing the auto-generated content. The GM reviews, edits if desired, and saves to a journal entry. The session continues to be playable after the log is saved — "End Session" doesn't actually end the world, just closes the chapter for record-keeping purposes.

## Event tracking approach

The system maintains a running event log throughout the session in a world flag: `flags["good-society-homebrew"].sessionEvents`.

Events are appended as they happen. Each event is a structured record:

```js
{
  type: "monologue" | "phaseChange" | "tagAdded" | "conditionAdded" | "conflictResolved" | "personaSwap" | "magicCast" | "letterSent" | ...,
  timestamp: 1746449632000,
  actorId: "...",         // optional, depending on event type
  details: { ... }         // event-specific fields
}
```

Hooks register on each meaningful event:

- `goodSociety.cyclePhaseChanged` → emit `phaseChange` event.
- `goodSociety.monologuePosted` → emit `monologue` event with full text.
- `goodSociety.tagAdded` / `goodSociety.tagRemoved` → emit `tagAdded` / `tagRemoved`.
- `goodSociety.conditionApplied` → emit `conditionAdded`.
- `goodSociety.conflictCompleted` → emit `conflictResolved`.
- `goodSociety.personaSwitched` → emit `personaSwap`.
- `goodSociety.magicCast` → emit `magicCast`.
- `goodSociety.letterSent` → emit `letterSent`.

The events accumulate from "session start" to "End Session click." The session boundary is defined by:

- **Session start**: the moment the world first goes from "no users connected" to "1+ users connected" in a play day, OR the moment after the last "End Session" was clicked.
- **Session end**: when the GM clicks "End Session."

The `sessionEvents` array is cleared when "End Session" → "save log" completes, ready for the next session.

### Why a flag and not an in-memory log

The flag persists across page reloads. If the GM accidentally refreshes mid-session, the log isn't lost. If the GM crashes and reconnects, the log resumes where it left off.

### Memory cost

A typical session generates roughly 30-50 events. Each event is small (~200 bytes). Total flag storage: <10KB per session. Negligible.

For long campaigns, after each session log is saved, the events array is cleared. Historical sessions live in their respective journal entries, not in actor flags.

## Generation flow

When the GM clicks "End Session":

1. The system reads `flags.sessionEvents`.
2. Groups events by category (Cycle Phase, Monologues, Reputation, Inner Conflicts, Personas, Magic, Letters).
3. Sorts within each category chronologically.
4. Generates a markdown document with a structured header and section-per-category body.
5. Opens the **Session Log preview modal** (see below).

The preview is auto-generated *without* the GM needing to do anything mid-session — the log materializes with full content on first open.

## Session Log preview modal

CSS class root: `.gs-session-log-preview`

Width: 580px. Height: auto with `max-height: 80vh` and internal scroll on the body.

### Layout

```
┌──────────────────────────────────────────────┐
│ [GM] SESSION LOG · preview      auto-generated│ ← header
│ Session 4 · May 5, 2026                        │
│ Cycle 3 · 7 scenes captured · 5 players       │
├──────────────────────────────────────────────┤
│                                                │
│ CYCLE PHASE                                    │ ← body sections
│ · Pre-cycle → Novel (8:14 PM)                  │
│ · Novel → Reputation (10:32 PM)                │
│                                                │
│ MONOLOGUES · 2                                 │
│ Lady Rose Willowood    cycle 3 · 9:42 PM      │
│ │ The lilacs in the south garden are blooming│
│ │ earlier than expected this year...          │
│                                                │
│ ... (more sections)                            │
│                                                │
├──────────────────────────────────────────────┤
│ [edit before saving]   → Session Logs / 2026 / Session 4 │
│                                  [cancel] [save log ↗] │
└──────────────────────────────────────────────┘
```

### Header

- Background: `var(--gs-paper)`.
- Padding: 18px 26px.
- 0.5px bottom border in `var(--gs-accent-2)`.
- Top row: GM pill + "SESSION LOG · preview" eyebrow on the left, italic "auto-generated" badge on the right.
- Title row: "Session {N} · {date}" in display type Lora, 22px, color `var(--gs-brand)`. The date is formatted as "May 5, 2026" (locale-aware).
- Subtitle row: italic 12px metadata showing cycle number, scene count, player count.

### Body

- Background: `var(--gs-paper-warm)` (slight visual lift to distinguish the rendered content from the chrome).
- Padding: 20px 28px.
- `max-height: 380px; overflow-y: auto`.

The body is the **rendered preview** of the generated markdown — not editable text but a styled presentation. Each section has:

- A small-caps section header with optional count ("MONOLOGUES · 2").
- A 0.5px hairline rule below the header.
- Section content in body-prose style.

Cross-theme rendering applies to character names: Lady Rose's name renders in her Cormorant + pink-wine; Avril's in Didot + candlelight gold. Same `.gs-themed[data-theme="..."]` wrapper pattern as everywhere else.

### Section-by-section content

#### Cycle Phase

Bullet list (unicode "·" prefix), one per phase change. Format: "{previous phase} → {new phase} ({timestamp})". The "→" arrow uses the actual unicode character.

#### Monologues

Each monologue rendered as a small block:
- Top row: speaker name in their display type and brand color, on the left; italic timestamp on the right.
- Body: indented blockquote (`border-left: 2px solid var(--gs-accent-3); padding-left: 12px;`) with the monologue text in italic body type, 12px.

The blockquote indent and accent stripe gives monologues their proper weight in the log. They're the most narratively-significant events in any session.

#### Reputation

Bullet list, one per change. Format:
- Tag added: `{actor name} gained ▲/▼ {tag} ({source context})`.
- Tag removed: `{actor name} lost ▲/▼ {tag} ({source context})`.
- Condition added: highlighted line with `★` prefix and italic emphasis: "★ {actor name}: Reputation Condition '{condition name}' added ({polarity count})".

Actor names use cross-theme rendering. Polarity arrows are colored (`var(--gs-positive)` for ▲, `var(--gs-danger)` for ▼).

#### Inner Conflicts

Two-line format per resolution:
- Top: `★ {actor name} resolved {left} vs. {right} on the side of {chosen}` — the `★` is in `var(--gs-accent-3)` (honey-gold), the rest is body text. The conflict labels render in display type for emphasis.
- Below (indented): "→ earned an Expanded Backstory Action" in italic 11px, `var(--gs-accent-2)` (sage).

#### Personas

Bullet list. Format: "{actor name} switched to {persona name} ({timestamp})". Empty section omitted entirely.

#### Magic

Bullet list. Format: "{actor name} cast {skill name} ({timestamp} · {public/secret})". The visibility note distinguishes public casts (everyone saw) from GM-whispered casts (only GM and the caster saw). Empty section omitted.

#### Letters

Bullet list. Format: "{sender} → {recipient(s)} · '{subject}' (sealed in {wax color})". Multi-recipient letters show "{N} recipients" instead of listing.

### Sections that don't appear

Sections with no events for the session simply don't render. A typical session might generate Cycle Phase + Monologues + Reputation, with no Magic or Personas — the log shows just the populated sections.

If *all* sections are empty (the session had no mechanical events — extremely rare), the body shows: "No mechanical events this session. Did you mean to track this as a planning session?" with a "save anyway" option.

### Footer

- Background: `var(--gs-paper)`.
- 0.5px top border in `var(--gs-accent-2)`.
- Padding: 14px 26px.
- Display: `flex; justify-content: space-between; align-items: center`.

Left cluster:
- **edit before saving** button — secondary outline, opens an editor panel (see below).
- Italic 10px destination preview: "→ Session Logs / 2026 / Session 4" — shows where the log will be saved.

Right cluster:
- **cancel** secondary outline.
- **save log ↗** primary filled.

## Edit before saving

When the GM clicks "edit before saving," the body switches from rendered preview to a markdown editor (Foundry's HTML editor with markdown extension, or a textarea with minimal styling).

The editor pre-populates with the generated markdown source. The GM can:
- Add a "Session Notes" section at the top with their own commentary.
- Remove or rephrase any auto-generated section.
- Add player-attributed quotes that aren't in the system's event log (the log captures only system-emitted events; out-of-character commentary or in-character spoken lines aren't tracked).
- Reorder sections.

A "back to preview" button reverts to the rendered view. Saving from either view persists the markdown.

The footer shows "{N} edits" if the GM modified the auto-generated content. The journal entry stores the final markdown as authored.

## Journal entry placement

The save action creates a journal entry with:

- **Folder structure**: "Session Logs" → "{year}" → "Session {N}"
- **Title**: "Session {N} — {date}"
- **Content**: the markdown (rendered to HTML for the journal viewer).
- **Permissions**: visible to all players by default. The GM can change this post-save via the journal entry's permissions UI.

If the "Session Logs" folder doesn't exist, it's created on first save. If the year sub-folder doesn't exist, same.

The session number is auto-incremented based on existing logs in the current year's folder. New campaign in a new year resets the counter to 1.

### Why this folder structure

Year-based grouping keeps long campaigns navigable. A 30-session campaign over two years has two top-level groups instead of one flat list of 30 entries.

Players catching up on missed sessions can browse "Session Logs / 2026" and find Session 4 quickly without scrolling through dozens of entries.

## Theme behavior

Modal chrome is **house-styled**. Cross-theme rendering applies only to actor names within the body — same hybrid pattern used in the dashboard, dock, and other communal surfaces.

The saved journal entry preserves the theme references (via embedded HTML with `.gs-themed` wrappers if Foundry's journal viewer renders them; otherwise the markdown source preserves them as inline span tags or plain text).

## Edge cases

### "End Session" clicked twice in same session
The second click reads the events array and finds it cleared (from the first save). The modal opens with "No events tracked since last log saved" — option to save a blank "session continued" placeholder or cancel.

### GM has events but doesn't want a log
The "cancel" button discards the modal without saving. Events stay in the flag; "End Session" can be clicked again later. Or, the GM can manually clear via a console command.

### Session spans multiple play sessions (e.g. weekly group plays for 2 weeks)
The GM can choose to either save logs at the end of each play day, or accumulate events across multiple days and save one combined log. The system doesn't auto-segment — the GM controls when sessions begin and end.

### Mid-session events get lost (e.g. server crash before save)
Because events are stored in a world flag (not in-memory), they survive restarts. After reconnect, the log can be generated and saved as if the crash never happened.

### Events from a single actor across multiple sessions
Each session's events stay scoped to that session's flag. A monologue Avril gave in Session 3 doesn't appear in Session 4's log; it lives in Session 3's journal entry.

### Player joins mid-session
Their events from when they connected onward appear in the log. Pre-connection events are unaffected (they happened before the player was present, which is the truthful record).

### Letters sent in Epistolary phase
Each letter generates a `letterSent` event. The Letters section renders the sender, recipient, subject, and wax color. Full body text is in the original chat card; the log links to the chat message via Foundry's standard linkage if the journal viewer supports it.

### Persona swaps with secret visibility
If a persona swap was whispered (only GM saw), should it appear in the log visible to all players? **Tentative answer: no.** Whispered events are filtered out of the public log. The GM gets a private addendum in their own session-end view that includes the secret events. (Defer the private-addendum implementation to v1.1; for v1, whispered events are simply omitted from the saved log.)

### Reputation conditions cleared mid-session
Events for both adding and clearing conditions are tracked. The Reputation section shows "★ {actor} cleared condition '{name}'" with an italic dimmer treatment.

### Inner conflict reset (rare GM action)
If a GM resets a conflict mid-session via the GM-only reopen action (per `12-item-sheets.md`), the log notes this: "GM reopened {actor's} {conflict name}". Italic, smaller, in muted color. Surfaces the meta-action without dramatizing it.

## Accessibility considerations

- The preview is keyboard-navigable — sections are headed with semantic h2/h3 elements.
- The "edit" mode opens an editor with full keyboard support (standard textarea behaviors).
- Actor names in the body have `aria-label` attributes that include the role/title for screen readers.
- The save action's destination ("→ Session Logs / 2026 / Session 4") is read aloud so screen reader users know where the log will be filed.

## Implementation notes for Claude Code

When prompted to build the session log feature, the recommended order:

1. Build the event-tracking infrastructure first. Hook handlers in `module/hooks/session-events.js`. Subscribe to all event types listed above; append to `flags["good-society-homebrew"].sessionEvents`.
2. Build the markdown generator (`module/helpers/session-log-generator.js`) that takes the events array and produces the structured markdown.
3. Build the preview modal `ApplicationV2` that opens on "End Session" click. Wire to the generator.
4. Build the rendered preview body — themed actor name spans, blockquote monologues, etc.
5. Build the "edit before saving" mode. Use Foundry's HTML editor or a plain textarea.
6. Build the save action. Create the journal folder if needed; create the dated entry.
7. Wire the "End Session" button into the scene controls and (optionally) the Cycle Phase HUD strip.

CSS organization:
- `styles/apps/_session-log-preview.css` — the modal chrome and body styling
- The body's section-per-category structure can reuse `_section-header.css` and `_card.css` primitives

### Test path

1. Play a brief mock session: advance phase Pre-cycle → Novel, take a monologue as Lady Rose, add 2 reputation tags.
2. Click "End Session" from the GM scene controls. Verify the modal opens with the generated content (3 phase change, 1 monologue with text, 2 tag changes).
3. Verify cross-theme rendering: Lady Rose's name in pink, Avril's in candlelight gold.
4. Click "edit before saving." Verify the markdown editor opens. Add a "Session Notes" header with text. Click "back to preview" — verify the new content renders.
5. Click "save log ↗." Verify the journal entry is created at "Session Logs / 2026 / Session 1" with the markdown content.
6. Click "End Session" again. Verify the modal opens with "No events tracked since last log saved."
7. Take another monologue. Click "End Session." Verify Session 2 entry is created with just the new monologue.

If 1–7 pass, the session log auto-generator is production-ready.

## Open questions

1. **Should the log auto-save without the GM clicking End Session?** E.g. on cycle wrap or session timeout. **Tentative answer: no.** The GM is the right gate for what counts as a session.

2. **Should the log include a "Cast in attendance" header listing players who were online?** **Tentative answer: yes**, automatically populated from connection events. Useful for absent players reading "I was there for Avril's monologue but missed Lady Rose's."

3. **Should the log support PDF export beyond the journal entry?** **Tentative answer: defer to v1.1.** The journal entry is the canonical archive; PDF export is a nice-to-have for end-of-campaign retrospectives.

4. **Should logs auto-include stat snapshots (e.g. resolve totals at session end)?** **Tentative answer: no for v1.** The log is a *changes* record; current state lives on the sheets. Adding snapshots would inflate the log.

5. **Should the log link to original chat messages where applicable?** Click a monologue blockquote → opens the original chat card. **Tentative answer: yes for v1.** Foundry supports inline message links; the generator inserts them.

6. **Should there be a "session summary" at the top — a single-paragraph prose summary of the session's key events?** **Tentative answer: defer to v1.1.** Auto-generating prose summaries is an LLM task; for v1, the structured log is sufficient.

7. **Should the log capture out-of-character chat messages?** Mechanical events only currently. **Tentative answer: no.** Out-of-character chat is for jokes, rules questions, etc. — usually not session-archive material. The mechanical-events focus is the right scope.

## Visual proof

The Session Log preview modal is rendered above (`good_society_session_log_preview_modal`) showing a Session 4 log for May 5, 2026 with: cycle phase changes, two monologues with full quoted text, three reputation tag changes plus a condition added, an inner conflict resolution, a magic cast, and two letters sent. Cross-theme rendering on actor names (Cormorant for Rose, Didot for Avril, Cinzel for Dixon, Lora for Pearlinda) holds throughout.

Validates: the modal's backdrop, the structured-but-narratively-readable section format, the blockquote treatment for monologues, the cross-theme rendering pattern at body scale, the journal destination preview in the footer.

## Changelog

| Date       | Change                                                                |
|------------|-----------------------------------------------------------------------|
| 2026-05-05 | File created. Event-tracking infrastructure specified, markdown generation flow specified, preview modal layout specified, journal placement convention specified. Visual proof rendered for a sample session. |
