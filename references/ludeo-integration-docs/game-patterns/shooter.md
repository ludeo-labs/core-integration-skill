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

After object tracking is implemented, verify these are covered:

### Player (CRITICAL)
- [ ] Position (vec3)
- [ ] Rotation (quat/vec4)
- [ ] Velocity (vec3)
- [ ] Health / HP
- [ ] Is alive/dead
- [ ] Current weapon / weapon ID
- [ ] Ammo (current + reserve)
- [ ] Score / kills / deaths
- [ ] Team ID

### Enemies / NPCs
- [ ] Position, rotation
- [ ] Health
- [ ] AI state (idle, alert, attacking, fleeing)
- [ ] Target entity ID
- [ ] Enemy type / blueprint ID
- [ ] Is alive/dead

### Weapons
- [ ] Weapon type
- [ ] Owner ID
- [ ] Ammo count
- [ ] Is equipped
- [ ] Position (if world item)

### Projectiles (if persistent/visible)
- [ ] Position, velocity
- [ ] Projectile type
- [ ] Owner ID
- [ ] Damage value

### Pickups / Items
- [ ] Position
- [ ] Item type
- [ ] Is collected / available
- [ ] Respawn state (if applicable)

### Environment
- [ ] Destructible objects (destroyed state)
- [ ] Doors (open/closed/locked)
- [ ] Level metadata (map name, game mode, difficulty)
