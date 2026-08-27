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

---

## 1. Actions Catalog

### Gathering / Harvesting Actions

| Action Name | Description | Objective Potential | Scoring Potential |
|-------------|-------------|---------------------|-------------------|
| `ResourceGathered` | Harvested wood/stone/ore/fiber | "Gather 50 wood" | 5 pts |
| `Mined` | Mined a block / ore node | "Mine 10 ore" | 10 pts |
| `TreeChopped` | Felled a tree | "Chop 5 trees" | 10 pts |
| `ItemPickup` | Picked up a loose item | — | — |

### Crafting / Building Actions

| Action Name | Description | Objective Potential | Scoring Potential |
|-------------|-------------|---------------------|-------------------|
| `ItemCrafted` | Crafted an item/tool | "Craft a tool" | 25 pts |
| `StructurePlaced` | Placed a building piece | "Build a shelter" | 50 pts |
| `StructureUpgraded` | Upgraded a structure | — | 25 pts |
| `StructureDestroyed` | Demolished / lost a structure | — | — |
| `RecipeUnlocked` | Unlocked a recipe / tech | "Unlock a recipe" | 100 pts |

### Survival Actions

| Action Name | Description | Objective Potential | Scoring Potential |
|-------------|-------------|---------------------|-------------------|
| `Ate` / `Drank` | Consumed food/water | — | — |
| `Slept` | Slept (time-skip; same run — see open-world.md) | — | — |
| `Healed` | Restored health | — | — |
| `StarvationDamage` | Took hunger/thirst/cold damage | "Survive a day without starving" (inverse) | — |
| `DaySurvived` | Survived another day | "Survive 7 days" | 200 pts |

### Combat / Threat Actions

| Action Name | Description | Objective Potential | Scoring Potential |
|-------------|-------------|---------------------|-------------------|
| `CreatureKill` | Killed a creature/mob | "Kill 10 creatures" | 50 pts |
| `BossKill` | Defeated a boss creature | "Defeat the boss" | 1000 pts |
| `Death` | Player died | "Survive without dying" (inverse) | -50 pts |
| `Tamed` | Tamed/domesticated a creature | "Tame a creature" | 100 pts |

---

## 2. Search Keywords

The agent should grep for these keywords in function names, variable names, and comments. Group
results by category.

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
attack, damage, kill, death, die, takeDamage
tame, domesticate, breed, mount, pet, follower
aggro, alert, hostile, passive, faction
```

---

## 3. Tracking Checklist

After object tracking is implemented, verify these are covered. These worlds stream and persist
heavily — apply [open-world-tracking.md](./open-world-tracking.md): track the **loaded neighborhood +
world state**, scope cell/chunk mutations to what the captured moment needs, not the entire save.

### Player (CRITICAL)
- [ ] Position (vec3), Rotation (quat/vec4)
- [ ] Health, Hunger, Thirst, Stamina, Temperature (and any survival meter)
- [ ] Is alive/dead
- [ ] Equipped tool/weapon (by item/blueprint ID)
- [ ] Inventory / hotbar (array of item IDs + counts; never pointers — `06 §4`)
- [ ] Unlocked recipes / tech (if it gates the moment)

### Placed structures / world edits
- [ ] Structure/block type + position (by stable cell/chunk + content ID — `open-world-tracking.md §4`)
- [ ] Health / durability / damage state
- [ ] Owner / team ID (multiplayer)
- [ ] Built/destroyed state (destroyed = **state flag**, distinguish from streamed-out — `06 §3.4`)

### Resource nodes
- [ ] Type, position
- [ ] Remaining yield / depleted state + respawn timer

### Creatures / mobs
- [ ] Position, rotation, health
- [ ] Creature type, AI state (idle, aggro, fleeing)
- [ ] Tamed/owned state + owner ID
- [ ] Target (by stable game ID); is alive/dead

### World state (CRITICAL for survival)
- [ ] Game-time, day count, weather, season (a `world_state` object — `open-world-tracking.md §3`)

### Containers
- [ ] Position, contents (array of item IDs + counts), owner ID
