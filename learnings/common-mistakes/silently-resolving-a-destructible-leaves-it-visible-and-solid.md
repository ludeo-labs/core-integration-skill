---
category: common-mistakes
tier: generalizable
sourceGame: RoomActionSample
phase: "4,5"
question: "Are there destructibles (breakable walls, destroyable turrets, props) whose 'destroyed' look is produced by the hit / break event rather than by entering a resolved state? Then a silent state restore brings them back whole."
sanitized: true
origin: "unity:common-mistakes/silently-resolving-a-destructible-leaves-it-visible-and-solid"
---

# Silently resolving a destructible leaves it visible and solid

Applies when a destructible's broken look comes from its break event, not from its state.

Level elements were restored by setting their state (off / resolved / active) **without** firing their designer
events, so nothing played twice on replay — the right instinct (`07 §11.1`). For levers the restore also re-applied
the pulled look. Destructibles got nothing: a breakable wall disappears only through its break event (meshes and
collision off, debris spawned, hit-stop), and entering "resolved" doesn't hide it. Captured as "resolved", restored
as "resolved" — and standing, solid, in the way. The same held for turrets destroyed by a parry.

The census had filed these under "level element state, covered", so no wave planned them. A per-level re-scan found
them across six levels, in one of which the wall blocks the only path forward.

## Fix shape

Add a small replay helper on the destructible that turns off its visuals and collision **without** the debris,
sound or hit-stop, and call it when the restore sets the element to resolved — in the same pass as the lever look.
No new captured data is needed: "resolved" already says it was destroyed. If the destructible's own init re-enables
its visuals after the apply, call the helper from `ApplyDeferred()` instead (`07 §6`).

## The question to ask while mapping objects (phase 4)

For every state change: ***does entering the state produce the look, or does the event that led to it?*** If it's
the event, a silent restore needs a look-only helper — record that in the entity's `OBJECT_TRACKING.md` block so the
restore plan picks it up, instead of leaving it to be discovered by a viewer walking into an invisible-in-intent,
solid-in-fact wall.
