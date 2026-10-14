---
category: common-mistakes
tier: generalizable
sourceGame: ActionGame
phase: "6"
question: "Does the game's damage event expose both per-hit flags (critical, killshot, armor-break) or auxiliary source pointers AND a damage-type classification (type enum, tag set, damage-type class)? If so, derive kill-method actions from the damage type."
sanitized: true
origin: "unreal:common-mistakes/damage-tags-not-bool-flags-for-action-discrimination"
---

# Discriminate kill-method actions by damage type, not by hit flags or source pointers

**Applies when** the damage event carries **both** boolean hit details (`isCritical`, `isKillshot`,
`isArmorBreak`), sometimes with auxiliary pointers (`throwableData != nullptr`), **and** a damage-type
classification. You want per-method actions: `Headshot`, `Melee`, `ExplosiveKill`, `KnifeKill`. The booleans look
like the obvious discriminators. They aren't.

## Two real bugs

```cpp
if (ev.isCritical)               SendAction("Headshot");       // fired for a grenade to the head
if (ev.throwableData != nullptr) SendAction("ExplosiveKill");  // fired for thrown knives, ammo/med bags, smoke
```

- `isCritical` was set from the **hit location** (head zone), whatever the damage type. Explosion damage that
  caught the head bone was "critical", so `Headshot` co-fired with `ExplosiveKill` on one frag to the face.
- The throwable pointer was non-null for **every** throwable: grenades, knives, utility items. A thrown-knife kill
  isn't explosive.

## The fix

Use the **damage-type classification**. It's set from the damage source at application time and is what the game
itself uses to pick hurt reactions:

```cpp
const DamageType t = ev.damageType;   // enum / tag set / class: whatever the game uses
const bool bullet = Is(t, DamageType::Bullet), explosive = Is(t, DamageType::Explosion),
           melee  = Is(t, DamageType::Melee),  knife     = Is(t, DamageType::Knife);

if (ev.isCritical && bullet) SendAction("Headshot");   // hit-zone flag only *refines* the type
if (!ev.isKillshot) return;
if (melee)          SendAction("Melee");
else if (explosive) SendAction("ExplosiveKill");
else if (knife)     SendAction("KnifeKill");
```

## How to apply

1. Open the damage-event struct and list every boolean and pointer field. Check how the **game's own consumers**
   use them. They'll turn out to be hit zone, lethality or an FX source reference, not method categories.
2. Find the damage-type classification and use it as the primary axis.
3. Cross-check against game code that already discriminates by method (hurt reactions, perks, analytics, gore).
   Reuse the predicate it uses.

**Anti-pattern:** trusting field names. `isCritical` sounds like "headshot" and `throwableData` sounds like
"explosive". They aren't.
