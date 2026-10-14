---
category: architecture
tier: generalizable
sourceGame: EndlessFPS
phase: "6"
question: "Does the game have a scripted hazard the player can either survive or die to (a grab-and-mash struggle, a QTE, a breakable finisher, a downed/revive state) that is worth an action?"
sanitized: true
origin: "unreal:architecture/survival-event-action-via-state-flag-transition"
---

# Emit a "survived the hazard" action from a state-flag transition, gated on the player being alive

**Applies when** the game has a scripted hazard the player survives or dies to, and you want a positive action
(for example `EscapeGrab`) when they get out of it.

## The pattern

Don't hook the player's input (the "press X to break free" key). The hazard almost always owns a **boolean
state flag** that is set when the struggle begins and cleared when it ends. Poll it.

The catch: **the flag clears on both outcomes**, a successful escape and the player dying to the hazard. A bare
`true → false` transition can't tell them apart. Use the player's **alive** state, read in the same poll:

```cpp
// per poll: update the player first, so `playerAlive` is current
if (wasAlive && !playerAlive) ludeo.SendAction("Death");

for (Hazard& h : trackedHazards) {
    const bool inStruggle = h.entity->IsStruggling();
    if (h.prevInStruggle && !inStruggle && playerAlive)
        ludeo.SendAction("EscapeGrab");           // cleared while still alive: broke free
    h.prevInStruggle = inStruggle;
}
```

If the hazard killed the player, `Death` already covers it and `playerAlive == false` suppresses the false
escape.

## Confirm the set and clear sites; don't guess

Read the code to find which function sets the flag (usually the hazard's "begin struggle", which also starts the
player-side animation and camera) and which clears it (the struggle-ended handler), and on which object each one
lives. Guessed semantics give a silent miss or a false positive.

## Watch the revive edge

If the game can **revive** the player after a hazard death, the flag may clear after health is restored, which
produces a stray escape. Add a guard only if you see it: require the player to have been alive on the previous
poll too, or suppress the action for a short window after `Death`.

## Why poll

Hazard types expose different (or no) "succeeded" callbacks. The flag is uniform across them, needs no game
edits, and the transition fires exactly once. Like every action, it fires in **both** flows (`06 §7`): run the
detector outside any replay gate, and baseline `prev*` after the restore applies so a struggle already in
progress at the captured moment doesn't fire.
