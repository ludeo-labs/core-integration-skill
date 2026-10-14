---
category: common-mistakes
tier: generalizable
sourceGame: TPSSample
phase: "5"
question: "Does your restore trigger a game flow that resolves on a LATER tick (a networked command, an async request, a queued job: equip a weapon, change class, apply appearance)? Read what that flow does when it resolves — if it resets or re-derives state you also restore (ammo, slots, buffs), your writes are stomped a tick later, and only for creators whose values differed from the defaults."
sanitized: true
origin: "unity:common-mistakes/a-deferred-game-command-stomps-freshly-restored-state"
---

# A deferred game command stomps freshly-restored state

Networked and job-based games route player-facing operations through commands that resolve on a later tick, and those
often end by resetting dependent state to defaults — an equip flow resets ammo slots, a class change clears buffs.
When the restore requests such a flow and then writes the dependent state, the resolution lands afterwards and puts
the defaults back.

Observed: the restore requested the weapon equip (a networked command), then wrote the recorded ammo slots. The equip
resolved a tick later and reset the ammo.

## Why it evades testing

The stomp restores *defaults*, so a creator with a default loadout passes. One of two otherwise-identical test
moments failed for this reason while the other was green.

## The fix — outlast the resolution, inside the settle

The command needs frames, so it resolves in the **settle**, not the frozen apply (CR-010 "Freeze vs suppress").
Stash the dependent values during the apply; in the settle, re-apply them once the operation has **provably landed**.
Use a state change the resolution itself performs as the signal — here the equip assigns a new weapon instance in the
same step that resets the slots. A timer is not a landed-signal. Extend the settle until the signal (bounded); all of
it lands before `OpenRoom`.

Verify with a creator whose values were **non-default**, reading back at the end of the settle.
