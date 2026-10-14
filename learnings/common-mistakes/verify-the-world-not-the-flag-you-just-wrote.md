---
category: common-mistakes
tier: universal
sourceGame: TPSSample
phase: "5,6"
question: null
sanitized: true
origin: "unity:common-mistakes/verify-the-world-not-the-flag-you-just-wrote"
---

# Never verify a restore against a field the restore itself writes

A restore check exists to answer one question: **did the world end up in the recorded state?** It is worthless the
moment it answers a different one — *did we call the thing we meant to call?* The two look identical in code and
produce the same green log line, and only one of them can fail.

The concrete failure: destructible scenery was restored by calling the game's own `Break()` on each piece the
recording showed smashed. The check asked `piece.isBroken`. But `Break()` sets `isBroken = true` on its **first
line** and defers the part that removes the mesh and spawns debris to a next-frame task. The restore wrote the flag;
the check read the flag; it could not fail. Five consecutive replays logged a flawless *"16 of 16 knocked down"*
while the integrator watched the wall stand there whole, unsure what he was seeing. His eye was the only working
instrument in the room, and the log had been lying for a day.

It also invalidated everything built on top of it. Restored enemies were placed *after* the scenery restore so the
world would have the right shape first — and enemies kept falling through the floor. Every investigation started
from "the scenery restored correctly, so it must be something else." It hadn't.

## The test for whether a check is real

> **If the restore's own call had done nothing at all, would this check still pass?**

If yes, it is not a check. Replace it. Apply this to every assertion a restore makes about itself, at the moment you
write it.

## Why it is so easy to write

The flag is the most convenient thing in the room: public, named after the question, already in hand. Checking the
real observable means knowing what the state change physically does. The trap has a shape — **setter now, effect
later** — and it is everywhere:

- a next-frame or async task that performs the visible half;
- networked flags that set locally and take effect when the authority confirms;
- animation- or effect-driven deaths, where the object is "dead" long before it is gone;
- pooled objects, whose flags reset on acquire rather than on the state change.

The flag is the **order**; the effect is what collides, renders and gets seen. A restore cares only about the second.

## Check what the player and the physics touch

- Is the intact object still active in the world — the thing an overlap or raycast will still hit?
- Is it actually submitted for rendering, rather than flagged to be?
- Is its collider still in the physics scene, rather than a "destroyed" bool being true?

When the check fails, report **both** halves — "still standing, and N of them report the flag true" — because
*ordered but not applied* and *never ordered* are different bugs.

## This was the second time

An earlier bug in the same integration had exactly this shape: a check confirmed restored enemies were visible by
testing the visibility flag the restore had just written, and reported dozens of enemies above an empty room. It was
fixed and written up as a fact about that one check — never generalized — so the same mistake recurred on another
object family. **A bug that recurs in a new place was never really understood the first time.** When you fix
something, name the class it belongs to and write the class down.
