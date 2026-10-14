---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: "4,5"
question: null
sanitized: true
origin: "unreal:common-mistakes/check-existing-pattern-before-deep-dive"
---

# When an entity is "missing or broken on replay", first check that you track it at all

## The mistake

User report: "I captured a Ludeo with the deployable device active. On replay the device was sort of there: a
placeholder sphere with an error label."

The agent went deep on theories: the level script spawns the device at the wrong spot because state isn't
restored; streaming races the spawn; the device's anchor depends on the player's position; a debug visualization
is hiding the mesh. It wrote a six-option solution plan and started building a level-data scanner. That took
about two hours.

**The actual answer:** the integration didn't track the device at all. It only hooked the device's activation
for an action. On replay nothing in the integration spawned it; the level's own logic probably tried and landed
it somewhere broken. Adding it as a tracked type, a copy of the existing pattern for other transient objects,
took 30 minutes and fixed it.

## The rule

When the user reports "entity X is missing or wrong on replay", **first verify that the integration captures and
restores X**. It takes a few minutes:

- Is X's `objectType` in `OBJECT_TRACKING.md` and the census, and in a green wave?
- Grep the integration for X's type: a `CreateObject` site, a Pass-1 spawn/match branch, a Pass-2 apply.
- Check the restore log: does Pass 1 report any objects of X's type?

If not, the answer is "we don't track it", and the fix is to apply your existing pattern for that kind of entity.
**Only once you've confirmed X is tracked** should you start theorizing about why the output is wrong (timing,
re-run init, apply order, `07 §9`).

## Triage order, before writing any theory

1. Is it a **tracking gap**: we don't capture/restore X?
2. Is it a **tracking-correctness** issue: we capture X, but the restore is wrong?
3. Is it a **game or engine** issue independent of the integration?

If you can't rule out (1) without grepping, grep first. The check is boring and cheap, which is exactly why it
comes first.
