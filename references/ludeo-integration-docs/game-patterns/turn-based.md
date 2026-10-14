# Turn-Based / Tactics Genre Patterns

> **Applies to:** turn-based tactics, strategy RPGs, SRPGs, grid/initiative combat (XCOM-likes),
> roguelike tactics.
>
> **Load when:** discrete turns / initiative order, action points, grid movement, unit-by-unit actions.
>
> ⚠️ **Provisional:** generalized from a single turn-based integration; confirm against the specific game
> before relying on it — especially the cadence advice in §4 and the restore-timing rules in §5.
>
> Action names below are sent with `LudeoManager::Get().SendAction(name)` (`06 §7.1`).

---

## 1. Actions Catalog

### Combat

| Action Name | Description | Objective Potential | Scoring Potential |
|-------------|-------------|---------------------|-------------------|
| `Attack` / `Hit` | Unit performs an attack and connects | "Land 10 attacks" | 50 pts |
| `Kill` | Unit is destroyed (per-unit-CLASS identity gives richer highlights — e.g. `Kill_HeavyInfantry`) | "Destroy 5 enemy units" | 200 pts |
| `AbilityUse` | Unit activates a special ability | "Use abilities 8 times" | 25 pts |
| `CriticalHit` | Attack deals critical/bonus damage | "Land 3 critical hits" | +75 bonus |
| `Miss` | Attack fails to connect | — | — |
| `Heal` | Unit restores HP to itself or an ally | "Heal 200 total HP" | 30 pts |
| `ApplyBuff` | Positive status effect applied to a unit | — | 10 pts |
| `ApplyDebuff` | Negative status effect applied to an enemy | "Debuff 4 enemies" | 15 pts |

### Turn Flow

| Action Name | Description | Objective Potential | Scoring Potential |
|-------------|-------------|---------------------|-------------------|
| `TurnStarted` | A unit's individual turn begins | — | — |
| `TurnEnded` | A unit's individual turn ends | — | — |
| `RoundStarted` | A full initiative cycle begins | — | — |
| `UnitActivated` | The active unit changes (initiative order advances) | — | — |

### Movement / Positioning

| Action Name | Description | Objective Potential | Scoring Potential |
|-------------|-------------|---------------------|-------------------|
| `UnitMoved` | Unit moves to a new grid cell | "Move 20 total tiles" | 5 pts per tile |
| `Overwatch` / `ReactionSet` | Unit enters overwatch / reaction stance | "Set overwatch 3 times" | 20 pts |

### Objectives

| Action Name | Description | Objective Potential | Scoring Potential |
|-------------|-------------|---------------------|-------------------|
| `ObjectiveComplete` | A battle objective is fulfilled | "Complete all objectives" | 500 pts |
| `PointCaptured` | Unit captures a control point or zone | "Capture 2 points" | 300 pts |
| `UnitExtracted` | Unit reaches an extraction zone | "Extract 3 units" | 250 pts |

### Outcome

| Action Name | Description | Objective Potential | Scoring Potential |
|-------------|-------------|---------------------|-------------------|
| `BattleWon` | The player's side wins the battle | — | 2000 pts |
| `BattleLost` | The player's side is defeated | — | — |

---

## 2. Search Keywords

Grep these in function/field names and comments. Group results by category.

### Turn / Round / Initiative
```
turn, round, initiative, phase, order, sequence
beginTurn, endTurn, startTurn, nextTurn, onTurnStart, onTurnEnd
activateUnit, unitActivated, activeUnit, currentUnit
actionPoint, AP, remainingActions, actionsLeft
```

### Grid / Movement / Positioning
```
grid, tile, cell, hex, square, slot
move, moveTo, moveUnit, unitMoved, walkTo
overwatch, reaction, stance, watchZone
range, distance, reach, adjacency
```

### Combat / Abilities / Status
```
attack, strike, hit, miss, damage, takeDamage, applyDamage, dealDamage
ability, skill, activate, cooldown, cast, useAbility
critical, crit, bonus, penetrate
buff, debuff, status, effect, apply, remove
heal, restore, regenerate, revive
```

### Unit Identity / State
```
unit, character, soldier, hero, actor
faction, team, side, owner, alliance
alive, dead, die, destroy, eliminate, remove
health, hp, hitPoints, maxHealth
class, type, archetype, role
```

### Objectives / Outcome
```
objective, mission, goal, task, condition
capture, extract, escort, defend, survive
win, lose, victory, defeat, gameOver, endBattle, endMission
score, points, reward, rank
```

Also look for the game's **turn/phase state machine** (a battle-phase enum on the game-state or battle
manager — Setup / PlayerTurn / EnemyTurn / GameOver): it is the natural capture gate. Units placed in the
level (rather than spawned) make restore matching trivial — match by stable ID and drive the game's own
removal path for units that were already dead at capture.

---

## 3. Tracking Checklist

After object tracking is implemented (`phase 5 · task 1`), verify these are covered. Sections are tiered
by restoration priority:
- **CRITICAL** — restore or the replayed moment is visibly wrong.
- **IMPORTANT** — restore for fidelity; recognizable without it but degraded.
- **OPTIONAL** — situational/cosmetic; capture only if it affects the specific captured moment.

> Universal items (alive/dead, team, appearance) → [common.md](./common.md) §1.

### Per Unit — CRITICAL
- [ ] Grid position — cell coordinates (`int` pair) and/or world position (`vec3`)
- [ ] Health / HP (`int`/`float`)
- [ ] Faction / team ID
- [ ] Action points remaining
- [ ] Ability cooldowns — **top priority, not enrichment**: a restored battle with reset cooldowns changes
      every decision; ask about this explicitly during entity tiering (capture *remaining* turns, `06 §9.4`)
- [ ] Alive / dead (`bool`)
- [ ] Unit class / archetype (enables per-class kill identity for richer highlights)

### Turn System — CRITICAL (a singleton object type)
- [ ] Round number
- [ ] Initiative order — capture the **runtime-ordered list** (unit IDs), NOT the per-unit initiative stat
      it was derived from; the stat produces the order at setup, but swaps/modifications happen at runtime
- [ ] Active-unit index (whose turn it currently is)
- [ ] Turn-state name (e.g. Setup / TurnBased / GameOver)

> Restoring units without restoring whose turn it is breaks the first frame — this is per-tick state and
> must survive into Player Flow.

### Objectives — IMPORTANT
- [ ] Objective flags (met / not met)
- [ ] Objective progress / counters
- [ ] Zone / point capture state

### Environment / Session — OPTIONAL
- [ ] Map / level name
- [ ] Game mode / difficulty
- [ ] Battle outcome flag (for early-restore edge cases)

---

## 4. Session & Capture Cadence (turn-based specific)

### Room = the whole battle

One battle (map load → victory/defeat) is the Gameplay Session. Turns are **not** rooms or highlights — do
not open/close a room per turn (the boundary rule is [`open-world.md §1`](./open-world.md): one live run
bounds one session).

### Quantized write cadence

When the team agrees that captures are assumed to start at the beginning of a turn, quantizing state writes
to turn boundaries makes every possible restore land at the most recent turn start. This enforces the
agreed capture semantics by construction — no cloud-side cooperation needed.

Implementation: the existing capture tick (e.g. 10 Hz) reads a **turn tuple** from the turn manager —
`(current_turn, active_unit_id, turn_state_name)` — and rewrites all tracked state objects only when the
tuple changes. Unit deaths are still handled at tick time (final write, then unregister — `06 §3.4`),
because a unit's backing object may be freed before the next boundary.

```cpp
struct TurnTuple { int turn; uint64_t active_unit_id; int turn_state; };

bool LudeoStateAdapter::ShouldWriteThisTick()          // the swappable policy
{
    if (m_cadence == Cadence::PerTick) return true;
    TurnTuple now = TurnManager::Get().ReadTuple();
    bool changed = !(now == m_last_tuple);
    m_last_tuple = now;
    return changed;                                    // TurnBoundary
}
```

### Make cadence a swappable policy

Structure the write path behind a `ShouldWriteThisTick()` predicate driven by a config key (e.g.
`ludeo.write_cadence = turn_boundary | per_tick`). Flipping cadence is then a config change.

**Key fact to surface to the team:** switching cadence does **not** invalidate previously captured Ludeos —
the attribute schema is identical; only write frequency differs. Re-recording is only forced when
attributes are added or removed.

### ⚠️ Critical — watch the replay early

Turn-boundary cadence can look **broken** when units do not move for whole turns (e.g. ranged combat): the
last-boundary data can equal the battle-start formation while the video shows mid-turn action. The replay
then appears as though the game restarted. Because the integration's self-checks validate restore-vs-data,
every instrument reads green while the scene is wrong.

Rules:
1. **Schedule a watch-the-replay test immediately after the first capture** — the team cannot evaluate
   cadence from a description alone; expect the cadence decision to flip to per-tick.
2. When restore-vs-data validation is green but the scene looks wrong, check **data-vs-video** before
   hunting restore bugs.
3. The swappable-cadence design (config key) is what makes the flip a one-line change — keep it.

---

## 5. Restore Timing (Player Flow) — turn-based specific

In a turn-based game, **WHEN the restore applies is mechanics, not polish.** Landing a restore in the
middle of the turn choreography — mid-animation, mid-action-queue, or by directly overwriting the turn
system — produces demo-breaking **limbo**: an intermittent empty ability bar, **wedged input**, or **turns
that will not advance** — none of which correct DATA can fix. Treat restore timing as **phase 5**
work (core playability of the restored moment), not late polish. Defer only genuinely cosmetic timing
(animation blending, camera easing, late-loading visuals).

Three rules, all driven by the **game's own signals** — never wall-clock guesses. They refine the fixed
restore order (`07 §2.1`) for this genre; they do not replace it:

1. **Restore only into a settled engine.** "Reach active gameplay" (`07 §2.1` step 4) is not finished when
   the level is up: also wait until the game's "something is animating" signals (e.g. the turn/action
   manager's ongoing- and blocking-action sets) have been continuously empty for a short window (~0.5 s)
   **before the freeze and apply** (step 5). The startup choreography finishes playing; the restore then
   lands on a quiescent state machine. This is what kills the intermittent (≈1-in-3) empty-ability-bar /
   un-advanceable-turn races that data-side fixes can never touch.
2. **Move through the game's own flow, not around it.** To put the battle on the captured unit, apply the
   unit data frozen as usual, then advance to that unit's turn via the game's **own end-turn / next-turn
   function** (guarded: only across player-controlled units, never crossing a round boundary). Drive it
   during the **settle** (step 6 — the sim runs, input stays off) and treat the settle as complete only when
   the busy signals from rule 1 are empty again, **then** freeze (the ~0.5 s of `07 §2.1` is a minimum, not
   a timer). Each transition rebuilds the UI/animation layers natively. Direct overwrites of the turn system
   desync the controller/UI layers and are the usual cause of the limbo.
3. **Capture only from actionable moments** (the write-side dual of rule 1): gate writes on "a player unit
   is active AND nothing is animating," so every frame a viewer can trim to restores to a player-actionable
   choice moment by construction. The cloud's restore point follows the viewer's **trim**, not the capture
   press, so per-frame validity is mandatory.
