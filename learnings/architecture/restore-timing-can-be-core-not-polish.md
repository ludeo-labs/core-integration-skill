---
category: architecture
tier: generalizable
sourceGame: TacticsGame
phase: "5"
question: "Does the game run a queued or staged sequence after its 'gameplay active' signal — turn-based action/animation queues, scripted intros, staged spawns, state-machine boots — that a restore could land in the middle of?"
sanitized: true
origin: "unreal:architecture/restore-timing-can-be-core-not-polish"
---

# Restore timing can be part of the game's mechanics — don't reflexively defer it to polish

**Precondition:** after its "gameplay active" signal the game still plays a choreography: queued actions and
animations, a scripted battle intro, staged spawns, a state machine booting up.

## The trap

Timing problems feel like polish (phase 8). On a turn-based game the human challenged exactly that framing, and was
right: **when** the restore lands is the mechanics. Whose turn it is, what is animating and which input is legal form a
choreography; restoring into the middle of it gave nondeterministic, demo-breaking failures — an intermittently empty
ability bar, wedged input, a turn that couldn't advance — that no amount of correct *data* fixed.

## What worked — every piece driven by the game's own signals, none by wall-clock guesses

1. **Apply only into a quiescent game.** After the gameplay-active gate, also wait until the game's own "something is
   animating" signals (its ongoing-actions and blocking-actions sets) have been **continuously empty for ~0.5 s**, then
   freeze → apply. This is part of reaching active gameplay (`07 §2.1` step 4), unfrozen and bounded. It removed a
   1-in-3 empty-ability-bar race that data-side fixes never touched.
2. **Capture only actionable moments** (the write-side twin). The platform's restore point follows the creator's trim,
   not the capture press, so every captured frame must be restorable. Gate per-tick writes on "a player unit is active
   and nothing is animating"; any frame a user can trim to then holds a player-actionable state.
3. **Move through the game's own flow, not around it.** To start on the captured unit, advance turns through the game's
   own end-turn input function — guarded to player-controlled units and never across a round boundary — so each
   transition rebuilds the UI and animation layers natively. Overwriting the turn system's state directly is what had
   desynchronized them.

## The rule

A timing item is core restore work (phase 5) whenever it gates **core playability** of the restored moment: can the
player act, is the input loop alive, is the right entity's turn running? Leave only genuinely cosmetic timing
(animation blending, camera easing, late-loading visuals) for phase 8.
