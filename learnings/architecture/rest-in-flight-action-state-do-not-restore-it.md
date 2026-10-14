---
category: architecture
tier: generalizable
sourceGame: RoguelikeSample
phase: "5"
question: "Does the character controller gate input or attacks on a state field cleared only at the END of a move, dodge, stun or knockback — a timed sequence the restore does not run? Restore that field faithfully and the character is frozen for the whole moment."
sanitized: true
origin: "unity:architecture/rest-in-flight-action-state-do-not-restore-it"
---

# Rest the in-flight action state — and make the can-act check read the controller's own gates

**Precondition:** the player controller gates movement or attacks on action-phase fields that only the end of the
action clears. `07 §1.2` states the rule (normalize transient action-phase state, never mirror it); this is what it
looked like, and the two things it adds.

## What happened

A moment was recorded mid-swing. The capture honestly wrote the move-state enum (`Executing`), a combo frame
part-way through its total, dodge, stun and knockback flags — and the restore wrote every one back. The world looked
perfect, every read-back check passed, and the player could not move or attack. The decisive line:

```cpp
can_request_moves = (move_state == MoveState::None);
```

`move_state` returned to `None` in exactly one place: the tail of the move manager's execution path, which runs only
while a move is in flight. Movement had the same shape one layer over: the stun and knockback checks each returned
out of the whole input pass, and both flags were cleared only by systems that were not running — the knockback's
clearer compared elapsed time against a duration written only when a knockback **starts**, so it was never captured.

A recorded moment resumes mid-**fight**, not mid-**swing**. Rest the action state to what the character holds a frame
later — able to act — and restore the descriptive state (health, resources, cooldown values, modifiers, facing,
status effects) normally.

## Addition 1 — then stop capturing it

A value the restore always discards is not state. Keeping it in the capture costs per-tick bandwidth for a number that
can never be honoured; mark it "rest, not captured" in `RESTORATION_PLAN.md`'s per-field disposition (`06 §9.6`).

## Addition 2 — the can-act check must read the controller's gates

The integration already had a check at `Begin` naming every reason the player might be unable to act. On the frozen
run it logged "the player can act — every input gate is clear", because it read only the global input-blocked flag
and screen state. The controller's own gates — mid-move, stunned, knocked back, mid-dodge — were invisible to it. A
check that cannot see what broke is worse than none, because it is read as proof. Enumerate the conditions the
**controller** returns on, and have any forced-recovery path rest that state rather than returning early when the
global flag is clear (`11 §8`).

## Finding them before a playtest

Grep for the assignment that **resets** each candidate field, not the one that sets it. One writer, sitting at the end
of a timed sequence the restore suppresses or never starts, means the field must be rested.
