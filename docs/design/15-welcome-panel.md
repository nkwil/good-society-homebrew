# 15 — Welcome Panel

**Status:** Locked — full first-load modal specified; visual proof rendered
**Date opened:** 2026-05-05
**Covers inventory entry:** #18 Welcome Panel

## Goal

Specify the first-load welcome modal (Plan §12.6). The first time a user opens any world running this system, they see this panel — three big options pointing them at the starting paths most users will want, plus a "don't show again" suppression. After dismissal, the panel is suppressed via the user-scoped `welcomePanelDismissed` setting (registered per CLAUDE.md §8).

This is the very first impression of the system. It matters disproportionately. The antique-but-clean principle does its work here at maximum weight: the panel reads like the title page of a society novel, sets the tone of the entire system, and gets out of the way fast.

## When and how it opens

- **Trigger:** `Hooks.once("ready", ...)` — opens once on world ready *if* `game.settings.get("good-society-homebrew", "welcomePanelDismissed") === false` for the current user.
- **Scope:** per-user setting. Each user sees the panel at most once until they tick "don't show again," at which point it's suppressed for that user across all sessions and worlds.
- **GM vs. player:** identical for both. The choices behind each button differ slightly per role (Sample World creates content the GM will own; players join a world someone else has set up) but the panel itself doesn't branch by role.

If the user dismisses the panel without ticking "don't show again," it reopens next session. This is intentional — closing without committing is "I'll think about it," not "stop showing me this."

## Sheet dimensions

```js
position: { width: 520, height: "auto" }
```

520px wide. Tall enough for the framed title + three button cards + footer, no scroll. Centered on the canvas with a 45% opacity ink-tone backdrop (same backdrop pattern as the Upkeep Wizard).

## Layout

```
┌────────────────────────────────────────────┐
│                                              │
│         ─── · ───  WELCOME TO  ─── · ───   │
│                                              │
│              Good Society                    │
│                                              │
│        A homebrew Foundry system...         │
│                                              │
│         ─── · ───              ─── · ───   │
│                                              │
│         PICK A STARTING POINT                │
│                                              │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│   │ SAMPLE   │ │  BLANK   │ │ QUICK-   │  │
│   │  WORLD   │ │ CAMPAIGN │ │  START   │  │
│   │          │ │          │ │  GUIDE   │  │
│   └──────────┘ └──────────┘ └──────────┘  │
│                                              │
├────────────────────────────────────────────┤
│  ☐ don't show again       v0.1.0 · welcome │
└────────────────────────────────────────────┘
```

CSS class root: `.gs-welcome-panel`

The panel is themed-neutral — pure house style throughout. The decorative ornaments (the centered dot fleurons between hairline rules) are the only flourish, and they're restrained: a single dot on each side.

## Header (title section)

CSS class root: `.gs-welcome-panel__title`

- Padding: 32px 36px 26px 36px.
- Background: `var(--gs-paper)`.
- Text-align: center.

### Top frame

A horizontal row centered: 80px max-width hairline rule, dot fleuron, 80px max-width hairline rule. Honey-gold dot (`var(--gs-accent-3)`) between sage hairlines (`var(--gs-accent-2)`). 14px gap below before the eyebrow.

This is the antique-but-clean principle's signature gesture: *one* ornament per side, period-correct, restrained.

### Eyebrow

"WELCOME TO" in 11px small caps, letter-spacing 0.2em (slightly more breathing than other small caps in the system — this is a title page, not a UI label), color `var(--gs-accent-2)` (sage).

### Title

"Good Society" in display type Lora at 36px, color `var(--gs-brand)` (forest green), line-height 1.05. The largest type anywhere in the system. Title-page weight.

### Description

Below the title in italic 14px Crimson Text, color `var(--gs-ink)`, line-height 1.6, max-width 380px centered. Single sentence: "A homebrew Foundry system for Storybrewers Roleplaying's Jane-Austen-inspired roleplaying game."

The description should never be more than two sentences. The panel is a welcome, not a manifesto.

### Bottom frame

Same dot-and-hairlines treatment as the top frame. 16px above, mirrors the top.

## Pick a starting point

CSS class root: `.gs-welcome-panel__choices`

Padding: 0 28px 24px 28px (no top padding — the title section already has bottom padding).

### Section eyebrow

"PICK A STARTING POINT" in 11px small caps, letter-spacing 0.16em, color `var(--gs-accent-2)`, centered, 14px margin below.

### Three option cards

Three-column grid: `grid-template-columns: 1fr 1fr 1fr; gap: 10px;`.

Each card:
- Background: `var(--gs-paper-warm)`.
- Border: 0.5px `var(--gs-accent-2)` (default) **or** 2px `var(--gs-brand)` (recommended). The 2px border is the visualize read_me's documented convention for marking a featured option (it's the one place where 2px borders are allowed).
- `border-radius: 8px`.
- Padding: 16px 12px.
- Text-align: center.
- Cursor: pointer.

Each card content:
- **Card title**: display type Lora, 18px, color `var(--gs-brand)`, line-height 1.1. Format: sentence case, e.g. "Sample world", "Blank campaign", "Quick-start guide".
- **Hairline divider**: 0.5px sage rule, 40% width, centered, with 8px margin top and bottom.
- **Card description**: italic Crimson Text, 11px, line-height 1.55, color `var(--gs-ink)`. One sentence describing what the option does.

### Recommended badge

The Sample World card has a small badge sitting above its top edge:
- Position: absolute, `top: -10px; left: 50%; transform: translateX(-50%);`.
- Background: `var(--gs-accent-1)` (terracotta).
- Color: paper.
- Font-family: Crimson Text, font-size: 9px, letter-spacing: 0.12em.
- Padding: 2px 10px.
- Border-radius: 100px (pill).
- Label: "RECOMMENDED".

The badge draws the eye without making the card itself shout. The 2px border + small badge is the same featured-option pattern from any well-designed pricing page.

### What each card does

#### Sample world (recommended)

- **Action**: Imports the bundled compendium pack (`packs/sample-world/`) into the active world. Creates the Cloudcandle and Willowood families, the Marquess, Lady Rose, Roger, Dixon, Avril, Pearlinda (when her theme exists), the canonical Connections (Hats McHats, Lavinia Fernvale, Sir Alphilan Seaweaver, Lady Mystery, the Gentleman Chaperone), a sample ballroom Scene with NPC tokens placed, sample Inner Conflicts pre-authored, and a few canonical Reputation Conditions.
- **Default**: GM users get this option pre-selected; player users get it but the action is "open the existing Sample World instead" if the GM has already imported.
- **Why recommended**: A working game in 30 seconds. Lets new users see the system in action before they have to author anything.

#### Blank campaign

- **Action**: Creates empty folders for Major Characters, Connections, Family, NPC. Sets `cyclePhase` to `pre-cycle`. Suppresses the panel for this world.
- **Default**: For GMs who already have campaign content authored elsewhere and want to import or build manually.

#### Quick-start guide

- **Action**: Opens a journal entry (created in the world if not already present) titled "Good Society — Quick Start" containing a short prose walkthrough of mechanics, sheet anatomy, cycle flow, and links to relevant rulebook pages.
- **Default**: For users who want to read before committing to a path. Doesn't import anything; just opens the guide.

## Footer

CSS class root: `.gs-welcome-panel__footer`

- Background: `var(--gs-paper-warm)`.
- 0.5px top border in `var(--gs-accent-2)`.
- Padding: 14px 28px.
- Display: `flex; justify-content: space-between; align-items: center`.

### Don't show again

- A small checkbox + label as a clickable group.
- Checkbox: 14×14px, 0.5px border `var(--gs-accent-2)`, 3px corner radius, transparent background. When checked, fills with `var(--gs-brand)` and shows a small paper checkmark.
- Label: italic Crimson Text, 11px, color `var(--gs-accent-2)`, "don't show again".

When ticked and the user picks any of the three options (or closes the panel), `welcomePanelDismissed` is set to `true` on the user setting.

### Version footnote

Right side: italic 11px in `var(--gs-accent-2)`, format "v{version} · welcome to the cycle". The flavor "welcome to the cycle" is a tiny double meaning — Good Society's cycles of play, and the user's ongoing engagement. Optional flavor, can be replaced with just the version string if the joke doesn't land.

## Why no logo or imagery

A logo would commit the system to one visual identity. Good Society as a printed game has its own branding (Storybrewers' cover art, etc.) that we shouldn't appropriate. The system uses typography and a single ornament as its identity instead.

If a future version wants a logo, it slots in above the eyebrow naturally (the title section has padding-top 32px which leaves room for ~80px of imagery without breaking layout).

## Theme behavior

The Welcome Panel is **pure house style**. No `.gs-themed` wrapper. The user hasn't picked a character yet — there's no theme to inherit.

This is consistent with the system's broader theme rules: themed surfaces are character-bound. Pre-character surfaces (settings, the dashboard's GM bulk actions row, the Welcome Panel) all stay house-styled.

## Edge cases

### Panel dismissed without picking
The user closes the modal (Escape, click outside, click a close button) without picking. The `welcomePanelDismissed` value depends on the checkbox: if ticked, suppress; if not, show again next session.

### Sample World already imported
If the world already has the Sample World content (detect via a flag set by the import action), the Sample World card label changes to "Open sample world" and the action becomes "open the Cloudcandle Estate scene" rather than "import."

### Player user opens before GM does
Players can see the panel even if they're not the GM. For a player, "Sample World" imports content into the *world they're connected to* — but only the GM has permission for that. The action falls back gracefully: if the user lacks permission, a small toast appears: "Ask your GM to enable the sample world."

The Quick-Start Guide is always available regardless of permissions (it's a journal entry, readable by any user).

### v0 / pre-release
For early development, the panel can include a small "v0 — pre-release · expect bugs" eyebrow above the title section, as a tasteful warning. Removed for v1.0.

### User has the panel open in two browser tabs (rare but possible)
Settings update is reactive — picking an option in one tab updates the setting and dismisses the panel in the other. No special handling.

## Accessibility considerations

- Each option card has an `aria-label`: "Open the sample world. Imports a pre-built Swan's Crossing campaign with the Cloudcandle and Willowood families."
- The Recommended badge is announced via `aria-label="Recommended"` on the card (so screen readers don't read the visual badge as decoration).
- Tab navigation works: tab through the three cards, Enter activates.
- Escape dismisses the panel without picking.

## Implementation notes for Claude Code

When prompted to build this panel:

1. Build the panel `ApplicationV2`. Position center, with backdrop. Wire to open via `Hooks.once("ready", ...)` if `welcomePanelDismissed === false`.
2. Build the title section. Hardcode the title and description. Verify the dot-and-hairline ornaments render correctly (they're a small but distinctive component).
3. Build the three option cards. Wire each to its action (Sample World import, Blank Campaign setup, Quick-Start journal).
4. Wire the "don't show again" checkbox to update `welcomePanelDismissed`.
5. Test the panel suppression: tick the checkbox, dismiss, reload. Verify the panel doesn't reopen.

CSS organization:
- `styles/apps/_welcome-panel.css` — full panel styling
- Reuse: `_dot-fleuron.css` if you extract the title-frame ornament as a reusable component (it could later appear at the top of the Sample World's intro journal entry)

### Test path

1. New world. Reload as GM. Verify the panel opens.
2. Click Sample World. Verify content imports (compendium dialog, content appears in actors directory).
3. Reload. Verify the panel does NOT reopen (since GM dismissed by acting).
4. Reset `welcomePanelDismissed` to false manually. Reload. Panel reopens.
5. Tick "don't show again". Click anywhere outside the modal. Verify the panel dismisses and the setting is `true`.
6. Reload. Verify panel does not reopen.

## Open questions

1. **Should the panel autoplay sample music?** A short snippet of period music to set tone. **Tentative answer: no.** Audio is invasive on first open. Could be a "play sample music" link inside the panel for users who want it.

2. **Should the Sample World import be reversible?** A "rollback" action that removes the sample content. **Tentative answer: no for v1.** Deleting the world or re-importing handles this fine. Reversibility adds substantial complexity for marginal benefit.

3. **Should the panel offer a tutorial walkthrough mode?** Step-by-step "click here, then here." **Tentative answer: no, defer to v1.1.** Quick-Start Guide as a journal entry is the lighter-touch alternative; tutorials are a different design problem.

4. **Should the version footnote include a "what's new" link for returning users?** **Tentative answer: defer to v0.2.** When the system has a real version history, link to a CHANGELOG journal entry from the footnote.

5. **Sample World content — what's actually in it?** This doc says it imports "the Cloudcandle and Willowood families, the Marquess, Lady Rose, Roger, Dixon, Avril..." — but the canonical content authoring is a Phase 11 task per the system plan. **Tentative answer: define the Sample World content in a separate doc (`sample-world-content.md`) when Phase 11 begins.** This doc commits to the *mechanism* of the sample import; the content itself can evolve.

## Visual proof

The Welcome Panel is rendered above (`good_society_welcome_panel_first_load`) on a darkened backdrop, validating: the dot-fleuron-and-hairline title frame, the title-page typography weight (36px Lora "Good Society"), the three option cards with the Sample World featured via 2px border + RECOMMENDED badge, the footer with don't-show-again checkbox and version footnote.

The visual confirms the antique-but-clean principle holds at the highest-stakes scale: a title-page moment that doesn't drift into ornamental excess.

## Changelog

| Date       | Change                                                                |
|------------|-----------------------------------------------------------------------|
| 2026-05-05 | File created. First-load modal specified with three option cards, suppression behavior, and the Sample World featured-option treatment. Visual proof rendered with dot-fleuron title frame. |
