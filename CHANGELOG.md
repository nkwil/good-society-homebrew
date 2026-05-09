# Changelog

All notable changes to **Good Society (Homebrew)** will be documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/) loosely; the
project follows semantic versioning where it makes sense for a Foundry
system.

## [0.1.0] — 2026-05-08 — initial release

First public release, covering Sessions B-0 through B-12. Foundry **v13**
only. Three optional module dependencies (Sequencer, JB2A) for VFX —
the system degrades to chat-only output if absent.

### Highlights

- Full Good Society character sheet (Major / Connection / Family / NPC)
  with public/private tab structure, persistent token & cycle strip,
  and per-field visibility flags.
- Persona system: each Major (and optionally Connection / NPC) has any
  number of personas with their own portraits, token images, names, and
  visibility overrides. Switching persona updates every placed token of
  the actor across all scenes.
- Five Item types (reputation tag, reputation condition, inner conflict,
  magic/skill, backstory action) with their own minimal sheets.
- Magic / Skills cast pipeline that fires on-screen Sequencer + JB2A
  effects, posts a chat card, and optionally swaps personas.

### Apps and surfaces

- **Public Info Dashboard** — communal facilitator surface listing every
  Major. Now includes reputation tag chips and active condition badges.
- **My Characters Dock** — persistent left-rail dock listing the
  player's owned Majors and Connections with quick speak-as access.
- **Cycle Phase HUD** — top-of-canvas strip rendering the canonical
  8-position cycle (Novel, Reputation, Rumour & Scandal, Epistolary,
  Novel², Reputation², Epistolary², Upkeep) per rulebook p.112.
  Final-cycle GM toggle skips Rumour & Scandal and the second Reputation
  per p.114-115; the second Epistolary becomes the epilogue.
- **Upkeep Wizard + Roster** — six-step per-Major modal for the Upkeep
  phase plus a GM Roster view tracking everyone's progress. Step 5
  shows the per-cycle reputation review (tags gained / removed since
  last upkeep).
- **Reputation Phase Wizard (GM + Player)** — round-robin facilitator
  modal plus per-player wizards mirroring the GM's view in real time.
  Both wizards listen to the same actor data and re-render on tag /
  condition changes.
- **Rumour & Scandal Wizard + Board** — player-driven round-robin per
  rulebook p.126-128, with state machine (unspread → spread → used,
  unspread → fading → faded). Spreading deducts 1 resolve from the
  player's Major Character. Board persists across phases for spending
  the attached resolve token during play.
- **Letter Composer** — themed Epistolary phase compose window with
  live preview, draft auto-save, recipient picker, and journal archive
  on send.
- **Event Timeline** — in-fiction calendar with stage-based bucketing
  (Coming Soon → Today → Past). The GM promotes events with optional
  Foundry Scene linkage; players see public events automatically.
- **Actions You Can Take** cheat sheet — rulebook-cited reference for
  resolve-token spending, accessible from the Major sheet's persistent
  strip and from the speaking-as bar.
- **Session Log** — auto-tracks tag/condition changes, monologues,
  persona swaps, phase transitions; the GM can preview and save the
  generated log to a journal entry at session end.
- **Chat-card system** — six themed variants (system, in-character,
  monologue, completion, persona switch, letter) with persona-aware
  brand colors and historic theme persistence via flags.
- **GM tools** — Bulk Permissions Panel, NPC Organizer, Reveal Control
  popovers, Condition Picker (fires when a Major hits 3 tags of one
  polarity).
- **Tooltip system** — every section header with `data-tooltip-key`
  gets an automatic `?` hover tooltip from a single localization key.
- **Foundry chrome theme** — opt-in body class that re-styles Foundry's
  surrounding chrome (chat log, sidebar, scene navigation, default form
  controls) to match the antique parchment palette.

### Notes

- This is a homebrew variant. It diverges from canonical Good Society in
  these documented ways: Family is an Actor (not an Item); per-field
  visibility (not per-sheet); inner conflict completes at 6 boxes total
  OR 5 on one side; Magic/Skills produce VFX; Adventurer Sentiment is
  flavor text only; spreading a rumour costs the player 1 resolve from
  their MC (rulebook uses general supply).
- Twelve character themes ship out of the box — six Major themes (rose,
  roger, mags, avril, dixon, clayton), five Connection variants, and
  one NPC theme that inherits the house style.
- The boilerplate scaffolding from the parent fork has been removed.
- No bundled compendium content. Players bring their own characters;
  the system is a blank shell at install time.
