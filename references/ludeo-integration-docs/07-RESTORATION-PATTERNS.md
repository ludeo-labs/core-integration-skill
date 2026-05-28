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
[Interrupt Current Activity]
    │  - Tear down any active gameplay session and room (Session stays alive)
    │  - Cancel in-flight transitions
    │  - Suppress non-restoration input
    ▼
[Load Required Level / Scene]
    │  - Use the level identifier from the Ludeo metadata
    │  - Block until load completes
    ▼
[Two-Pass Restoration]
    │  - Pass 1: Create all objects
    │  - Pass 2: Apply properties + resolve references
    ▼
[Environment Restoration]
    │  - World flags, time-of-day, weather, etc.
    ▼
[Wait-For-Player — game PAUSED, simulation frozen]
    │  - Ludeo overlay shows the Play button (game does NOT draw one)
    ▼ Player presses Play → SDK runs OpenRoom→AddPlayer→RoomReady→Begin
[On RoomReady → TryBeginGameplaySession → unpause]
    │  (same gameplay-session-start chain `/4` wired — see 05-LIFECYCLE)
    ▼
[Resume Gameplay]
```

### 2.2 Handler Skeleton (pseudocode)

```pseudo
on_ludeo_selected(ludeoId):              # SDK notification thread — marshal to main thread FIRST
    if current_state == GAMEPLAY:
        end_current_gameplay_session()
    suppress_input()
    cancel_in_flight_transitions()

    load_level(level_from_ludeo_metadata)   # level/scene id from the Ludeo metadata
    await_level_loaded()

    # The DataReader is delivered ASYNCHRONOUSLY by GetLudeo's callback — there is no
    # synchronous open-reader call. Request it; continue in on_get_ludeo:
    ludeo_Session_GetLudeo(session, { apiVersion, ludeoId }, on_get_ludeo)

on_get_ludeo(callbackParams):            # GetLudeo completion callback — marshal to main thread
    if callbackParams.resultCode != Success:
        abort_restoration(); return
    reader = callbackParams.dataReader   # <-- the reader arrives here
    ludeo_DataReader_SetCurrent(reader)
    state_adapter.restore_two_pass(reader)
    state_adapter.restore_environment(reader)
    pause_simulation()                   # FREEZE the tick — CR-010; overlay shows Play

on_room_ready(callbackParams):           # SDK fires this when the player presses Play
    try_begin_gameplay_session()         # /4's helper (begins when player added + room ready)
    resume_simulation()                  # UNPAUSE — gameplay starts here
```

> **On `level_from_ludeo_metadata`:** the level/scene identifier is **integration-defined, not a dedicated SDK call to hunt for.** It's data *your own tracking captured* — read it back from the restored state (e.g. a world/session attribute `/9` wrote, or the ludeo info from `ludeo_DataReader_GetInfo` if you stored it there). If the plan didn't capture a way to identify the level, that's a gap to fix in `/8`/`/9`, not a missing SDK function.

### 2.3 What the Handler Must NOT Do

- Block the SDK's notification thread. Marshal to the main thread or a
  queued task immediately.
- Assume the game is in a "safe" state. Always handle the interrupt path.
- Restore directly into a live gameplay session. Tear down first.

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
    game_obj = spawn(ludeo_obj.type)   # type-only, no properties yet
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
- `ludeo_obj.attributes()` is **not** a real iterator in the normal path — attribute reads are **plan-driven, by known name**. For each property the plan lists for that object, enter it (`ludeo_DataReader_EnterObject(objectId)` / `LeaveObject`, via the RAII scope) and call the typed getter for that name: `ludeo_DataReader_GetFloat("health", &out)`, `GetUInt64`, `GetVec3Float`, etc. Each returns `false` if the attribute is absent — apply the plan's missing-attribute policy; don't write a default over real state. (`ludeo_DataReader_AttributeExists` / `ludeo_DataReader_VisitAttributes` exist if you genuinely must discover names at runtime, but a complete plan already lists them.)
- `GetString`/`GetBlob` are **sized first**: `ludeo_DataReader_GetSize(name, &size)` → allocate → `GetString`/`GetBlob`; they don't allocate for you. The fixed-width getters (`GetFloat`/`GetInt32`/…) need no sizing.

This is the same two-callback-then-enumerate path described in §2 — the SDK calls here are stable enough to reproduce; if one ever disagrees with the cloned headers, the headers win.

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

Some properties cannot be applied at the moment the entity is spawned:

- **Animation state** — requires the skeletal mesh to be initialized.
- **Physics** — requires the physics body to be registered.
- **Ability state** — requires gameplay subsystems to be online.
- **Networked replicated state** — requires the replication graph to be ready.

### 6.1 Detection

Properties needing deferral are usually marked in `RESTORATION_PLAN.md` (output
of `/10-plan-state-restoration`). Common heuristic: anything that fails or
no-ops when set in a constructor needs deferral.

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

> 🔴 **CR-010 — crystal clear, non-negotiable:** **the instant a Ludeo finishes loading, the game is PAUSED — simulation tick frozen, not just input — and it stays paused while the Ludeo overlay waits for the player to press Play.** It resumes when the player presses Play and the game receives **`RoomReady`** (→ `Begin`, the gameplay-session-start chain already documented in `05-LIFECYCLE-MANAGEMENT.md`). The game must never run, tick, or advance state during this wait — a running sim overwrites the restored state, which is exactly the "loads the right map but the state is wrong" failure. There is no `PlayerReady`; do not build your own prompt to bypass this; `ResumeGameRequest` is the **mid-play** overlay-closed resume, not this one.

After restoration completes, the game should **pause (freeze the simulation) and
wait for the player to press Play on the overlay**, which the SDK signals with
**`RoomReady`** (→ `Begin`, via the gameplay-session-start chain already documented
in `05-LIFECYCLE-MANAGEMENT.md`). This serves two purposes:

1. **UX:** The player just selected a Ludeo and doesn't expect gameplay to
   start mid-animation.
2. **Robustness:** Any restoration glitches surface visually before the
   player is fighting them.

### 7.1 State

```
[Restoration Complete]
    │
    ▼
[Paused — frozen, waiting for the player on the overlay]
    │  - Freeze the simulation tick (not just input)
    │  - The Ludeo OVERLAY shows the Play button (you do not draw one)
    ▼  Player presses Play → SDK runs OpenRoom→AddPlayer→RoomReady→Begin
[On RoomReady → TryBeginGameplaySession → unpause]   (chain owned by 05-LIFECYCLE)
    ▼
[Resume Gameplay]
```

### 7.2 Implementation Notes

- **Freeze the simulation, not just input.** Otherwise physics/AI drift — and
  overwrite the values you just restored — during the wait. Reuse the game's
  pause system if it has one; build a minimal tick-freeze if it doesn't
  (Group 3 games often lack pause).
- **Resume on `RoomReady` (then `Begin`), not a self-made prompt and not `ResumeGameRequest`.**
  When the player presses Play on the overlay, the SDK runs the gameplay-session-start chain
  `OpenRoom → AddPlayer → RoomReady → Begin` — already documented in
  `05-LIFECYCLE-MANAGEMENT.md` for tracking-start; **playback reuses the same chain**.
  In the `RoomReady` callback, call `TryBeginGameplaySession()` and **unpause**.
  **There is no `PlayerReady` notification in this SDK; do not wait on one.**
  `ResumeGameRequest` is the **mid-play** overlay-closed resume — not the post-restore one (§2.4).
- **Stay frozen until `RoomReady`.** Nothing in the game world may advance between
  "restoration complete" and the `RoomReady` callback that begins the playback session.
  That frozen window is what keeps the live simulation from overwriting the restored snapshot (§9).

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
    the simulation frozen** (§7) until `ResumeGameRequest`. If the sim runs, or
    the game's default init runs after your apply, the restored snapshot is
    silently overwritten — the "state isn't reconstructed properly" failure.

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
