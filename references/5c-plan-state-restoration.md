# Phase 5 · Task 2 — Plan State Restoration

> **Stage:** State Restoration — Planning (analysis only, no code yet)
> **Prerequisite:** `4-map-game-objects.md` approved (entity model is fixed)
> **Inputs:** `OBJECT_TRACKING.md`, `GAME_ANALYSIS_SAVE_SYSTEM.md` (+ `GAME_ANALYSIS_ENVIRONMENT.md`, produced in Step 9 if absent)
> **Output:** `ludeo-integration-plan/RESTORATION_PLAN.md` — two-pass algorithm, deferred-property list, wait-for-player flow, environment restoration
> **Gate:** Human approval required before `5d-implement-restoration-flow.md` (and the `phase 5 · task 4` reconstruction that follows it)

Restoration is the inverse of tracking. This command does **not** invent a new
state model — it reads the already-approved `OBJECT_TRACKING.md` and, row by row,
specifies how each captured thing is rebuilt when a Ludeo is selected. No code is
written here; the output is a reviewed plan that `phase 5 · task 3` (player-flow/lifecycle) and `phase 5 · task 4` (two-pass data reconstruction) both consume.

## Fresh Context Check

This is a sequential workflow — continuing to phase 5 · task 2 in the **same session as earlier phases is normal**; do **not** stop just because prior phases ran here. Only stop if **phase 5 · task 2** was already completed in this conversation and you're about to redo/regenerate its output — then confirm with the user first. If context has grown very large you may *suggest* a fresh session, but it is not required.

## Engine Scope

Proprietary C++ engines only. If the game uses Unity or Unreal, stop — use the engine-specific guide instead.

## Prerequisites

**From the intake** (`ludeo-integration-plan/integration.json` → `intake`; [`know-your-game.md`](know-your-game.md)) — every `playbackUXBar.startOfRunToSuppress` entry is on the Step 3 start-of-run suppression
list; every `dynamicPhaseMetadata` value with `mustRestore` and every load-bearing trail in `scriptedSystems` has a
restore path in the plan (for a trail: the game's own "advance to this point" entry, called during the apply with its
side effects gated — `07 §11`); `visiblePlayerState.loadoutDependency` constrains what the player can be restored
with; `playbackUXBar.instantAnimations` are applied in their end pose, not played; `runnability.levelLoadCommand` is
how the restore reaches a captured level from a cold start.

> ⚠️ **REQUIRED:** These must complete first:
> 1. `4-map-game-objects.md` → `ludeo-integration-plan/OBJECT_TRACKING.md`, **approved**
> 2. `phase 3 · task 6` (Classify Save System) → `GAME_ANALYSIS_SAVE_SYSTEM.md` + `CODE_MAP.save_system.group`
>
> **Produced by this phase if absent:** the **environment inventory** (`GAME_ANALYSIS_ENVIRONMENT.md`). No earlier phase produces it, so Step 9 builds it from `02D-RESEARCH-ENVIRONMENT.md` before planning environment restoration — you do **not** need it in hand to start.
>
> **Recommended:** `5b-implement-object-tracking.md` done, so the tracking code (and its
> `objectType` strings + stable-ID fields) exists to mirror against. If `phase 5 · task 1` hasn't run,
> plan against `OBJECT_TRACKING.md` and flag any field the implementation may still rename.

This command reads those artifacts and does **NOT** re-analyze the entity model — that's fixed by `phase 4`. The one exception is the **environment inventory** (Step 9): if `GAME_ANALYSIS_ENVIRONMENT.md` doesn't exist yet, this phase produces it from `02D-RESEARCH-ENVIRONMENT.md`, since no earlier phase does.

> 🛑 **Planning scope — do not go exploring.** This phase produces a *plan*, not code. You do **not** need exact SDK signatures, struct fields, or the `GetLudeo` callback shape, and you must **not** read the SDK headers here. Reference the restoration API only at the level of *which call maps to which step*; the entry mechanism (`LudeoSelected → GetLudeo → DataReader`, async, reader delivered in a callback) is described in `07-RESTORATION-PATTERNS.md §2` and is implemented by `phase 5 · task 3`. If you find yourself opening `Session.h`/`DataReader.h` to answer a question, stop — either the answer is in `07 §2`, or it's a `phase 5 · task 3` concern; note it as an Open Question instead.

## Context Files

**Action Required:** Read the following files. Do not assume they are in context.

- `ludeo-integration-docs/07-RESTORATION-PATTERNS.md` — the core input. §2 (LudeoSelected flow), §3 (two-pass / CR-006), §4 (per-group strategy), §5 (reconciliation vs manual), §6 (deferred properties), §7 (wait-for-player), §8 (environment).
- `ludeo-integration-docs/00-CRITICAL-REQUIREMENTS.md` — CR-006 (two-pass restoration is mandatory).
- `ludeo-integration-docs/06-TRACKING-PATTERNS.md` — §4 (identity & references). **What was captured determines what can be restored** — read it as the other half of each mirror row.
- `ludeo-integration-docs/12-SDK-API-REFERENCE.md` — the restoration API surface *at a glance* (what exists), so the plan's spawn/setter rows map onto real calls: the typed `ludeo_DataReader_Get*` getters mirror the `Set*` writers (and return `false` when an attribute is absent — the plan must say what happens then); objects are enumerated with `GetObjectsInfo`; the entry point is `LudeoSelected` → `GetLudeo` *(async)* → `DataReader`. **For planning you do not need exact signatures, the GetLudeo callback shape, or any header detail** — the entry mechanism is fully described in `07-RESTORATION-PATTERNS.md §2`, and `phase 5 · task 3` implements it. **Do not read SDK headers in this phase.**
- `ludeo-integration-docs/research-context/02D-RESEARCH-ENVIRONMENT.md` — environment inventory template; produces `ludeo-integration-plan/GAME_ANALYSIS_ENVIRONMENT.md`.
- `ludeo-integration-docs/research-context/02F-RESEARCH-SAVE-SYSTEM.md` — per-entity reconciliation-vs-manual matrix; produces `ludeo-integration-plan/GAME_ANALYSIS_SAVE_SYSTEM.md`.

> **Artifact naming convention:** each `research-context/02X-RESEARCH-<TOPIC>.md` template produces a matching `ludeo-integration-plan/GAME_ANALYSIS_<TOPIC>.md`. `GAME_ANALYSIS_SAVE_SYSTEM.md` is produced by **`phase 3 · task 6`**; `GAME_ANALYSIS_ENVIRONMENT.md` is produced by **Step 9 of this phase** if it doesn't already exist (no earlier phase emits it).

## The Mirror Principle

Every restoration decision is the inverse of a tracking decision already recorded in
`OBJECT_TRACKING.md`. Do not introduce entities, properties, or IDs that tracking
didn't capture — you cannot restore what wasn't written. Drive the entire plan from
this table:

| `OBJECT_TRACKING.md` (capture side) | `RESTORATION_PLAN.md` (rebuild side) |
|---|---|
| Creation hook (file:line) | Spawn function invoked in **Pass 1** (type-only) |
| `objectType` string | Spawn dispatch key — **must match exactly** |
| Stable ID source field | `id_map` key reconstruction + how the runtime object is located/created |
| Destruction hook | n/a — restoration doesn't destroy; but the freshly **loaded level is not empty** — it repopulates with default content, so reconcile against placed instances (don't blind-spawn duplicates) and apply after level init |
| Property · `one-shot` | Apply at spawn or early in **Pass 2** |
| Property · `per-tick` / `per-change` / `event-driven` | Apply the **final captured value** once in **Pass 2** — restoration reconstructs a *snapshot*, it does **not** replay the time series |
| Property · `reference` (captured target's stable ID) | **Pass 2** `id_map` lookup → `set_reference` |
| Batch registration site (pre-existing objects) | Pre-existing-object reconciliation: at restore, decide *match existing* vs *spawn* to avoid duplicates |
| Entity marked `reconciliation` | Restore through the game's existing load/recreate path |
| Entity marked `manual` | Restore via explicit per-property setters |

If a tracking row has no sensible restoration inverse (or vice versa), that is a gap —
record it as an Open Question rather than papering over it.

## Your Task

### Step 1: Read Prior Artifacts

From `ludeo-integration-plan/`:
- `OBJECT_TRACKING.md` → the **spine**: entities, `objectType` strings, stable-ID fields, property kinds + strategies, Cross-Entity References table, Batch Registration Sites, reconciliation/manual per entity.
- `CODE_MAP.json` → `save_system.group` (1 / 2 / 3), session boundaries, level-load hook.
- `GAME_ANALYSIS_SAVE_SYSTEM.md` → per-entity reconciliation-vs-manual matrix (must agree with `OBJECT_TRACKING.md`; if they disagree, stop and reconcile with the user).
- `GAME_ANALYSIS_ENVIRONMENT.md` → world-level state inventory for Step 9.

### Step 2: Select the Per-Group Restoration Strategy

Branch on `save_system.group` using `07-RESTORATION-PATTERNS.md §4`:
- **Group 1 (full save system)** — restore through the existing `Load(slot)` path; wire the SDK read in; two-pass still required for references unless the loader is already multi-pass.
- **Group 2 (checkpoint-only)** — extend the checkpoint manager to accept a synthetic checkpoint built from Ludeo data; identify which checkpoint constraints must be relaxed.
- **Group 3 (no save system)** — build the restoration path end-to-end; the two-pass algorithm is the spine; every entity needs an explicit spawn function + setters.

Record the chosen strategy and exactly what existing game machinery (if any) restoration reuses.

### Step 3: Design the LudeoSelected Interrupt Flow

Per `§2.1`, specify the handling of a `LudeoSelected` event that can fire in **any** state
(menu, mid-gameplay, loading, cutscene). The whole sequence completes **before** the viewer presses Play:
1. **Handler:** marshal off the SDK notification thread immediately (never block it), stash the id as a **candidate**,
   dispatch `ludeo_Session_GetLudeo(id)` — and **nothing else**. No teardown, no freeze, no `OpenRoom`: a selection
   that turns out bad must leave the running session (or the menu) exactly as it was.
2. **Validate in the `GetLudeo` callback** (it **may fire repeatedly** under the forced-launch path; `07 §2.2.1`):
   `resultCode != Success` → ignore the selection. Reader not populated (`GetObjectsInfo` `Success && objectsCount > 0`)
   → ignore the cycle; a deadline ignores the selection if it never populates. Populated → **read the entry identity**
   and decide whether this integration can play it (identity present; a supported level/slice) — if not, ignore.
3. **Commit** a validated selection — holding its id and reader by value. **If a Ludeo is playing or an earlier
   restore is still in progress**, run `EndCurrentLudeo()` **first**: `End(isAbort=true)` if `Begin` ran →
   `RemovePlayer` → `Close`, reset prior-Ludeo state, and continue only once the close completes. **Then**
   `SetRestoring(true)` (arms the §9.11 start-of-run skips before the load fires them), bump a restore generation that
   stale continuations check, and set `m_pending_ludeo_id` / the pending reader — the id feeds `OpenRoom`, and passing
   it there is what makes the rerun a *scored Player-Flow replay* rather than a new recording (`05 §6.2`, §6.11;
   `nullptr` is the silent "state restored but the rerun isn't scored" failure). Turn the **input hold** on (input off
   until `Begin`). Plan the skip of the Creator-Flow "`OpenRoom` when the level starts loading" hook while
   `IsRestoring()`.
4. **Reach active gameplay on the captured level** — load that level / boot the run (generic level if the game has no
   rooms). **At the menu / startup there is no game — you *boot* a run here** (scene-based → level load + spawn;
   state-machine entry → trigger new-game/load so player+world+state exist); restoring into a menu silently no-ops
   (`07 §2`). Start-of-run sequences fire during this load and silently skip via the gate. Name the game's
   **native-spawn-done** signal — the apply waits for it.
5. **Apply held:** freeze → `SetCurrent` → two-pass → environment → release the reader.
6. **Settle** ~0.5 s with time running and input still off (teleports, controllers, pooled spawns and deferred
   properties take), then **freeze again**; `SetRestoring(false)`.
7. **`OpenRoom(ludeoId)`** → `AddPlayer` → `OnPlayerAdded` sets `player_added`. The finished moment is on screen,
   frozen, behind the overlay.
8. **`RoomReady` = the viewer pressed Play** → `TryBeginGameplaySession()` → `Begin` (needs `player_added`,
   `room_ready` and `applied`, in either order — `05 §6.6`) → **unfreeze**. Nothing loads or is written after Play.

Also plan five distinct sets of hooks:
- **Reader readiness + retry** (07 §2.2.1) — the forced-launch path fires `LudeoSelected → GetLudeo` **repeatedly**, and early cycles return `Success` with an **empty** reader. Plan: validate populated (`GetObjectsInfo` `Success && objectsCount > 0`) before committing; retry-until-ready (re-check each `GetLudeo` callback + an `Update` poll) with a **timeout → ignore the selection** (it is still pre-commit, so nothing is torn down; never `Begin` an empty Ludeo); keep the accepted reader; guard the handler and `OpenRoom` to run once per Ludeo. Confirm with the integrator/SDK owner how the forced-launch path behaves for this game (how many cycles, typical delay) so the timeout is sane.
- **Post-restore resume** — reuse `phase 3 · task 4`'s `OnRoomReadyCallback` / `TryBeginGameplaySession()` (`05-LIFECYCLE-MANAGEMENT.md`). The apply already ran before the room opened; this callback only issues `Begin` and unfreezes.
- **Mid-play overlay open/close** (07 §2.4) — `PauseGameRequest` → freeze the sim, `ResumeGameRequest` → resume, `BackToMenuRequest` → tear down + go to menu. Session-lifetime; easy to forget because they sit outside the restore path. Map each onto a game hook. **Do not plan around `PlayerReady` — it does not exist in this SDK.**
- **Playback-end handling** (`05 §6.11`) — plan both end paths. **Backend ends the Ludeo** (timer hits 0, objective met/failed, or any backend-decided reason): the backend sends **`PauseGameRequest`** → the game **pauses (freezes) and waits**; it does **NOT** detect end-of-moment, call `End`, or submit (the backend owns submission, and `PauseGameRequest` is the universal end-of-moment cue — there is no game-facing "moment ended" callback). **Game-initiated interrupt** (another `LudeoSelected` mid-play, `BackToMenuRequest`, quit): the **game** calls `ludeo_GameplaySession_End(isAbort=true)` then `RemovePlayer → CloseRoom`. Name the hook for the interrupt path; the backend-ends path needs no `End` call, only the `PauseGameRequest` freeze.
- **Start-of-run suppression — two categories** (07 §9.11) — identify every mechanism the game runs between launch and the first interactive frame, in **both** categories (don't filter the scan to state-touching ones and miss a blocking modal): (1) **state-clobbering** — would overwrite restored values: intro cutscenes, countdowns, slow-mo intros, fly-in cameras, default-spawn teleports, respawn-on-load logic, scripted level-start events; miss one → Ludeo loads at the **wrong** state. (2) **flow-blocking** — stall reaching the playable frame *without* touching state: "press start"/"press any key"/"click to continue" gates, modal popups (daily-reward, news, "what's new"), EULA/login/age-gate prompts, tutorial overlays, confirmation dialogs, between-segment reward/shop screens; miss one → Ludeo loads at the **right** state but never becomes **interactive**. List each with its hook (file:function) and the plan to gate it on `IsRestoring()` so it's skipped during playback. The Ludeo must start *exactly* at the captured state, **interactive**, on the first visible frame — anything between launch and that frame is a candidate to suppress.
- **Procedural-assembly re-drive + re-roll suppression** (only if `CODE_MAP.session_boundaries.assembly == "procedural"`; `game-patterns/procedural-world.md §5`) — for these games the **entry identity** read in step 2 is the captured `RunMetadata` generation inputs, and "reach active gameplay" is **re-driving the level builder/pool to those inputs**, not just loading a level: gate the generator's random selection (`RandomChunk`/encounter/wave roll) on `IsRestoring()` so it returns the *captured* ids instead of rolling, and restore the run-scaling counter (combat level) **before** any post-restore spawn. Loading the level alone yields an empty container (the procedural cousin of §9.10/§9.12). Note *when* the generator rolls — lazily per room-entry (override each) vs. whole-floor up-front (inject the full resolved set / re-seed before the call). **Single vs multi-room (§2.1):** one room live at a time → `07 §8` + these deltas suffice; several rooms navigable → **procedural ∩ open-world**, also restore the layout/connectivity + per-room `RoomDelta` state (`open-world-tracking.md §3`), scoped to the reachable set.

Map each step onto a concrete game hook (file:function) where known; flag any that don't yet exist as an Open Question for `phase 5 · task 3`.

### Step 4: Specify the Two-Pass Algorithm (CR-006)

Document the two passes concretely for this game (`§3`):
- **Pass 1 — Create:** iterate reader objects, spawn type-only via the spawn function, populate `id_map[LudeoObjectId] → native id`.
- **Pass 2 — Apply + Resolve:** iterate again, apply non-reference attributes via setters, resolve reference attributes through `id_map`.

Define the `id_map`: key = `LudeoObjectId`, value = the native identifier the game uses for runtime lookup (pointer / handle / EntityId — match what `phase 4` chose as the stable-ID anchor). State that it is **per-Ludeo** and discarded after restoration.

If the spawn graph has ordering constraints (e.g. player must exist before per-player UI), split Pass 1 into **1a (foundational)** and **1b (dependent)** per `§3.4`, and record which entities go in each.

### Step 5: Build the Per-Entity Spawn + Setter Inventory

This is the heart of the plan and the direct mirror of `OBJECT_TRACKING.md`'s entity
blocks. For **each** tracked entity, fill one restoration block:
- **Spawn function** — the inverse of the creation hook; takes `objectType` (and minimal identity), returns a fresh, property-less instance.
- **`id_map` key** — derived from the stable-ID field; note whether the entity is *created fresh* or *matched to a pre-existing instance* (Step 8).
- **Per-property apply** — for every property `phase 4` captured, name the setter and whether it applies in Pass 2 or is **deferred** (Step 7). Reference properties get a Pass 2 `id_map` lookup.
- **Approach** — `reconciliation` (route through the game's recreate path, per `§5.1`) or `manual` (explicit setters, per `§5.2`), taken from the matrix — never re-decided here by global policy.

### Step 6: Resolve Cross-Entity References

Take the Cross-Entity References table from `OBJECT_TRACKING.md` verbatim and turn each
row into a Pass 2 resolution step (`§3.1`, `06 §4.4`): the captured value is the target's
**stable game ID**, resolved through `id_map` to the live target. State the failure
policy explicitly: **a missing `id_map` entry in Pass 2 is a Pass 1 bug — fail loud, never
substitute null** (`§3.3`, `§9.6`). Any reference in the table with no resolution path is an Open Question.

### Step 7: Identify Deferred Properties

Per `§6`, list every property that cannot be applied at spawn and must run after Pass 2,
before handing control to the player. Heuristic: anything that no-ops or reverts when set
too early — animation pose, physics velocity, ability state, replicated state. For each:
- Why it must defer (which subsystem must be online first).
- Its position in the deferred queue if deferred properties depend on each other (`§6.3`) — capture the order here, don't infer it at runtime.

### Step 8: Plan Pre-Existing-Object Reconciliation

Mirror of `phase 4`'s Batch Registration Sites. Objects that exist at level load (placed,
not spawned) must **not** be double-created. For each batch-registered entity type,
decide: does restoration *match* the captured object to the level-placed instance (and
just apply properties), or *spawn* a fresh one? Specify the match key (stable ID) and the
hook where matching runs relative to level load.

### Step 9: Plan Environment Restoration

**If `GAME_ANALYSIS_ENVIRONMENT.md` does not exist, build it now** using `02D-RESEARCH-ENVIRONMENT.md` as the template — a light world-state inventory (time-of-day, weather, world flags, audio mix, camera state) — and write it to `ludeo-integration-plan/`. No earlier phase produces it; this is its producing step.

From `GAME_ANALYSIS_ENVIRONMENT.md` and `§8`, model world-level state (time-of-day,
weather, world flags, audio mix, camera state) as a singleton "world" object restored with
the same two-pass discipline (usually no references → Pass 2 is pure property application).
- **Ordering:** environment restoration runs **after** entity restoration (`§8.2`, `§9.8`) — world flags can despawn entities you just spawned, or fire logic for entities not yet present. State the order explicitly.
- **Procedural-assembly exception** (`assembly == "procedural"`): the `RunMetadata` **generation inputs** (selection/seed, sub-roll, progress cursor, scaling counter) are *not* environment — they are the **entry identity** read **first** (read-then-load, `07 §2.2`) and used to re-drive the generator and assemble the container **before** entities, with the re-roll suppressed (`procedural-world.md §5`). Plan them as that distinct early step; ordinary world/environment flags still restore *after* entities. State both positions.
- **Exclusion list:** record state deliberately **not** restored (UI history, local player prefs, replication metadata) and why (`§8.3`).

### Step 10: Specify the Wait-For-Player Flow

Per `§7` and **CR-010**: the restored moment is **built before Play**. Plan how the game is **held** through the
load (input off until `Begin`, start-of-run skips via `IsRestoring()`, the sim running as much as loading needs), how it is **frozen**
for the apply (the tick, not just input), how the **settle** runs (~0.5 s of time with input still suppressed — the
freeze controller needs an explicit settle mode), and how it is **frozen again** to hold the finished moment behind
the overlay. Only then does the room open (Step 3, step 7), so when the Play button appears the captured moment is
already on screen.
**Resume comes via `RoomReady → Begin`** — `RoomReady` is the viewer's Play click (the platform withholds it until
then); on it, `TryBeginGameplaySession()` issues `Begin` and then **unfreezes**. The gates may arrive in either
order, so don't assume a fixed order (`05 §6.6`). **Not** a self-built "press to begin" prompt, **not**
`PlayerReady` (doesn't exist), and **not** `ResumeGameRequest` (that's the mid-play overlay-closed resume). The
separate `PauseGameRequest`/`ResumeGameRequest` pair (Step 3) keeps the game paused when the player reopens the
overlay during cloud playback. Note whether the game has an existing pause system to reuse or (common for Group 3) a
minimal tick-freeze must be built, and how input is suppressed independently of the freeze (the settle needs it).

### Step 11: Confidence + Open Questions

Tag each entity restoration block `high | medium | low`. Low-confidence blocks and genuine
ambiguities (missing hooks, unresolved references, fields `phase 5 · task 1` may rename, deferred-order
uncertainty) go in dedicated sections. These are the gate items the human resolves before `phase 5 · task 3`.

### Step 12: Produce Output

Write `ludeo-integration-plan/RESTORATION_PLAN.md`:

```markdown
# State Restoration Plan — <GameName>

**Engine:** <name>
**Save-system group:** <1 | 2 | 3>   **Strategy:** <reuse Load() | extend checkpoint | build end-to-end>
**Entities to restore:** X (mirrors OBJECT_TRACKING.md)   **Deferred properties:** Y   **Pending human review**

## LudeoSelected Interrupt Flow
| Step | Game hook (file:function) | Notes |
|---|---|---|
| Marshal off notification thread | ... | Never block the SDK thread |
| Stash candidate id + dispatch `GetLudeo` | ... | Nothing else in the handler — no teardown, freeze or `OpenRoom` before validation |
| Validate (populated reader + entry identity) | ... | `GetLudeo` may fire repeatedly; accept only a **populated** reader (`GetObjectsInfo` Success && objectsCount>0), read the entry identity, check it is playable; failure/timeout/unplayable → **ignore the selection** (07 §2.2.1) |
| Commit | ... | If a Ludeo is playing or still restoring → `EndCurrentLudeo` first (`End(isAbort=true)` if Begin ran → RemovePlayer → CloseRoom), continue after the close; then `SetRestoring(true)`, pending id/reader, restore generation, input hold on; skip the Creator-Flow level-load `OpenRoom` while restoring |
| Reach active gameplay | ... | Load the captured level / boot the run (generic if no rooms); wait for native-spawn-done |
| Apply held | ... | Freeze → SetCurrent → two-pass (§3) → environment (§8.2, after entities) |
| Settle + freeze | ... | ~0.5 s of time with input off, then freeze; `SetRestoring(false)` |
| `OpenRoom(ludeoId)` → AddPlayer | ... | After the settle; carries `m_pending_ludeo_id` (Player Flow; nullptr = new recording, 05 §6.2) |
| Play → resume | ... | `RoomReady` = the viewer's Play click → `Begin` (player_added + room_ready + applied, either order — 05 §6.6) → unfreeze. NOT `ResumeGameRequest` (mid-play only, §2.4) |
| Playback end | ... | Backend ends (timer/objective/any reason) → sends `PauseGameRequest` → game freezes+waits, does NOT call End or submit; game-initiated interrupt → game `End(isAbort=true)` → RemovePlayer → CloseRoom (05 §6.11) |

## Two-Pass Algorithm
- **id_map:** LudeoObjectId → <native id type>. Per-Ludeo, discarded after restore.
- **Pass 1 split:** <none | 1a foundational: …, 1b dependent: …>
- Pass 2 missing-id policy: fail loud (§3.3).

## Entity: <EntityType>
- objectType string: `<exact match to OBJECT_TRACKING.md>`
- Approach: <reconciliation | manual>
- Pass: <1 | 1a | 1b>   Pre-existing: <spawn | match-existing, key=<field>>
- Spawn function: <inverse of creation hook @ file:line>

### Property Restoration
| Property | Kind | Setter | Pass 2 | Deferred? | Reference resolves to | Notes |
|---|---|---|---|---|---|---|
| ... | ... | ... | yes/no | no / queue#N | — / <Target> via id_map | ... |

## Cross-Entity Reference Resolution
| From | Field | To | Resolution | Failure |
|---|---|---|---|---|
| ... | ... | ... | id_map lookup in Pass 2 | fail loud |

## Deferred Property Queue (applied after Pass 2, before player resume)
| Order | Entity | Property | Why deferred | Depends on |
|---|---|---|---|---|
| 1 | ... | ... | physics body not yet registered | — |

## Pre-Existing-Object Reconciliation
| Entity | Match key | Hook | Spawn or match |
|---|---|---|---|
| ... | ... | OnLevelLoadComplete | match-existing |

## Environment Restoration
- Order relative to entities: after (§8.2)
| World property | Setter | Notes |
|---|---|---|
| ... | ... | ... |
- **Excluded (not restored):** <UI history, prefs, …> — rationale

## Overlay Control & Wait-For-Player
- Pause mechanism: <reuse game pause | build minimal tick-freeze>
- **Post-restore resume hook:** `OnRoomReadyCallback` → `TryBeginGameplaySession()` → `Begin` → unfreeze (`05-LIFECYCLE-MANAGEMENT.md`'s chain; `phase 3 · task 4` already wired this for tracking-start). NOT `ResumeGameRequest`, NOT `PlayerReady` (doesn't exist), NOT a self-built prompt unless game-specific.
- **Mid-play overlay hooks** (07 §2.4): PauseGameRequest → <file:function>  ·  ResumeGameRequest → <file:function>  ·  BackToMenuRequest → <file:function>
- Game stays frozen between "restoration complete" and the `RoomReady` callback so the sim can't overwrite restored state.

## Open Questions
- ...

## Needs Human Review (Low Confidence)
| Item | Reason | Action |
|---|---|---|
| ... | ... | ... |
```

### Step 12.5: Self-validate the plan before the human review

Before handing off to the user, walk the plan you just wrote and confirm each item below — catch gaps now rather than letting them surface in `phase 5 · task 3`/`phase 5 · task 4`:

- [ ] **Mirror is complete.** For every entity in `OBJECT_TRACKING.md` there is a restoration block; for every property row there is a setter + Pass-2 mapping (or it's in the deferred queue). No row left un-reversed.
- [ ] **No stub rows.** Every spawn function, setter, `id_map` key, and hook is named with a file:function (or a clearly-flagged Open Question) — not `TODO`, not "to be filled."
- [ ] **Cross-Entity References table covers every reference property.** Missing rows silently break two-pass.
- [ ] **Order is right (CR-010).** Sequence: handler dispatches only `GetLudeo` → validate (populated reader + playable entry identity; otherwise ignore the selection) → commit (`SetRestoring`, teardown if playing, hold) → reach active gameplay → **freeze → apply (Pass 1 + Pass 2 + env) → settle → freeze** → `OpenRoom(ludeoId)` → on `RoomReady` (Play) `Begin` → unfreeze. Not teardown-before-validation; not load-or-apply-on-Play; not unfreeze-before-apply; not Begin-then-apply; not OpenRoom before the settle.
- [ ] **Reader readiness handled.** `GetLudeo` repeated-fire + empty early cycles covered (07 §2.2.1): validate populated, retry-until-ready with a timeout, abort (no `Begin`) on timeout/empty, don't clobber a cached populated reader.
- [ ] **Overlay-control hooks named** (`PauseGameRequest`/`ResumeGameRequest`/`BackToMenuRequest` → CR-011), not "TBD" and not deferred to `phase 3 · task 4`'s discretion.
- [ ] **Deferred queue is ordered** and each entry names *why* it defers (which subsystem it waits on).
- [ ] **Pre-existing reconciliation chose match-vs-spawn per entity** with a stable-ID match key — no placed-by-default entity left as "spawn fresh."
- [ ] **Start-of-run mechanisms enumerated and each has a suppression hook — both categories** (07 §9.11): state-clobbering (intro cutscenes, countdowns, slow-mo, fly-in cameras, default-spawn teleports, respawn-on-load, scripted start events) **and** flow-blocking (press-start/click-to-continue gates, modal popups, EULA/login/age-gate, tutorial overlays, confirmation dialogs). None left as "TBD"; each gated on `IsRestoring()` or equivalent. The Ludeo reaches the captured state *and* is interactive on the first visible frame.
- [ ] **Environment ordering** is after-entities; exclusion list is rationalized.
- [ ] **Low-confidence + Open Questions** populated (or explicitly empty with a one-line note — empty on a complex game is itself a yellow flag).
- [ ] **Disagreements with `OBJECT_TRACKING.md` or `GAME_ANALYSIS_SAVE_SYSTEM.md`** are surfaced for the user, not silently reconciled.

If any item fails, fix the plan and re-check before Step 13 — do not advance to human review with known gaps.

### Step 13: Halt for Human Review

After writing the plan, summarize for the user and ask them to review:
1. Per-group strategy + what existing machinery is reused
2. LudeoSelected interrupt flow + tear-down path
3. Two-pass mapping — every tracked entity has a spawn function and setters (the mirror is complete)
4. Cross-entity reference resolution + fail-loud policy
5. Deferred-property list and queue ordering
6. Pre-existing-object match-vs-spawn decisions
7. Environment restoration order + exclusion list
8. Wait-for-player mechanism
9. Open questions + low-confidence entries

**Do not proceed to `phase 5 · task 3` automatically.** This gate prevents generating restoration code against an incomplete or mis-mirrored model.

## Output

| File | Purpose |
|------|---------|
| `ludeo-integration-plan/RESTORATION_PLAN.md` | Approved plan that `phase 5 · task 3` (flow) and `phase 5 · task 4` (reconstruction) consume |
| `ludeo-integration-plan/GAME_ANALYSIS_ENVIRONMENT.md` | World-state inventory (produced in Step 9 if it didn't already exist) |

May also surface disagreements between `OBJECT_TRACKING.md` and `GAME_ANALYSIS_SAVE_SYSTEM.md` for the user to reconcile.

## Important Notes

- **Restoration mirrors tracking.** Every entity, property, and reference here traces back to a row in `OBJECT_TRACKING.md`. You cannot restore what tracking didn't capture — if you need to, the fix belongs in `phase 4`/`phase 5 · task 1`, not here.
- **Snapshot, not replay.** `per-tick`/`per-change`/`event-driven` captures kept the value fresh during tracking; restoration applies the single final value. Do not design a timeline replay. **Progression trails** (the intake's `scriptedSystems`) are no exception: capture how far the trail got and restore it through the game's own "advance to this point" entry, with that call's side effects (spawns, voice-over) gated (`07 §11`) — never by re-firing the events one by one.
- **Two-pass is mandatory (CR-006).** Single-pass silently corrupts reference graphs by spawn order.
- **Fail loud on missing IDs.** A Pass 2 lookup miss is a Pass 1 bug — never substitute null.
- **Drive reconciliation/manual from the matrix**, per entity, never by global policy.
- **Environment after entities; pause simulation, not just input.**
- **Analysis only.** This command writes no game code — `phase 5 · task 3` and `phase 5 · task 4` do.

## Related Commands

- `4-map-game-objects.md` — produces `OBJECT_TRACKING.md`, the spine this plan mirrors (run FIRST)
- `5b-implement-object-tracking.md` — emits the capture code; restoration is its inverse
- `5d-implement-restoration-flow.md` — consumes this plan after approval (player-flow/lifecycle half)
- `5e-implement-state-reconstruction.md` — consumes this plan after `phase 5 · task 3` (two-pass data half)

## Next Steps

1. Review `RESTORATION_PLAN.md` with the user
2. Confirm the mirror is complete — no tracked entity/property without a restoration path
3. Resolve open questions + low-confidence entries
4. Confirm approval
5. Run `5d-implement-restoration-flow.md`, then `5e-implement-state-reconstruction.md`
