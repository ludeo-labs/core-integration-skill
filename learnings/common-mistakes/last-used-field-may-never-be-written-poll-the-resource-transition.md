---
category: common-mistakes
tier: generalizable
sourceGame: TacticsGame
phase: "6"
question: "Are you about to detect an 'ability/item/weapon used' action by polling a 'LastUsedX' / 'CurrentX' convenience field for a change? Verify that the use path actually writes that field. The reliable signal is usually the consumable-resource transition the use causes: a charge consumed or a cooldown started."
sanitized: true
origin: "unreal:common-mistakes/last-used-field-not-written-poll-resource-transition"
---

# A "LastUsedX" field is often never written on the use path: poll the resource transition instead

**Precondition:** you detect an "ability used" (or item used, weapon fired) action by polling game state, not by
hooking a call site.

## The trap

The obvious signal was a field named like the event (`last_used_ability`), with the action firing when it
changed. On one turn-based game the action **never fired**, though the player clearly used abilities. Nothing on
the activation path wrote that field; it was vestigial.

## Diagnose before trusting any "last used" field

1. Runtime: use the ability. If the action doesn't fire, you have a detection miss, not "no ability used".
2. Find every write to the field (grep for assignments, setters, serializer writes) and walk the activation call
   chain from input to effect. If no write sits on that chain, the field isn't your signal. A field whose name
   sounds right is not the signal until you've seen the write.

## The reliable signal

Using an ability almost always changes a **consumable resource** the HUD reads, such as a charge count, a cooldown
timer or ammo. Those values are live and are usually already captured for state. Detect the use from their
transition:

```cpp
bool used = false;
for (size_t i = 0; i < u.charges.size(); ++i)
    if (u.charges[i] < u.prevCharges[i]) { used = true; break; }        // a charge consumed
if (!used)
    for (size_t i = 0; i < u.cooldowns.size(); ++i)
        if (u.cooldowns[i] > u.prevCooldowns[i]) { used = true; break; } // a cooldown STARTED
u.prevCharges = u.charges; u.prevCooldowns = u.cooldowns;
if (used) LudeoManager::Get().SendAction("AbilityUsed");
```

**The discriminator matters:** a per-turn "reduce all cooldowns" step lowers cooldowns every turn, so test for a
cooldown **increase**, not any change. Charges usually only drop on use, so a decrease means a use.

## How to apply

- Keep the previous poll's values per entity, and set the baseline when you build the registry so the first poll
  doesn't fire.
- Run the detector in both flows. Actions are never gated on replay (`06 §7`).

Related: `learnings/common-mistakes/death-is-not-destruction-detect-kills-by-state-transition.md`,
`learnings/common-mistakes/verify-capture-source-actually-varies.md`.
