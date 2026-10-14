---
category: architecture
tier: generalizable
sourceGame: ActionGame
phase: "5"
question: "Is the game first-person with separate first-person (hands/weapon) and third-person (full body) models, and does a runtime 'is this the locally viewed player?' check decide which model a cosmetic or weapon attaches to?"
sanitized: true
origin: "unreal:architecture/tpp-mesh-owner-visible-diagnostic"
---

# "Dark blob over the player's view" after restore = the third-person model attached for the local player

**Applies to** first-person games with a first-person/third-person model split, where the game picks at runtime
which model a cosmetic or weapon attaches to, based on a check like "is locally controlled AND the camera's view
target is this character".

## The symptom

On replay the local player sees a **dark curved shape across the top of the first-person view**: a hat brim, a
head cosmetic seen from the inside, a hovering blob. Often the held weapon also looks wrong (small, or not what was
equipped at capture). That's the third-person weapon on a third-person socket.

## The 30-second diagnostic

**Aim down sights**, or anything else that pushes the first-person camera forward past the head:

- the blob **leaves the view** → it's your own third-person head/cosmetic geometry, now behind the camera;
- the blob **stays put** → it's attached to the camera (UI, post-process, first-person attachment). Different
  bug.

This rules out most "weird mesh in view" theories at once. In the incident it would have cut hours of ranked
theories (spawn timing, unrelated restores) to minutes.

## Root cause

When the attach decision ran, one of its preconditions was still false: control not yet assigned, controller
missing, or the camera's view target not yet the character (a transition camera, say). The decision fell through
to the third-person model, and with that model visible to its owner the player sees their own cosmetics from
inside. In development builds the ordering usually works out. In optimized/shipping builds the game's natural
equip flow can race the restore, and a long pre-restore delay makes it worse by letting defaults install first.

## Fix

1. **Find the attach decision** (search for the locally-controlled / view-target check near equip/cosmetic
   code) and log its precondition values at the top.
2. **Order the restore after control and camera are final.** The core restore already reaches active gameplay
   and waits for the game's native spawn before the frozen apply (`07 §2.1`). Make sure "native spawn done"
   includes control/possession and the view target, not just the entity existing.
3. **Don't add pre-restore delays.** They let the natural equip flow run against an unfinished setup.
4. **Last resort:** after the apply (in `ApplyDeferred()`), detach and re-run the game's own attach function so
   the decision is re-evaluated against the final state.
