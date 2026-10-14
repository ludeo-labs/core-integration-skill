---
category: architecture
tier: universal
sourceGame: ActionGame
phase: "6"
question: null
sanitized: true
origin: "unreal:architecture/additive-action-emission-for-composable-goals"
---

# Emit actions on independent axes — additive, not else-if

## The principle

Studio Lab goals combine actions; they work best when each gameplay event is emitted along **independent axes** the
goal author can pick from. An event is a tuple of facts — *who* did it, *to whom*, *how* — and each fact deserves its
own `SendAction`, not one "most specific" bucket.

A single headshot kill on a heavy enemy is **all of**: `KillEnemy` (any enemy), `KillHeavy` (a special class) and
`Headshot` (the kill method). "Kill 10 enemies", "kill any heavy" and "get 3 headshots" each pick a different action;
the same frame fires all three and the backend evaluates each goal separately.

## The anti-pattern

```cpp
// WRONG — one emission per event; the tuple collapses
if      (victim.IsHeavy())    SendAction("KillHeavy");
else if (victim.IsWorker())   SendAction("KillWorker");
else if (victim.IsCivilian()) SendAction("KillCivilian");
else                          SendAction("KillEnemy");
```

`KillWorker` never fires `KillCivilian`, so "kill 3 civilians" misses worker kills; `KillHeavy` never fires
`KillEnemy`, so "kill 10 enemies" must enumerate every special class; the kill method has no slot at all.

## The pattern

```cpp
// Victim axis — a sub-type fires its specific action AND the broad bucket it belongs to
if (victim.IsCivilian()) {
    if (victim.IsWorker()) SendAction("KillWorker");
    SendAction("KillCivilian");
} else {
    if (victim.IsHeavy()) SendAction("KillHeavy");
    if (!victim.HasSurrendered()) SendAction("KillEnemy");   // state exclusion, see below
}
// Method axis — orthogonal to the victim
if (hit.isBullet && hit.isCritical) SendAction("Headshot");
if (hit.isMelee) SendAction("Melee"); else if (hit.isExplosive) SendAction("ExplosiveKill");
```

Actions fire in both flows (`06 §7`); none of these calls is gated on replay.

## Composable is not "fire everything"

- **State exclusions still apply.** A surrendered hostile is not an "enemy" at the moment of execution; a type bucket
  (`KillCivilian`) is not a behaviour bucket — a hostile acting like a civilian is still a hostile.
- **Two names for one event → pick one.** Don't emit both `Death` and `PlayerDied`.
- **No negative actions.** If the negative side of a boolean has no goal value ("wasn't crouched"), don't emit it.

## Cost and duplication

One extra `SendAction` per axis per event is cheap. Additive emission does amplify any upstream double-fire (an event
bus that rebroadcasts the same kill), so dedupe at the source event, per axis — see
`learnings/common-mistakes/debounce-rebroadcast-events-before-sending-actions.md`.

## Detection

When building `GAME_ACTIONS_MAP.md` (`phase 6 · task 1`), write each meaningful event as its tuple of facts. If the
code emits exactly one action per event, the tuple has been collapsed — check whether each fact deserves its own axis.
