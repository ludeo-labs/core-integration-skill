---
category: architecture
tier: universal
sourceGame: TPSSample
phase: "5"
question: null
sanitized: true
origin: "unity:architecture/write-restored-state-to-whoever-owns-it"
---

# Write restored state to whoever owns it, not to the field you can reach

The most repeated failure of a first restore wave is not writing the wrong value. It is writing the right value to
the wrong place: a field that a live system re-derives, re-copies or re-assigns a moment later. The write succeeds,
the log is silent, and the state is gone by the time anyone looks. It happened three times in one wave, each in a
different subsystem, each looking like a different bug:

| What was written | Who actually owned it | How it came back wrong |
|---|---|---|
| the player's position | the spawn handshake, ~1 s after the level activates | player teleported to the level entrance a second after the restore placed them |
| an entity's visibility | the arrival sequence, which reveals at its final step | entities present, correctly placed, invisible |
| an entity's "is dying" flag | the behaviour tree, which copies its own variable onto the entity when it initializes | flag flipped back moments after the restore set it |

**The restore does not own the world; it is a guest in it.**

## The habit

For every value you restore, ask **who writes this between now and the first frame the player controls?**

1. **Nobody** — write the field. Most values are here.
2. **A system that re-derives it** — don't write it, and don't check it; it is recomputed from state already
   reproduced (an aggro target from line of sight). Checking it buries real findings in false alarms.
3. **A system that owns it and will overwrite you** — write to the **owner**: set the behaviour tree's variable, not
   the entity's field; complete the arrival sequence, not the visible flag; let the spawn handshake run and place the
   entity **after** it (`07 §6` deferred application when it needs a frame).

Case 3 costs days because the naive fix — suppress the overwriting system — usually breaks something worse.
Suppressing the spawn handshake produced a half-spawned player with no camera orientation: a black screen and
thousands of zero-vector warnings. The system was doing more than the one thing it appeared to do.

## Find them without a run each time

Read the write path of the field you are about to set and grep for every other assignment to it. A field with several
writers has an owner, and the owner is rarely you. Three of these were found in minutes once the habit existed; each
had cost a build-and-run before.

## Why order matters

Anything owned by a system that runs on spawn or level entry must be written **after** that system finishes — which is
why `07 §2.1` step 4 waits for the game's native spawn before the apply, and why placement goes last. See
`learnings/architecture/boot-the-replay-through-the-games-own-entry-flow.md`,
`learnings/architecture/restored-entities-must-arrive-already-arrived.md` and the check that catches regressions,
`learnings/architecture/make-the-restore-verify-every-value-it-writes.md`.
