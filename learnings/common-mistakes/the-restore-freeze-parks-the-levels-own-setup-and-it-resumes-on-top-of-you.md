---
category: common-mistakes
tier: generalizable
sourceGame: RoguelikeSample
phase: "5"
question: "Does the level / room run any of its own setup on game-clock timers or delayed tasks (a spawn delay, a wave warm-up) that the restore freeze SUSPENDS rather than cancels? Then the parked setup resumes after the apply and overwrites it."
sanitized: true
origin: "unity:common-mistakes/the-restore-freeze-parks-the-rooms-own-setup-and-it-resumes-on-top-of-you"
---

# The restore freeze parks the level's own setup, and it resumes on top of your apply

Applies when the game's level setup includes delayed steps on the game clock, which the restore freeze suspends.

The restore freezes the world so nothing overwrites the snapshot as it lands (CR-010). But a freeze built on a
stopped game clock doesn't **stop** the game's setup work — it **suspends** it. Every delayed step in flight waits on
the game clock, so it parks exactly where it is and resumes when time runs again: in the settle, or after Play —
either way **after** the apply. The observed shape, from a room's wave scheduler:

```
on room entry -> schedule:
    after 0.2 s:        disable every wave enemy
    after spawnDelay:   enable the first wave (with spawn effects)
```

The run went: freeze → apply (place the recorded enemy, switch the rest off) → Play → unfreeze → **the parked
schedule resumes**: the disable step switches off the enemy just restored, and the first-wave step spawns the whole
opening wave on top. The integrator: *"the enemies don't spawn until after I start playing."*

## Why the restore's own checks say everything is fine

Any checkpoint after the apply — even one reading live state, even one at the Play press — runs *before* the parked
step resumes. It sees the correct world. **Two clean checkpoints and a wrong replay is the signature.** The check
isn't broken; it's being asked while the answer is still yes.

## The fix: drain first, apply last

This is what CR-010 step 4 means by "wait for the game's native spawn to finish":

1. Reach active gameplay with **time running** and only the input hold on — no freeze — and the start-of-run skips
   gated on `IsRestoring()` (`07 §9.11`).
2. Wait on the game's **own idle signal**, not a guessed duration.
3. Then freeze → apply → settle → freeze.

Anything still pending on the game clock when you freeze is queued behind you and will run last. **"Last write wins"
is decided by resume order, not call order.**

## When the game doesn't raise its idle signal on the restore path

Here the game already had the right flag — a "still standing enemies up" boolean the wave manager clears when the
last enemy finishes activating — but it was **never raised on the restore path**: the normal room transition raises
it, the restore boot bypassed that path, and the one other setter was gated on a flag the restore had already
flipped. Raise it yourself from the restore boot, mirroring the game's own transition — a use of the game's contract,
not an invention. **Bound the wait and log the timeout**: a room with empty waves never clears the flag.

Related: `learnings/common-mistakes/a-freeze-stops-only-the-clocks-it-owns.md` (the same clock split
from the presentation side) and `learnings/common-mistakes/a-freeze-stops-only-the-clocks-it-owns.md` (the
mirror: work on a clock the freeze doesn't stop, which drifts instead of parking).
