---
category: save-systems
tier: generalizable
sourceGame: EndlessFPS
phase: "5"
question: "Do killed entities linger in the world (ragdoll, death animation, corpse) as the same object, so capture keeps writing them and the snapshot contains entities at health <= 0?"
sanitized: true
origin: "unreal:save-systems/captured-dead-entities-restore-as-corpses-via-death-path"
---

# The snapshot contains dead entities — restore them as corpses through the game's own death path

**Precondition:** a killed enemy stays in the world as the **same** object (ragdoll, death pose, corpse) for
seconds or forever, so per-tick capture keeps writing it. A moment captured during or just after combat then holds
entities at **health <= 0** — the kills made just before the captured frame, clustered exactly where the action
was. This is the tombstone case of `06 §3.5`: the object is still in the reconstructed world, in an ended state.

## Three wrong ways (all field-tested)

1. **Drop them** (`if (health > 0) Spawn(...)`). In a real capture this discarded 7 of 9 entities — the whole
   cluster in the player's face — leaving the scene empty right where the highlight happened, and it got
   misblamed on transforms or the camera.
2. **Spawn them and write health <= 0.** Writing the value does not make a corpse — the game's death logic runs off
   the death **event**, not the health field — so you get standing, live-looking enemies with zero health (see
   `learnings/common-mistakes/choose-the-restore-write-path-per-field.md` on raw writes).
3. **Revive them all** at their captured spots with default health. That fabricates a point-blank pack fight that
   never happened — the player killed them one at a time and now gets overrun by all of them at once.

## The right way

Pass 1 spawns or matches the entity at its captured transform; Pass 2 writes the captured health and then **drives
the game's own death path** — the same death entry point gameplay uses, which plays the ragdoll / death pose and
sets every "dead" flag the AI, targeting and HUD read. If that path needs live subsystems (physics for the ragdoll,
animation), call it from `ApplyDeferred()` (`07 §6`). Corpses restored this way are scene dressing at full
fidelity; the genuinely living entities restore alive.

Watch the death path's side effects: it may award score, drop loot or increment a kill counter. The snapshot
already contains those results — suppress them while `IsRestoring()` or recompute aggregates afterwards
(`07 §11.2`).

## Action detection — free if ordered right

Restored corpses must not fire spurious `Kill` actions. If the action detector seeds its alive/dead baselines
**after** the apply (at `Begin`), corpses enter the cache already dead and only a real alive→dead transition
fires.

## Edge case

An entity killed **on** the captured frame also reads health <= 0 and becomes a corpse — the data can't tell
"dying this frame" from "died seconds ago". Usually acceptable; fixing it is a capture-side change (stop writing
entities at death, or capture a death timestamp), not a restore-side hack.

Related: `learnings/common-mistakes/dead-bodies-need-kill-time-capture.md` (the other case: the game removes the logical
entity within a frame or two of death, so corpses must be recorded at kill time),
`learnings/common-mistakes/check-the-restore-cannot-fire-your-kill-action.md`.
