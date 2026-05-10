# Patch: the Epistolary Wizard

> **Status:** drafting. Wraps the existing composer + letter card from `05-epistolary-ui.md` in an email-style three-tab phase environment (inbox / compose / outbox), introduces a seal-type system with mechanical meaning, and gives the GM a roster of who's done writing.
>
> **Companion docs:** [`05-epistolary-ui.md`](./05-epistolary-ui.md) (locked v1 spec — the composer and letter card it covers are reused verbatim), [`11-upkeep-wizard.md`](./11-upkeep-wizard.md) (parallel structure — Upkeep also has a per-player wizard + GM roster).
>
> **Repo target:** `module/apps/epistolary-wizard.js` (new) + `module/apps/epistolary-roster.js` (new) + `templates/apps/epistolary-wizard.hbs` (new) + `templates/apps/epistolary-roster.hbs` (new) + `styles/apps/_epistolary-wizard.css` (new) + new constants for seal types + small additions to `module/helpers/letter-cards.js` and `module/hooks/cycle-phase-change.js`.

---

## 1. Goals

1. **Give the Epistolary phase a home.** Right now, the existing `05-epistolary-ui.md` covers composing one letter at a time. The phase itself has no environment — a player can write a letter via the composer but has no place to *see* what they've received, *track* what they've sent, or *signal* that they're done.
2. **Email-inspired but period-flavored.** Inbox / compose / outbox is a familiar enough pattern that players don't need explanation, but the visual language stays in the system's antique-but-clean idiom. No skeuomorphic envelopes-on-a-desk; it's a writing room with three notebooks.
3. **Seal types carry meaning.** Currently `05-epistolary-ui.md` notes seal colour as "pure flavor; doesn't gate visibility or trigger anything." This patch rewrites that decision: seal types are a small registry with mechanical and social meaning, configured in a constants file, illustrated with custom assets supplied by the GM.
4. **Per-player wizards + GM roster.** Each player runs their own wizard. The GM sees a roster of completion status. Phase advances when everyone marks done.
5. **Reuse, don't duplicate.** The composer and letter card from `05-epistolary-ui.md` are unchanged. The wizard hosts the composer; it doesn't re-implement it.

---

## 2. Relationship to existing 05 spec

`05-epistolary-ui.md` is locked. This patch:

- **Reuses** the `LetterComposer` ApplicationV2, the `.gs-letter-card` component, the `themedWrap()` helper, the send flow (chat post + journal archive + `epistolary-sent` hook), and the draft-saving mechanism. None of those are touched.
- **Extends** the seal system. Where 05 says "seal is pure flavor," this patch defines a typed seal registry with optional behaviors. The composer's seal picker grows from "pick a colour" to "pick a seal type"; the underlying letter card still renders a colored disc, just driven by the type's metadata.
- **Adds** the wizard surface that hosts the composer + an inbox view + an outbox view, plus the GM-side roster.

Where 05 says one thing and this patch says another (specifically: the seal-mechanic question), this patch wins. Update `05-epistolary-ui.md`'s "Open questions" §2 entry when this patch lands to reflect the new decision.

---

## 3. Lifecycle

### 3.1 Phase begin

When `cyclePhase` becomes `epistolary` (per `module/helpers/cycle-advance.js`):

1. Hook `Hooks.callAll("good-society-homebrew.phase-begin", "epistolary")`.
2. The cycle-phase-change hook handler opens the wizard for every connected user that owns a Major.
3. GMs additionally get the roster window (or a "Open Epistolary Roster" scene control button).

```js
// module/hooks/cycle-phase-change.js — extend existing handler

import { EpistolaryWizard } from "../apps/epistolary-wizard.js";
import { EpistolaryRoster } from "../apps/epistolary-roster.js";

Hooks.on("good-society-homebrew.phase-begin", (phase) => {
  if (phase !== "epistolary") return;
  const myMajors = game.actors.filter(a =>
    a.type === "major-character" && a.testUserPermission(game.user, "OWNER")
  );
  if (myMajors.length > 0) {
    new EpistolaryWizard({ actor: myMajors[0] }).render(true);
    // If the user owns multiple Majors, the wizard shows a top selector to switch between them.
  }
  if (game.user.isGM) {
    new EpistolaryRoster().render(true);
  }
});
```

### 3.2 During the phase

The wizard stays open for the duration of the phase. Players can:

- Read incoming letters (inbox).
- Compose new letters (compose tab opens the existing `LetterComposer`).
- Review their sent letters (outbox).
- Toggle filters (by seal type, by recipient, by cycle).
- Mark themselves "Done with Epistolary" when finished.

The GM watches the roster fill in. They can poke a slow player or advance the phase manually.

### 3.3 Phase end

When the GM advances past `epistolary`:

1. Hook `Hooks.callAll("good-society-homebrew.phase-end", "epistolary")`.
2. Wizards on all clients close themselves.
3. Roster closes on the GM client.
4. Letters not sent (still in drafts) are preserved across the phase boundary — they auto-restore the next time the player opens the composer, regardless of phase. (This matches the existing draft mechanism in 05.)
5. "Burn after reading" letters that were *opened* during the phase are now permanently destroyed (see §7).

---

## 4. Wizard structure

### 4.1 Class

```js
// module/apps/epistolary-wizard.js

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class EpistolaryWizard extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "gs-epistolary-wizard",
    classes: ["good-society", "gs-epistolary-wizard"],
    window: {
      title: "GOODSOCIETY.epistolary.wizard.title",
      icon: "fa-solid fa-envelope",
      resizable: true,
    },
    position: { width: 760, height: 640 },
    actions: {
      switchTab:    this.prototype._onSwitchTab,
      openLetter:   this.prototype._onOpenLetter,
      composeNew:   this.prototype._onComposeNew,
      replyToLetter: this.prototype._onReplyToLetter,
      markDone:     this.prototype._onMarkDone,
      switchActor:  this.prototype._onSwitchActor,
      filterBySeal: this.prototype._onFilterBySeal,
    },
  };

  static PARTS = {
    wizard: { template: "systems/good-society-homebrew/templates/apps/epistolary-wizard.hbs" },
  };

  constructor(options = {}) {
    super(options);
    this.actor = options.actor ?? null;
    this._currentTab = "inbox";
    this._sealFilter = null;     // null = show all
    this._cycleFilter = "this";  // "this" | "all"
  }

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    ctx.actor = this.actor;
    ctx.actors = game.actors.filter(a =>
      a.type === "major-character" && a.testUserPermission(game.user, "OWNER")
    );
    ctx.currentTab = this._currentTab;
    ctx.sealTypes = SEAL_TYPES;
    ctx.cycleNumber = game.settings.get("good-society-homebrew", "cycleNumber");

    if (this._currentTab === "inbox") {
      ctx.letters = await this._collectInbox();
    } else if (this._currentTab === "outbox") {
      ctx.letters = await this._collectOutbox();
    }
    // compose tab has no letters list

    ctx.markedDone = !!this.actor?.flags["good-society-homebrew"]?.epistolaryDone?.[ctx.cycleNumber];

    return ctx;
  }

  // ... handlers below ...
}
```

### 4.2 Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Epistolary phase · Cycle 3        [actor: Rose Whitcombe ▾] │ ← header (house)
├─────────────────────────────────────────────────────────────┤
│ [Inbox · 3 unread]  [Compose]  [Outbox · 2 sent]            │ ← tab nav
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   {tab content}                                              │ ← variable
│                                                              │
├─────────────────────────────────────────────────────────────┤
│ filter: [all] [▼ red] [▼ green] [▼ yellow]   [mark done ↗] │ ← footer (house)
└─────────────────────────────────────────────────────────────┘
```

- **Header:** house style. Title + actor switcher (if user owns multiple Majors). Switching actor switches the entire view's data — inbox, outbox, "marked done" state are all per-actor.
- **Tab nav:** three tabs with badges. Unread count on Inbox, sent count on Outbox.
- **Tab content:** depends on which tab is active. See §5–§7.
- **Footer:** seal-type filter pills, "mark done ↗" button.

### 4.3 Tab body — Inbox

A list of letters received by the active actor this cycle (or all cycles, depending on `_cycleFilter`).

Each row:

```
┌─────────────────────────────────────────────────────────────┐
│ [seal] [portrait]  Margaret Halloway        cycle 3 · iii   │
│        UNREAD     "On a matter of debt"                      │
│                   "Uncle — The Marquess held court last…"   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

- **Seal column** — 28×28 px wax-disc swatch using the seal type's color + icon asset (custom illustration). On hover, tooltip with seal label.
- **Portrait column** — 36×42 px cameo, themed with sender's `data-theme`.
- **Sender + cycle** — display name (resolved from active persona at send time) + cycle number + iconic phase mark.
- **Subject + snippet** — subject in display 14 px brand color; snippet in body 11 px italic muted (first ~80 chars of body). Subject "—" if no subject.
- **Unread badge** — tiny brand-color dot at the top-left, hidden when read.
- **Hover state** — paper-warm background.
- **Click** — opens the letter detail view (§4.4).

The list scrolls if it exceeds the viewport. Each row keeps a `data-letter-id` so the click handler knows which letter to open.

**Empty state:** "No letters yet this cycle" in italic muted body, plus a "compose your first letter ↗" button.

### 4.4 Letter detail view

When a row is clicked, the wizard *replaces* its tab content with the full letter card render, plus a small action strip:

```
┌─────────────────────────────────────────────────────────────┐
│ [← back to inbox]                                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   {full themed .gs-letter-card render — sender's theme}     │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│ [reply ↗]                                       [archive ↗] │
└─────────────────────────────────────────────────────────────┘
```

- **Letter card** — exactly the same component used in chat (`05-epistolary-ui.md` §letter card). One component, one render.
- **Reply ↗** — opens the existing `LetterComposer` pre-filled with: TO = sender, SUBJECT = "RE: {original subject}", BODY = empty, SEAL = casual (default). Wizard tab switches to "Compose" while the composer is open.
- **Archive ↗** — moves the letter from "active" view into a per-actor archive. Doesn't delete it; archived letters appear under a different filter ("show archived"). For green-burn letters, "Archive" is replaced by "Burn now ↗" (per §7).
- **Back to inbox** — re-render the inbox list view.

### 4.5 Tab body — Compose

```
┌─────────────────────────────────────────────────────────────┐
│ [embedded composer — same as 05-epistolary-ui.md]           │
│                                                              │
│ FROM      [actor + active persona — pre-filled]             │
│ TO        [recipient picker]                                │
│ SUBJECT   [...]                                             │
│ BODY      [textarea]                                        │
│ SEAL      [seal-type picker — see §6]                       │
│                                                              │
│ [preview — themed letter card]                              │
│                                                              │
│ [cancel] [save draft] [send ↗]                              │
└─────────────────────────────────────────────────────────────┘
```

Implementation: instantiate `LetterComposer` in a sub-render, embedded in the wizard's tab. The composer's existing chrome (title bar, action bar) is hidden when embedded — we use the wizard's chrome instead. Specifically:

- The wizard adds `.embedded` class to the composer's root element. Composer's `_onRender` checks for it and hides its own title bar + footer.
- The wizard's footer adopts the composer's send/save/cancel actions.

If embedding turns out to be ugly architecturally, alternative is opening the composer as a modal *over* the wizard. The visual reference shows embedded; that's the goal.

### 4.6 Tab body — Outbox

Mirrors inbox structure. Each row shows:

- **Seal column** — same.
- **Recipient column** — recipient's portrait + name. If it was a multi-recipient letter (deferred to v1.1 per 05), shows "Multiple recipients · {count}".
- **Subject + snippet**.
- **Status** — "Delivered · 2 hours ago" / "Read · cycle 3" / "Burned · cycle 3" / "Unread by recipient." Status is computed by checking flags on the chat message + the letter's seal type behavior.
- **Hover, click** — same as inbox. Click opens the same detail view (§4.4) but the action strip is "Back to outbox" + (no reply, since this is your own letter) + "View in journal ↗" (opens the journaled letter for editing the archival entry — GM only).

**Empty state:** "You haven't sent any letters this cycle yet" + "compose now ↗" button.

### 4.7 Footer — filter pills + "mark done"

**Filter pills** — small round chips matching the seal-type registry. Click to toggle filter; multi-select allowed.

```hbs
<span class="gs-epistolary-filter is-all" data-action="filterBySeal" data-seal-id="all">All</span>
{{#each sealTypes as |seal|}}
  <span class="gs-epistolary-filter"
        data-action="filterBySeal"
        data-seal-id="{{seal.id}}"
        style="--seal-color: {{seal.color}};"
        title="{{seal.label}}">
    <span class="gs-epistolary-filter-disc"></span>
    {{seal.label}}
  </span>
{{/each}}
```

CSS: each filter chip is a pill. The disc is a small circle in the seal's color. Active filter has a brand outline.

**Mark done ↗** — primary button, right-aligned. On click:

1. Confirm prompt: "Mark Rose Whitcombe's epistolary phase complete? You can still read inbox letters, but you won't be able to compose more this cycle."
2. On confirm: `actor.update({ "flags.good-society-homebrew.epistolaryDone.{cycleNumber}": true })`.
3. The compose tab is disabled (button text changes to "Done — locked until next cycle").
4. The roster updates for the GM.

Once marked done, the player can still:

- Read inbox letters.
- Open the detail view of any letter.
- Read sent letters in the outbox.

But the Compose tab and the reply button are disabled.

The GM can override and unlock a player's compose access via a roster action.

---

## 5. Inbox sourcing

### 5.1 Where letters live

Per `05-epistolary-ui.md` §send flow, letters post to chat as `ChatMessage` documents with flags:

```js
flags["good-society-homebrew"] = {
  letter: true,
  senderActorId: "...",
  senderTheme: "...",
  recipientActorIds: ["..."],   // array even for single-recipient (forward-compat)
  sealTypeId: "...",            // NEW — added by this patch
  cycleNumber: 3,
  cyclePhase: "epistolary",
  // optional:
  burnedAt: 1715000000000,      // timestamp set when a green-burn letter is opened
  archivedBy: { "userId": true } // per-user archive state
}
```

The wizard reads these flags to populate inbox / outbox.

### 5.2 Inbox query

```js
async _collectInbox() {
  const myActorId = this.actor.id;
  const cycleNumber = game.settings.get("good-society-homebrew", "cycleNumber");

  const allLetters = game.messages.filter(m =>
    m.flags["good-society-homebrew"]?.letter === true
    && m.flags["good-society-homebrew"]?.recipientActorIds?.includes(myActorId)
  );

  let scoped = allLetters;
  if (this._cycleFilter === "this") {
    scoped = scoped.filter(m => m.flags["good-society-homebrew"]?.cycleNumber === cycleNumber);
  }
  if (this._sealFilter && this._sealFilter !== "all") {
    scoped = scoped.filter(m => m.flags["good-society-homebrew"]?.sealTypeId === this._sealFilter);
  }
  // Hide letters this user has archived (per-user archive state)
  scoped = scoped.filter(m => !m.flags["good-society-homebrew"]?.archivedBy?.[game.user.id]);
  // Hide letters that have been burned (green seal, opened previously)
  scoped = scoped.filter(m => !m.flags["good-society-homebrew"]?.burnedAt);

  // Sort newest first
  scoped.sort((a, b) => b.timestamp - a.timestamp);

  return scoped.map(m => this._summarizeLetter(m));
}

_summarizeLetter(message) {
  const flags = message.flags["good-society-homebrew"];
  const sender = game.actors.get(flags.senderActorId);
  const sealType = SEAL_TYPES.find(s => s.id === flags.sealTypeId) ?? SEAL_TYPES[0];
  // Read state per user
  const readByMe = !!message.flags["good-society-homebrew"]?.readBy?.[game.user.id];

  return {
    id: message.id,
    sender: { id: sender?.id, name: sender?.name, theme: flags.senderTheme, portrait: sender?.img },
    sealType,
    subject: message.flags["good-society-homebrew"]?.subject ?? "",
    bodySnippet: stripHtml(message.content).slice(0, 80),
    timestamp: message.timestamp,
    cycleNumber: flags.cycleNumber,
    readByMe,
    raw: message,
  };
}
```

Same approach for outbox, swapping `recipientActorIds` → `senderActorId === myActorId`.

### 5.3 Marking read

When a letter is opened in the detail view:

```js
async _onOpenLetter(event, target) {
  const letterId = target.dataset.letterId;
  const message = game.messages.get(letterId);
  if (!message) return;

  // Mark read for this user
  await message.update({
    [`flags.good-society-homebrew.readBy.${game.user.id}`]: Date.now()
  });

  // If green-burn and this is the recipient's first open, schedule the burn (§7)
  this._maybeTriggerBurn(message);

  // Re-render with detail view
  this._currentDetailLetterId = letterId;
  this._currentTab = "letter-detail";  // pseudo-tab; the render path detects this
  this.render();
}
```

Read state is per-user, not per-actor — if multiple users own the same Major, their read states are independent (though they're looking at the same data).

---

## 6. Seal-type system

### 6.1 Registry

```js
// module/constants.js — add a new export

export const SEAL_TYPES = [
  {
    id: "yellow-casual",
    label: "Casual",
    color: "#C9A33C",
    description: "An everyday note. A pleasantry, a small invitation, a kindness.",
    iconAsset: "systems/good-society-homebrew/assets/seals/yellow-casual.png",
    behavior: null,          // no special behavior
    isDefault: true,
  },
  {
    id: "red-invitation",
    label: "Invitation",
    color: "#8B2A2A",
    description: "A formal invitation. The recipient is expected to respond.",
    iconAsset: "systems/good-society-homebrew/assets/seals/red-invitation.png",
    behavior: "invitation",  // see §6.3 — drives the session log entry
  },
  {
    id: "green-burn",
    label: "Burn after reading",
    color: "#4A7A4A",
    description: "Sensitive. The letter destroys itself once opened.",
    iconAsset: "systems/good-society-homebrew/assets/seals/green-burn.png",
    behavior: "burn-on-open",
  },
  // Future seals — add as Natalie defines them:
  // {
  //   id: "black-mourning",
  //   label: "Mourning",
  //   color: "#2A1F1A",
  //   description: "A formal notice of grief — a death, a departure.",
  //   iconAsset: "systems/good-society-homebrew/assets/seals/black-mourning.png",
  //   behavior: "mourning",
  // },
];

export const DEFAULT_SEAL_ID = SEAL_TYPES.find(s => s.isDefault).id;
```

The `iconAsset` slot expects a 64×64 (or larger, square) transparent PNG/SVG that renders well at 24–32 px. **Custom illustrations are GM-supplied.** Per the patch preview's reputation-tag asset hunt (Etsy "wax seal png botanical"), the default asset library will be Etsy-sourced.

### 6.2 Composer integration

The composer's existing seal field per `05-epistolary-ui.md` shows colored circles. Update it to read from `SEAL_TYPES` and show the seal's icon + label:

```hbs
<div class="gs-letter-composer-field">
  <label>SEAL</label>
  <div class="gs-seal-picker">
    {{#each sealTypes as |seal|}}
      <button class="gs-seal-option {{#if (eq ../selectedSealId seal.id)}}is-selected{{/if}}"
              type="button"
              data-action="selectSeal"
              data-seal-id="{{seal.id}}"
              title="{{seal.description}}">
        <img class="gs-seal-icon" src="{{seal.iconAsset}}" alt="" onerror="this.style.display='none'">
        <span class="gs-seal-label">{{seal.label}}</span>
      </button>
    {{/each}}
  </div>
  <p class="gs-seal-description">{{selectedSeal.description}}</p>
</div>
```

Selecting a seal updates the live preview's footer (the existing letter card's "sealed in {color}" line gets the new label and icon).

### 6.3 Behavior hooks

Each seal can carry a `behavior` string. The system maps behaviors to handlers:

| Behavior | Description |
|---|---|
| `null` (or absent) | No special behavior. Letter sends and renders normally. |
| `"invitation"` | On send, additionally fires a `Hooks.callAll("good-society-homebrew.invitation-sent", { sender, recipients, message })` hook. The session log auto-generator listens and writes "X invited Y to Z" with optional location/event metadata in the body. |
| `"burn-on-open"` | When the recipient opens the letter, see §7. |
| (future) `"mourning"` | TBD — could trigger a brief moment-of-silence VFX or grant a "Mourning" condition. |
| (future) `"contract"` | TBD — could prompt a signature step (recipient confirms). |

Behaviors are registered at module load:

```js
// module/helpers/seal-behaviors.js (new)

export const SEAL_BEHAVIORS = {
  "invitation": (action, payload) => {
    if (action === "send") {
      Hooks.callAll("good-society-homebrew.invitation-sent", payload);
    }
  },
  "burn-on-open": (action, payload) => {
    if (action === "open") {
      // Schedule the burn — see §7
      scheduleBurn(payload.message, payload.user);
    }
  },
};

export function fireSealBehavior(action, sealTypeId, payload) {
  const sealType = SEAL_TYPES.find(s => s.id === sealTypeId);
  const handler = SEAL_BEHAVIORS[sealType?.behavior];
  if (handler) handler(action, payload);
}
```

Composer calls `fireSealBehavior("send", sealTypeId, { sender, recipients, message })` after posting.

Wizard calls `fireSealBehavior("open", sealTypeId, { message, user })` when a letter is opened in detail view.

### 6.4 Storage

The seal type id stores on the chat message at `flags["good-society-homebrew"].sealTypeId`. The seal's color and icon resolve at render time from the registry — historic messages don't need to store the full metadata, just the id.

If a seal type is removed from the registry later (rare), historic messages with that id get rendered with a fallback ("Unknown seal") + the default icon. Don't crash.

---

## 7. Burn-after-reading mechanic (green seal)

The most theatrical of the seal behaviors.

### 7.1 What "burn" means

When a `green-burn` letter is opened by ANY recipient for the first time:

1. The detail view shows the letter card with a small "burns when you close this" warning eyebrow at the top.
2. The recipient reads the letter. They may take notes, screenshot if they want.
3. When they close the detail view OR navigate away from the wizard for >30s, the letter "burns":
   - The chat message gets `flags["good-society-homebrew"].burnedAt = Date.now()` and `flags["good-society-homebrew"].burnedBy = userId`.
   - The chat message's `content` is replaced with `"<em>(Burned. The letter is destroyed.)</em>"`.
   - The chat message's `flags["good-society-homebrew"].burnedContent` is set to the original content (for GM forensics — see §7.4).
   - The inbox row disappears for the recipient (filtered out per §5.2).
   - The outbox row for the sender shows status "Burned · cycle {n}".

A small VFX accompanies the burn — a flame animation in the corner of the wizard, ~1.5s. **No Sequencer required**; pure CSS keyframe.

### 7.2 GM seal override

The GM can configure (world setting `epistolaryBurnsRespectGM`) whether burning destroys the chat message globally or just for non-GM users. Default: **GMs always retain access to burned content via the message flags.** The displayed content is still "(Burned)" but a GM-only "view burned content" button reveals the original.

### 7.3 Multi-recipient considerations

If a green-burn letter is sent to multiple recipients (deferred to v1.1):

- The first recipient to open it triggers the burn.
- Other recipients see the letter as "burned" before they had a chance to read it. The chat row still appears in their inbox until they "see it gone."
- Sender warning at compose time: "Green seal letters with multiple recipients: only one recipient gets to read it."

For v1, single recipient only — this concern is theoretical.

### 7.4 Audit trail

The original content is preserved on the message in `flags.burnedContent`. This serves two purposes:

- **GM oversight** — a GM can see what was sent if there's a dispute about behavior.
- **Session log forensics** — the auto-generator records the burn ("X sent Y a green-seal letter; Y read it") without exposing content.

Players cannot recover burnedContent. The GM can.

### 7.5 "Burn now" action

In the detail view of a green-burn letter, the action strip's right button is "Burn now ↗" instead of "Archive ↗." Clicking it triggers the burn immediately rather than waiting for navigation-away. Useful for players who want a deliberate, ceremonial dismissal.

---

## 8. The GM roster

A parallel companion app — same structure as the existing Upkeep Roster (`module/apps/upkeep-roster.js`, per CLAUDE.md §13 Session B-5b).

### 8.1 Class

```js
// module/apps/epistolary-roster.js

export class EpistolaryRoster extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "gs-epistolary-roster",
    classes: ["good-society", "gs-epistolary-roster"],
    window: { title: "GOODSOCIETY.epistolary.roster.title", icon: "fa-solid fa-users" },
    position: { width: 480, height: "auto" },
    actions: {
      pokePlayer:    this.prototype._onPokePlayer,
      unlockPlayer:  this.prototype._onUnlockPlayer,
      advancePhase:  this.prototype._onAdvancePhase,
    },
  };

  static PARTS = {
    roster: { template: "systems/good-society-homebrew/templates/apps/epistolary-roster.hbs" },
  };

  async _prepareContext() {
    const cycleNumber = game.settings.get("good-society-homebrew", "cycleNumber");
    const majors = game.actors.filter(a => a.type === "major-character");
    return {
      cycleNumber,
      rows: majors.map(a => ({
        id: a.id,
        name: a.name,
        theme: a.system.theme,
        portrait: a.img,
        sentCount: this._countSent(a, cycleNumber),
        receivedCount: this._countReceived(a, cycleNumber),
        unreadCount: this._countUnread(a, cycleNumber),
        markedDone: !!a.flags["good-society-homebrew"]?.epistolaryDone?.[cycleNumber],
      })),
      allDone: this._allMajorsDone(majors, cycleNumber),
    };
  }
  // ... handlers ...
}
```

### 8.2 Layout

```
┌──────────────────────────────────────────────────┐
│ Epistolary roster · Cycle 3                       │
├──────────────────────────────────────────────────┤
│ [portrait] Rose Whitcombe   sent 2 · received 1 · ✓ │
│ [portrait] Roger Goodfellow sent 1 · received 0 · ⏳ │
│ [portrait] Mags Tarrant     sent 0 · received 3 · ⏳ │
│ [portrait] Avril St. James  sent 1 · received 2 · ✓ │
│ [portrait] Dixon Lefroy     sent 0 · received 0 · ⏳ │
│ [portrait] Clayton Pemberton sent 2 · received 0 · ✓ │
├──────────────────────────────────────────────────┤
│ 3 of 6 done                                       │
│ [poke laggers] [unlock all] [advance phase ↗]    │
└──────────────────────────────────────────────────┘
```

- Each row shows portrait, name, sent/received counts, and a status icon (✓ done, ⏳ in progress).
- Themed accent stripe on the left of each row per dashboard rules.
- Row click → opens a peek of the actor's outbox (read-only — even GMs don't write on a player's behalf without explicit GM-override mode).
- "Poke laggers" → whisper notification to all not-yet-done players.
- "Unlock all" → clears the `epistolaryDone` flag for everyone (e.g., GM realized phase needs more time).
- "Advance phase ↗" → calls `module/helpers/cycle-advance.js`'s `advancePhase()`.

### 8.3 Auto-close

Roster closes automatically when the GM advances past `epistolary` (per phase-end hook §3.3).

---

## 9. Wizard styling

Reuse house style. New CSS file: `styles/apps/_epistolary-wizard.css`.

Key elements:

- **Tab nav** (top of body): three pills per tab, similar to dashboard's row tabs. Active tab has filled `--gs-brand` background; inactive tabs are outline. Badges (counts) sit inside the pill in `--gs-paper-warm` rounded-square chips.
- **Letter rows**: paper-warm background, sage hairline border, hover lifts slightly. Same row style as the My Characters Dock so users feel consistency.
- **Seal disc**: 28×28 px circle. Background = `var(--seal-color)` (set via inline style). Inner image = `var(--seal-icon-url)` (custom asset). Drop shadow inset for "wax depth" feel.
- **Filter pills**: small, rounded, hairline outline. Active pill has a brand-colored solid disc next to its label.
- **Letter-detail back-button**: sage outline pill, top-left corner, "← back to inbox" / "← back to outbox."
- **Mark Done button**: primary (filled `--gs-brand`), right-aligned in footer. Disabled state when the actor is already done.

Roster styles in a separate `styles/apps/_epistolary-roster.css` (matches Upkeep Roster's pattern).

---

## 10. Localization

Add to `lang/en.json`:

```json
{
  "GOODSOCIETY.epistolary.wizard.title": "Epistolary Phase",
  "GOODSOCIETY.epistolary.roster.title": "Epistolary Roster",
  "GOODSOCIETY.epistolary.tab.inbox": "Inbox",
  "GOODSOCIETY.epistolary.tab.compose": "Compose",
  "GOODSOCIETY.epistolary.tab.outbox": "Outbox",
  "GOODSOCIETY.epistolary.empty.inbox": "No letters yet this cycle.",
  "GOODSOCIETY.epistolary.empty.outbox": "You haven't sent any letters this cycle yet.",
  "GOODSOCIETY.epistolary.cta.composeFirst": "compose your first letter ↗",
  "GOODSOCIETY.epistolary.cta.composeNow": "compose now ↗",
  "GOODSOCIETY.epistolary.action.reply": "reply ↗",
  "GOODSOCIETY.epistolary.action.archive": "archive ↗",
  "GOODSOCIETY.epistolary.action.burnNow": "burn now ↗",
  "GOODSOCIETY.epistolary.action.markDone": "mark done ↗",
  "GOODSOCIETY.epistolary.action.markDoneConfirm": "Mark {actor}'s epistolary phase complete? You can still read inbox letters, but you won't be able to compose more this cycle.",
  "GOODSOCIETY.epistolary.status.unread": "Unread",
  "GOODSOCIETY.epistolary.status.delivered": "Delivered",
  "GOODSOCIETY.epistolary.status.read": "Read · cycle {n}",
  "GOODSOCIETY.epistolary.status.burned": "Burned · cycle {n}",
  "GOODSOCIETY.epistolary.status.unreadByRecipient": "Unread by recipient",
  "GOODSOCIETY.epistolary.status.done": "Done with epistolary",
  "GOODSOCIETY.epistolary.warning.burnPending": "This letter burns when you close this view.",
  "GOODSOCIETY.epistolary.warning.burned": "(Burned. The letter is destroyed.)",
  "GOODSOCIETY.epistolary.filter.all": "All",
  "GOODSOCIETY.epistolary.cycle.this": "this cycle",
  "GOODSOCIETY.epistolary.cycle.all": "all cycles",
  "GOODSOCIETY.epistolary.roster.allDone": "All players done. Phase ready to advance.",
  "GOODSOCIETY.epistolary.roster.partialDone": "{done} of {total} done.",
  "GOODSOCIETY.epistolary.roster.poke": "poke laggers",
  "GOODSOCIETY.epistolary.roster.unlockAll": "unlock all",
  "GOODSOCIETY.epistolary.roster.advancePhase": "advance phase ↗",
  "GOODSOCIETY.seal.yellow-casual.label": "Casual",
  "GOODSOCIETY.seal.yellow-casual.description": "An everyday note. A pleasantry, a small invitation, a kindness.",
  "GOODSOCIETY.seal.red-invitation.label": "Invitation",
  "GOODSOCIETY.seal.red-invitation.description": "A formal invitation. The recipient is expected to respond.",
  "GOODSOCIETY.seal.green-burn.label": "Burn after reading",
  "GOODSOCIETY.seal.green-burn.description": "Sensitive. The letter destroys itself once opened."
}
```

---

## 11. Settings

```js
// module/settings.js — add to registerSettings()

game.settings.register("good-society-homebrew", "epistolaryAutoOpen", {
  name: "GOODSOCIETY.settings.epistolaryAutoOpen.name",
  hint: "GOODSOCIETY.settings.epistolaryAutoOpen.hint",
  scope: "world",
  config: true,
  type: Boolean,
  default: true,
});

game.settings.register("good-society-homebrew", "epistolaryBurnsRespectGM", {
  name: "GOODSOCIETY.settings.epistolaryBurnsRespectGM.name",
  hint: "GOODSOCIETY.settings.epistolaryBurnsRespectGM.hint",
  scope: "world",
  config: true,
  type: Boolean,
  default: true,    // GMs see burned content
});

game.settings.register("good-society-homebrew", "epistolaryDefaultSeal", {
  name: "GOODSOCIETY.settings.epistolaryDefaultSeal.name",
  hint: "GOODSOCIETY.settings.epistolaryDefaultSeal.hint",
  scope: "world",
  config: true,
  type: String,
  choices: { "yellow-casual": "Casual", "red-invitation": "Invitation", "green-burn": "Burn after reading" },
  default: "yellow-casual",
});
```

---

## 12. File-by-file plan

| File | Action | Notes |
|---|---|---|
| `module/apps/epistolary-wizard.js` | Create | Class per §4.1; tab handlers; inbox/outbox queries; mark-done logic. |
| `module/apps/epistolary-roster.js` | Create | Class per §8.1; mirrors Upkeep Roster's structure. |
| `templates/apps/epistolary-wizard.hbs` | Create | Tabbed layout per §4.2; renders inbox/outbox/letter-detail/compose based on `currentTab`. |
| `templates/apps/epistolary-roster.hbs` | Create | Per-actor row layout per §8.2. |
| `templates/components/letter-row.hbs` | Create | Reusable row for inbox/outbox lists (sender/recipient + seal + subject + snippet). |
| `styles/apps/_epistolary-wizard.css` | Create | Wizard chrome + tab nav + letter rows + seal discs + footer. |
| `styles/apps/_epistolary-roster.css` | Create | Roster chrome. |
| `module/constants.js` | Extend | Add `SEAL_TYPES` registry + `DEFAULT_SEAL_ID`. |
| `module/helpers/seal-behaviors.js` | Create | Behavior dispatcher per §6.3. |
| `module/helpers/letter-cards.js` | Modify | Update render to read seal icon + label from `SEAL_TYPES` instead of hardcoded color. Footer "sealed in {label}" with icon. |
| `module/apps/letter-composer.js` (existing per 05) | Modify | Replace seal color picker with seal-type picker per §6.2. Call `fireSealBehavior("send", ...)` after posting. Accept embedded mode for use inside the wizard. |
| `module/hooks/cycle-phase-change.js` | Modify | Add the `phase-begin` listener that auto-opens the wizard + roster. |
| `module/settings.js` | Extend | Three new settings per §11. |
| `lang/en.json` | Extend | Strings per §10. |
| `assets/seals/*.png` | Create (placeholders) | Default placeholder PNGs for the three seed seals. Replace with custom illustrations as Natalie supplies them. |
| `05-epistolary-ui.md` | Update | Open Question §2 ("Should the seal color affect anything mechanically?") — answer changes to "yes; see `patch-epistolary-wizard.md`." Don't otherwise modify. |

---

## 13. Behaviors preserved from `05-epistolary-ui.md`

A working epistolary system after this patch must still:

- Compose a letter via the existing `LetterComposer` (now hosted inside the wizard or opened standalone).
- Render the letter card with `themedWrap()` and the sender's theme cascade.
- Post to chat with `flags["good-society-homebrew"].letter = true` and the existing flag set (extended with `sealTypeId`, `cycleNumber`, `cyclePhase`).
- Archive to journal under `Letters / Cycle {n} / {sender} → {recipient}` (existing flow).
- Fire the `epistolary-sent` hook for session-log subscribers.
- Auto-save drafts every 10s.
- Carry the persona's `chatColor` override on the letter card's `--gs-brand` if the active persona has one.

---

## 14. Behaviors added (new in this patch)

- **Three-tab wizard** (inbox / compose / outbox) with per-actor data scope.
- **Inbox view** with seal-color filter, cycle-scope toggle, unread badges, click-through to full letter card.
- **Outbox view** with status indicators (delivered / read / burned / unread by recipient).
- **Reply action** that pre-fills the composer with the sender's actor as recipient.
- **Archive action** that hides letters from the active list per-user.
- **Mark-done action** that flags the actor as epistolary-complete for the current cycle.
- **Per-cycle scoping** — letters and "done" status are scoped to `cycleNumber`.
- **Seal-type registry** with three default types (yellow-casual, red-invitation, green-burn).
- **Burn-after-reading mechanic** — opening a green-seal letter triggers a delayed destruction, with GM oversight.
- **Invitation flag** — red-seal letters fire a hook that the session log can subscribe to.
- **GM roster** with real-time completion status, poke / unlock / advance-phase actions.
- **Auto-open** the wizard when `epistolary` phase begins (configurable).

---

## 15. Open questions

- **Should the wizard be the ONLY entry point for the composer during epistolary phase?** Per §4.5 the composer can still be opened standalone. But maybe during epistolary, opening the standalone composer should redirect to the wizard's compose tab. **[FILL IN]**
- **Multi-recipient (deferred to v1.1):** the schema has `recipientActorIds` as an array, but the inbox query filter assumes single-recipient. Once multi-recipient is enabled, the inbox needs to handle "I'm one of several recipients" differently (e.g., a small "+N others" indicator). **[FILL IN — defer.]**
- **Older-cycle inbox:** the cycle-scope toggle lets players see all-cycles or just-this-cycle. Does the GM roster also include letters from previous cycles when computing "sent"/"received" counts? Probably no — roster is current-cycle scoped. **[FILL IN — confirm.]**
- **Burn timing.** §7.1 specifies "30s away from the wizard" as the auto-burn trigger. Is that the right value? Could also be "on close of the detail view" (immediate). Tradeoff: immediate is cleaner UX but doesn't give a re-read pause. **[FILL IN — Natalie pick.]**
- **Default seal.** Currently `yellow-casual`. Can the GM override per-world? Yes, via `epistolaryDefaultSeal` setting. **[Locked.]**
- **GM-side seal forensics UI.** §7.2 says GMs can view burned content. Where? A small "view burned" button in the chat log on burned messages? On the wizard's outbox? On a dedicated GM panel? **[FILL IN.]**
- **Roster realtime updates.** When a player marks done on their wizard, the GM's roster needs to refresh. Implementation: a Foundry socket message, or polling, or a hook the wizard triggers and the roster listens for. Probably a custom socket. **[FILL IN — confirm with multi-user testing.]**
- **Custom seal asset onboarding.** When Natalie supplies new illustrations, where do they live? `assets/seals/` per the constants reference. What's the naming convention? Probably `{seal-id}.png` (i.e., `green-burn.png`). Confirm. **[FILL IN.]**
- **Should the green-burn animation use Sequencer?** Per §7.1 "no Sequencer required; pure CSS keyframe." Could be more cinematic with a flame VFX. **[FILL IN — defer to polish pass.]**

---

## 16. Implementation order

1. Add `SEAL_TYPES` to `module/constants.js` + placeholder asset PNGs in `assets/seals/`.
2. Add the three settings to `module/settings.js`.
3. Add localization keys to `lang/en.json`.
4. Update `letter-cards.js` and `letter-composer.js` to read seal metadata from the registry. Existing letters render unchanged (yellow-casual is the default for letters with no `sealTypeId` flag).
5. Create `module/helpers/seal-behaviors.js` with the dispatcher. Wire `letter-composer.js`'s send flow to call it.
6. Create `module/apps/epistolary-wizard.js` with class skeleton (no tab logic yet).
7. Create `templates/apps/epistolary-wizard.hbs` with the chrome + empty tab body.
8. Create `styles/apps/_epistolary-wizard.css`. Wire into `styles/good-society.css`.
9. Implement Inbox tab. Test against existing chat-message letters from prior phases.
10. Implement Outbox tab.
11. Implement Compose tab — embedded composer.
12. Implement detail view (single letter render).
13. Wire mark-done + filter actions.
14. Wire `Hooks.on("good-society-homebrew.phase-begin", ...)` auto-open in `cycle-phase-change.js`.
15. Implement Burn-on-Open behavior (delayed burn + content replacement + GM override).
16. Create `module/apps/epistolary-roster.js` + template + CSS.
17. Wire socket-based realtime roster refresh.
18. Test the full phase: GM advances to epistolary, players write/read/burn/respond, players mark done, GM advances past.

Each step ends with a working build.

---

## 17. Decisions captured during build

(Empty — fill in as decisions are made during the work.)
