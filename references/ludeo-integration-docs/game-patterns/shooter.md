# Shooter Genre Patterns

> **Applies to:** FPS, TPS, Arena Shooters, Battle Royale, Tactical Shooters
> **Load when:** Game involves guns, projectiles, health/damage combat, player-vs-enemy or PvP

---

## 1. Actions Catalog

> **Candidates, not a capture list** — read the **Tier** column and apply the keep test ([INDEX.md](./INDEX.md),
> "Action Tiers and the Keep Test"). **Genre T3 traps:** the whole Movement group, `Reload`/`WeaponSwitch` and
> `ShotFired` (mechanical noise — current weapon and ammo are tracked **state**), and
> `PickupAmmo`/`PickupHealth`/`PickupArmor` (the totals are tracked state). **Scope:** player-scoped — `Kill`,
> `Death`, `Headshot`, `MultiKill`, `MeleeKill`, `Assist`; **global** (fire once, no guard) — `RoundWin`,
> `MatchWin`, `ObjectiveComplete`, `FlagCapture`, `PointCapture`.

### Combat Actions

| Action Name | Tier | Description | Objective Potential | Scoring Potential |
|-------------|------|-------------|---------------------|-------------------|
| `Kill` | T1 | Player kills enemy/opponent | "Kill 10 enemies" | 100 pts |
| `Death` | T1 | Player dies | "Survive without dying" (inverse) | -50 pts |
| `Headshot` | T1 | Kill via headshot | "Get 5 headshots" | +50 bonus |
| `MeleeKill` | T2 | Kill with melee weapon | "Get 3 melee kills" | +25 bonus |
| `ExplosiveKill` | T2 | Kill with explosive | "Get 2 explosive kills" | +25 bonus |
| `MultiKill` | T1 | Multiple kills in short window | "Get a double kill" | +100 bonus |
| `Assist` | T2 | Contributed damage to a kill | "Get 5 assists" | 50 pts |
| `TeamKill` | T2 | Killed a teammate (negative) | — | -200 pts |

**Kill actions are additive axes, not alternatives.** One death sends the canonical `Kill` **and** its method
(`Headshot` / `MeleeKill` / `ExplosiveKill`) **and**, where a goal needs it, a class bucket from a curated, bounded
list (`KillHeavy`) — so "kill 10 enemies", "get 3 headshots" and "kill a heavy" all score off one event. Emit them
side by side (never `else if`), never instead of `Kill`, and never as a runtime-built name (`Kill_<Type>`)
(`6a` Important Notes). Derive method and class from the victim and damage type at kill time, and check every
enemy family's death path — they often differ (`learnings/architecture/additive-action-emission-for-composable-goals.md`,
`learnings/common-mistakes/enemy-death-signal-varies-across-families.md`).

### Downed / Revive Actions

In revive-based shooters, `Death` fires only on the **downed→dead** transition. Track the defeat-state enum (§3) for the in-between states, and emit these for the transitions a viewer would call out:

| Action Name | Tier | Description | Objective Potential | Scoring Potential |
|-------------|------|-------------|---------------------|-------------------|
| `Downed` | T2 | Player entered the downed / bleed-out state (not yet dead) | — | — |
| `Revived` | T2 | This player was revived by a teammate | — | +50 |
| `RevivedTeammate` | T2 | This player revived a teammate | "Revive 2 teammates" | 100 pts |

### Weapon/Equipment Actions

| Action Name | Tier | Description | Objective Potential | Scoring Potential |
|-------------|------|-------------|---------------------|-------------------|
| `Reload` | T3 | Weapon reloaded | — | — |
| `WeaponSwitch` | T3 | Changed weapon | — | — |
| `PickupWeapon` | T2 | Picked up a weapon | "Pick up 3 weapons" | 10 pts |
| `PickupAmmo` | T3 | Picked up ammo | — | — |
| `PickupHealth` | T3 | Picked up health | — | — |
| `PickupArmor` | T3 | Picked up armor | — | — |
| `UseGrenade` | T3 | Threw grenade | — | — |
| `UseAbility` | T2 | Used special ability | "Use ability 5 times" | — |
| `ShotFired` | T3 | Fired a weapon — per-shot heartbeat (T2 only when a shots/accuracy goal exists) | "Land 20 shots" | — |

### Movement Actions

| Action Name | Tier | Description | Objective Potential | Scoring Potential |
|-------------|------|-------------|---------------------|-------------------|
| `Jump` | T3 | Player jumped | — | — |
| `DoubleJump` | T3 | Double jump (if available) | — | — |
| `Dash` | T3 | Dash/dodge (T2 only if a *scored* mechanic) | — | — |
| `Sprint` | T3 | Started sprinting | — | — |

### Progression/Objective Actions

| Action Name | Tier | Description | Objective Potential | Scoring Potential |
|-------------|------|-------------|---------------------|-------------------|
| `ObjectiveComplete` | T1 | Completed map objective | "Complete all objectives" | 500 pts |
| `FlagCapture` | T1 | Captured the flag | "Capture 2 flags" | 300 pts |
| `PointCapture` | T1 | Captured control point | "Capture 3 points" | 200 pts |
| `Respawn` | T3 | Player respawned | — | — |
| `RoundWin` | T1 | Won a round | — | 1000 pts |
| `MatchWin` | T1 | Won the match | — | 2000 pts |

---

## 2. Search Keywords

The agent should grep for these keywords in function names, variable names, and comments. Group results by category. Combat and pickups often route through the engine's **collision / overlap / trigger-volume callbacks** and **raycast / trace** queries rather than a named `OnKill` — search those too.

### Combat / Damage / Kill
```
kill, killed, death, die, died, dead, frag, eliminate, eliminated
damage, hurt, hit, takeDamage, applyDamage, onDamage, doDamage, dealDamage, damageable
onCollision, onOverlap, onTrigger, raycast, trace
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
- [ ] Current weapon / weapon ID / active slot index
- [ ] Ammo — **magazine (loaded) and reserve are distinct quantities**; capture both
- [ ] Score / kills / deaths / assists
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

An attack **in flight at the captured instant** (a rocket or grenade mid-air, an enemy mid-swing) sharpens the reconstruction, but it is a **later-wave** add (`06 §1.1`): the moment is coherent without it, and it is the hardest class to capture (pooled, short-lived, velocity applied late). No new machinery — it is a pooled collection object with a handful of attributes (`06 §10.5`); the **velocity is a deferred property** at restore (`07 §6`), the **owner resolves in Pass 2** (`07 §3`), and any lifetime timer is captured as **remaining**, not elapsed (`06 §9.4`). The hit the attack lands is an **action, not state** (`06 §7`): reconstruct the attack and let the hit re-fire as the replay plays forward. A mid-cast or mid-swing enemy is the same idea on the enemy object — cast progress, or animation state + normalized time, with the animation time deferred exactly like velocity (`06 §9.7`).

**Until projectiles are tracked, clear them at restore.** In-flight projectiles left in the world by the boot or a previous play are not part of the captured moment — have the restore remove them rather than let a stale shot land in the replay (`07 §2.6`).

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
