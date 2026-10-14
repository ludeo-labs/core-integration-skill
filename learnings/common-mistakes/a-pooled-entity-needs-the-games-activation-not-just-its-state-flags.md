---
category: common-mistakes
tier: generalizable
sourceGame: TPSSample
phase: "5"
question: "Do the game's pooled entities go through an explicit activation step after leaving the pool (start the AI, kick the state machine, a wave trigger) - i.e. is a freshly-pulled instance 'parked' until something starts it?"
sanitized: true
origin: "unity:common-mistakes/a-pooled-entity-needs-the-games-activation-not-just-its-state-flags"
---

# A pooled entity needs the game's activation, not just its state flags

**Precondition:** pooled entities come out of the pool parked and are started by a separate activation call.

Restored enemies were pulled from the pool, placed, health-set, arrival-completed and visibility-flagged — and stood
there as unshootable statues. The pool's acquire path parks an instance in a neutral state and its release path stops
its behaviour tree; the game un-parks an entity only through its activation call (`StartAI()`, run by the wave logic
when a fight starts). The restore reproduced every *value* and skipped the one *call* that makes it an enemy.

Three compounding traps:

1. **Flag-setting is not activation.** Visibility, arrival and dissolve flags can all read correct while the
   entity's driver is stopped. Value checks can't see the parked state; only a rendered-result check and a checkpoint
   after Play exposed it.
2. **Don't release-then-acquire from the same pool in one pass.** The restore released the level's pre-spawned
   population, then acquired instances for the captured enemies — and got the just-released bodies back, with hidden
   renderers and stopped trees no flag-setting cured (20 released, 20 broken). **Spawn the restored set first,
   release the replaced population after.**
3. **Visual work races the entity's async init.** Calling the reveal path at spawn time can land before the entity's
   effect controller finishes its asynchronous init, which then applies its own hidden baseline over yours. The
   game's own spawn path waited on an `isReady` flag before any visual work. That wait needs frames, so it can't run
   in the frozen apply (CR-010 "Freeze vs suppress"): queue the entity and run the reveal in the settle once it
   reports ready — bounded, and done before `OpenRoom`. (An arrival effect is better placed already-finished,
   `07 §6`.)

## The rule

After the restore spawns a pooled entity and applies its values, run **the same activation call the game's own
spawn flow ends with** — after the values, so a restored mid-death entity resumes dying instead of fighting — and
sequence pool traffic so the restore never consumes instances it just released. Sometimes what's missing isn't a
value at all; it's a call.
