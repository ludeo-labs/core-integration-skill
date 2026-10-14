---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: "6"
question: null
sanitized: true
origin: "unreal:common-mistakes/action-axis-player-method-not-victim-taxonomy"
---

# Action names describe what the player did — the victim's archetype is context, not the name

## The mistake

The action stream named kills by the **victim's type**:

```cpp
// WRONG: bakes the dead enemy's class into the action name
ludeo.SendAction(("Kill_" + enemy.TypeName()).c_str());   // Kill_Sniper, Kill_Heavy, Kill_Shield
```

That describes what kind of enemy died, not what the player did.

## Why it's wrong

Goals, constraints and highlight picking all work per player, on **what the player did**: `Headshot`, `Melee`,
`StealthKill`, `ExplosiveKill`, `LongRangeKill`, `MultiKill`. A victim-axis stream breaks that three ways:

1. Two players making the same knife kill produce different actions when their targets differ: same play,
   different bucket.
2. "Headshot" can't be recognized as one class of moment across all enemies, because every variant has a
   different name.
3. The variable part explodes the action vocabulary. Each name needs its own trigger/goal in Studio Lab, so most
   of them never get connected.

The victim's class is **context**. If the team wants it, emit it as a separate, additive action next to the
method action, from a curated, bounded allowlist of classes (`KillHeavy`, not `"Kill_" + TypeName()`). Don't fold it
into the method action's name, and never let it replace the canonical action.

## The rule

1. The canonical action names the **player's action** and is always sent. Don't embed unbounded variable data in
   any action name (no `Kill_Rifle` either: that's the same mistake on the weapon axis). Extra actions come only
   from a curated, bounded allowlist
   (`learnings/architecture/additive-action-emission-for-composable-goals.md`,
   `learnings/common-mistakes/per-class-action-token-derive-from-runtime-type-name.md`). See `phase 6 · task 1` for
   naming.
2. Hook the **damage/hit event** that carries instigator, damage type and hit location/zone, not the victim's
   death event. Only the damage event has what you need to derive the method (and see
   `learnings/common-mistakes/discriminate-kill-method-by-damage-type-not-hit-flags.md` for which field to
   derive it from).
3. Every `SendAction` carries the `playerId` passed to `ludeo_Room_AddPlayer` (`06 §7.1`), and only for events
   the player took part in (see
   `learnings/common-mistakes/send-actions-only-for-events-the-player-took-part-in.md`).
