---
category: common-mistakes
tier: generalizable
sourceGame: RoomActionSample
phase: "4,5"
question: "Do several gameplay elements (attack slots, hit zones, limbs) share one visual object, so that hiding the visual takes all of them out of play?"
sanitized: true
origin: "unity:common-mistakes/when-logic-elements-share-a-visual-the-visual-carries-the-state"
---

# When several logic elements share one visual, the visual carries part of the state

Applies when gameplay elements share a visual and the game decides availability from the visual. A multi-limb boss
attacks in phases. In the second phase, 11 attack elements drive 8 visible limbs: several elements share one limb
model. Destroying an element hides its limb, and the phase's attack picker only chooses elements whose limb is
shown — so the siblings sharing that limb are out too. (The designers' data notes said so; the code shows it only
through the picker's "is the visual active" test.)

The restore recorded, per element, "resolved" and "limb shown". It resolved the destroyed elements and then, for the
current phase, showed every hidden limb again, on the theory that a hidden limb meant an attack in progress (a
swiping limb hides its model while its element acts). With 4 elements destroyed, most limbs were hidden by
destruction, not by an attack — and they all came back. The viewer faced the full set instead of the one limb the
creator had left.

## Fix

Decide per **visual**, not per element: a visual with any resolved element stays hidden; only a visual hidden while
none of its elements is resolved (an attack in progress) is shown again for the restarted phase. Capture both masks so
either rule can be applied (`OBJECT_TRACKING.md` should list the visual as part of the state), and add a restore check
that flags "a destroyed limb is shown again" — checked against what is actually rendered, not against the flag the
restore wrote (`learnings/common-mistakes/verify-the-world-not-the-flag-you-just-wrote.md`).

## Generalization

Before restoring "which parts are gone", find out what the game itself reads to decide that a part is gone. When that
is a shared object's visibility rather than each element's own state, the shared object is part of the state — map it
in phase 4 and restore it as such in phase 5.
