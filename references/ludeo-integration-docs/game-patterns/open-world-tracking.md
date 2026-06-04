# Open-World / Streaming-World Tracking

> **Applies to:** the same games as [`open-world.md`](./open-world.md) — streaming worlds with no
> discrete level/match scenes (open-world RPGs, sandbox/survival, MMOs). That file decides *when* a
> Gameplay Session begins/ends; **this file decides *what* a streaming world captures and how identity
> survives streaming.**
>
> **Load when:** you're mapping/implementing object tracking for a game where the world **streams in
> and out** (terrain, cells, chunks, regions) instead of loading discrete levels.
>
> **Prerequisites:** [`06-TRACKING-PATTERNS.md`](../06-TRACKING-PATTERNS.md) (the engine-wide data
> model — object lifecycle §3, the bidirectional ID map §4, the decision guide §9). This file is the
> open-world *delta* on top of `06`, not a replacement.

---

## 1. The core problem: the world is never fully loaded

In a level-based game, "the world" is the loaded level — everything trackable is present at once. A
streaming world is different: at any instant only the **neighborhood around the player** is resident;
the rest is on disk, in a save record, or not yet generated. So "track all world objects" is both
impossible (most aren't loaded) and wrong (you'd try to capture a 100-hour save).

The reframe that makes this tractable: **Ludeo captures a *moment*, replayed from the player's
perspective.** A replay reconstructs the **live neighborhood as it was at capture**, not the entire
world. That single fact bounds the tracked set to *what is streamed in and gameplay-relevant right
now* — exactly the set the §6 batch pass and the §2 spawn hooks of `06` already see. You do **not**
need to reach into unloaded cells.

## 2. The cardinal rule: presence ≠ existence

The most common open-world tracking bug is treating **stream-out as destruction**. They are not the
same, and conflating them corrupts the replay:

| Event | What it means | `06` action |
|---|---|---|
| Object **streamed out** / culled / LOD-dropped / cell unloaded | Still exists in the world; just not resident near the player | **Stop sampling it, but do not treat it as destroyed.** Never key off this as "dead" or fold its game ID out of the world model. |
| Object **destroyed in gameplay** (killed, consumed, mined, looted) | Gone from the world | `UnregisterFromLudeo` (`06 §3.4`), *or* keep it registered and capture a `is_destroyed`/`is_consumed` **state flag** (`06 §9.4`) |

> **The destruction hook fires for both.** When a cell/chunk unloads, the engine destroys (or
> pool-releases) the objects in it — that runs the same `OnDestroy`/destructor/`pool.release()` hook
> `06 §3.4`/§2.4 tells you to use for `UnregisterFromLudeo`. **That is the trap:** a streamed-out NPC
> isn't dead, but its destruction hook ran. **Distinguish the two at the hook** — gate
> `UnregisterFromLudeo` on a real "removed from world" signal (death/consume/destroy event, or a
> `WorldRemoved` vs `Unloaded` flag the streamer exposes), not on the raw destructor/release alone.
> Mishandling this drops objects from the replay that should still be there.

**Practical consequence:** in a streaming world, prefer to drive register/unregister from the game's
**world/persistence layer** (the system that knows "this NPC died" vs "this cell unloaded") — often a
manager/factory (`06 §2.2`) or the save-system walk (`06 §2.7`) — not from a raw destructor.

## 3. What to track in a streaming world

Apply `06 §9` (the decision guide) to the **currently-loaded, gameplay-relevant** set, plus these
open-world-specific object types that level-based games rarely need:

| Trackable | Why it matters in a streaming world | object-type shape |
|---|---|---|
| **Live entities near the player** | The neighborhood the replay reconstructs (NPCs, creatures, vehicles, dropped items) | per-entity, stable game ID in the map (`06 §4`) |
| **World/global state** | Time-of-day, weather, global event flags, faction/world simulation state — visible and affects the moment | one `world_state` object |
| **Per-cell / per-chunk mutations** | Opened chests, killed-and-not-respawned NPCs, placed/removed blocks, structures — the *deltas* from the base world | one object type per mutation kind, keyed by cell/chunk ID + content ID (§4) — **scope to deltas the moment needs, not the whole save (§5)** |
| **Player run/world metadata** | World seed (if gameplay-deterministic), current region/cell ID, game-time | part of the player or a `run_metadata` object |

Decorative streamed scenery (terrain meshes, foliage, props with no gameplay state) is **skip** — same
as `06 §9.4`. Track the *state* the world shows, not the streamed geometry.

## 4. Identity across stream cycles

This is `06 §4` (stable game IDs + the bidirectional `LudeoStateAdapter` map) with a sharper edge: in
a streaming world the **same logical object is destroyed and recreated repeatedly** as it streams out
and back in.

- Pointers and memory addresses are **doubly useless** here — they change every stream cycle, not just
  every run. Never use them as the stable ID (`06 §4.2`).
- Use the game's **persistent world ID** as the stable game ID: a cell/region ID + a content/instance
  ID the streamer already uses to re-place the object on reload. Most streaming engines have one (it's
  how the save system re-spawns the right NPC in the right spot) — find it via the save-system read
  (`06 §2.7`). Register it through the adapter so the same logical object reuses the **same** Ludeo
  object ID across stream cycles rather than churning new ones.
- **Relationships** (an NPC's home cell, a follower's owner) capture the target's persistent world ID,
  resolved through the map at restore (`06 §4.4`).

## 5. Scope to the moment, not the save

A streaming world's save file can be enormous. **Do not mirror the save into Ludeo.** The replay only
needs what reconstructs *this captured moment from the player's view*:

- **In-scope:** the loaded neighborhood + world/global state + the cell mutations the player can
  observe or that affect nearby gameplay.
- **Out-of-scope:** mutations in cells the player isn't in and can't affect during the captured moment;
  full quest logs, the entire map's discovery state, inventory of NPCs three regions away.

When unsure whether a far-away mutation matters, apply `06 §9.2`: is it visible during *this* moment,
or does it influence a tracked object *now*? If neither, it's out of scope for the capture even though
the save records it. Record the in/out cut in `OBJECT_TRACKING.md`.

## 6. Sampling and the stream

The capture cadence is unchanged from `06` — `LUDEO_CAPTURE_*` (or the central capture system, `06
§2.8`) fires while the game is in active gameplay, gated by `IsTrackingActive()` (`06 §8`) and
creator-flow-only via `IsRestoring()` (`06 §6.3`). Two open-world notes:

- **Only resident objects sample.** A streamed-out object has nothing live to read — it was either
  unregistered at world-removal, or you skip its capture while non-resident. Don't fabricate values for
  unloaded objects; their last captured value stands.
- **Batch registration at gameplay start (`06 §6`) registers only what's loaded then.** As the world
  streams more in, those newcomers register at *their* stream-in hook (treat stream-in like a spawn —
  `06 §2.2`/§2.6), still skipped when `IsRestoring()`. There is no "register the whole world" step.

## 7. Restoration interaction (forward pointer)

On the play flow, the world is rebuilt from the Ludeo, then streamed around the restored player. The
restore (`07`, phase 11) recreates the captured neighborhood and world/cell state, then resolves
relationships through the ID map; the game's **load-save plumbing** is the natural vehicle (a Ludeo is
"a save from elsewhere" — [`open-world.md §6`](./open-world.md)). Objects that stream in *after*
restore are normal spawns in the play flow → state capture stays creator-only (`06 §7`). Capture the
persistent world IDs in §4 precisely so restore can re-place objects into the right cells.

## 8. Worked mapping — Daggerfall Unity

| Trackable | Game source | object type / stable ID |
|---|---|---|
| Player | `PlayerEntity` (stats, position, current region/cell) | `player` singleton + region/cell ID as attributes |
| Loaded NPCs / enemies | `DaggerfallEntityBehaviour` instances in the resident cells | `npc`, stable ID = save-link ID (not pointer/instance handle) |
| Loot / dropped items | `DaggerfallLootContainer` (opened?, contents) | `loot`, stable ID = container persistent ID |
| World/global state | `DaggerfallUnity.Instance.WorldTime` (game-time), weather manager | `world_state` singleton (time, weather, season) |
| Cell mutations | discovered/looted/killed flags in the save record for resident cells | `cell_delta`, stable ID = cell ID + content ID |

The streamer (`StreamingWorld`) destroying cell objects on unload is the §2 trap: gate `npc`/`loot`
unregister on death/removal events, **not** on the destruction the streaming triggers. (Daggerfall is
Unity — for a real Unity integration use the Unity skill; this row set illustrates the streaming-world
*tracking shape* for a proprietary-engine open-world game.)

## 9. After this file

Back to [`06-TRACKING-PATTERNS.md §9`](../06-TRACKING-PATTERNS.md) (decision guide) to finalize the
per-type tracked set, and the genre file(s) the game blends for the action catalog + genre checklist
(via [`INDEX.md`](./INDEX.md)). This file only added the **streaming delta**: presence ≠ existence,
world/cell object types, persistent-world-ID identity in the map, and scope-to-the-moment.
