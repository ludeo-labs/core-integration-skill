# /10-plan-state-restoration — Design the Two-Pass Restoration Flow

> **Stage:** State Restoration — Planning (analysis only, no code yet)
> **Prerequisite:** `/8-map-game-objects` approved (entity model is fixed)
> **Inputs:** `OBJECT_TRACKING.md`, `GAME_ANALYSIS_SAVE_SYSTEM.md` (+ `GAME_ANALYSIS_ENVIRONMENT.md`, produced in Step 9 if absent)
> **Output:** `ludeo-integration-plan/RESTORATION_PLAN.md` — two-pass algorithm, deferred-property list, wait-for-player flow, environment restoration
> **Gate:** Human approval required before `/11-implement-state-restoration`

Restoration is the inverse of tracking. This command does **not** invent a new
state model — it reads the already-approved `OBJECT_TRACKING.md` and, row by row,
specifies how each captured thing is rebuilt when a Ludeo is selected. No code is
written here; the output is a reviewed plan that `/11` consumes.

## Fresh Context Check

This is a sequential workflow — continuing to phase 10 in the **same session as earlier phases is normal**; do **not** stop just because prior phases ran here. Only stop if **phase 10** was already completed in this conversation and you're about to redo/regenerate its output — then confirm with the user first. If context has grown very large you may *suggest* a fresh session, but it is not required.

## Engine Scope

Proprietary C++ engines only. If the game uses Unity or Unreal, stop — use the engine-specific guide instead.

## Prerequisites

> ⚠️ **REQUIRED:** These must complete first:
> 1. `/8-map-game-objects` → `ludeo-integration-plan/OBJECT_TRACKING.md`, **approved**
> 2. `phase 2c` (Classify Save System) → `GAME_ANALYSIS_SAVE_SYSTEM.md` + `CODE_MAP.save_system.group`
>
> **Produced by this phase if absent:** the **environment inventory** (`GAME_ANALYSIS_ENVIRONMENT.md`). No earlier phase produces it, so Step 9 builds it from `02D-RESEARCH-ENVIRONMENT.md` before planning environment restoration — you do **not** need it in hand to start.
>
> **Recommended:** `/9-implement-object-tracking` done, so the tracking code (and its
> `objectType` strings + stable-ID fields) exists to mirror against. If `/9` hasn't run,
> plan against `OBJECT_TRACKING.md` and flag any field the implementation may still rename.

This command reads those artifacts and does **NOT** re-analyze the entity model — that's fixed by `/8`. The one exception is the **environment inventory** (Step 9): if `GAME_ANALYSIS_ENVIRONMENT.md` doesn't exist yet, this phase produces it from `02D-RESEARCH-ENVIRONMENT.md`, since no earlier phase does.

> 🛑 **Planning scope — do not go exploring.** This phase produces a *plan*, not code. You do **not** need exact SDK signatures, struct fields, or the `GetLudeo` callback shape, and you must **not** read the SDK headers here. Reference the restoration API only at the level of *which call maps to which step*; the entry mechanism (`LudeoSelected → GetLudeo → DataReader`, async, reader delivered in a callback) is described in `07-RESTORATION-PATTERNS.md §2` and is implemented by `/11`. If you find yourself opening `Session.h`/`DataReader.h` to answer a question, stop — either the answer is in `07 §2`, or it's a `/11` concern; note it as an Open Question instead.

## Context Files

**Action Required:** Read the following files. Do not assume they are in context.

- `ludeo-integration-docs/07-RESTORATION-PATTERNS.md` — the core input. §2 (LudeoSelected flow), §3 (two-pass / CR-006), §4 (per-group strategy), §5 (reconciliation vs manual), §6 (deferred properties), §7 (wait-for-player), §8 (environment).
- `ludeo-integration-docs/00-CRITICAL-REQUIREMENTS.md` — CR-006 (two-pass restoration is mandatory).
- `ludeo-integration-docs/06-TRACKING-PATTERNS.md` — §4 (identity & references). **What was captured determines what can be restored** — read it as the other half of each mirror row.
- `ludeo-integration-docs/12-SDK-API-REFERENCE.md` — the restoration API surface *at a glance* (what exists), so the plan's spawn/setter rows map onto real calls: the typed `ludeo_DataReader_Get*` getters mirror the `Set*` writers (and return `false` when an attribute is absent — the plan must say what happens then); objects are enumerated with `GetObjectsInfo`; the entry point is `LudeoSelected` → `GetLudeo` *(async)* → `DataReader`. **For planning you do not need exact signatures, the GetLudeo callback shape, or any header detail** — the entry mechanism is fully described in `07-RESTORATION-PATTERNS.md §2`, and `/11` implements it. **Do not read SDK headers in this phase.**
- `ludeo-integration-docs/research-context/02D-RESEARCH-ENVIRONMENT.md` — environment inventory template; produces `ludeo-integration-plan/GAME_ANALYSIS_ENVIRONMENT.md`.
- `ludeo-integration-docs/research-context/02F-RESEARCH-SAVE-SYSTEM.md` — per-entity reconciliation-vs-manual matrix; produces `ludeo-integration-plan/GAME_ANALYSIS_SAVE_SYSTEM.md`.

> **Artifact naming convention:** each `research-context/02X-RESEARCH-<TOPIC>.md` template produces a matching `ludeo-integration-plan/GAME_ANALYSIS_<TOPIC>.md`. `GAME_ANALYSIS_SAVE_SYSTEM.md` is produced by **`phase 2c`**; `GAME_ANALYSIS_ENVIRONMENT.md` is produced by **Step 9 of this phase** if it doesn't already exist (no earlier phase emits it).

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

Per `§2`, specify the handler for a `LudeoSelected` event that can fire in **any** state
(menu, mid-gameplay, loading, cutscene):
1. Marshal off the SDK notification thread immediately (never block it).
2. **`SetRestoring(true)` FIRST** — arms the §9.11 pre-match skips (cutscenes, countdowns, default-spawn teleports, etc.); they fire later, during the level load inside the apply (step 8), and hit the gate then.
3. **Stash the selected `ludeoId`** (`params->ludeoId`) on `LudeoManager` (e.g. `m_pending_ludeo_id`). It feeds **two** calls: `ludeo_Session_GetLudeo` (the state reader) **and** `OpenRoom` — passing it to `OpenRoom` is what makes the rerun a *scored Player-Flow replay* rather than a new recording (`05 §6.2`, §6.11). `nullptr` is the silent "state restored but the rerun isn't scored" failure.
4. **If a Ludeo is already playing** (another `LudeoSelected` arrived mid-play), run `EndCurrentLudeo()` first: tear down its gameplay session + room (`End(isAbort=true)` → `RemovePlayer` → `Close`) **and reset prior-Ludeo state** (release the old reader, re-arm `IsRestoring`, swap in the new `ludeoId`). Cancel in-flight transitions; suppress non-restoration input. (No teardown is needed at the menu — there's no run yet.)
5. **Freeze the simulation now** — the instant `LudeoSelected` fires (freeze the tick, not just input — CR-010). The game **may already be frozen** at the menu; set the restoration-freeze bit regardless. It holds through the `GetLudeo` + room + wait-for-Play window, and unpauses only at the top of the apply (step 8).
6. **Dispatch `ludeo_Session_GetLudeo(ludeoId)` and `OpenRoom(ludeoId)` now — they race; no ordering guarantee.** The target level is **unknown** at this point — nothing about which level loads is decided until the reader is in hand. `OpenRoom` is dispatched **here in the handler**, *not* hung off the level-load path (the level does not load until the apply); `OpenRoom → AddPlayer → OnPlayerAdded` set `player_added` (`Begin` still waits on `room_ready`).
7. Acquire the `DataReader` (async — delivered in `GetLudeo`'s completion callback, see `07 §2`) and **cache it**. The apply is gated on `reader cached && room_ready` and fires **once**, when the last of the two arrives (call it from both the reader callback and `OnRoomReady`).
8. **In the apply** (fired on whichever of `OnRoomReady` — withheld until the player presses Play — or the reader callback lands last): **unpause → read the entry identity from the reader → reach active gameplay (load that level / boot the run; generic level if the game has no rooms) → apply (two-pass + environment) → `TryBeginGameplaySession()`**, in that order. **At the menu / startup there is no game — you *boot* a run here** (scene-based → level load + spawn; state-machine entry / no per-level scene like DFU → trigger new-game/load so player+world+state exist); restoring into a menu silently no-ops (`07 §2`), and pre-match sequences fire during this load and silently skip via the gate. Apply runs unpaused so movement/physics/AI can settle; `Begin` fires once **both** gates are met (`player_added` from step 6 + `room_ready`) — either order (`05 §6.6`) — and after apply so the SDK records playback from the restored state.

Also plan four distinct sets of hooks:
- **Post-restore resume** — reuse `/4`'s `OnRoomReadyCallback` / `TryBeginGameplaySession()` (`05-LIFECYCLE-MANAGEMENT.md`). Apply state inside this callback, after unpause, before `Begin`.
- **Mid-play overlay open/close** (07 §2.4) — `PauseGameRequest` → freeze the sim, `ResumeGameRequest` → resume, `BackToMenuRequest` → tear down + go to menu. Session-lifetime; easy to forget because they sit outside the restore path. Map each onto a game hook. **Do not plan around `PlayerReady` — it does not exist in this SDK.**
- **Playback-end handling** (`05 §6.11`) — plan both end paths. **Backend ends the Ludeo** (timer hits 0, objective met/failed, or any backend-decided reason): the backend sends **`PauseGameRequest`** → the game **pauses (freezes) and waits**; it does **NOT** detect end-of-moment, call `End`, or submit (the backend owns submission, and `PauseGameRequest` is the universal end-of-moment cue — there is no game-facing "moment ended" callback). **Game-initiated interrupt** (another `LudeoSelected` mid-play, `BackToMenuRequest`, quit): the **game** calls `ludeo_GameplaySession_End(isAbort=true)` then `RemovePlayer → CloseRoom`. Name the hook for the interrupt path; the backend-ends path needs no `End` call, only the `PauseGameRequest` freeze.
- **Pre-match / location-override suppression** (07 §9.11) — identify every mechanism the game runs at start-of-match that would touch restored state: intro cutscenes, countdowns, slow-mo intros, fly-in cameras, default-spawn teleports, respawn-on-load logic, scripted level-start events. List each with its hook (file:function) and the plan to gate it on `IsRestoring()` so it's skipped during playback. The Ludeo must start *exactly* at the captured state on the first visible frame — anything that runs between level-load and apply (or after apply, before `Begin`) is a candidate to suppress.

Map each step onto a concrete game hook (file:function) where known; flag any that don't yet exist as an Open Question for `/11`.

### Step 4: Specify the Two-Pass Algorithm (CR-006)

Document the two passes concretely for this game (`§3`):
- **Pass 1 — Create:** iterate reader objects, spawn type-only via the spawn function, populate `id_map[LudeoObjectId] → native id`.
- **Pass 2 — Apply + Resolve:** iterate again, apply non-reference attributes via setters, resolve reference attributes through `id_map`.

Define the `id_map`: key = `LudeoObjectId`, value = the native identifier the game uses for runtime lookup (pointer / handle / EntityId — match what `/8` chose as the stable-ID anchor). State that it is **per-Ludeo** and discarded after restoration.

If the spawn graph has ordering constraints (e.g. player must exist before per-player UI), split Pass 1 into **1a (foundational)** and **1b (dependent)** per `§3.4`, and record which entities go in each.

### Step 5: Build the Per-Entity Spawn + Setter Inventory

This is the heart of the plan and the direct mirror of `OBJECT_TRACKING.md`'s entity
blocks. For **each** tracked entity, fill one restoration block:
- **Spawn function** — the inverse of the creation hook; takes `objectType` (and minimal identity), returns a fresh, property-less instance.
- **`id_map` key** — derived from the stable-ID field; note whether the entity is *created fresh* or *matched to a pre-existing instance* (Step 8).
- **Per-property apply** — for every property `/8` captured, name the setter and whether it applies in Pass 2 or is **deferred** (Step 7). Reference properties get a Pass 2 `id_map` lookup.
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

Mirror of `/8`'s Batch Registration Sites. Objects that exist at level load (placed,
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
- **Exclusion list:** record state deliberately **not** restored (UI history, local player prefs, replication metadata) and why (`§8.3`).

### Step 10: Specify the Wait-For-Player Flow

Per `§7` and **CR-010**: the simulation is **frozen the instant `LudeoSelected` fires — freeze the
tick, not just input** (it may already be frozen at the menu) — and stays frozen while the overlay
waits for the player; the level is not loaded until the apply, so the freeze guarantees nothing
ticks before the restored state is in place. By this point the room is **already open (with the
`ludeoId`) and the player already added** (Step 3, step 6) — only `room_ready` is pending.
**Resume comes via `RoomReady → Begin`** — the platform **withholds `RoomReady` until the player
presses Play**; the rest of the `OpenRoom → AddPlayer → RoomReady → Begin` chain (`/4` wired it in
`05-LIFECYCLE-MANAGEMENT.md`) already ran during the handler. Plan the resume hook on the
`RoomReady` callback (unpause → read entry identity → load level → apply → `TryBeginGameplaySession()`); `Begin` fires once **both**
gates are met and the two callbacks may arrive in either order, so don't assume a fixed order
(`05 §6.6`). **Not** a self-built "press to begin" prompt, **not** `PlayerReady` (doesn't exist),
and **not** `ResumeGameRequest` (that's the mid-play overlay-closed resume). The separate
`PauseGameRequest`/`ResumeGameRequest` pair (Step 3) keeps the game paused when the player reopens
the overlay during playback. Note whether the game has an existing pause system to reuse or
(common for Group 3) a minimal tick-freeze must be built.

### Step 11: Confidence + Open Questions

Tag each entity restoration block `high | medium | low`. Low-confidence blocks and genuine
ambiguities (missing hooks, unresolved references, fields `/9` may rename, deferred-order
uncertainty) go in dedicated sections. These are the gate items the human resolves before `/11`.

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
| Stash `m_pending_ludeo_id` | ... | From `params->ludeoId`; feeds GetLudeo + OpenRoom |
| Tear down gameplay session + room | ... | Only if a Ludeo is already playing; SDK Session stays alive; interrupt = `End(isAbort=true)` |
| Freeze simulation | ... | The instant `LudeoSelected` fires (may already be frozen at the menu); freeze the tick, not just input (CR-010) |
| Dispatch `GetLudeo(ludeoId)` + `OpenRoom(ludeoId)` | ... | Both in the handler, they race; OpenRoom carries `m_pending_ludeo_id` (Player Flow; nullptr = new recording, 05 §6.2); AddPlayer runs now. **Level NOT loaded yet** — target is unknown until the reader is in hand |
| Cache `DataReader` | ... | From `GetLudeo`'s completion callback; apply waits for `reader cached && room_ready` |
| Apply (read-then-load) | ... | On the last of {reader, room_ready}: unpause → **read entry identity from reader → load that level / boot the run (generic if no rooms)** → two-pass → environment (07 §2.2) |
| Two-pass restore | ... | §3 — inside the apply, after the level load |
| Environment restore | ... | After entities (§8.2) — inside the apply |
| Wait-for-player resume | ... | Frozen since `LudeoSelected`; resume on `RoomReady` → `Begin` once both gates met, either order (05 §6.6/§6.11) — NOT `ResumeGameRequest` (mid-play only, §2.4) |
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
- **Post-restore resume hook:** `OnRoomReadyCallback` → `TryBeginGameplaySession()` + unpause (`05-LIFECYCLE-MANAGEMENT.md`'s chain; `/4` already wired this for tracking-start). NOT `ResumeGameRequest`, NOT `PlayerReady` (doesn't exist), NOT a self-built prompt unless game-specific.
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

Before handing off to the user, walk the plan you just wrote and confirm each item below — catch gaps now rather than letting them surface in `/11`:

- [ ] **Mirror is complete.** For every entity in `OBJECT_TRACKING.md` there is a restoration block; for every property row there is a setter + Pass-2 mapping (or it's in the deferred queue). No row left un-reversed.
- [ ] **No stub rows.** Every spawn function, setter, `id_map` key, and hook is named with a file:function (or a clearly-flagged Open Question) — not `TODO`, not "to be filled."
- [ ] **Cross-Entity References table covers every reference property.** Missing rows silently break two-pass.
- [ ] **Order is right.** Sequence: freeze at `LudeoSelected` → dispatch `GetLudeo` + `OpenRoom(ludeoId)` in the handler → cache reader in `OnGetLudeo` → apply once (last of {reader, room_ready}): **unpause → read identity → load level → apply (Pass 1 + Pass 2 + env) → `Begin`** (CR-010). Not Begin-then-apply; not apply-in-GetLudeo; not level-load-before-GetLudeo; not OpenRoom-on-level-load.
- [ ] **Overlay-control hooks named** (`PauseGameRequest`/`ResumeGameRequest`/`BackToMenuRequest` → CR-011), not "TBD" and not deferred to `/4`'s discretion.
- [ ] **Deferred queue is ordered** and each entry names *why* it defers (which subsystem it waits on).
- [ ] **Pre-existing reconciliation chose match-vs-spawn per entity** with a stable-ID match key — no placed-by-default entity left as "spawn fresh."
- [ ] **Pre-match / location-override mechanisms enumerated and each has a suppression hook** (intro cutscenes, countdowns, slow-mo, fly-in cameras, default-spawn teleports, respawn-on-load logic, scripted start events — 07 §9.11). None left as "TBD"; each gated on `IsRestoring()` or equivalent.
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

**Do not proceed to `/11` automatically.** This gate prevents generating restoration code against an incomplete or mis-mirrored model.

## Output

| File | Purpose |
|------|---------|
| `ludeo-integration-plan/RESTORATION_PLAN.md` | Approved plan that `/11` consumes |
| `ludeo-integration-plan/GAME_ANALYSIS_ENVIRONMENT.md` | World-state inventory (produced in Step 9 if it didn't already exist) |

May also surface disagreements between `OBJECT_TRACKING.md` and `GAME_ANALYSIS_SAVE_SYSTEM.md` for the user to reconcile.

## Important Notes

- **Restoration mirrors tracking.** Every entity, property, and reference here traces back to a row in `OBJECT_TRACKING.md`. You cannot restore what tracking didn't capture — if you need to, the fix belongs in `/8`/`/9`, not here.
- **Snapshot, not replay.** `per-tick`/`per-change`/`event-driven` captures kept the value fresh during tracking; restoration applies the single final value. Do not design a timeline replay.
- **Two-pass is mandatory (CR-006).** Single-pass silently corrupts reference graphs by spawn order.
- **Fail loud on missing IDs.** A Pass 2 lookup miss is a Pass 1 bug — never substitute null.
- **Drive reconciliation/manual from the matrix**, per entity, never by global policy.
- **Environment after entities; pause simulation, not just input.**
- **Analysis only.** This command writes no game code — `/11` does.

## Related Commands

- `/8-map-game-objects` — produces `OBJECT_TRACKING.md`, the spine this plan mirrors (run FIRST)
- `/9-implement-object-tracking` — emits the capture code; restoration is its inverse
- `/11-implement-state-restoration` — consumes this plan after approval

## Next Steps

1. Review `RESTORATION_PLAN.md` with the user
2. Confirm the mirror is complete — no tracked entity/property without a restoration path
3. Resolve open questions + low-confidence entries
4. Confirm approval
5. Run `/11-implement-state-restoration`
