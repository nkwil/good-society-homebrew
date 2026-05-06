# 27 — Token Frame (Canvas)

**Status:** Locked — three variants specified, Foundry rendering API path specified
**Date opened:** 2026-05-05
**Covers inventory entry:** #51 Token frame (canvas)

## Goal

Specify the canvas-side rendering of token frames — the rings/borders that distinguish Major, Connection, and NPC tokens at a glance on a populated scene. This is the design system's per-actor accent language extended onto the Foundry canvas, so the same visual identity that appears on sheets (theme-colored sheet headers), in lists (themed left-edge stripes on dock and dashboard rows), and in chat (themed brand colors on chat cards) also appears on the canvas.

Without consistent token frames, the canvas is the one place in the system where character themes go silent — a populated ballroom would have neutral tokens, breaking the visual continuity that the rest of the design carefully builds.

## Three variants

The system supports three token frame variants matching the three theme categories:

| Variant | For | Ring color | Ring weight | Ring style |
|---|---|---|---|---|
| Major | Major character actors | Theme `var(--gs-brand)` | 3px | Solid + outer glow |
| Connection | Connection actors | Connection variant `var(--gs-brand)` | 2px | Solid |
| NPC | NPC actors | House `var(--gs-accent-2)` (sage) | 1px | Dashed |

The progression — from prominent (Majors) to subtle (NPCs) — encodes narrative weight: the player characters draw the eye most, supporting cast next, ambient cast least. Same hierarchy as the persistent UI's chrome (themed dashboard rows for Majors, simpler dock-style for Connections, near-invisible NPC rows in the Organizer).

## Visual

```
   Major (Lady Rose)        Connection (Hats)        NPC (Madame Lacroix)
   
   ┌─────────────┐         ┌──────────┐              ┌─────────┐
   │  outer ring │         │ outer    │              │ dashed  │
   │  with glow  │         │ ring     │              │ ring    │
   │   ┌─────┐   │         │  ┌────┐  │              │ ┌─────┐ │
   │   │  R  │   │         │  │ H  │  │              │ │  L  │ │
   │   └─────┘   │         │  └────┘  │              │ └─────┘ │
   └─────────────┘         └──────────┘              └─────────┘
   
   3px solid +              2px solid                 1px dashed
   theme glow               theme color               sage (house)
```

CSS class root: not applicable — this is canvas rendering, not HTML.

## Implementation approach

Foundry v13 provides two paths for custom token frames:

### Option A — `TokenRingConfig` (Foundry's built-in token rings)

Foundry has a `core.tokenRingSubject` system that supports custom ring colors per token. This is the lighter-touch approach.

For each token of an actor, the system sets:

```js
token.update({
  "texture.tint": null,         // don't tint the underlying token image
  "ring.enabled": true,
  "ring.colors.ring": getThemeRingColor(actor),
  "ring.colors.background": null,
  "ring.subject.scale": 1.0,
});

function getThemeRingColor(actor) {
  if (actor.type === "npc") return "#708060";  // house sage
  const themeId = actor.system.theme;
  const theme = CONFIG.GOODSOCIETY.themes[themeId];
  return theme?.brandColor || "#2A3A2D";
}
```

The ring weight (3px / 2px / 1px) maps to Foundry's ring `subject.thickness` property or similar. The dashed style for NPCs would require either a custom ring sprite (if Foundry supports per-actor ring textures) or fall back to a thinner solid ring.

### Option B — Custom canvas overlay

A custom PIXI graphics overlay drawn above each token. More complex but allows full control over ring style (dashed lines, glow effects).

Implementation in `module/canvas/token-frame-overlay.js`:

```js
Hooks.on("drawToken", (token) => {
  const actor = token.actor;
  if (!actor) return;
  
  const ring = new PIXI.Graphics();
  const config = getTokenFrameConfig(actor);
  
  ring.lineStyle(config.weight, config.color, 1.0, 0.5);
  if (config.dashed) {
    drawDashedCircle(ring, token.w / 2, token.h / 2, token.w / 2 + 4);
  } else {
    ring.drawCircle(token.w / 2, token.h / 2, token.w / 2 + 4);
  }
  
  if (config.glow) {
    // outer glow filter
    ring.filters = [new PIXI.filters.GlowFilter({color: config.color, distance: 6})];
  }
  
  token.addChild(ring);
});
```

This option gives full control over the dashed NPC ring and the Major's glow effect.

### Recommendation

**Try Option A first.** If Foundry's built-in token ring system supports per-token ring colors (it does in v13), use it. The performance is better (rendered by Foundry's optimized pipeline) and the implementation is simpler.

Fall back to Option B if:
- Foundry's ring system doesn't support per-token colors (unlikely in v13).
- The dashed NPC variant can't be achieved with built-in rings.
- The Major's outer glow effect requires custom overlay.

The fallback is a one-time decision per implementation pass; after that, every token uses the same approach.

## Persona-aware

When an actor's persona changes, the token's ring color may shift if the persona has a `chatColor` override (which we already use for chat cards per `10-chat-cards.md`).

Implementation: when `goodSociety.personaSwitched` fires, recompute the token's ring color from the actor's active persona's chatColor (falling back to the theme's brandColor). Update the token via `token.update({...})` to apply the new ring.

This means Avril's token ring color shifts subtly between her Maid persona (candlelight gold via the theme) and her Black Hound persona (a deeper oxblood if her chatColor override is set). The ring shift is the canvas-side complement to her chat card color shift.

## Edge cases

### Token without a linked actor
No ring. The system only applies frames to actor-linked tokens.

### Token's actor is deleted
The ring persists with stale color until the token itself is deleted or the user reloads. Foundry's default token cleanup on actor delete usually handles this.

### NPC promoted to Connection
The `goodSociety.actorTypeChanged` hook fires (custom hook on the system's promotion flow per `16-npc-sheet.md`). The token's ring updates from the dashed NPC ring to the solid Connection ring with the chosen connection theme.

### Theme changed mid-session
If a player changes their character's theme via the persona switcher's "edit" mode (e.g. Rose moves from `rose` to a new theme), all of Rose's tokens across all scenes update their ring colors on next render. The persona swap pipeline already iterates `scene.tokens.filter(...)`; reuse the same iteration for ring updates.

### Sequencer effects layered on tokens
Sequencer animations (per Plan §10 magic casts and persona swaps) draw above the token but below the UI layer. They don't conflict with the ring overlay — the overlay is part of the token's own display; the Sequencer sprite is a separate entity.

### Performance with many tokens (50+)
The ring rendering is cheap (one circle per token). Even busy scenes with 50+ tokens won't strain the canvas. Foundry's built-in rings are optimized; the custom overlay approach (Option B) batches into a single PIXI container.

## Theme behavior summary

The token frame is the canvas-side proof that the per-actor theme system extends fully across all surfaces:
- Sheets (themed sheet headers, themed body content)
- Persistent UI (themed accent stripes on dashboard/dock/organizer rows)
- Chat (themed chat cards via `.gs-themed` wrapper)
- Letters (themed letter cards)
- Hover cards (themed token hover cards)
- **Canvas tokens (this doc — themed token frames)**

A character's visual identity is consistent everywhere they appear in the system. The token frame closes the loop.

## Implementation notes for Claude Code

When prompted to build the token frame:

1. Try Option A first. Implement `getThemeRingColor()` helper. Wire on `Hooks.on("drawToken", ...)` to apply the ring color via Foundry's token ring API.
2. Test with Major, Connection, and NPC tokens on a sample scene. Verify the three variants render distinctly.
3. If Foundry's ring API can't achieve the NPC's dashed style, switch to Option B for NPCs only (custom overlay just for the dashed ring; Majors and Connections use Option A).
4. Wire to `goodSociety.personaSwitched` to update rings on persona changes.
5. Wire to `goodSociety.themeChanged` (custom hook fired when an actor's theme is updated) to update rings on theme changes.
6. Wire to `goodSociety.actorTypeChanged` (NPC ↔ Connection promotion/demotion) to update ring style.

CSS organization: not applicable for canvas rendering. Configuration in `module/canvas/token-frame.js`.

### Test path

1. Place a Major token (Lady Rose) on a scene. Verify a 3px pink-wine ring appears around her token.
2. Place a Connection token (Hats McHats). Verify a 2px sage ring appears.
3. Place an NPC token (Madame Lacroix). Verify a 1px dashed sage ring appears.
4. Switch Avril's persona to The Black Hound. Verify her token's ring color shifts from candlelight gold to oxblood.
5. Promote Madame Lacroix from NPC to Connection (Connection Green). Verify her token's ring changes from 1px dashed sage to 2px solid green.
6. Change Rose's theme via persona editor. Verify her token's ring color updates immediately.

If 1–6 pass, the token frame is production-ready.

## Open questions

1. **Should the Major's outer glow be subtle (8% opacity, 4px distance) or more pronounced?** **Tentative answer: subtle.** A pronounced glow would compete with Sequencer effects during magic casting. Subtle glow is "always present in the world," strong glow is "actively casting."

2. **Should secret-persona token rings hide their identity from non-owners?** I.e. when Avril is in Black Hound persona and the GM is the only one who knows, should other players see Avril's normal candlelight gold ring or the Black Hound's oxblood ring? **Tentative answer: show the active persona's ring color to all viewers.** Consistent with the hover card's persona-aware rendering — the visual identity is always the active persona, even from non-owners' views.

3. **Should the ring color animate during persona swaps?** Cross-fade from old color to new over the 400ms swap pipeline. **Tentative answer: yes if Option A supports it natively.** Otherwise defer to v1.1.

4. **Should there be a fourth ring variant for "highlighted" tokens?** E.g. when the GM clicks a token to focus the camera, briefly highlight the ring. **Tentative answer: yes — a 600ms golden pulse on top of the existing ring.** Separate from the static identity ring; doesn't override it.

5. **Should Family heirs get a special ring decoration?** A small crown glyph on top, for instance. **Tentative answer: no for v1.** The crest medallion lives on the Family sheet; tokens stay clean.

## Visual proof

Three token frame variants are rendered above (`good_society_final_three_designs`, bottom section) on a darkened canvas-suggesting backdrop:

1. **Major (Lady Rose)** — 70px token with 3px solid pink-wine ring and a soft outer glow.
2. **Connection (Hats McHats)** — 56px token with 2px solid sage ring.
3. **NPC (Madame Lacroix)** — 50px token with 1px dashed sage ring.

The size hierarchy reinforces narrative weight (Majors largest, NPCs smallest), and the ring weight + style differentiation makes actor type instantly recognizable at a glance even at small canvas zooms.

## Changelog

| Date       | Change                                                                |
|------------|-----------------------------------------------------------------------|
| 2026-05-05 | File created. Three token frame variants specified for Major / Connection / NPC. Foundry rendering API path specified with fallback option. Persona-aware and theme-change reactivity specified. Visual proof rendered for all three variants. |
