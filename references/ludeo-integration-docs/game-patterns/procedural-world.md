# Procedural / Non-Deterministic-Assembly Pattern

> **Applies to:** roguelikes / roguelites (Hades, Dead Cells, Slay the Spire, Risk of Rain, Enter the
> Gungeon-likes), procedural dungeon crawlers, wave/horde survival, daily-seed runs — any game where a
> run's world is **assembled at load from data + RNG** rather than authored into a fixed level/scene. The
> defining trait: **the level is a container; the run-specific content is generated/selected at runtime**
> (room/chunk definitions, prefab/asset pools, a seed).
>
> **Load when:** capturing "which level/scene" would **not** be enough to relocate the captured moment,
> because loading that level yields an empty/default container and the generator **re-rolls** content
> (layout, encounter, waves) on load. Signals in the CODE_MAP: a level/run *builder* or *pool* that picks
> rooms/chunks from a list, an RNG/seed driving layout or encounters at level load, content defined as
> data assets assembled at runtime, a per-run difficulty/depth counter.
>
> **This is a structural pattern, not a genre pattern.** Like `open-world.md` it is about *world lifecycle
> and identity*, not an action/object catalog. It is **orthogonal**: a game can be procedural **and**
> level/match-based (most roguelikes) or procedural **and** streaming. Load it *in addition to* the genre
> file(s), and — when several rooms are live at once (§2.1) — alongside the open-world files.

---

## 1. The trap: level ≠ content, and load is non-deterministic

A level-based game's level **is** its content — reload it and the same world comes back. A procedural
game's level is a **container** populated at runtime from data and a random stream. Four consequences
break the naïve "capture the level id" instinct, and all four must be fixed on the **capture side** —
*you can't restore what tracking never wrote*:

| Naïve capture | Why it fails on restore |
|---|---|
| **Level/scene id only** | Reloading that level loads an **empty/default container**, not the room/chunk/layout the player was in. You can't restore what you can't relocate. |
| *(even capturing the room/chunk id)* | Loading the room **re-rolls** its content — a fresh random encounter / wave set / layout. The remaining fight won't match what the player faced. Load is **not idempotent** w.r.t. content. |
| *(room/chunk id captured, content re-roll suppressed)* | The room's **world placement** — origin + rotation — is rolled *independently of which room it is*: an entrance connector aligned to the previous room's exit connector, plus a per-transition offset, typically from an unseeded RNG. The room lands at a **different world transform** than at capture, so every **absolute** entity position you stored (player, enemies, boss, hazards, even untracked props parented to the room) now points into the void. Reproducing *which* room is **not** reproducing *where it sits*. |
| *(room/chunk, but nothing about progression)* | The reload **resets run-scaling counters** (combat level → 0, depth, difficulty tier). Anything spawned *after* the restore point is mis-scaled. |

The reframe: a Ludeo captures **one assembled moment**. To rebuild it you must capture the **generation
inputs** that *identify and reproduce* that assembly — not the container it happened to live in. This
plugs directly into the restore flow's **read-then-load** step (`07 §2`): the "entry identity" you read
from the `DataReader` before reaching active gameplay is exactly these inputs, and "reach active gameplay"
means *re-drive the generator to them*, not just load a level.

## 2. Session boundary: one run = one Gameplay Session

The boundary rule is the roguelike instance of [`open-world.md §1`](./open-world.md): **one live run = one
Gameplay Session**, regardless of how many rooms/chunks/floors it stitches together.

| Event | Boundary? | Why |
|---|---|---|
| Run starts (new run from the hub/menu) | ✅ Start | First live frame of the run → `OpenRoom` |
| Player death / run lost (permadeath) | ✅ End | Run is over → `End(isAbort=false)` |
| Abandon run → back to hub/menu | ✅ End | → `End(isAbort=true)` |
| Walk through a portal / enter next room/chunk/floor | ❌ | Same run, generator assembles the next segment |
| Re-roll / shop / reward screen between segments | ❌ | Same run, modal step |

Walking between rooms is **not** a boundary — it is the within-run analogue of streaming a new cell. The
Gameplay Session spans the whole run. (Bind `OpenRoom`, gate sampling, and pause exactly as
[`open-world.md §3–§5`](./open-world.md) prescribe.)

### 2.1 The decisive question: how many rooms are live at once?

This single fact decides whether the existing single-container world-restore
([`07 §8`](../07-RESTORATION-PATTERNS.md)) is enough, or whether you've crossed into open-world territory.
Answer it from the CODE_MAP (does the builder keep **one** active room, or assemble/keep **many**?) and
record it in `OBJECT_TRACKING.md`.

- **Single active room/chunk** — one segment is live at a time; walking a portal **replaces** it, and
  previous rooms are gone and non-navigable (the classic "corridor of rooms"; the §6 worked model). The
  captured moment is **one container**. Capture the active room + sub-roll + cursor (§3); restore rebuilds
  that one room (`07 §8` + §5). The rooms you left don't exist anymore, so there's nothing to reconstruct
  — the player's accumulated run state (upgrades, deck) rides along as normal player-entity attributes
  (`06`/`07`). **`07 §8` is sufficient — *but only if the active room is placed at a deterministic
  transform*** (e.g. always instantiated at the origin). If the room's **world placement** is itself rolled
  — entrance/exit connectors aligned at random, a per-transition offset — then even one live room lands at
  a **different world transform** each run, and the absolute entity positions you captured restore into the
  void. Then you must also capture the room's **resolved placement** (§3, the Placement input) and replay
  it (§5), exactly as the multi-room case does. The tell is partial success: a capture in the run's
  *first* room (still at its origin) restores perfectly while any deeper room breaks.
- **Several rooms live or navigable** — a connected floor generated up-front, back-tracking through
  cleared rooms, adjacent rooms streamed in, or line-of-sight across rooms. Now "the world" is a **set of
  rooms in a layout**, not one container, and previously-visited rooms carry **mutation deltas** (chests
  opened, enemies dead, doors unlocked) the replay must show. This is **procedural ∩ open-world**;
  `07 §8`'s singleton-"world"-object restore is **not** sufficient. Additionally load
  [`open-world-tracking.md`](./open-world-tracking.md) and capture, beyond §3:
  - the **layout / connectivity + placement** — the full set of reachable room ids, how they connect, **and
    each room's resolved world transform** (§3, the Placement input; or a whole-layout seed, if §4 says
    seed-capture is safe), so restore reproduces the navigable graph **at the right world coordinates**,
    not just the current room;
  - **per-room mutation deltas** as a `ChunkDelta`/`RoomDelta` object type keyed by room id + content id
    (`open-world-tracking.md §3`), **scoped to the reachable/relevant set, not the whole run**
    (`open-world-tracking.md §5`);
  - identity that survives a room streaming out and back (`open-world-tracking.md §4`).

  **When unsure, assume multi-room and scope down** — under-capturing the layout silently breaks
  back-tracking in the replay (the player walks back through a portal into an empty/default room).

## 3. What to capture: the generation inputs, as stable ids

Add **one singleton `RunMetadata`** (a/k/a "world definition") object type capturing the inputs that
reproduce the assembled moment. This is the `07 §8` "world" object, specialized for procedural assembly,
and it's the source the restore flow reads in its **read-entry-identity** step (`07 §2`). Capture **stable
game ids / values** — never pointers, raw handles, pool indices, or level/scene indices (`06 §4.2`; a
Ludeo replays in a **different process/build** where in-memory references and even load order are
meaningless). Five input kinds, in three layers — **content** (selection + sub-roll), **progression**
(cursor + scaling), and **placement**:

| Input kind | What it is | Examples | Capture as |
|---|---|---|---|
| **Selection identity** | *which* content was assembled | room/chunk/biome id; the run **seed** (if seed-deterministic) | stable asset/blueprint id (`room_id`) or the seed (`uint64`/string) |
| **Sub-roll identity** | the nested rolls the loader **re-rolls** on load | encounter id, enemy-wave-set id, modifier/affix ids | stable asset id (`encounter_id`) |
| **Progress cursor** | *how far into* the assembled segment | wave index, room/floor depth, step count | `int` (`wave_index`, `depth`) |
| **Scaling counter** | run-scaling the reload resets | combat level, difficulty tier, ascension, heat | `int`/`float` (`combat_level`) |
| **Placement / spatial frame** | *where* the assembled content physically sits — the world transform the generator rolls **independently of** which content it picked (connector alignment + per-transition offset) | each room's resolved world position + rotation; the connector indices it rolled | `vec3` + `vec4` (quat) per room (`room_transform`), keyed by room index **and** the room's persistent id (to disambiguate a slot replaced mid-run) |

> **Why Placement is its own input — and the cheapest fix.** Selection / sub-roll / cursor reproduce
> *which* content and *how far in*; **none reproduces *where the content sits*.** When the generator
> computes each room's world transform from random connector picks + offsets (not a fixed origin), the room
> lands somewhere new every run — and **every absolute entity position downstream** restores into the void.
> This is a **second, independent layer of nondeterminism**: suppressing the *layout* re-roll (which rooms,
> in what order) does **not** suppress it. Capture the **resolved placement** and replay it at the
> placement seam (§5) and the whole downstream set becomes valid again **at the source** — zero changes to
> per-entity capture/restore. The alternative — storing every entity's position *relative to its room
> frame* — works only when each entity belongs to one unambiguous active-room frame (it breaks the moment a
> captured moment spans several simultaneously-live rooms) and forces per-entity frame attribution; prefer
> fixing placement at the source.

Verify chosen identifiers are **unique among the content a real run can reach** (asset/blueprint ids
usually are; list indices and pointers are not). Capture them with the same `LUDEO_CAPTURE_*` discipline as
the player (`06 §3`) — cheap, diff-sent. They are read back in Pass-2 by name and, crucially, in the
restore flow's read-entry-identity step *before* reaching active gameplay (`07 §2.2`).

> These kinds describe the **single active container** (§2.1). If several rooms are live/navigable,
> this `RunMetadata` is only the *active* room's inputs — add the **layout/connectivity + placement** and
> per-room `RoomDelta` object types from §2.1 as well, or back-tracking restores into empty rooms.

## 4. Decide: capture the seed, or the resolved selection?

This is the [seed-vs-stored-layout](https://www.gamedeveloper.com/design/2d-procedural-generation-in-unity-with-scriptableobjects)
trade-off, restated for Ludeo, and applied **per stream**. Pick per game and record it in `OBJECT_TRACKING.md`.

> **First, inventory the generation streams — don't assume there's only one.** A procedural load usually pulls from
> **several independent** RNG/seed sources, and reproducing one while ignoring another silently restores a
> *different* moment. Enumerate every random/seed/roll the load path consumes — **by reading the generator, not just
> grepping; an empty grep is not a closed list** — and classify each against the §3 input kinds: **content**
> (selection / sub-roll), **placement** (easy to miss — keyed off *where* a segment lands, not *which* one),
> **scaling** (run counters), or **cosmetic** (purely visual, safe to let roll live). Every non-cosmetic stream must
> be captured-and-replayed or provably reproduced; the set is done only when it is *closed*.

The two options, per stream:

- **Resolved-selection** *(default for Ludeo)* — capture the **outcome** ids (room id, encounter id, wave
  index, combat level), i.e. the result of the rolls. Restore re-drives the generator *to those exact ids*
  and suppresses the re-roll (§5). Robust because it does **not** depend on the replaying build reproducing
  the same RNG.
- **Seed + cursor** — capture the run seed + how far in, re-seed the generator at restore, and
  fast-forward. Smallest payload, but **only valid if** generation is *fully* seeded, deterministic, and
  **version-stable across the build that replays the Ludeo**. A Ludeo plays on a different process/machine
  and possibly a later build, so a seed that silently regenerates a *different* world is a corrupt replay.
  Use only when the run is provably seed-deterministic; otherwise prefer resolved-selection.

> **The deciding question:** "If a different build re-runs this seed, is the output *guaranteed*
> identical?" If you can't answer yes, capture the resolved selection.

## 5. Restore delta: re-drive the generator, suppress the re-roll

Restoration is [`07 §2`](../07-RESTORATION-PATTERNS.md) (the read-then-load LudeoSelected flow) +
[`07 §8`](../07-RESTORATION-PATTERNS.md) (world restore) **plus** the determinism discipline below. The
captured `RunMetadata` is the **entry identity** the flow already reads from the `DataReader` before
reaching active gameplay (`07 §2.2`, the `read_entry_identity` step). Three deltas over a level-based
restore:

1. **Re-drive the generator from captured inputs — do not let it roll.** "Reach active gameplay" for these
   games is not "load a level" — it is *drive the builder/pool with the captured selection id(s)* so it
   assembles *that* room/layout, and with the captured sub-roll id so the encounter/wave-set is *that* one,
   not a fresh random roll. The clean mechanism is the **same `IsRestoring()` gate** the flow already uses
   to suppress pre-match sequences (`07 §9.11`): while restoring, the generator's random selection returns
   the captured id instead of rolling. Loading the level alone is **not** restoration here — it yields the
   empty container (`07 §9.10`/§9.12 are the level-based cousins of this failure).

   > **Suppress the *placement* roll too, not just the content roll.** At the seam where the room's world
   > transform is computed (connector alignment + per-transition offset), feed back the captured
   > `room_transform` / connector indices (§3 Placement) under the same `IsRestoring()` gate instead of
   > rolling. Reproducing *which* room without reproducing *where it lands* leaves the room at a fresh
   > world transform, and the absolute entity positions you restore via the two-pass land in the void (§1).
   > Once placement is deterministic, the two-pass entity restore needs no change.
2. **Restore the scaling counter before any post-restore spawns.** Set combat level / depth / tier from
   `RunMetadata` *before* the world spawns anything, or waves after the restore point mis-scale (the §1
   scaling failure). **If the segment's load-time setup reads it** (common — the builder scales as it
   spawns), "before any spawn" means **before the level/room loads**, not in the apply: arm it at the
   commit (`07 §2.1` step 3, alongside `SetRestoring(true)`), from the already-cached `RunMetadata` read at
   validation, so it is in place when the load-time spawns run.
3. **Order: read inputs → assemble container → entities → environment.** The generation inputs are read
   first (read-then-load, `07 §2.2`) and drive `reach_active_gameplay`; entities then come back via the
   normal two-pass (`07 §3`); world/environment flags last (`07 §8.2`). The progress cursor (wave index)
   positions the encounter so remaining waves match.
4. **Position the cursor — don't let entering the encounter *re-spawn* the restored wave.** "Remaining waves match"
   means the spawner may **advance** to the next wave from the restored cursor. But a trigger that fires when
   combat / the encounter (re)starts often **repopulates the current wave wholesale**, stacking a fresh wave on the
   enemies you just restored. Restore the encounter's **already-started** state so that trigger sees a running encounter and
   doesn't repopulate (`07 §11.1`); if the game has no such state, gate the re-populate **trigger** — never the spawn
   primitive Pass 1 uses — and let genuine advancement through. Restore the live wave as a snapshot; let only genuine
   *advancement* run.

> **Where you inject depends on *when* the generator rolls.** If it rolls **lazily per room-entry**
> (next-room-at-portal), override each entry to the captured id. If it generates the **whole floor
> up-front** (one call assembles every room), inject the *entire* resolved set at that call (the
> layout/`RoomDelta` capture from §2.1), or re-seed *before* the call (only if §4 says seed-capture is
> safe). A per-entry override can't reconstruct a floor that was already fully built in one shot.

Everything else is standard `07`: freeze during restore (CR-010), apply before `Begin`, resume via
`RoomReady → Begin`.

## 6. Worked mapping — chunk-assembled roguelike (single active room, §2.1)

A run is a randomly-stitched sequence of room/chunk definitions selected by a level-selection pool into
one reused container level; **one room is live at a time** and a portal loads the next (the previous is
gone), each room re-rolls its encounter on load, and the reload resets the run's combat level. This is the
**single-active-room** regime — the captured moment is one container. (If instead several rooms stayed
navigable, you'd add the layout + `RoomDelta` captures from §2.1.)

| Capture (`phase 4`,`phase 5 · task 1`) | Source (game) | Restore (`phase 5 · task 2`,`phase 5 · task 3`) |
|---|---|---|
| `room_id` (selection identity) | active room/chunk definition's stable id | read in read-entry-identity; re-drive the selection pool to load *that* room under `IsRestoring()`, not a random pick |
| `encounter_id` (sub-roll) | resolved encounter definition's id | force the encounter selector to return *that* encounter under `IsRestoring()` |
| `wave_index` (progress cursor) | current wave in the encounter | position the encounter at that wave so remaining waves match |
| `combat_level` (scaling counter) | run combat-level field | set before any post-restore wave spawns (reload resets it to 0) |

`RunMetadata` is a singleton — one object in the reader, no per-instance stable id needed. Entities
currently alive in the room (enemies, projectiles, pickups) are captured/restored normally per `06`/`07`;
`RunMetadata` is what makes the *container* they live in reconstructable.

## 7. After This File

Capture the generation inputs as a `RunMetadata` object type in
[`phase 4`](../../4-map-game-objects.md)/[`phase 5 · task 1`](../../5b-implement-object-tracking.md) (data model:
[`06-TRACKING-PATTERNS.md`](../06-TRACKING-PATTERNS.md)); plan + implement the re-drive-the-generator
restore in [`phase 5 · task 2`](../../5c-plan-state-restoration.md)/[`phase 5 · task 3`](../../5d-implement-restoration-flow.md)/[`phase 5 · task 4`](../../5e-implement-state-reconstruction.md) on
top of [`07 §2`](../07-RESTORATION-PATTERNS.md) (read-then-load) and [`07 §8`](../07-RESTORATION-PATTERNS.md)
(world restore). You still need the **action catalog** and **tracking checklist** for whichever genre(s)
the run blends (combat → `shooter.md`/`rpg.md`), via [`INDEX.md`](./INDEX.md). If several rooms are live at
once, load the [`open-world*.md`](./open-world.md) pair too (§2.1).
