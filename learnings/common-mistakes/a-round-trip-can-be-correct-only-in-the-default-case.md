---
category: common-mistakes
tier: generalizable
sourceGame: PlatformerSample
phase: "5"
question: "Does the getter you capture return a value the game has ALREADY combined (magnitude times sign, local plus offset, base times multiplier), while the setter you restore through re-applies the same factor? The round trip is then exact in the default case and wrong in every other one — the case the mechanic exists for."
sanitized: true
origin: "unity:common-mistakes/a-round-trip-can-be-correct-only-in-the-default-case"
---

# A capture/restore pair can be exact in the default case and inverted in the interesting one

**Precondition:** you capture through a game getter and restore through the matching game setter.

The game's signature mechanic is flipping gravity. Capture read the gravity getter; restore wrote through the gravity
setter. Symmetrical by inspection, verified by play, shipped — and wrong. The getter returns a member stored as
`magnitude * sense`; the setter does `Change(value * sense)`, **applying the sense a second time**:

| Captured state | Stored | Restored |
|---|---|---|
| upright, sense `+1`, magnitude 30 | `+30` | `+30 * +1 = +30` ✅ |
| upside-down, sense `-1`, magnitude 30 | `-30` | `-30 * -1 = +30` ❌ inverted |

Captured upright it is harmless, which is why it survives casual testing — and the failing case is exactly the
mechanic the census flagged as the one a wrong restore ruins. The value feeds the physics body directly, so this is
real motion, not a cosmetic pose.

## The fix and the rule

Capture the **unsigned component** and leave the setter as the single place the sign is applied:

> Find the one place the game combines the parts, and make sure exactly one side of the round trip crosses it.

## Find these before a player does

Read the getter's and the setter's bodies **in the same sitting** and write down what each does to the raw member.
Matching names (`GetX`/`SetX`) prove nothing. The same review caught three more:

- an accessor named for *lives* that actually sets *health*;
- a setter that early-returns while a zero-gravity mode is active — a mode not captured, recorded as a known gap
  rather than fixed blind;
- load-bearing, invisible ordering: the sense must be restored before the magnitude, and a checkpoint setter
  snapshots the *live* camera zoom, so the captured zoom must be written after it. Pin both with a comment naming the
  dependency (and in `RESTORATION_PLAN.md`), or the next edit reorders them.

## Changing what a captured attribute means invalidates existing Ludeos

There is no migration. When a fix changes an attribute's meaning (unsigned instead of signed), every Ludeo captured
before it is stale **for that attribute**, and testing against one measures the old bug. Say so in the commit and
re-capture, deliberately exercising the non-default case.
