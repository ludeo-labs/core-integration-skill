# 07-RESTORATION-PATTERNS.md — State Restoration

> **Purpose:** Patterns for restoring captured state when a Ludeo is selected for playback.
> **Audience:** AI agents implementing the LudeoStateAdapter, LudeoSelected handling, and the two-pass restoration algorithm.
> **Prerequisites:** `00-CRITICAL-REQUIREMENTS.md` (CR-006: Two-Pass Restoration), `06-TRACKING-PATTERNS.md`, `research-context/02F-RESEARCH-SAVE-SYSTEM.md`

**Last Updated:** May 2026

---

## Contents

1. [Overview](#1-overview)
2. [The LudeoSelected Flow](#2-the-ludeoselected-flow)
3. [Two-Pass Restoration (CR-006)](#3-two-pass-restoration-cr-006)
4. [Per-Group Restoration Strategies](#4-per-group-restoration-strategies)
5. [Per-Entity Approach: Reconciliation vs Manual](#5-per-entity-approach-reconciliation-vs-manual)
6. [Deferred Property Application](#6-deferred-property-application)
7. [Wait-For-Player Flow](#7-wait-for-player-flow)
8. [Environment Restoration](#8-environment-restoration)
9. [Common Mistakes](#9-common-mistakes)
10. [Validation Checklist](#10-validation-checklist)

---

## 1. Overview

Restoration is the inverse of tracking. The game received a `LudeoSelected`
event, the SDK has a `DataReader` open against the captured Ludeo, and the
game must:

1. Interrupt whatever it's doing.
2. Reach a clean restoration point (level loaded, systems ready, no
   conflicting state).
3. Spawn all tracked entities.
4. Apply all properties, including cross-entity references.
5. Hand control to the player.

The order of operations matters. Skipping or reordering steps causes the
issues catalogued in Section 9.

---

## 2. The LudeoSelected Flow

`LudeoSelected` is delivered by the Ludeo Platform — it is **not** chosen from a
gallery or menu inside the game. It can arrive in **any** game state: at game
start, while sitting at the main menu, while paused, during a loading screen, or
mid-gameplay. The handler must be defensive about all of these. If a Ludeo is
already being played when it arrives, the active gameplay session and room must
be torn down before restoring — the persistent SDK `Session` stays alive.

#### How the DataReader is delivered (don't go re-derive this from the headers)

`LudeoSelected` does **not** hand you a `DataReader`. It hands you a **ludeo id**, and obtaining the reader is a separate, **asynchronous** call whose **completion callback** delivers the reader. This is the single most-misread part of restoration — it is reproduced here verbatim from `Include/Ludeo/Session.h` + `SessionTypes.h` so you do not have to open them:

1. **`ludeo_Session_AddNotifyLudeoSelected(...)`** → your `LudeoSessionLudeoSelectedCallback` fires with `params->ludeoId`. (On the SDK notification thread — marshal off it immediately.)
2. **`ludeo_Session_GetLudeo(session, &params, clientData, callback)`** — set `params.apiVersion = LUDEO_SESSION_GETLUDEO_API_LATEST` and `params.ludeoId = <id from step 1>`. This call is **async** and does **not** return the reader or change session state.
3. Your **`LudeoSessionGetLudeoCallback`** fires with `const LudeoSessionGetLudeoCallbackParams* data`: check `data->resultCode == LudeoResult::Success`, then **`data->dataReader`** is the `LudeoHDataReader`. **The reader arrives here — there is no synchronous "open reader" function.**
4. From that callback (marshalled to the main thread): **`ludeo_DataReader_SetCurrent(data->dataReader)`** → run two-pass restoration.

So the entry path is two callbacks deep: `LudeoSelected(ludeoId)` → `GetLudeo(ludeoId)` *(async)* → `GetLudeo` completion callback delivers the reader → `SetCurrent` → restore. If a signature here ever disagrees with the cloned headers, the headers win — but you should not need to read them for this flow.

### 2.1 State Machine

```
[Any State — game start, main menu, paused, loading, mid-gameplay]
    │
    ▼ LudeoSelected fires
[Set IsRestoring(true)] — gates every pre-match skip (§9.11): cutscenes, countdowns,
    │   slow-mo intros, fly-in cameras, default-spawn teleports, respawn-on-load,
    │   scripted level-start events all hit the gate and silently no-op.
    ▼
[Interrupt Current Activity]
    │  - Tear down any active gameplay session and room (SDK Session stays alive)
    │  - Cancel in-flight transitions; suppress non-restoration input
    ▼
[Load Required Level / Scene]
    │  - Level id from Ludeo metadata; block until loaded
    │  - Pre-match sequences fire during load and silently skip (because of IsRestoring)
    ▼
[PAUSE the game] — freeze the simulation tick AFTER the skips have completed (CR-010)
    │   The pause locks in a clean post-skip baseline — the player will see this
    │   frozen frame while the overlay awaits Play. No cutscene paused on its
    │   first frame, no countdown frozen at "3", no default-spawn teleport visible.
    ▼
[GetLudeo — cache the DataReader]   (paused; apply runs later)
    │  - Overlay shows the Play button (game does NOT draw one)
    ▼ Player presses Play → SDK runs OpenRoom→AddPlayer→RoomReady
[On RoomReady]
    │  1. UNPAUSE — apply needs the game running so movement/physics/AI can settle
    │  2. Apply state from the cached DataReader: two-pass restoration + environment
    │  3. TryBeginGameplaySession() — Begin AFTER apply, so the SDK records from restored state
    ▼
[Resume Gameplay]
```

### 2.2 Handler Skeleton (pseudocode)

```pseudo
on_ludeo_selected(ludeoId):              # SDK notification thread — marshal to main thread FIRST
    set_restoring(true)                      # FIRST: enable pre-match skip gating (§9.11)
    if current_state == GAMEPLAY:
        end_current_gameplay_session()
    suppress_input()
    cancel_in_flight_transitions()

    load_level(level_from_ludeo_metadata)
    await_level_loaded()                     # pre-match sequences fire here and SILENTLY SKIP via IsRestoring

    pause_simulation()                       # PAUSE AFTER skips have completed — locks in a clean post-skip baseline (CR-010)

    # GetLudeo is async — its callback delivers the DataReader. CACHE it here;
    # the apply runs later in on_room_ready, after unpause.
    ludeo_Session_GetLudeo(session, { apiVersion, ludeoId }, on_get_ludeo)

on_get_ludeo(callbackParams):            # GetLudeo completion — marshal to main thread
    if callbackParams.resultCode != Success:
        abort_restoration(); return
    pending_reader = callbackParams.dataReader   # cache; do NOT apply yet

on_room_ready(callbackParams):           # SDK fires when player presses Play (gameplay-session-start chain)
    resume_simulation()                          # UNPAUSE FIRST — apply needs game running for movement/physics/AI
    if pending_reader:
        ludeo_DataReader_SetCurrent(pending_reader)
        state_adapter.restore_two_pass(pending_reader)       # match-or-spawn + apply (§3)
        state_adapter.restore_environment(pending_reader)    # §8
        pending_reader = null                                # one-shot
    try_begin_gameplay_session()                 # Begin AFTER apply — SDK records from restored state
```

> **On `level_from_ludeo_metadata`:** the level/scene identifier is **integration-defined, not a dedicated SDK call to hunt for.** It's data *your own tracking captured* — read it back from the restored state (e.g. a world/session attribute `/9` wrote, or the ludeo info from `ludeo_DataReader_GetInfo` if you stored it there). If the plan didn't capture a way to identify the level, that's a gap to fix in `/8`/`/9`, not a missing SDK function.

### 2.3 What the Handler Must NOT Do

- Block the SDK's notification thread. Marshal to the main thread or a queued task immediately.
- Assume the game is in a "safe" state. Always handle the interrupt path.
- Restore directly into a live gameplay session. Tear down first.
- **Run *state-writing* SDK calls during playback.** Restoration is **state-read-only**: no `CreateObject`, no `Set*`, no `BindPlayer`, no per-tick state capture. The `IsRestoring()` seam from `/9` gates batch registration; the same gate must guard every *state-write* path the game has, or restoration races against itself and pollutes the playback. Entity *discovery* for action detection still runs (otherwise actions go undetected during playback).
  - **EXCEPTION — action sends:** `SendAction` calls (and the `LUDEO_ACTION` macro) **fire in BOTH flows** and are *not* gated by `IsRestoring()`. Player Flow re-fires the same action sites so the SDK can score the Ludeo's win/fail conditions. See `06 §7` for the dual-flow contract.

### 2.4 Overlay & platform control notifications — the game does NOT drive pause/resume itself

This is the most-missed part of restoration, and skipping it produces a game that "loads the right Ludeo but never pauses and whose restored state gets trampled." The Ludeo **overlay** (the platform UI drawn over your game) controls the playback experience and drives the game through **Session-level notifications you must register and obey.** They are *not* part of the restoration call path, which is exactly why they get forgotten. Register all of them at **session creation** (next to `ludeo_Session_AddNotifyLudeoSelected` — see `05-LIFECYCLE-MANAGEMENT.md`), and service each on the main thread:

| Notification | Fires when | The game MUST |
|---|---|---|
| `ludeo_Session_AddNotifyPauseGameRequest` | Overlay reopens mid-playback / platform requests pause | **Pause gameplay — freeze the tick/simulation, not just input** |
| `ludeo_Session_AddNotifyResumeGameRequest` | Overlay closes mid-playback / platform requests resume | **Resume gameplay** (unfreeze). *Not* the post-restore resume — see below. |
| `ludeo_Session_AddNotifyBackToMenuRequest` | Player chose "back to menu" in the overlay | Tear down the current Ludeo, navigate to main menu / lobby |
| `ludeo_Session_AddNotifyMuteRequest` | Platform requests mute | Mute game audio |

Two consequences that decide whether restoration actually works:

- **The post-restore resume goes through the gameplay-session-start chain — not `ResumeGameRequest`.** After restoration the game sits paused; the **overlay shows the Play button**, and when the player presses it the game receives **`RoomReady`** (from the same `OpenRoom → AddPlayer → RoomReady → Begin` chain documented in `05-LIFECYCLE-MANAGEMENT.md` for tracking-start). On `RoomReady`, begin the gameplay session (`TryBeginGameplaySession` / `ludeo_GameplaySession_Begin`) and **unpause**. Do **not** invent a game-side "press to begin" prompt, do **not** wait on `PlayerReady` (it does not exist in this SDK — GameplaySession exposes only `Begin`/`End`), and do **not** wait on `ResumeGameRequest` (that's the mid-play overlay-closed resume, not the post-restore one).
- **"Pause" must freeze the simulation (CR-010).** This applies right after a Ludeo loads — the game sits **paused, simulation frozen, while the overlay waits for the player to press Play** — and any time `PauseGameRequest` arrives during playback (the player reopens the overlay). If your pause only blocks input, physics/AI/scripts keep mutating the world — and that is one of the ways a freshly restored snapshot gets overwritten (see §9). Pause = freeze the tick, not just input.

These notifications are **session-lifetime** (register once at session creation, not per-Ludeo), and they apply to the whole Ludeo experience, not just the moment of restoration.

### 2.5 Local trigger — `--ludeo=<id>` launch arg

To exercise this flow **without the platform overlay** (useful while integrating), the game can accept a launch arg (e.g. `--ludeo=<id>`, engine-specific format) and synthesize a `LudeoSelected` to the same handler once the session is active. The arg only changes the *source* of the id — the same handler still calls `ludeo_Session_GetLudeo`, whose async callback still delivers the `DataReader`. Implementation lives in `/11` Step 3.5.

---

## 3. Two-Pass Restoration (CR-006)

> **CR-006 is mandatory.** Single-pass restoration silently corrupts object
> graphs whenever entity B holds a reference to entity A and B is processed
> first.

### 3.1 The Algorithm

```pseudo
# Pass 1 — Create
id_map = {}                       # LudeoObjectId → GameObjectId

for ludeo_obj in reader.objects():
    game_obj = match_or_spawn(ludeo_obj)   # match the level's placed instance by stable ID first; only spawn fresh if absent (§8 / Pre-Existing-Object Reconciliation)
    id_map[ludeo_obj.id] = game_obj.id

# Pass 2 — Apply + Resolve
for ludeo_obj in reader.objects():
    game_obj = lookup(id_map[ludeo_obj.id])
    for attr in ludeo_obj.attributes():
        if attr.is_reference():
            target_game_id = id_map[attr.value]   # always resolvable now
            game_obj.set_reference(attr.name, target_game_id)
        else:
            game_obj.set_value(attr.name, attr.value)
```

**The concrete read loop the pseudocode stands in for (reproduced from `DataReader.h` + `DataReaderTypes.h` so you don't re-derive it from the headers):**

- `reader.objects()` = **`ludeo_DataReader_GetObjectsInfo(handle, &params, &objectsInfo)`** (`params.apiVersion = LUDEO_DATAREADER_GETOBJECTSINFO_API_LATEST`). It yields a `LudeoObjectsInfo*` with `LudeoObjectInfo* objects` and `uint32_t objectsCount`. Iterate `objects[0 .. objectsCount)`; each `LudeoObjectInfo` gives you `objectId` (the `LudeoObjectId` → your `id_map` key) and `objectType` (the `const char*` dispatch key for `spawn`, identical to the string `/9` passed to `CreateObject`). **Object order is unspecified** — never depend on it (precisely why two-pass exists). When done, **`ludeo_ObjectsInfo_Release(objectsInfo)`** — mandatory, or you leak.
- `ludeo_obj.attributes()` is **not** a real iterator in the normal path — attribute reads are **plan-driven, by known name**. For each property the plan lists for that object, enter it (`ludeo_DataReader_EnterObject(objectId)` / `LeaveObject`, via the RAII scope) and call the typed getter for that name: `ludeo_DataReader_GetFloat("health", &out)`, `GetUInt64`, `GetVec3Float`, etc. Each returns `false` if the attribute is absent — **check the bool, branch explicitly on it**; do not use `read-or-default` helpers where the default is itself a valid value. A missing read and a real read that returns the default look identical downstream, which silently turns a type-lock drop or a partial capture into "the apply fired with a plausible-but-wrong value" (real failure mode: "the missing identity attribute defaulted to 0 → 4 spawned entities all read as the player"). Either skip / fail-loud on absence, or compare against an impossible sentinel. (`ludeo_DataReader_AttributeExists` / `ludeo_DataReader_VisitAttributes` exist if you genuinely must discover names at runtime, but a complete plan already lists them.)
- **Assert type invariants on the apply side.** Cheap one-liners like "this object's `objectType` is `player` — assert the apply's target is the player entity, not an NPC" convert baffling gameplay glitches into a single explicit log line at the exact failure point. Add invariant checks at Pass 1 dispatch and Pass 2 apply.
- `GetString`/`GetBlob` are **sized first**: `ludeo_DataReader_GetSize(name, &size)` → allocate → `GetString`/`GetBlob`; they don't allocate for you. The fixed-width getters (`GetFloat`/`GetInt32`/…) need no sizing.

This is the same two-callback-then-enumerate path described in §2 — the SDK calls here are stable enough to reproduce; if one ever disagrees with the cloned headers, the headers win.

**Pass 2 is the inverse of `/9`'s capture, row for row.** Every `LUDEO_CAPTURE_*` `/9` emitted has exactly one mirror here: the matching `ludeo_DataReader_Get*` (same attribute name, same type) **whose returned value is written back into the same field `/9` captured from**, on the **live entity** (the one the player sees in the loaded level — not a detached spawn). `LUDEO_CAPTURE_FLOAT(player, "health", m_health)` mirrors to `ludeo_DataReader_GetFloat("health", &h)` + `m_health = h` (or `entity->SetHealth(h)`). Walk `OBJECT_TRACKING.md` row by row and reverse each capture into a get-then-apply. Any row left un-reversed stays at the level's default — that is the "Ludeo loaded but state didn't restore, the player sees mid-level positions as level-start" symptom.

### 3.2 Why Single-Pass Fails

If `Enemy.target` references `Player`:
- Single-pass processes `Enemy` first → `target` points to nothing.
- Single-pass processes `Player` first by luck → may work, but order is
  not guaranteed across captures or SDK versions.
- Result: nondeterministic, hard-to-reproduce reference corruption.

Two-pass eliminates ordering as a variable.

### 3.3 The ID Map

- **Lifetime:** Constructed in Pass 1, consumed in Pass 2, can be discarded
  after restoration completes.
- **Keys:** `LudeoObjectId` (the SDK's identifier from the capture).
- **Values:** Whatever native identifier the game uses for runtime lookup
  (raw pointer, handle, EntityId).
- **Failure mode:** If Pass 2 encounters a `LudeoObjectId` not in the map,
  this is a bug in Pass 1 (an object was skipped) — log loudly, do not
  silently substitute null.

### 3.4 When Pass 1 Itself Needs Splitting

Some entities must exist before others can be spawned (e.g., the player
must exist before per-player UI elements). If your spawn graph has such
constraints, split Pass 1 into:

- **Pass 1a:** Foundational entities (player, world systems).
- **Pass 1b:** Dependent entities (UI, attached props, child actors).

Apply Pass 2 over both groups.

---

## 4. Per-Group Restoration Strategies

Branch on the save-system group identified in `02F-RESEARCH-SAVE-SYSTEM.md`.

### Group 1 — Full Save System

- Write Ludeo state to the game's save format during capture.
- Restoration calls the game's existing `Load(slot)` path.
- Two-pass is **still required** for reference resolution unless the game's
  load path already does multi-pass internally.
- AI work: wire the SDK read into the existing load path, add reference
  resolution if missing.

### Group 2 — Checkpoint-Only Save System

- Extend the checkpoint manager to accept "synthetic" checkpoints created
  from Ludeo data.
- Restoration goes through the extended checkpoint load path.
- Two-pass required; the original checkpoint loader probably wasn't built
  for arbitrary mid-session state.
- AI work: design the extension API, ensure the checkpoint constraints
  (e.g., "must be on solid ground") are relaxed or satisfied.

### Group 3 — No Save System

- Build the entire restoration path from scratch.
- The two-pass algorithm is the spine.
- Per-entity registration of spawn functions and property setters is
  required.
- AI work: maximum. Design and emit the `LudeoStateAdapter` end-to-end.

---

## 5. Per-Entity Approach: Reconciliation vs Manual

For each entity type, the `02F-RESEARCH-SAVE-SYSTEM.md` per-entity matrix
already specified the approach.

### 5.1 Reconciliation

Reuse the game's existing save/load plumbing.

```pseudo
# Pass 1: spawn via the game's own factory
for ludeo_obj in reader.objects():
    game_obj = game_save_system.recreate_from_saved(ludeo_obj.snapshot)
    id_map[ludeo_obj.id] = game_obj.id

# Pass 2: only references the save system didn't resolve
for ref in unresolved_references(id_map, reader):
    apply_reference(ref, id_map)
```

### 5.2 Manual

Read each attribute from the SDK and apply directly.

```pseudo
# Pass 1: spawn empty
for ludeo_obj in reader.objects():
    game_obj = factory.spawn(ludeo_obj.type)
    id_map[ludeo_obj.id] = game_obj.id

# Pass 2: read and apply property by property
for ludeo_obj in reader.objects():
    game_obj = lookup(id_map[ludeo_obj.id])
    for (name, value) in reader.attributes_of(ludeo_obj.id):
        setter = setters_for(game_obj.type)[name]
        setter(game_obj, resolve_if_reference(value, id_map))
```

### 5.3 Mixing Approaches

A single game often needs both. Player and major enemies may be reconciliation;
dynamically-attached sub-components may be manual. Drive the choice from the
per-entity matrix, not by global policy.

---

## 6. Deferred Property Application

Some properties cannot be applied synchronously in the apply path because their setter reaches into subsystems that aren't initialized yet at that moment. Apply those on the **next tick**:

- **Animation state** — requires the skeletal mesh to be initialized.
- **Physics velocity / impulses** — requires the physics body to be registered.
- **Ability / attribute-system state** — requires the ability system to be online.
- **Networked replicated state** — requires the replication graph to be ready.
- **Health (or any "trivial" attribute whose setter fans out into handlers)** — the setter looks like a one-liner, but the handler chain (widget creation, mesh material updates, AI perception, damage events) crashes or no-ops on uninitialized targets. Defer.

### 6.1 Detection

Properties needing deferral are usually marked in `RESTORATION_PLAN.md` (output of `/10-plan-state-restoration`). General rule: **if a setter's handler reaches into another subsystem, defer it.** Heuristic: anything that fails, no-ops, or crashes when set in a constructor lands here.

### 6.2 Pattern

```pseudo
deferred_queue = []

# In Pass 2
if is_deferred(attr.name):
    deferred_queue.append((game_obj, attr.name, attr.value))
else:
    game_obj.set(attr.name, attr.value)

# After Pass 2, before handing control to player
for (obj, name, value) in deferred_queue:
    obj.set(name, value)
```

### 6.3 Ordering Within the Deferred Queue

If deferred properties have inter-dependencies (e.g., "current animation"
depends on "animation graph initialized"), the queue itself may need
ordering. Capture the order in `RESTORATION_PLAN.md`; don't infer it at
runtime.

---

## 7. Wait-For-Player Flow

> 🔴 **CR-010 — non-negotiable:** `LudeoSelected` fires → **`SetRestoring(true)` FIRST** (gates §9.11 pre-match skips) → tear down → load level (skips fire silently during load) → **PAUSE AFTER level load completes** (sim tick frozen, not just input). The pause locks in a clean post-skip baseline. On `RoomReady`: **unpause → apply state → `Begin`**, in that order — the apply needs the game ticking so movement/physics/AI can settle before `Begin` starts recording. There is no `PlayerReady`. `ResumeGameRequest` is the **mid-play** overlay-closed resume, not this one (§2.4).

The pause set after level load (§2.1 / §2.2) is what makes the wait safe. Two roles:

1. **Closes the race window** between level-load completion and apply — without the pause, the game ticks with default-init state until apply lands, and that window is where "Ludeo loaded but state is wrong" failures originate.
2. **UX** — the player picked a Ludeo from the overlay and doesn't expect gameplay to start mid-animation; the overlay's Play button is the explicit handoff. The paused frame they see is *post-skip* (clean), not a frozen mid-cutscene.

### 7.1 Implementation notes

- **Freeze the simulation tick, not just input.** Otherwise physics/AI/scripts drift during the wait and over the apply that follows. Reuse the game's pause system; build a minimal tick-freeze if none (common in Group 3).
- **Unpause BEFORE the apply (in the `RoomReady` callback), not after.** A teleport / setHealth / spawn issued against a paused world doesn't propagate — components need a tick to react. Order: `unpause → apply → TryBeginGameplaySession`. See §2.1 / §2.2.
- **The overlay shows Play — don't build your own prompt.** Resume is `RoomReady → Begin`; do not wait on `PlayerReady` (it doesn't exist in this SDK) or on `ResumeGameRequest` (mid-play only, §2.4).

---

## 8. Environment Restoration

Entities aren't the only state. The world itself usually has:

- Time of day / lighting state
- Weather
- World flags (doors opened, switches flipped, areas unlocked)
- Audio mix / music track
- Camera state (mode, target, lens settings)

### 8.1 Modeling

Treat the environment as a singleton "world" object in the capture. It
follows the same two-pass discipline but typically has no references to
resolve (Pass 2 is just property application).

### 8.2 Ordering Relative to Entity Restoration

Environment restoration usually runs **after** entity restoration:
- Lighting may depend on entity placements (e.g., dynamic light sources
  attached to entities).
- World flags may trigger entity-affecting logic (e.g., opening a door
  should not despawn an entity we just spawned inside it).

Capture the order in `RESTORATION_PLAN.md`.

### 8.3 Non-Restored State

Some state is deliberately not restored:
- UI history (menus, transient HUD)
- Local player preferences (volume, controls)
- Replication metadata

Document the exclusion list in `RESTORATION_PLAN.md` so the rationale isn't lost.

---

## 9. Common Mistakes

1. **Single-pass restoration.** See Section 3.2. The most common and most
   silent failure.
2. **Restoring into an active gameplay session.** Tear down first. Otherwise
   you have two copies of every entity.
3. **Blocking the SDK notification thread.** `LudeoSelected` arrives on
   whichever thread the SDK chose. Marshal immediately.
4. **Forgetting deferred properties.** Animation pose, ability state, and
   physics velocities applied in Pass 2 will silently no-op or revert.
5. **Resuming gameplay before the player is ready.** Skip the wait-for-player
   step and the player sees one frame of restored state before the game
   blasts past it.
6. **Letting Pass 2 reference unresolved IDs.** If `id_map[x]` is missing,
   fail loud. Substituting null hides the bug for weeks.
7. **Reusing the ID map across sessions.** It's per-Ludeo. Discard after
   restoration.
8. **Running environment restoration before entity restoration.** World
   flags can despawn entities you're about to spawn, or fire events for
   entities that aren't there yet.
9. **Ignoring the overlay / gameplay-session-start contract.** Two related failures:
   (a) Not pausing while the overlay awaits the player — if the game doesn't pause
   the moment a Ludeo loads, and doesn't register `PauseGameRequest`/`ResumeGameRequest`
   for the player reopening/closing the overlay mid-play, the simulation runs and
   overwrites restored state.
   (b) Wiring the post-restore resume to the wrong signal. **`PlayerReady` does not
   exist**, and **`ResumeGameRequest` is the mid-play resume**. The **post-restore
   resume goes through `RoomReady → Begin`** — the same gameplay-session-start chain
   documented in `05-LIFECYCLE-MANAGEMENT.md` for tracking-start. Pressing Play on the
   overlay drives that chain; the game unpauses in the `RoomReady` callback.
10. **Treating the loaded level as an empty/torn-down world.** Loading the level
    **repopulates it** with default-placed entities and default state, and the
    game's own init runs around your restore. Restoration must be the
    **authority**: reconcile captured objects to the level's placed instances
    (don't blind-spawn duplicates — §8/Pre-Existing-Object Reconciliation),
    apply restored values **after** the level finishes initializing, and **keep
    the simulation frozen** (§7) until the `OnRoomReadyCallback` unpauses. If the
    sim runs, or the game's default init runs after your apply, the restored
    snapshot is silently overwritten — the "state isn't reconstructed properly" failure.
11. **Pre-match sequences and location-overriding mechanisms clobber the snapshot.**
    Most games run a *start-of-match* flow after level load — intro cutscene,
    countdown, slow-mo, fly-in camera, default-spawn teleport, respawn-on-load
    logic, level-start scripted events. Any of these that touch position, state,
    or camera **after** the apply overwrites the restored snapshot. The signature
    failure: "first frame after Play is the level-start cinematic / default spawn,
    not the captured mid-level moment." For playback: **identify every such
    mechanism during planning (`/10` Step 3) and gate it on `IsRestoring()` (or
    equivalent) in `/11`** — skip the cutscene, suppress the default-spawn teleport,
    short-circuit the countdown. **Set `IsRestoring(true)` FIRST and pause LAST**
    (after level load completes), so the skips fire silently during load and the
    pause locks in a clean post-skip baseline — the player sees a clean frozen
    frame while the overlay awaits Play, not a frozen mid-intro. The Ludeo must
    start *exactly* at the captured state on the first visible frame.

---

## 10. Validation Checklist

Before considering restoration "done" on a game:

- [ ] LudeoSelected received at the main menu or while paused is handled and
      restores cleanly.
- [ ] LudeoSelected during active Ludeo playback tears down the gameplay session
      and room, then restores cleanly.
- [ ] LudeoSelected during a loading screen waits or queues correctly.
- [ ] Two-pass is exercised: a Ludeo with cross-entity references restores them.
- [ ] Deferred properties (animation pose, physics, abilities) appear correct
      after the wait-for-player resume, not just during Pass 2.
- [ ] Environment matches the original (lighting, world flags).
- [ ] Wait-for-player pauses simulation, not just input.
- [ ] LudeoSelected handler never blocks the SDK notification thread.
- [ ] Multiple LudeoSelected events in sequence behave deterministically.
- [ ] `PauseGameRequest` / `ResumeGameRequest` are registered and the game
      pauses (freezes the tick) when the overlay reopens **mid-playback** and resumes
      when it closes (§2.4).
- [ ] After a Ludeo loads, the game is paused (sim frozen) **until `RoomReady` fires**;
      the post-restore resume is driven by `RoomReady → Begin` (the chain `05-LIFECYCLE`
      wired for `/4`) — **not** a self-built prompt, **not** `PlayerReady` (which does
      not exist), **not** `ResumeGameRequest` (that's the mid-play resume).
- [ ] Restored values survive: spot-check that the live simulation and the
      level's default init do **not** overwrite restored state after resume (§9.10).
- [ ] `BackToMenuRequest` returns to the menu and tears down the current Ludeo.
- [ ] Local launch-arg trigger (`--ludeo=<id>` or engine-equivalent) runs the full restoration flow without the platform overlay (§2.5 / `/11` Step 3.5).

---

## 🔗 Cross-References

- `00-CRITICAL-REQUIREMENTS.md` → CR-006 (two-pass mandate)
- `06-TRACKING-PATTERNS.md` → what was captured determines what can be restored
- `research-context/02D-RESEARCH-ENVIRONMENT.md` → environment inventory
- `research-context/02F-RESEARCH-SAVE-SYSTEM.md` → group-based strategy selection
- `commands/10-plan-state-restoration.md` → produces `RESTORATION_PLAN.md`
- `commands/11-implement-state-restoration.md` → emits the `LudeoStateAdapter`
