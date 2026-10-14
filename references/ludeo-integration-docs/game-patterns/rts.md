# RTS Genre Patterns

> **Applies to:** Real-Time Strategy, Tower Defense, Base Builders, MOBA (partial)
> **Load when:** Game involves unit production, base building, resource management, strategic combat

---

## 1. Actions Catalog

### Unit/Building Production

| Action Name | Description | Objective Potential | Scoring Potential |
|-------------|-------------|---------------------|-------------------|
| `BuildUnit` | Produced a unit | "Build 20 units" | 10 pts |
| `BuildStructure` | Built a structure | "Build 5 structures" | 50 pts |
| `BuildDefense` | Built defensive structure | "Build 3 towers" | 30 pts |
| `UpgradeUnit` | Upgraded a unit | "Upgrade 5 units" | 25 pts |
| `UpgradeStructure` | Upgraded a structure | — | 25 pts |
| `Research` | Completed research/tech | "Research 3 upgrades" | 100 pts |

### Combat

| Action Name | Description | Objective Potential | Scoring Potential |
|-------------|-------------|---------------------|-------------------|
| `UnitKill` | Destroyed an enemy unit | "Destroy 50 units" | varies by unit |
| `StructureDestroy` | Destroyed enemy structure | "Destroy 3 buildings" | 200 pts |
| `UnitLost` | Lost a unit | "Lose fewer than 10 units" (inverse) | — |
| `StructureLost` | Lost a structure | — | — |
| `HeroKill` | Killed a hero unit | "Kill the enemy hero" | 500 pts |
| `HeroDeath` | Hero unit died | — | — |

### Economy / Resources

| Action Name | Description | Objective Potential | Scoring Potential |
|-------------|-------------|---------------------|-------------------|
| `ResourceCollect` | Gathered resources | "Collect 1000 gold" | per unit |
| `ResourceSpend` | Spent resources | — | — |
| `TradeComplete` | Completed a trade | — | — |
| `WorkerCreated` | Created a worker/harvester | — | — |

### Territory / Objectives

| Action Name | Description | Objective Potential | Scoring Potential |
|-------------|-------------|---------------------|-------------------|
| `CapturePoint` | Captured a strategic point | "Capture 3 points" | 200 pts |
| `LosePoint` | Lost a strategic point | — | — |
| `ObjectiveComplete` | Completed map objective | "Complete all objectives" | 500 pts |
| `WaveComplete` | Survived a wave (tower defense) | "Survive 10 waves" | 100 pts |
| `MatchWin` | Won the match | — | 2000 pts |

### Player Commands

| Action Name | Description | Objective Potential | Scoring Potential |
|-------------|-------------|---------------------|-------------------|
| `AttackOrder` | Issued attack command | — | — |
| `MoveOrder` | Issued move command | — | — |
| `GroupSelect` | Selected a control group | — | — |
| `UseAbility` | Used a special ability | "Use ability 5 times" | — |

---

## 2. Search Keywords

### Units / Entities / Spawning
```
unit, troop, soldier, army, squad, group, formation
spawn, produce, create, train, recruit, summon, deploy
destroy, kill, die, death, eliminate, remove
hero, champion, commander, leader
worker, harvester, gatherer, villager, peasant, drone, probe, scv
```

### Buildings / Structures / Construction
```
build, construct, place, erect, foundation
structure, building, tower, wall, gate, barracks, factory
upgrade, level, tier, tech, evolve, improve
demolish, raze, dismantle, sell
defense, turret, cannon, fortification
```

### Resources / Economy
```
resource, gold, wood, stone, food, mineral, gas, supply, mana, energy
harvest, gather, mine, collect, extract
cost, afford, spend, buy, purchase, invest
income, rate, production, economy
trade, market, exchange
population, supply, capacity, limit, cap
```

### Territory / Map Control
```
capture, control, occupy, claim, contest, neutral
territory, zone, region, sector, point, node, base
flag, beacon, outpost, expansion
minimap, fog, reveal, scout, explore, vision
```

### Combat / Orders
```
attack, fight, engage, assault, siege, raid, charge
defend, retreat, garrison, hold, guard
move, patrol, waypoint, rally, formation
select, group, hotkey, command, order, queue
ability, spell, skill, power, cooldown, cast
damage, armor, range, dps, aoe
```

### Game Flow
```
wave, round, phase, age, era, epoch
victory, defeat, surrender, ally, enemy, neutral
score, objective, mission, campaign, scenario
```

---

## 3. Tracking Checklist

After object tracking is implemented, verify these are covered. Sections are tiered by restoration priority:
- **CRITICAL** — restore or the replayed moment is visibly wrong.
- **IMPORTANT** — restore for fidelity; recognizable without it but degraded.
- **OPTIONAL** — situational/cosmetic; capture only if it affects the specific captured moment.

### Player State — CRITICAL
- [ ] Resources (each type: gold, wood, etc.)
- [ ] Population / supply (current and cap)
- [ ] Tech level / age / era
- [ ] Score
- [ ] Team / faction
- [ ] Appearance / equipped cosmetics (faction color/scheme, hero/unit skins; MOBA-style hero skins matter most — by content ID, never a pointer). Constant through the clip, but **visible**: constants are normally skipped (`06 §9.3` step 1) — this is the exception, because a default-skin replay is visibly wrong

### Units — CRITICAL (the army *is* the moment in an RTS)
- [ ] Position (vec3)
- [ ] Unit type / blueprint ID
- [ ] Health / HP
- [ ] Owner / player ID
- [ ] Current order / AI state (idle, moving, attacking, gathering)
- [ ] Target entity ID
- [ ] Is alive

### Structures / Buildings — IMPORTANT
- [ ] Position
- [ ] Building type
- [ ] Health
- [ ] Owner / player ID
- [ ] Build progress (0.0 to 1.0)
- [ ] Is complete
- [ ] Upgrade level
- [ ] Production queue (if producing units)

### Resources / Economy — IMPORTANT
- [ ] Resource node positions
- [ ] Resource node remaining amount
- [ ] Player resource totals (each type)

### Map / Territory — OPTIONAL
- [ ] Control point ownership
- [ ] Fog of war state (per player)
- [ ] Explored areas

### Environment — OPTIONAL
- [ ] Destructible terrain (if applicable)
- [ ] Weather / time of day (if affects gameplay)
- [ ] Level metadata (map name, game mode, player count)
