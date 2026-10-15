# Survival / Sandbox Genre Patterns

> **Applies to:** Survival/crafting games (Valheim, 7 Days to Die, Rust, Subnautica), sandbox/builder
> games (Minecraft-likes), base-building survival, colony sims with a controlled avatar
> **Load when:** Game involves gathering resources, crafting/building, hunger/thirst/temperature
> survival meters, or placing/destroying world structures
>
> **These games are almost always open-world / streaming and often indefinite (no death-end).** Load
> [open-world.md](./open-world.md) (session boundaries — note the §7 sandbox edge case:
> load→play→save-exit = one session) and [open-world-tracking.md](./open-world-tracking.md)
> (streaming-world tracking) **alongside** this file.

> ⚠️ **Two shapes of "survival" — pick the right subset.** (1) **Full crafting sandbox** (Valheim, Rust,
> Minecraft, 7 Days): gathering + crafting + building + hunger/thirst/temperature. (2) **Survival-FPS /
> survival-horror**: mostly combat + inventory + a health/stamina meter, with **no** crafting, building or
> gathering. For (2), use the Combat / Threat actions, the inventory and survival-meter checklist items, and
> [shooter.md](./shooter.md) for the gunplay — skip the Gathering and Crafting / Building sections entirely.

---

## 1. Actions Catalog

> **Candidates, not a capture list** — read the **Tier** column and apply the keep test ([INDEX.md](./INDEX.md),
> "Action Tiers and the Keep Test"). **Genre T3 traps:** `ItemPickup`, `HitTaken`, `ShotFired` and
> `Ate`/`Drank`/`Healed`/`StarvationDamage` (the survival meters are tracked **state** — capture the *milestone*,
> `DaySurvived`, not every bite). `ResourceGathered`/`Mined`/`TreeChopped` are **high-frequency** — promote to T2
> only when tied to a real objective ("gather 50 wood"), never send them on every harvest as flavor.
> **Scope:** predominantly player-scoped — `CreatureKill`, `Death`, `StructurePlaced`, `Tamed`, `RecipeUnlocked`
> (guard kills that fire for non-player actors); world-wide events (a raid or boss spawn, `DaySurvived` as a shared
> day rollover) are **global** — fire once.

### Gathering / Harvesting Actions

| Action Name | Tier | Description | Objective Potential | Scoring Potential |
|-------------|------|-------------|---------------------|-------------------|
| `ResourceGathered` | T3 | Harvested wood/stone/ore/fiber (T2 if tied to an objective) | "Gather 50 wood" | 5 pts |
| `Mined` | T3 | Mined a block / ore node | "Mine 10 ore" | 10 pts |
| `TreeChopped` | T3 | Felled a tree | "Chop 5 trees" | 10 pts |
| `ItemPickup` | T3 | Picked up a loose item | — | — |

### Crafting / Building Actions

| Action Name | Tier | Description | Objective Potential | Scoring Potential |
|-------------|------|-------------|---------------------|-------------------|
| `ItemCrafted` | T2 | Crafted an item/tool | "Craft a tool" | 25 pts |
| `StructurePlaced` | T1 | Placed a building piece | "Build a shelter" | 50 pts |
| `StructureUpgraded` | T2 | Upgraded a structure | — | 25 pts |
| `StructureDestroyed` | T2 | Demolished / lost a structure | — | — |
| `RecipeUnlocked` | T1 | Unlocked a recipe / tech | "Unlock a recipe" | 100 pts |

### Survival Actions

| Action Name | Tier | Description | Objective Potential | Scoring Potential |
|-------------|------|-------------|---------------------|-------------------|
| `Ate` / `Drank` | T3 | Consumed food/water | — | — |
| `Slept` | T3 | Slept (time-skip; same run — see open-world.md) | — | — |
| `Healed` | T3 | Restored health | — | — |
| `StarvationDamage` | T3 | Took hunger/thirst/cold damage | "Survive a day without starving" (inverse) | — |
| `DaySurvived` | T1 | Survived another day | "Survive 7 days" | 200 pts |

### Combat / Threat Actions

| Action Name | Tier | Description | Objective Potential | Scoring Potential |
|-------------|------|-------------|---------------------|-------------------|
| `CreatureKill` | T2 | Killed a creature/mob | "Kill 10 creatures" | 50 pts |
| `BossKill` | T1 | Defeated a boss creature | "Defeat the boss" | 1000 pts |
| `Death` | T1 | Player died | "Survive without dying" (inverse) | -50 pts |
| `Tamed` | T1 | Tamed/domesticated a creature | "Tame a creature" | 100 pts |
| `HitTaken` | T3 | Player took damage and survived | — | — |
| `ShotFired` | T3 | Fired a ranged weapon — per-shot heartbeat (if armed) | — | — |
| `EscapeGrab` | T2 | Broke free of an enemy grab / grapple (survival-horror) | "Escape 3 grabs" | 25 pts |

**Kills are additive, like [shooter.md](./shooter.md) §1:** one creature death sends `CreatureKill` **and**, where
goals need them, a creature-class bucket and (if armed) a weapon-method bucket — each from a curated, bounded list
next to it, never a runtime-built `Kill_<Weapon>` and never instead of `CreatureKill`.

---

## 2. Search Keywords

The agent should grep for these keywords in function names, variable names, and comments. Group
results by category. Gathering and interaction usually run through **overlap / collision callbacks** or a
**raycast / trace** from the tool, and placement through the engine's spawn call — search those too.

### Gathering / Resources
```
gather, harvest, mine, chop, dig, forage, pick, collect, resourceNode
resource, wood, stone, ore, metal, fiber, food, water, fuel
node, deposit, vein, depleted, respawn, regrow, yield
durability, harvestTool, pickaxe, axe, hit, onHit
```

### Crafting / Building
```
craft, build, construct, place, snap, blueprint, recipe, schematic, ingredient
structure, piece, foundation, wall, floor, building, deconstruct, demolish, upgrade
inventory, stack, slot, storage, container, chest, crate
unlock, research, tech, techTree, progression
```

### Survival Meters
```
hunger, thirst, food, water, stamina, fatigue, temperature, cold, heat, warmth
health, hp, heal, regen, eat, drink, consume, sleep, rest, bed
oxygen, sanity, radiation, poison, disease, status, effect, buff, debuff
day, night, dayCount, time, weather, season, storm
```

### Creatures / Combat / Threats
```
creature, mob, animal, enemy, monster, spawn, spawner, AI
attack, damage, kill, death, die, takeDamage, damageable, onHit
tame, domesticate, breed, mount, pet, follower
aggro, alert, hostile, passive, faction
```

---

## 3. Tracking Checklist

After object tracking is implemented, verify these are covered. These worlds stream and persist
heavily — apply [open-world-tracking.md](./open-world-tracking.md): track the **loaded neighborhood +
world state**, scope cell/chunk mutations to what the captured moment needs, not the entire save. Sections are tiered by restoration priority:
- **CRITICAL** — restore or the replayed moment is visibly wrong.
- **IMPORTANT** — restore for fidelity; recognizable without it but degraded.
- **OPTIONAL** — situational/cosmetic; capture only if it affects the specific captured moment.

> Universal player items (look/aim rotation, armor/shield pool, stance, team) → [common.md](./common.md) §1.

### Player — CRITICAL
- [ ] Position (vec3), Rotation (quat/vec4)
- [ ] Health, Hunger, Thirst, Stamina, Temperature (and any survival meter)
- [ ] Is alive/dead
- [ ] Equipped tool/weapon (by item/blueprint ID)
- [ ] Appearance / equipped cosmetics (outfit, skin, armor look — by content ID, never a pointer). Constant through the clip, but **visible**: constants are normally skipped (`06 §9.3` step 1) — this is the exception, because a default-appearance replay is visibly wrong
- [ ] Inventory / hotbar (array of item IDs + counts; never pointers — `06 §4`)
  - [ ] For ranged weapons: **magazine (loaded) and reserve ammo are distinct quantities** — often the same "quantity" property on different inventory entries; capture both
- [ ] Unlocked recipes / tech (if it gates the moment)

### Placed structures / world edits — IMPORTANT
- [ ] Structure/block type + position (by stable cell/chunk + content ID — `open-world-tracking.md §4`)
- [ ] Health / durability / damage state
- [ ] Owner / team ID (multiplayer)
- [ ] Built/destroyed state (destroyed = **state flag**, distinguish from streamed-out — `06 §3.4`)

### Resource nodes — OPTIONAL
- [ ] Type, position
- [ ] Remaining yield / depleted state + respawn timer

### Creatures / mobs — IMPORTANT
- [ ] Position, rotation, health
- [ ] Creature type, AI state (idle, aggro, fleeing)
- [ ] Tamed/owned state + owner ID
- [ ] Target (by stable game ID); is alive/dead

### World state — CRITICAL (for survival)
- [ ] Game-time, day count, weather, season (a `world_state` object — `open-world-tracking.md §3`)

### Containers — OPTIONAL
- [ ] Position, contents (array of item IDs + counts), owner ID
