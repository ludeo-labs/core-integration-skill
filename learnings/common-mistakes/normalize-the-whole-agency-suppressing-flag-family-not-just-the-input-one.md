---
category: common-mistakes
tier: generalizable
sourceGame: ActionAdventureSample
phase: "5"
question: "Does the game suppress player agency during scripted sequences with MORE THAN ONE flag (an input-disable, a game-state enum, a movement-only / no-combat mode) — and does the restore normalize all of them, or only the obvious input one?"
sanitized: true
origin: "unity:common-mistakes/normalize-the-whole-agency-suppressing-flag-family-not-just-the-input-one"
---

# Normalize the whole family of agency-suppressing flags — missing one ships an unwinnable Ludeo that looks perfect

Applies when the game suppresses agency during scripted sequences with several flags at once.

Every restore plan learns to force the input-disable flag off: a captured "inputs disabled" produces a replay the
viewer cannot move in, which nobody misses (`11 §8`). **But games suppress agency with a family of flags.** A
scripted sequence (intro, tutorial, guided walk) typically sets several from one helper:

```cpp
// the game's scripted-sequence helper — all three, together
game.SetState(GameState::Cinematic);   // game-state enum
player.DisableInput();                 // total input lock
player.EnableMovementOnly();           // walk, but no combat  <- the one that gets missed
```

Miss the movement-only member and you get the worst-presenting failure in the integration: correct level, correct
position, unfrozen, control granted, zero errors — the viewer walks normally and **cannot attack, block, dodge or
shoot**. In the observed case an enemy killed the viewer while they had no way to answer; the only symptom was a
human saying "I couldn't attack." With a kill-based action set the Ludeo is also unscoreable.

## The check

Find the scripted-sequence helper and read **every** flag it sets; confirm the restore normalizes each. Then grep
the offence entry points and read their **full** guard: here melee required
`attackPressed && hasMeleeSkill && !movementOnly` — three terms, two of them captured attributes. A plan that only
reasoned about the input flag had no reason to look at the other two.

Normalize the whole family on the doctrine of `07 §1.2`: a stretch where the player cannot fight is a non-ludeoable
window by definition, never a playable start — force each flag to its idle value whatever was captured, and log a
warning so the normalization shows in the restore report.

## Log the ability gates too

"The viewer cannot attack" has two visually identical causes: the restore dropped or mis-applied a suppression flag
(**our defect**), or the capture was taken **before the creator earned the ability** (a faithful restore). Log the
ability booleans on every restore, with an explicit marker when the one gating basic attack is false. Without that
line, each investigation restarts from zero. Same instrumentation-first move as
`learnings/common-mistakes/dramatized-kills-open-a-non-ludeoable-span-before-the-action-fires.md`.

## Where it surfaces

Often **not** at the restore gate — the tester's own save has every ability and the capture was mid-combat. It
surfaced at the **actions** gate, replaying an early-game capture to prove actions fire in the Player Flow. Expect
it from any capture taken inside a scripted sequence, which is exactly where a new creator marks their first moment.
