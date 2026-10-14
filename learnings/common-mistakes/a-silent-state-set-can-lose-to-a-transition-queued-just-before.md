---
category: common-mistakes
tier: generalizable
sourceGame: RoomActionSample
phase: "5"
question: "Does the game's element or state machine queue transitions (store the request, apply it on the next update) instead of switching at once, and does the restore set states silently after game code that requests transitions?"
sanitized: true
origin: "unity:common-mistakes/a-silent-state-set-can-lose-to-a-transition-queued-just-before"
---

# A silent state set can lose to a transition the game queued a moment before

The restore toggles an enemy's aggro off and on so it re-enters its attack state cleanly, then puts the fight's
progress back: elements the creator had already destroyed are set to "resolved" silently (no designer events). The
check right after the apply passed. One frame later every element had flipped back to "disabled", and the viewer faced
the boss at full strength.

The toggle's attack-state exit called `Deactivate()` on every element, and in this game that does not switch the
state — it stores a pending transition the next update applies. For elements **still** resolved, the silent set saw
"already in the target state" and returned without touching anything, so the pending "disabled" survived and won on
the first settle frame. An earlier restore pass had worked only because the elements were not yet resolved then, so
the set really switched them and entering the state cleared the pending request.

**Fix:** after a silent state set, also clear whatever transition is queued on that element, whether or not the set
changed anything.

**How to spot it:** a check that passes at the end of the apply and fails at the end of the settle, with nothing logged
between. Run the restore's checks at both points (they are at least a frame apart); a pass-then-fail flip on state
values points to a queued transition, not to your write.
