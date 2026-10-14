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
mid-gameplay. The handler must be defensive about all of these, and its job is the
same regardless of starting state: **drive the game to *active gameplay*, then apply
the captured state there.**

> 🔴 **The restore target is *active gameplay*, never a menu.** "Active gameplay" is the
> point at which — **without Ludeo's intervention — the player would have been able to start
> playing**: menus, character-creation / new-game / load-save, loading, cutscenes, and intros
> are all behind you, and the player would have control. The play flow must reach that point
> and apply the Ludeo state there — **all of it before the viewer presses Play.** `RoomReady` is the
> viewer's Play click, not "the room is ready", so the restored moment must already be built, settled and
> frozen behind the overlay when the Play button appears; the first frame the viewer sees is the captured
> moment, and Play only resumes it (see §2.1). Every restore step (spawn, match-or-spawn, per-property
> setters, the game's own load path) writes into a **live player + world**; run them at the
> title menu and the game's load/restore path hits its "no active game" guard and **silently
> no-ops** — then `onComplete` fires and `Begin` runs anyway, so the overlay/recording starts
> at the menu and **nothing is reconstructed.** Do not assume the player/world is persistent
> and "just needs repositioning" — at the menu it does not exist yet.

> **The game is in player flow or creator flow from launch, decided by whether a Ludeo ID was provided** — it does **not** switch a player's own creator run into a replay mid-run. So restoration (the player-flow path) only ever starts from one of **two** states, and `LudeoSelected` handling must cover both:
>
> - **No Ludeo run active yet** — startup / main menu. **There is no live game: no player, no world, no in-gameplay state.** This is the *common production case*, not an edge case — the platform (and the forced-Ludeo launch path) routinely fires `LudeoSelected` at startup, before any game exists. The handler must **drive the game's normal new-game / enter-gameplay flow** so a player + world + in-gameplay state come into being. Scene-based game → level load + spawn; state-machine-entry game with no per-level scene (e.g. Daggerfall's `StartGameBehaviour`) → trigger that entry flow — there is no scene to "load," so reaching active gameplay *is* booting a run.
> - **A Ludeo is already playing** — another `LudeoSelected` arrives during an active playback (or while it's paused awaiting Play). **First validate the new selection** (`GetLudeo` is read-only — §2.1 step 2); only a valid one disturbs the running play. Then tear down the current Ludeo's gameplay session and room (`GameplaySession_End(isAbort=true)` → `RemovePlayer` → `Room_Close`; the persistent SDK `Session` stays alive) **and reset all prior-Ludeo state** — release the old `DataReader`, re-arm `IsRestoring`, and replace `m_pending_ludeo_id` with the new id — so the previous play can't leak into the new one (this is `EndCurrentLudeo()`; see `phase 5 · task 3`). Then reach active gameplay for the **new** Ludeo and restore it.
>
> See [`game-patterns/open-world.md`](./game-patterns/open-world.md) §6 for the streaming-world (no-per-level-scene) walkthrough of both.

#### How the DataReader is delivered (don't go re-derive this from the headers)

`LudeoSelected` does **not** hand you a `DataReader`. It hands you a **ludeo id**, and obtaining the reader is a separate, **asynchronous** call whose **completion callback** delivers the reader. This is the single most-misread part of restoration — it is reproduced here verbatim from `Include/Ludeo/Session.h` + `SessionTypes.h` so you do not have to open them:

1. **`ludeo_Session_AddNotifyLudeoSelected(...)`** → your `LudeoSessionLudeoSelectedCallback` fires with `params->ludeoId`. (On the SDK notification thread — marshal off it immediately.)
2. **`ludeo_Session_GetLudeo(session, &params, clientData, callback)`** — set `params.apiVersion = LUDEO_SESSION_GETLUDEO_API_LATEST` and `params.ludeoId = <id from step 1>`. This call is **async** and does **not** return the reader or change session state.
3. Your **`LudeoSessionGetLudeoCallback`** fires with `const LudeoSessionGetLudeoCallbackParams* data`: check `data->resultCode == LudeoResult::Success`, then **`data->dataReader`** is the `LudeoHDataReader`. **The reader arrives here — there is no synchronous "open reader" function.** But **`Success` means the call produced a valid reader *handle*, not that the Ludeo's data has landed in it** — the callback can fire **repeatedly** (the forced-launch path re-injects `LudeoSelected`), and early cycles hand back a **valid-but-empty** reader. See §2.2.1 — you must validate the reader is *populated* before applying.
4. From that callback (marshalled to the main thread), **once the reader is populated** (§2.2.1): **`ludeo_DataReader_SetCurrent(data->dataReader)`** → run two-pass restoration.

So the entry path is two callbacks deep: `LudeoSelected(ludeoId)` → `GetLudeo(ludeoId)` *(async)* → `GetLudeo` completion callback delivers the reader → `SetCurrent` → restore. If a signature here ever disagrees with the cloned headers, the headers win — but you should not need to read them for this flow.

### 2.1 State Machine

```
[Any State — game start, main menu, paused, loading, mid-gameplay]
    │
    ▼ 1. LudeoSelected fires — marshal off the SDK thread, stash the ludeoId,
    │    dispatch GetLudeo(ludeoId). TOUCH NOTHING ELSE YET: no teardown, no freeze.
    ▼
[2. VALIDATE — GetLudeo callback]   GetLudeo is read-only; it commits you to nothing
    │  - resultCode != Success           → ignore the selection; the running session stays exactly as it was
    │  - reader empty (early cycle)       → wait for a later cycle (§2.2.1); timeout → ignore the selection
    │  - populated → cache the reader, read the ENTRY IDENTITY (start_mode, room_x/y, …) and check this
    │    integration can play it (known level/slice, identity present). Not playable → ignore + log.
    │  A bad selection is a no-op: on a cloud VM nobody can recover a session you tore down for nothing.
    ▼
[3. COMMIT — only a validated selection gets here]
    │  - SetRestoring(true): arms every start-of-run skip (§9.11) BEFORE the load fires them
    │  - If a run is live: EndCurrentLudeo — End(isAbort=true) → RemovePlayer → Close; release the old
    │    reader, reset flags. Start the new play only once the room close has completed (async).
    │  - Restoration HOLD on: player input off, start-of-run mechanisms skipped. The sim runs as much
    │    as the game's own load path needs — a frozen engine often cannot load a level.
    ▼
[4. REACH ACTIVE GAMEPLAY on the captured level] — the game's own new-game / load path
    │   At the menu there is NO game — you BOOT one here (scene-based → load level + spawn;
    │   state-machine entry → trigger that flow). Wait until the game's native spawn is done.
    ▼
[5. APPLY, held]   FREEZE → SetCurrent → two-pass restore (§3) → environment (§8) → release reader
    │   Frozen so nothing (AI, default-spawn logic, physics) overwrites the snapshot while it lands.
    ▼
[6. SETTLE]   let time run ~0.5 s with input STILL off, then FREEZE again
    │   Teleports, character controllers, pooled spawns and deferred properties (§6) need real frames
    │   to land; a teleport issued into a frozen world can be swallowed. SetRestoring(false) after.
    ▼
[7. OPEN THE ROOM]   OpenRoom(ludeoId) → AddPlayer → OnPlayerAdded (player_added = true)
    │   OpenRoom MUST carry the selected ludeoId (Player Flow; nullptr records a NEW Ludeo — 05 §6.2).
    ▼  The finished, settled moment is on screen, frozen, behind the overlay's Play button.
    ▼  The game does NOT draw its own prompt.
[8. RoomReady = THE VIEWER PRESSED PLAY]   (room_ready = true)
    │  TryBeginGameplaySession() — Begin needs player_added AND room_ready AND applied
    │  Begin → UNFREEZE (clear the restoration hold). The SDK records from the restored state.
    ▼
[Resume Gameplay]
```

> **Why this order and not "load on Play".** `RoomReady` is withheld until the viewer presses Play — an
> `AddPlayer → RoomReady` gap of many seconds in a log is a person reading the overlay, not SDK latency. If
> the level load and the apply run on `RoomReady`, the viewer stares at a frozen menu (or a loading cover)
> behind the overlay and then watches the moment assemble after Play. Building it first means Play is an
> instant resume of exactly what the viewer chose. (The Unity and Unreal skills converged on this order from
> production integrations.)

### 2.2 Handler Skeleton (pseudocode)

```pseudo
on_ludeo_selected(ludeoId):              # SDK notification thread — marshal to main thread FIRST
    if selection_in_progress(ludeoId): return    # repeated fires for the same id (forced-launch re-injects) — dispatch once
    candidate_ludeo_id = ludeoId                 # NOT pending_ludeo_id yet — nothing is committed until it validates
    candidate_reader = null; candidate_deadline = now() + RESTORE_TIMEOUT
    ludeo_Session_GetLudeo(session, { apiVersion, ludeoId: candidate_ludeo_id }, on_get_ludeo)
    # NO teardown, NO freeze, NO OpenRoom here. GetLudeo is read-only: a bad selection must leave the
    # running session exactly as it was.

on_get_ludeo(callbackParams):            # may fire REPEATEDLY (forced-launch re-injects LudeoSelected) — marshal to main thread
    if callbackParams.resultCode != Success:
        ignore_selection("GetLudeo failed"); return       # hard fetch failure — the current session is untouched
    if not reader_is_populated(callbackParams.dataReader): # Success + objectsCount > 0 (§2.2.1)
        return                                            # empty early cycle — a populated reader arrives later
    if candidate_reader != null: return                   # never let a later cycle replace an accepted reader
    entry = read_entry_identity(callbackParams.dataReader) # level/map identity FROM the reader (start_mode, room_x, room_y)
    if not can_play(entry):                               # identity missing (version skew) or unknown level
        ignore_selection("cannot play this Ludeo: " + describe(entry)); return
    candidate_reader = callbackParams.dataReader
    commit_and_restore(entry)

commit_and_restore(entry):               # only a VALIDATED selection reaches here
    set_restoring(true)                          # arm start-of-run skips (§9.11) BEFORE the load fires them
    pending_ludeo_id = candidate_ludeo_id; pending_reader = candidate_reader
    room_ready = false; player_added = false; applied = false
    if a_ludeo_is_already_playing:
        end_current_ludeo(then = continue_restore)   # End(isAbort=true) → RemovePlayer → Close; async —
        return                                       # start the new play only once the close has completed
    continue_restore()

continue_restore():
    hold_restoration()                           # input off, start-of-run mechanisms skipped; sim runs as loading needs
    reach_active_gameplay(entry, then = apply_held)  # the game's own new-game / load path; boot a run at the menu.
    #   scene-based → load level + spawn; state-machine entry → trigger new-game/load (creates player+world)
    #   procedural → re-drive the generator to the captured inputs (procedural-world.md §5)

apply_held():                            # called once the game's native spawn is done
    freeze_simulation()                          # nothing may overwrite the snapshot while it lands (CR-010)
    ludeo_DataReader_SetCurrent(pending_reader)
    state_adapter.restore_two_pass(pending_reader)       # match-or-spawn + apply (§3)
    state_adapter.restore_environment(pending_reader)    # §8
    pending_reader = null                                # one-shot
    settle(0.5s, input_off = true, then = after_settle)  # time runs, input stays off: teleports/spawns/deferred props land

after_settle():
    freeze_simulation()                          # the finished moment holds still behind the overlay
    set_restoring(false)                         # restore window closes (NOT the whole replay — §2.3)
    applied = true
    ludeo_Session_OpenRoom(session, { ludeoId: pending_ludeo_id, ... }, on_room_opened)
    #   ↑ ludeoId set ⇒ Player Flow (scored replay); nullptr ⇒ Creator Flow (new recording) — 05 §6.2
    #   on_room_opened → AddPlayer → on_player_added: player_added = true; try_begin_gameplay_session()

reader_is_populated(reader):             # the readiness gate (§2.2.1)
    info = ludeo_DataReader_GetObjectsInfo(reader)
    populated = (info.resultCode == Success and info.objectsCount > 0)
    ludeo_ObjectsInfo_Release(info)                       # pair every GetObjectsInfo with a Release
    return populated

on_room_ready(callbackParams):           # = THE VIEWER PRESSED PLAY (RoomReady is withheld until then)
    room_ready = true
    try_begin_gameplay_session()

try_begin_gameplay_session():            # also called from on_player_added — the gates arrive in either order (05 §6.6)
    if not (player_added and room_ready and applied): return
    ludeo_GameplaySession_Begin(...)             # the SDK records from the restored state
    release_restoration_hold()                   # UNFREEZE — Play resumes exactly the moment the viewer chose

update():                                # per-frame fallback — don't depend on the forced-launch re-fire
    if candidate_ludeo_id and candidate_reader == null and now() > candidate_deadline:
        ignore_selection("Ludeo never populated")   # still pre-commit: nothing was torn down, nothing to undo
```

> **On `read_entry_identity` — read-then-load, all before Play:** which level/scene to load (or which save / new-game flow to drive) is **read from the `DataReader`** — it is **not** known at `LudeoSelected`, and it is **not** a dedicated SDK call to hunt for. It's data *your own tracking captured* — e.g. a world/session attribute `phase 5 · task 1` wrote (`start_mode`, `room_x`, `room_y`) or the ludeo info from `ludeo_DataReader_GetInfo` if you stored it there. So the reader comes first and the load second — and reading the identity is also what **validates** the selection before anything is torn down. The whole sequence still completes **before** the viewer presses Play. If the game has **no rooms/levels to choose between**, there is nothing to read for routing — load the single generic level here, after the reader is in hand. If the plan didn't capture a way to identify the entry point, that's a gap to fix in `phase 4`/`phase 5 · task 1`, not a missing SDK function.
>
> **Procedural / non-deterministic-assembly games** (roguelike / procedural dungeon / wave-survival — `game-patterns/procedural-world.md`): the entry identity is the captured **generation inputs** (room/chunk id, encounter id, wave index, combat level), and "reach active gameplay" means **re-drive the level builder/pool to those inputs with the random re-roll suppressed** (gate the generator's selection on `IsRestoring()`), restoring the scaling counter before any spawn — *not* just loading a level, which here yields an empty container that re-rolls its content. See `procedural-world.md §5`.
>
> **Fail loud on the entry identity, and distinguish two failures.** The reader can be **populated** (§2.2.1 passed — `objectsCount > 0`) yet the **entry-identity attribute** specifically reads back **empty/absent**. That is almost always **version skew**: the Ludeo was captured by a build *before* the identity attribute existed (`phase 5 · task 1` added it later), so there is nothing to route on. This is **different** from reading a valid id that then **resolves to no level** ("room 'X' not found") — a genuine routing/content bug. Branch them with distinct messages so a stale-Ludeo re-capture isn't chased as a code bug:
> - entry identity **absent/empty** → log "entry identity missing — Ludeo predates the identity capture; **RE-CAPTURE** on the current build", then **ignore the selection** — it is still pre-commit, so nothing has been torn down (do **not** `Begin` a scored replay on a guessed level).
> - entry identity **present but unresolvable** → log "level/room '<id>' not found — routing/content bug, not version skew".
>
> **Corollary (engine-agnostic):** you can only restore what capture wrote, so **adding or renaming any captured attribute invalidates every previously captured Ludeo** for that attribute — there is no migration. After any capture-schema change, **re-capture** before testing restore.

### 2.2.1 Reader readiness — the reader can arrive empty; validate before applying

`GetLudeo`'s callback returning `resultCode == Success` means **the call produced a valid reader handle — not that the Ludeo's data has landed in it.** The captured Ludeo is fetched **asynchronously**; under the **forced-launch path** (`autoStartInLudeo` / the LC-8977 workaround that injects `LudeoSelected` at cold start), `LudeoSelected → GetLudeo` fires **repeatedly**, and the **early cycles return `Success` with an empty reader** — the payload hasn't arrived yet. A populated reader shows up a cycle or two later.

So **`resultCode == Success` and `reader != null` are NOT enough to apply.** Gate the apply on the reader being **populated**, which is a real query:

```pseudo
reader_is_populated(reader):
    info = ludeo_DataReader_GetObjectsInfo(reader)        # check ITS result, not just GetLudeo's
    populated = (info.resultCode == Success and info.objectsCount > 0)
    ludeo_ObjectsInfo_Release(info)                       # pair every GetObjectsInfo with a Release
    return populated
```

What the handler must do as a result:
- **Validate before accepting the reader.** Only cache + apply a reader that `reader_is_populated`. **Ignore empty cycles** — don't apply on them, and **never let a later empty cycle clobber an already-cached populated reader.**
- **Retry until ready, bounded — not one-shot.** The populated reader may arrive on a *later* cycle, so re-check on each `GetLudeo` callback **and** drive a per-frame poll from `Update` (the forced-launch re-fire is a workaround, not a contract — don't depend on it re-firing). Cap with a **timeout** (e.g. 15 s).
- **Three stop conditions — all of them before the commit (§2.1 step 2).** (1) **populated** reader whose entry identity this integration can play → commit and restore. (2) `GetLudeo` `resultCode != Success` → **hard fetch failure: ignore the selection, do not retry.** (3) **timeout still empty** → treat as an invalid/empty Ludeo and **ignore the selection — do NOT `Begin` a scored replay on nothing.** Because validation happens before anything is torn down, an ignored selection leaves the running session (or the menu) exactly as it was; surface the failure in the log (in forced-launch production, the normal menu simply stays up).
- **Dispatch once.** Repeated `LudeoSelected` for the same id must not restart validation, re-open the room or re-add the player — guard the handler and `OpenRoom` so they run once per selected Ludeo.

> ⚠️ **`objectsCount == 0` fails silently.** The two-pass loop iterates the reader's objects (§3) — an empty reader makes it a clean **zero-spawn no-op**, so the apply "succeeds," `Begin` runs, and the player is left at the game's **default new-game spawn** with none of the captured state. This has the *same* "0 objects restored" symptom as "restored into a menu" (§2.3, mistake #12) but a *different* root cause — distinguish them via `11-TROUBLESHOOTING`. The `resultCode == Success` check alone will not catch it.

### 2.3 What the Handler Must NOT Do

- Block the SDK's notification thread. Marshal to the main thread or a queued task immediately.
- Assume the game is in a "safe" state. Always handle the interrupt path.
- **Apply the snapshot before *active gameplay* is reached.** At the main menu / startup there is no player or world — applying there silently no-ops against the game's "no active game" guard, and the overlay/recording starts at the menu with nothing reconstructed (§2 intro). Within the apply, the order is fixed: read the entry identity → **reach active gameplay (load the level / boot the run)** → *then* apply the snapshot. Booting a run if none is live comes *first*, the two-pass restore *second* — never the reverse.
- Restore directly into a live gameplay session. Tear down first.
- **Run *state-writing* SDK calls during playback.** The **entire Player-Flow replay** is state-read-only: no `CreateObject`, no `Set*`, no `BindPlayer`, no per-tick state capture — for the *whole* session, not just the restore window. **Gate state writes on a session-scoped "is this a Player-Flow replay?" flag** — set when this gameplay session's `OpenRoom` carried a `ludeoId` (`05 §6.2`, §6.11), cleared at session end. `IsRestoring()` is **only the narrower restore-window sub-gate** (`LudeoSelected` → end of apply): it goes false the moment the snapshot lands, so gating capture on `IsRestoring()` *alone* lets per-tick capture **resume mid-replay** and silently turns the scored replay into a new recording — the most common form of "state reconstructs fine but the rerun fails" (`06 §7`). Entity *discovery* for action detection still runs (otherwise actions go undetected during playback).
  - **EXCEPTION — action sends:** `SendAction` calls (and the `LUDEO_ACTION` macro) **fire in BOTH flows** and are *not* gated by `IsRestoring()`. Player Flow re-fires the same action sites so the SDK can score the Ludeo's win/fail conditions. See `06 §7` for the dual-flow contract.

### 2.4 Overlay & platform control notifications — the game does NOT drive pause/resume itself

This is the most-missed part of restoration, and skipping it produces a game that "loads the right Ludeo but never pauses and whose restored state gets trampled." The Ludeo **overlay** (the platform UI drawn over your game) controls the playback experience and drives the game through **Session-level notifications you must register and obey.** They are *not* part of the restoration call path, which is exactly why they get forgotten. Register all of them at **session creation** (next to `ludeo_Session_AddNotifyLudeoSelected` — see `05-LIFECYCLE-MANAGEMENT.md`), and service each on the main thread:

| Notification | Fires when | The game MUST |
|---|---|---|
| `ludeo_Session_AddNotifyPauseGameRequest` | Overlay reopens mid-playback / platform requests pause | **Pause gameplay — freeze the tick/simulation, not just input** |
| `ludeo_Session_AddNotifyResumeGameRequest` | Overlay closes mid-playback / platform requests resume | **Resume gameplay** (unfreeze). *Not* the post-restore resume — see below. |
| `ludeo_Session_AddNotifyBackToMenuRequest` | Player chose "back to menu" in the overlay | Tear down the current Ludeo, navigate to main menu / lobby |
| `ludeo_Session_AddNotifyMuteRequest` | Platform requests mute | Mute game audio |

Three consequences that decide whether restoration actually works:

- **The post-restore resume goes through the gameplay-session-start chain — not `ResumeGameRequest`.** After restoration the game sits **frozen on the finished, settled moment** with the **room open and the player added** (§2.1 steps 5–7). The **overlay shows the Play button**, and pressing it makes the platform release **`RoomReady`** — the *only* part of the `OpenRoom → AddPlayer → RoomReady → Begin` chain (documented in `05-LIFECYCLE-MANAGEMENT.md` §6.11) that is Play-gated. On `RoomReady`, **`TryBeginGameplaySession()` → `Begin` → unfreeze** — the apply already ran; nothing is loaded or written after Play. `Begin` fires only when `player_added`, `room_ready` and `applied` are all true (`05 §6.6`). Do **not** invent a game-side "press to begin" prompt, do **not** wait on `PlayerReady` (it does not exist in this SDK — GameplaySession exposes only `Begin`/`End`), and do **not** wait on `ResumeGameRequest` (that's the mid-play overlay-closed resume, not the post-restore one).
- **"Pause" must freeze the simulation (CR-010).** This applies while the restored moment waits behind the overlay for Play — the game sits **frozen on the finished moment** — and any time `PauseGameRequest` arrives during playback (the player reopens the overlay). If your pause only blocks input, physics/AI/scripts keep mutating the world — and that is one of the ways a freshly restored snapshot gets overwritten (see §9). Pause = freeze the tick, not just input.
- **Ending a playback session is split by *who* ends it (`05 §6.11`).** When the **backend** ends the Ludeo — timer hits 0, objective met/failed, or any backend-decided reason — it sends **`PauseGameRequest`** and the game just **pauses (freezes the sim) and waits**. The game does **not** detect end-of-moment, does **not** call `End`, and does **not** submit — the backend owns submission, and `PauseGameRequest` is the universal end-of-moment cue (there is no game-facing "moment ended" callback). The game calls `ludeo_GameplaySession_End` itself **only on a game-initiated interrupt** — another `LudeoSelected` mid-play, `BackToMenuRequest`, or the player quitting — and then with **`isAbort = true`**, followed by `RemovePlayer → CloseRoom`.
  - **Because the backend-ends path sets `m_freeze_overlay` (via `PauseGameRequest`) and may never send a matching `ResumeGameRequest`,** that bit can be left dirty when the *next* `LudeoSelected` arrives — and a stale `m_freeze_overlay` keeps the next restored Ludeo frozen even after `RoomReady` clears the restore bit, presenting as **dead input**. Reset the pause bits in `EndCurrentLudeo()` *and* at the commit of the next validated selection (§2.1 step 3). See [CR-011](00-CRITICAL-REQUIREMENTS.md) "bits must start clean" and [11-TROUBLESHOOTING.md](11-TROUBLESHOOTING.md) §8.

These notifications are **session-lifetime** (register once at session creation, not per-Ludeo), and they apply to the whole Ludeo experience, not just the moment of restoration.

> ⚠️ **`PauseGameRequest` / `ResumeGameRequest` only fire in a cloud Player-Flow session** — never in a local build, never in Creator Flow. A local smoke test cannot exercise them (call the handlers directly from a debug hook instead), and a local replay is still Player Flow without them — so gate the game's own pause key on the **overlay-open bit**, not on "is this Player Flow", or a local replay leaves the player unable to pause (CR-011).

### 2.5 Local trigger — `--ludeo=<id>` launch arg

To exercise this flow **without the platform overlay** (useful while integrating), the game can accept a launch arg (e.g. `--ludeo=<id>`, engine-specific format) and synthesize a `LudeoSelected` to the same handler once the session is active. The arg only changes the *source* of the id — the same handler still calls `ludeo_Session_GetLudeo`, whose async callback still delivers the `DataReader`. Implementation lives in `phase 5 · task 3` Step 3.

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

- `reader.objects()` = **`ludeo_DataReader_GetObjectsInfo(handle, &params, &objectsInfo)`** (`params.apiVersion = LUDEO_DATAREADER_GETOBJECTSINFO_API_LATEST`). It yields a `LudeoObjectsInfo*` with `LudeoObjectInfo* objects` and `uint32_t objectsCount`. Iterate `objects[0 .. objectsCount)`; each `LudeoObjectInfo` gives you `objectId` (the `LudeoObjectId` → your `id_map` key) and `objectType` (the `const char*` dispatch key for `spawn`, identical to the string `phase 5 · task 1` passed to `CreateObject`). **Object order is unspecified** — never depend on it (precisely why two-pass exists). When done, **`ludeo_ObjectsInfo_Release(objectsInfo)`** — mandatory, or you leak.
- `ludeo_obj.attributes()` is **not** a real iterator in the normal path — attribute reads are **plan-driven, by known name**. For each property the plan lists for that object, enter it (`ludeo_DataReader_EnterObject(objectId)` / `LeaveObject`, via the RAII scope) and call the typed getter for that name: `ludeo_DataReader_GetFloat("health", &out)`, `GetUInt64`, `GetVec3Float`, etc. Each returns `false` if the attribute is absent — **check the bool, branch explicitly on it**; do not use `read-or-default` helpers where the default is itself a valid value. A missing read and a real read that returns the default look identical downstream, which silently turns a type-lock drop or a partial capture into "the apply fired with a plausible-but-wrong value" (real failure mode: "the missing identity attribute defaulted to 0 → 4 spawned entities all read as the player"). Either skip / fail-loud on absence, or compare against an impossible sentinel. (`ludeo_DataReader_AttributeExists` / `ludeo_DataReader_VisitAttributes` exist if you genuinely must discover names at runtime, but a complete plan already lists them.)
- **Assert type invariants on the apply side.** Cheap one-liners like "this object's `objectType` is `player` — assert the apply's target is the player entity, not an NPC" convert baffling gameplay glitches into a single explicit log line at the exact failure point. Add invariant checks at Pass 1 dispatch and Pass 2 apply.
- `GetString`/`GetBlob` are **sized first**: `ludeo_DataReader_GetSize(name, &size)` → allocate → `GetString`/`GetBlob`; they don't allocate for you. The fixed-width getters (`GetFloat`/`GetInt32`/…) need no sizing.

This is the same two-callback-then-enumerate path described in §2 — the SDK calls here are stable enough to reproduce; if one ever disagrees with the cloned headers, the headers win.

**Pass 2 is the inverse of `phase 5 · task 1`'s capture, row for row.** Every `LUDEO_CAPTURE_*` `phase 5 · task 1` emitted has exactly one mirror here: the matching `ludeo_DataReader_Get*` (same attribute name, same type) **whose returned value is written back into the same field `phase 5 · task 1` captured from**, on the **live entity** (the one the player sees in the loaded level — not a detached spawn). `LUDEO_CAPTURE_FLOAT(player, "health", m_health)` mirrors to `ludeo_DataReader_GetFloat("health", &h)` + `m_health = h` (or `entity->SetHealth(h)`). Walk `OBJECT_TRACKING.md` row by row and reverse each capture into a get-then-apply. Any row left un-reversed stays at the level's default — that is the "Ludeo loaded but state didn't restore, the player sees mid-level positions as level-start" symptom.

> **The restore driver applies the snapshot — never defer the apply to the spawned entity's own init.** Pass 2 above writes every value **from the restore loop's own call stack**. Do **not** instead stash the captured data on the freshly-spawned entity and rely on the entity's **own engine-invoked initialization or first-tick callback** (constructor body, the engine's spawn/begin-play hook, the first `Update`/tick) to pull it back and apply it. Two failure modes: (1) **those callbacks are not guaranteed to run — or to run before `Begin` and before the freeze lifts — for an entity created during the level boot/transition** (the restore path loads the level *inside* the apply, §2.1); a skipped callback leaves the entity at its spawn defaults with the snapshot silently dropped, and the symptom is worst on a **second back-to-back replay** in one session (the level reload lands inside the same window). (2) Self-application fires in **unspecified order**, so it cannot honor two-pass reference resolution (§3.2). Keep entity *creation/activation* in whatever callback the engine guarantees at spawn; keep the **state apply in the driver's Pass-2 sweep**; and make the apply **idempotent** so a late init callback that re-applies is harmless.

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

Properties needing deferral are usually marked in `RESTORATION_PLAN.md` (output of `5c-plan-state-restoration.md`). General rule: **if a setter's handler reaches into another subsystem, defer it.** Heuristic: anything that fails, no-ops, or crashes when set in a constructor lands here.

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

> 🔴 **CR-010 — non-negotiable:** `LudeoSelected` → **validate with `GetLudeo`** (read-only; a bad selection is ignored) → **commit:** `SetRestoring(true)`, tear down if a run is live, restoration hold on → **reach active gameplay** on the captured level → **freeze → apply → settle (~0.5 s, input off) → freeze** → **`OpenRoom(ludeoId)` → `AddPlayer`** → wait. On `RoomReady` — the viewer pressing Play — **`Begin` → unfreeze**. Nothing is loaded or written after Play. There is no `PlayerReady`. `ResumeGameRequest` is the **mid-play** overlay-closed resume, not this one (§2.4).

The hold and the freezes (§2.1 / §2.2) are what make the wait safe. Two roles:

1. **Protect the snapshot** — the apply runs frozen so default-init, AI, physics and start-of-run logic can't overwrite values as they land; the settle gives teleports and spawns the real frames they need with input still off; the second freeze then holds the finished moment exactly as built until `Begin`. Without them, the "Ludeo loaded but state is wrong" failures originate in that drift.
2. **UX** — the viewer picked a Ludeo and sees **that moment**, frozen, behind the overlay; the Play button is the explicit handoff, and pressing it resumes the moment instantly — no load, no assembly on screen.

### 7.1 Implementation notes

- **Freeze the simulation tick, not just input.** Otherwise physics/AI/scripts drift during the wait and over the apply that follows. Reuse the game's pause system; build a minimal tick-freeze if none (common in Group 3).
- **Apply frozen, then settle, then freeze again — all before `OpenRoom`.** Some writes (a teleport, a character controller, a pooled spawn, a deferred property — §6) need real frames to take; the settle gives them ~0.5 s of time with input still suppressed. If a write still doesn't take, it belongs in the deferred queue (§6), not in an unpause before the apply. See §2.1 / §2.2.
- **Unfreeze only after `Begin`, on `RoomReady`.** Unfreezing earlier gives the sim live frames before recording starts; unfreezing later leaves the viewer pressing Play on a still image.
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
    failure: "the moment behind the overlay is the level-start cinematic / default spawn,
    not the captured mid-level moment." For playback: **identify every such
    mechanism during planning (`phase 5 · task 2` Step 3) and gate it on `IsRestoring()` (or
    equivalent) in `phase 5 · task 3`** — skip the cutscene, suppress the default-spawn teleport,
    short-circuit the countdown. **Set `IsRestoring(true)` at the commit (§2.1 step 3), before
    the level load**; the start-of-match skips fire during that load while `IsRestoring` is set —
    so they silently no-op. `IsRestoring` is cleared only after the apply and the settle. The
    Ludeo must show *exactly* the captured state on the first visible frame — the frozen moment
    behind the overlay, before Play — and Play must resume it without anything firing in between.
    This is the **state-clobbering** category: mechanisms that overwrite restored values, so the Ludeo
    loads at the *wrong* state. A second, distinct category is **flow-blocking** UI: gates that stall
    progression to the playable frame **without** touching state — "press start"/"press any key"/"click
    to continue" gates, modal popups (daily-reward, news, "what's new"), EULA/login/age-gate prompts,
    tutorial overlays, confirmation dialogs, between-segment reward/shop screens. These don't corrupt the
    snapshot — they stand *in front of* it, so the Ludeo loads at the *right* state but never becomes
    **interactive** (the player faces a popup instead of the captured moment). Gate **both** categories on
    `IsRestoring()` (or equivalent) so that on the playback flow the game runs straight from `LudeoSelected`
    to the first interactive frame of the captured state. When enumerating mechanisms during planning, do
    not filter the scan to state-touching ones and miss a blocking modal — the playback flow must suppress
    *everything* between launch and that first interactive frame.
12. **Restoring into a menu instead of reaching active gameplay first.** When
    `LudeoSelected` fires at the title menu / app startup (the common production
    case), there is **no player or world** to restore into. If the play flow runs
    the apply there, the game's load/restore path hits its "no active game" guard,
    **silently no-ops**, and `Begin` runs anyway — overlay/recording start at the
    menu, nothing reconstructed. The play flow must first drive the game to **active
    gameplay** — the point the player would have control absent Ludeo — *booting a
    run* (new-game/load creating player+world) when none is live, **not** assuming a
    persistent player it can "just reposition." This is most acute for state-machine-
    entry games with no per-level scene (DFU): "load the level" doesn't create the
    player/world — only the new-game/`StartGameBehaviour` flow does (§2 intro,
    `game-patterns/open-world.md` §6). **Same "0 objects" symptom as #13 but a different
    cause** — if the run *did* reach active gameplay and the reader was empty, it's #13, not this.
13. **Applying on an empty / not-yet-populated reader (the player stays at the default spawn).**
    `GetLudeo`'s callback can fire **repeatedly** (forced-launch re-injects `LudeoSelected`), and
    early cycles return `resultCode == Success` with an **empty reader** — `Success` means a valid
    *handle*, not that the data has landed. A one-shot apply gated only on `Success`/`reader != null`
    runs on that first empty cycle: the two-pass loop spawns **0 objects** (silent no-op), `Begin`
    fires, and the player is left at the game's default new-game spawn while the real data arrives a
    cycle later, unapplied. **Gate the apply on the reader being *populated*** — `GetObjectsInfo`
    `resultCode == Success && objectsCount > 0` — and make it **retry-until-ready with a timeout**,
    not one-shot; keep the populated reader (don't let a later empty cycle clobber it); on timeout
    still-empty, abort (don't `Begin`). See §2.2.1 and `11-TROUBLESHOOTING §7`.
14. **Deferring the property apply to the spawned entity's own init callback.** Stashing the captured
    data on the entity and letting it pull-and-apply from its **constructor / engine spawn hook / first
    tick** — instead of applying from the **Pass-2 driver loop** — drops the snapshot whenever the engine
    doesn't run that callback (or runs it after `Begin`, or after the freeze lifts) for an entity created
    during the level boot, leaving it frozen at its spawn defaults; it also breaks two-pass ordering
    (self-application runs in unspecified order). The signature is a snapshot that restores on the **first**
    replay but not the **second back-to-back** one. Apply from the driver; keep entity creation/activation
    in the guaranteed-at-spawn callback only; make the apply **idempotent**. See §3.1.

---

## 10. Validation Checklist

Before considering restoration "done" on a game:

- [ ] LudeoSelected received at the main menu or while paused is handled and
      restores cleanly.
- [ ] LudeoSelected at the main menu / startup **drives the game to active gameplay
      first** (boots a run — player + world + in-gameplay state live) before applying;
      the apply is **not** run against the menu (where it would silently no-op).
- [ ] LudeoSelected during active Ludeo playback tears down the gameplay session
      and room, then restores cleanly.
- [ ] LudeoSelected during a loading screen waits or queues correctly.
- [ ] Two-pass is exercised: a Ludeo with cross-entity references restores them.
- [ ] The property apply runs **from the two-pass driver loop**, not deferred to a spawned entity's own
      init / first-tick callback (§3.1, §9.14); the apply is idempotent. Verified by a **second back-to-back
      replay** in one session, not just the first.
- [ ] Entry identity is captured (`phase 4`/`phase 5 · task 1`) and read back to route the load; an **absent/empty** entry
      identity aborts with a distinct "re-capture (version skew)" message vs an unresolvable id's "not found"
      (§2.2). Re-captured after any capture-schema change.
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
      wired for `phase 3 · task 4`) — **not** a self-built prompt, **not** `PlayerReady` (which does
      not exist), **not** `ResumeGameRequest` (that's the mid-play resume).
- [ ] Restored values survive: spot-check that the live simulation and the
      level's default init do **not** overwrite restored state after resume (§9.10).
- [ ] `BackToMenuRequest` returns to the menu and tears down the current Ludeo.
- [ ] Local launch-arg trigger (`--ludeo=<id>` or engine-equivalent) runs the full restoration flow without the platform overlay (§2.5 / `phase 5 · task 3` Step 3).

---

## 🔗 Cross-References

- `00-CRITICAL-REQUIREMENTS.md` → CR-006 (two-pass mandate)
- `06-TRACKING-PATTERNS.md` → what was captured determines what can be restored
- `research-context/02D-RESEARCH-ENVIRONMENT.md` → environment inventory
- `research-context/02F-RESEARCH-SAVE-SYSTEM.md` → group-based strategy selection
- `commands/5c-plan-state-restoration.md` → produces `RESTORATION_PLAN.md`
- `commands/5d-implement-restoration-flow.md` → wires the `LudeoSelected` flow, freeze, apply gate, and wait-for-player (calls the read-back as a stub)
- `commands/5e-implement-state-reconstruction.md` → fills the `LudeoStateAdapter` two-pass read-back
