# Implement Object Tracking - Wire Registration & Capture Calls

Read the Object Tracking Plan produced by `phase 8` and emit registration + property-capture code at the hook sites identified in the plan. Follow the propose-confirm-execute cycle.

## 🚦 Fresh Context Check

**Before proceeding, verify this is a fresh agent session:**
- If you see prior tool calls, game analysis, or CODE_MAP references in this conversation, **STOP** and tell the user:
  > "This chat has prior context. For best results, please start a fresh agent session and continue with phase 9 there."
- If this is a fresh conversation, proceed.

## Engine Scope

Proprietary C++ engines only. If the game uses Unity or Unreal, stop — use the engine-specific guide instead.

## Prerequisites

> **REQUIRED:** These must be complete before running this command:
> 1. Phase 0 complete — LudeoManager exists and SDK lifecycle works
> 2. `phase 8` complete — `ludeo-integration-plan/OBJECT_TRACKING.md` exists
> 3. User has reviewed and approved the plan

## Context Files

**Action Required:** Read the following files. Do not assume they are in context.

- `ludeo-integration-docs/06-TRACKING-PATTERNS.md` — §3 (lifecycle), §4 (identity/mapping), §5 (manager integration), §6 (batch registration). All canonical code patterns live here.
- `ludeo-integration-docs/00-CRITICAL-REQUIREMENTS.md` — CR-001 (`#if LUDEO_SDK_ENABLED` guards), CR-002 (Enter/Leave pairing via `ObjectScope`)
- `ludeo-integration-docs/research-context/02F-RESEARCH-SAVE-SYSTEM.md` — per-entity reconciliation vs manual

## Your Task

### Step 1: Read the Plan

Read `ludeo-integration-plan/OBJECT_TRACKING.md`. Extract per entity:
- Class FQN, codebase pattern (§2.x reference)
- Creation / destruction hooks (file:line)
- Stable ID source field
- Properties with kind + strategy
- Restoration approach (reconciliation / manual)

Also extract the Codebase Pattern Summary, Batch Registration Sites, and Cross-Entity References tables.

Skip entities with unresolved Open Questions — confirm with the user before generating code for them.

### Step 2: Ensure Shared Infrastructure Exists

Two prerequisites that the rest of the command assumes:

1. **`LudeoCaptureMacros.h`** — provides `LUDEO_CAPTURE_*` macros and `LudeoCapture::ObjectScope`. Canonical contents in `06-TRACKING-PATTERNS.md §3.2 and §7.2`.
2. **`LudeoStateAdapter`** — owns the bidirectional `LudeoObjectId ↔ stable game ID` map. Canonical structure in `06-TRACKING-PATTERNS.md §4.3`.

If either doesn't exist, propose creating it using the canonical version verbatim. Get confirmation, then proceed. Do not inline writer calls without the macro — bare calls bypass tracking-active checks and `ObjectScope` discipline.

### Step 3: Add Per-Entity Register/Unregister Methods

For each entity class in the plan, propose adding `RegisterWithLudeo()` and `UnregisterFromLudeo()` per the canonical lifecycle in `06-TRACKING-PATTERNS.md §3.2 and §3.4`. The body:

- Acquires the DataWriter, calls `ludeo_DataWriter_CreateObject` with the `objectType` string from the plan
- Stores the returned `LudeoObjectId` on the entity
- Calls `LudeoStateAdapter::RegisterObject(this, ludeoId, stable_game_id)` for reference resolution
- Emits one-shot identity + static + initial-dynamic captures
- Mirror destructor: `DestroyObject` → `UnregisterObject` → clear ID

Wrap all SDK references in `#if LUDEO_SDK_ENABLED` per CR-001.

### Step 4: Wire Register/Unregister into Hook Sites

Hook sites depend on the codebase pattern from the plan. Use the pattern-specific guidance:

| Pattern | Hook | Reference |
|---|---|---|
| §2.1 Inheritance | Virtual `OnSpawn`/`OnDestroy` (never constructor) | 06 §2.1 |
| §2.2 Manager/Factory | Inside `Manager::Create` and `Manager::Destroy` | 06 §5 |
| §2.3 ECS | `registry.on_construct<Tracked>()` / `on_destroy<Tracked>()` signals | 06 §2.3 |
| §2.4 Handle/Pool | After post-init, before generation bump on release | 06 §2.4 |
| §2.5 Event bus | Subscribe in `LudeoStateAdapter` to lifecycle events | 06 §2.5 |
| §2.6 Data-driven prefab | Central `Spawn(prefabId, …)`, use prefab ID as `objectType` | 06 §2.6 |
| §2.8 Frame iteration | No discrete hook — see Step 6 batch path instead | 06 §2.8 |

Show each insertion as propose-confirm-execute. Check for fast-path bypasses (pool acquires, bulk loaders) that skip the manager — instrument those too.

### Step 5: Wire Per-Property Captures

For each property in the plan, insert the capture macro at the location dictated by its **strategy**:

- **one-shot** — already covered by `SendInitialLudeoValues()` in Step 3
- **per-change** — inside the setter / `OnXChanged` handler, *after* the game-state mutation
- **per-tick** — inside the entity's existing `Tick`/`Update`
- **event-driven** — inside the subscribed event handler
- **reference** — capture the target's **stable game ID**, never the pointer (per `06 §4.4`)
- **debounced** — use a per-property timestamp check; don't introduce new timers

Critical discipline:
- All `LUDEO_CAPTURE_*` calls go *after* the game-state mutation, not before.
- Reference fields capture `target ? target->GetEntityId() : 0`, never `(uintptr_t)target`.
- Don't add session/active-tracking guards at call sites — the macro handles them.

### Step 6: Wire Batch Registration for Pre-Existing Objects

For each entry in the plan's *Batch Registration Sites* table, add a walker in `LudeoStateAdapter::RegisterAllExistingObjects()` per `06 §6.2`. Call it from the identified hook (typically `OnLevelLoadComplete`), gated by `!LudeoManager::Get().IsRestoring()` to avoid double-registration during `phase 11`'s restoration path.

### Step 7: Reconciliation Wiring (Per-Entity, Only Where the Matrix Says So)

For entities marked **reconciliation** in `GAME_ANALYSIS_SAVE_SYSTEM.md §8.1`: locate the entity's existing `Serialize`/`Save` method and add a Ludeo capture that mirrors the fields it writes. For **manual** entities, all writes are explicit per Step 5 — no reconciliation wiring.

### Step 8: Summary

```
## Object Tracking Implementation Summary

**Infrastructure created/confirmed:**
- LudeoCaptureMacros.h — created / already existed
- LudeoStateAdapter.{h,cpp} — created / already existed

**Entities instrumented:** X / Y total
**Properties wired:** one-shot A, per-change B, per-tick C, event-driven D
**Batch registration sites wired:** Z
**Reconciliation entities:** R   **Manual entities:** M
**Skipped (open questions / low confidence):** S

### Files Modified
- <file 1>
- <file 2>
...

### Next
1. Run `phase 5` to verify clean compile both with and without LUDEO_SDK_ENABLED
2. Verify a sample capture contains the expected objects + attributes
3. Run `phase 10` next
```

## Important Notes

- **Propose-confirm-execute** for every change. The two new files (`LudeoCaptureMacros.h`, `LudeoStateAdapter`) are project-wide infrastructure — get explicit approval before creating.
- Every SDK call wrapped in `#if LUDEO_SDK_ENABLED` (CR-001).
- `EnterObject` / `LeaveObject` paired only via `ObjectScope` (CR-002) — the macros enforce this; don't hand-pair.
- Track stable game IDs for references, never pointers (06 §4).
- Update game state first, then track.
- Do not modify game logic — only add SDK calls. If a hook site doesn't exist, propose adding it as a separate, named change first.
- Match `objectType` strings exactly to `OBJECT_TRACKING.md` — restoration looks them up by name.

## Related Phases

- `phase 8` — produces the plan this command consumes (run FIRST)
- `phase 5` — run after to verify compilation
- `phase 10` — consumes the same plan + stable-ID strategy

## Next Steps

After running this command:
1. Run `phase 5` with `LUDEO_SDK_ENABLED=1` and `=0`
2. Run the game; verify registration logs at gameplay session begin
3. Sample a capture and confirm planned objects + attributes are present
4. Run `phase 10`
