# Shooter Genre Patterns

> **Applies to:** FPS, TPS, Arena Shooters, Battle Royale, Tactical Shooters
> **Load when:** Game involves guns, projectiles, health/damage combat, player-vs-enemy or PvP

---

## 1. Actions Catalog

### Combat Actions

| Action Name | Description | Objective Potential | Scoring Potential |
|-------------|-------------|---------------------|-------------------|
| `Kill` | Player kills enemy/opponent | "Kill 10 enemies" | 100 pts |
| `Death` | Player dies | "Survive without dying" (inverse) | -50 pts |
| `Headshot` | Kill via headshot | "Get 5 headshots" | +50 bonus |
| `MeleeKill` | Kill with melee weapon | "Get 3 melee kills" | +25 bonus |
| `ExplosiveKill` | Kill with explosive | "Get 2 explosive kills" | +25 bonus |
| `MultiKill` | Multiple kills in short window | "Get a double kill" | +100 bonus |
| `Assist` | Contributed damage to a kill | "Get 5 assists" | 50 pts |
| `TeamKill` | Killed a teammate (negative) | — | -200 pts |

### Downed / Revive Actions

In revive-based shooters, `Death` fires only on the **downed→dead** transition. Track the defeat-state enum (§3) for the in-between states, and emit these for the transitions a viewer would call out:

| Action Name | Description | Objective Potential | Scoring Potential |
|-------------|-------------|---------------------|-------------------|
| `Downed` | Player entered the downed / bleed-out state (not yet dead) | — | — |
| `Revived` | This player was revived by a teammate | — | +50 |
| `RevivedTeammate` | This player revived a teammate | "Revive 2 teammates" | 100 pts |

### Weapon/Equipment Actions

| Action Name | Description | Objective Potential | Scoring Potential |
|-------------|-------------|---------------------|-------------------|
| `Reload` | Weapon reloaded | — | — |
| `WeaponSwitch` | Changed weapon | — | — |
| `PickupWeapon` | Picked up a weapon | "Pick up 3 weapons" | 10 pts |
| `PickupAmmo` | Picked up ammo | — | — |
| `PickupHealth` | Picked up health | — | — |
| `PickupArmor` | Picked up armor | — | — |
| `UseGrenade` | Threw grenade | — | — |
| `UseAbility` | Used special ability | "Use ability 5 times" | — |

### Movement Actions

| Action Name | Description | Objective Potential | Scoring Potential |
|-------------|-------------|---------------------|-------------------|
| `Jump` | Player jumped | — | — |
| `DoubleJump` | Double jump (if available) | — | — |
| `Dash` | Dash/dodge | — | — |
| `Sprint` | Started sprinting | — | — |

### Progression/Objective Actions

| Action Name | Description | Objective Potential | Scoring Potential |
|-------------|-------------|---------------------|-------------------|
| `ObjectiveComplete` | Completed map objective | "Complete all objectives" | 500 pts |
| `FlagCapture` | Captured the flag | "Capture 2 flags" | 300 pts |
| `PointCapture` | Captured control point | "Capture 3 points" | 200 pts |
| `Respawn` | Player respawned | — | — |
| `RoundWin` | Won a round | — | 1000 pts |
| `MatchWin` | Won the match | — | 2000 pts |

---

## 2. Search Keywords

The agent should grep for these keywords in function names, variable names, and comments. Group results by category.

### Combat / Damage / Kill
```
kill, killed, death, die, died, dead, frag, eliminate, eliminated
damage, hurt, hit, takeDamage, applyDamage, onDamage, doDamage
headshot, critical, crit, lethal, fatal
health, hp, hitpoints, armor, shield
spawn, respawn, revive
```

### Weapons / Equipment / Pickups
```
weapon, gun, firearm, rifle, pistol, shotgun, sniper
fire, shoot, trigger, attack, projectile, bullet, ammo, ammunition
reload, magazine, clip
pickup, collect, grab, loot, item, drop
grenade, explosive, rocket, mine, throwable
melee, knife, punch, bash
equip, unequip, holster, swap, switch
```

### Movement / Player Actions
```
jump, doubleJump, wallJump, dash, dodge, sprint, crouch, prone, slide
```

### Game Flow / Objectives
```
objective, mission, quest, goal, flag, capture, point, control
score, scoring, points, reward, bonus
round, match, wave, level, stage
win, lose, victory, defeat, gameOver, endGame, endRound, endMatch
```

---

## 3. Tracking Checklist

After object tracking is implemented, verify these are covered. Sections are tiered by restoration priority:
- **CRITICAL** — restore or the replayed moment is visibly wrong.
- **IMPORTANT** — restore for fidelity; recognizable without it but degraded.
- **OPTIONAL** — situational/cosmetic; capture only if it affects the specific captured moment.

### Player — CRITICAL

> Universal player items (position, body + look/aim rotation, armor/shield pool, stance, team) →
> [common.md](./common.md) §1. Shooter-specific additions:

- [ ] Position (vec3)
- [ ] Rotation (quat/vec4)
- [ ] Velocity (vec3)
- [ ] Health / HP
- [ ] Is alive/dead — in a **revive** game, a **defeat-state enum** instead (e.g. Normal / Downed / BleedOut / Dead): `Death` fires only on downed→dead (§1), so a single alive/dead bool cannot express the in-between states
- [ ] Current weapon / weapon ID
- [ ] Ammo — **magazine (loaded) and reserve are distinct quantities**; capture both
- [ ] Score / kills / deaths
- [ ] Team ID
- [ ] Appearance / equipped cosmetics (skin, outfit, character-model or team-color variant — by content ID, never a pointer). Constant through the clip, but **visible**: constants are normally skipped (`06 §9.3` step 1) — this is the exception, because a default-skin replay is visibly wrong

### Enemies / NPCs — CRITICAL (the combatants in the moment are load-bearing — `06 §1.5`)
- [ ] Position, rotation
- [ ] Health
- [ ] AI state (idle, alert, attacking, fleeing)
- [ ] Target entity ID
- [ ] Enemy type / blueprint ID
- [ ] Is alive/dead

### Weapons — IMPORTANT
- [ ] Weapon type
- [ ] Owner ID
- [ ] Ammo count
- [ ] Is equipped
- [ ] Position (if world item)

### Projectiles / in-flight attacks (if persistent/visible) — OPTIONAL (a later wave)

An attack **in flight at the captured instant** (a rocket or grenade mid-air, an enemy mid-swing) sharpens the reconstruction, but it is a **later-wave** add (`06 §1.1`): the moment is coherent without it, and it is the hardest class to capture (pooled, short-lived, velocity applied late). No new machinery — it is a pooled collection object with a handful of attributes (`06 §10.5`); the **velocity is a deferred property** at restore (`07 §6`), the **owner resolves in Pass 2** (`07 §3`), and any lifetime timer is captured as **remaining**, not elapsed (`06 §9.4`). The hit the attack lands is an **action, not state** (`06 §7`): reconstruct the attack and let the hit re-fire as the replay plays forward.

- [ ] Position, velocity
- [ ] Projectile type
- [ ] Owner ID
- [ ] Damage value

### Pickups / Items — OPTIONAL
- [ ] Position
- [ ] Item type
- [ ] Is collected / available
- [ ] Respawn state (if applicable)

### Environment — OPTIONAL
- [ ] Destructible objects (destroyed state)
- [ ] Doors (open/closed/locked)
- [ ] Level metadata (map name, game mode, difficulty)
