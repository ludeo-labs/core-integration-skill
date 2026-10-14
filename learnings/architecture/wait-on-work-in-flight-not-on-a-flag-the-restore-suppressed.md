---
category: architecture
tier: generalizable
sourceGame: RoguelikeSample
phase: "5"
question: "Is the restore waiting on a game flag before it applies — a 'still loading' / 'still spawning' signal? Find what LOWERS that flag. If the only thing that lowers it is a system the restore suppresses, the wait can only end in its timeout."
sanitized: true
origin: "unity:architecture/wait-on-work-in-flight-not-on-a-flag-the-restore-suppressed"
---

# Wait on the work actually in flight, not on a flag your own restore stopped anything from lowering

**Precondition:** before the apply (`07 §2.1` step 4), the restore waits for the room to finish standing up its own
entities — otherwise the room's setup switches off what the restore just placed.

The obvious signal was the game's "still spawning enemies" flag, waited on with a timeout. Measured, that wait burned
**7.6 of the 10 seconds** between selecting a moment and the moment being playable, on every replay, and ended in a
warning describing a fault that was not there.

The flag was raised by the room transition and lowered in exactly **one** place: the tail of the per-enemy activation
sequence. The restore arms the recorded wave cursor so the room does not re-fight waves it already fought — so the
activation sequence never runs — so nothing lowers the flag. **The wait could only end in its timeout, by
construction, on every moment recorded mid-fight.** Which is most of them.

## The fix

Ask "is anything actually doing the work", not "is the flag down". Count in-flight activations directly — increment
when the work starts, decrement at **every** exit including early ones — and proceed when the count is zero. Keep
honouring the flag when it does clear; then it is telling the truth.

Two details that each cost a round:

- **Latch "the room's setup has run at least once".** The restore starts waiting **before** the room fires its enter
  signal, when nothing is in flight yet. Proceeding on "count is zero" alone applies the moment, then the room's setup
  deactivates every placed enemy a moment later. Proceed on *setup ran at least once AND nothing in flight*.
- **Do not count work that is merely scheduled.** The first version incremented on entry to the wave-enable sequence,
  including a branch that schedules a mandatory wave **ten seconds** out. A wave that has not started is not standing
  anyone up, so the count read 1 for the whole timeout and the stall returned with a more honest message. Increment
  after the initial delay elapses.

## Why counting beats replicating the trigger conditions

Evaluating the game's own trigger predicates ("can any wave still start?") rots the moment the studio adds a trigger
type, and races: the "wave started" flag flips at the start of activation while entities stand up hundreds of
milliseconds later. Counting hooks the code that **does** the work, not the conditions that decide to.

Reset the counters at the start of each restore. A sequence killed mid-flight (a deactivated manager, a level unload)
never reaches its decrement, and a counter that leaks upward reinstates the full-timeout stall permanently. Related:
`learnings/architecture/a-world-ready-flag-may-still-answer-for-the-world-you-are-leaving.md`.
