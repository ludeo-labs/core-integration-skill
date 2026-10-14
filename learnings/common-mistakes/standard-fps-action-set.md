---
category: common-mistakes
tier: generalizable
sourceGame: Lyra
phase: "6"
question: "Is the game a shooter (FPS/TPS) whose curated play has discrete events beyond kills and deaths — assists, weapon pickups, ability activations, multi-kill/streak events?"
sanitized: true
origin: "unreal:common-mistakes/standard-fps-action-set"
---

# A shooter's standard action set is 5–6 actions, not 2–3

**Precondition:** a shooter with events beyond eliminations.

Stopping at Kill + Death leaves a bare integration. A reference shooter shipped six:

| Action | Source in the game | Why |
|---|---|---|
| `Kill` | elimination event, instigator side | core metric |
| `Death` | elimination event, victim side | core metric |
| `Assist` | assist-credit event | team play |
| `WeaponPickup` | inventory-changed event | loadout adaptation |
| `AbilityActivation` | ability-activated event (dash, grenade) | skill usage |
| `Accolade` | multi-kill / streak notification | highlight moments |

**How to apply:** in `phase 6 · task 1`, present the full set (see `game-patterns/shooter.md` §1) as the
recommendation and let the integrator trim it — don't validate Kill + Death and stop.
