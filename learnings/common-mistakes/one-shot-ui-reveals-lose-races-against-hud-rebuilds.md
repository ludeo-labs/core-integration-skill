---
category: common-mistakes
tier: generalizable
sourceGame: TPSSample
phase: "5"
question: "Does the HUD rebuild itself asynchronously on level load (clear-and-recreate of map tiles, markers, widgets), while the things it displays are revealed by ONE-SHOT calls (a door drawn on room entry, an enemy marker switched on at spawn)?"
sanitized: true
origin: "unity:engine-quirks/one-shot-ui-reveals-lose-races-against-hud-rebuilds"
---

# One-shot UI reveals lose races against HUD rebuilds

Applies when a HUD (minimap, objective markers) rebuilds asynchronously on level load and its content is revealed by
one-shot calls. Such HUDs clear every tile and marker on load, wait (often on scaled time), then re-create everything
switched off. In normal play the sequence is safe: the rebuild finishes behind the loading screen, and reveals come
later, from player actions.

A restore reveals **during** the rebuild. The reveal call succeeds — on a widget that is about to be destroyed. Three
separate symptoms in one integration came from this single race: revealed rooms losing their door markers, a second
replay's tiles drawn on the previous level's still-registered widgets, and enemy markers that never appeared.

## The pattern that fixed all three

**Re-assert until provably landed.** Keep every reveal the restore issues on a pending list; each tick, re-run the
reveal and remove it only when a landed-condition holds against the **live** widget — not a flag that outlives the
rebuild:

- the HUD registry's widget for this key **exists**;
- it is bound to **this** level's object (an identity check — a same-index widget from the previous level passes every
  other test);
- the data the reveal draws from has arrived (a replicated list can be empty on a client while the authority's copy is
  full).

Run the pending list through the settle (`07 §2.1`) — time runs there, so a HUD rebuild waiting on scaled time can
finish — and treat "pending list empty" as part of the moment being settled: don't open the room until it drains,
bounded like every other restore wait, with a log line naming any reveal that never landed. Nothing is written after
Play (CR-010), so a reveal still pending at `RoomReady` is a bug to fix, not a write to finish.

## Two adjacent traps found the same way

- A marker's fallback reveal was **structurally dead** for one entity class: its "which module am I in" id is never
  set, so the "is this module visible" gate never passed.
- Positions were anchored to a "current module" that only **door crossings** update. A restored player never crosses
  a door, so everything drew off-mask a whole level away. Any anchor the HUD derives from player traversal must be
  asserted explicitly by the restore (`07 §8`, environment restoration).
