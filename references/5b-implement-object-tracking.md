# Phase 5 · Task 1 — Implement Object Tracking

Read the Object Tracking Plan produced by `phase 4` and emit registration + property-capture code at the hook sites identified in the plan. Follow the propose-confirm-execute cycle.

## 🚦 Fresh Context Check

This is a sequential workflow — continuing to phase 5 · task 1 in the **same session as earlier phases is normal**; do **not** stop just because prior phases ran here. Only stop if **phase 5 · task 1** was already completed in this conversation and you're about to redo/regenerate its output — then confirm with the user first. If context has grown very large you may *suggest* a fresh session, but it is not required.

## Engine Scope

Proprietary C++ engines only. If the game uses Unity or Unreal, stop — use the engine-specific guide instead.

## Prerequisites

> **REQUIRED:** These must be complete before running this command:
> 1. Phase 1 complete — LudeoManager exists and SDK lifecycle works
> 2. `phase 4` complete — `ludeo-integration-plan/OBJECT_TRACKING.md` exists
> 3. User has reviewed and approved the plan

## Context Files

**Action Required:** Read the following files. Do not assume they are in context.

- `ludeo-integration-docs/06-TRACKING-PATTERNS.md` — §1.4 (attributes-vs-blobs — default to attributes), §3 (lifecycle), §4 (identity/mapping), §5 (manager integration — **§5.4 centralized pull vs entity-embedded**), §6 (batch registration). All canonical code patterns live here.
- `ludeo-integration-docs/00-CRITICAL-REQUIREMENTS.md` — CR-001 (`#if LUDEO_SDK_ENABLED` guards), CR-002 (Enter/Leave pairing via `ObjectScope`)
- `ludeo-integration-docs/research-context/02F-RESEARCH-SAVE-SYSTEM.md` — per-entity reconciliation vs manual
- `ludeo-integration-docs/11-TROUBLESHOOTING.md` — runtime failure modes (especially §1 attribute type-locking) to check against a live capture after wiring

## Your Task

> ⚠️ **Verify every `ludeo_*` signature against the cloned SDK headers before emitting it.** The canonical snippets in `06-TRACKING-PATTERNS.md` (`§3.2` CreateObject, `§3.4` DestroyObject, `§4.3` the adapter, `§7` actions) show the *shape* of each call, but the skill clones the **latest** SDK release, so exact parameter lists, struct fields, `*_API_LATEST` macro names, and the `LudeoBool` vs `LudeoResult` return types can drift. Open `Include/Ludeo/DataWriter.h` + `DataWriterTypes.h` in the clone and confirm — e.g. the `Set*` setters take `(attributeName, value)` against the current object context and return `LudeoBool`, while `CreateObject`/`DestroyObject`/`SendAction` take the writer handle + a params struct and return `LudeoResult`. Don't paste a signature you haven't checked.

### Step 1: Read the Plan

Read `ludeo-integration-plan/OBJECT_TRACKING.md`. Extract per entity:
- Class FQN, codebase pattern (§2.x reference)
- Creation / destruction hooks (file:line)
- Stable ID source field
- Properties with kind + strategy
- Restoration approach (reconciliation / manual)

Also extract the Codebase Pattern Summary, Batch Registration Sites, and Cross-Entity References tables.

Skip entities with unresolved Open Questions — confirm with the user before generating code for them.

### Step 1.5: Choose the Implementation Style

There are two valid ways to wire tracking (see `06-TRACKING-PATTERNS.md §5.4`). Decide up front — it changes where Steps 3–5 put code:

- **Entity-embedded** (default for most games): `RegisterWithLudeo()`/`UnregisterFromLudeo()` and `LUDEO_CAPTURE_*` macros live inside the entity classes; entities push their own state. Use when state changes through setters/events you can hook precisely, accessors are missing or expensive, or object lifetimes are irregular.
- **Centralized pull adapter**: all SDK calls live in `LudeoStateAdapter`, which iterates the game's objects through their existing public getters and pulls state. **Touches zero game files.** Prefer this when objects come from a manager/factory (§2.2) with clean accessors, you already batch-register at session start, and the codebase wants "no SDK calls outside the integration module" (CR-009's spirit).

You may mix: pull for clean manager-owned entities, embedded for the awkward ones. State the chosen style (per subsystem if mixed) and confirm with the user before generating code. If centralized-pull is chosen, Steps 3–5 happen **inside the adapter** rather than in entity classes — the identity, gating, `ObjectScope`, and `#if LUDEO_SDK_ENABLED` rules are identical, just centralized.

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

Emit each property as a **discrete typed `LUDEO_CAPTURE_*` attribute** — the default for every property. Do not serialize an object into one blob string and capture that, and do not ask the user which approach to use. The only exceptions are entities the plan explicitly flagged for blob storage (because the user asked, or the state is genuinely opaque/unmappable per `06 §1.4`); for those, follow the plan. If you hit a property that seems to need a blob but the plan didn't flag it, capture what you can as attributes and note it for review rather than silently switching approaches.

Critical discipline:
- All `LUDEO_CAPTURE_*` calls go *after* the game-state mutation, not before.
- Reference fields capture `target ? target->GetEntityId() : 0`, never `(uintptr_t)target`.
- Don't add session/active-tracking guards at call sites — the macro handles them.

### Step 6: Wire Batch Registration for Pre-Existing Objects

For each entry in the plan's *Batch Registration Sites* table, add a walker in `LudeoStateAdapter::RegisterAllExistingObjects()` per `06 §6.2`. Call it from the identified hook (typically `OnLevelLoadComplete`), gated by `!LudeoManager::Get().IsRestoring()` so that once restoration (phase 5 · tasks 3–4) is wired, this hook won't double-register objects that restoration recreates.

**`IsRestoring()` does not exist yet in a phase-9-only integration** — restoration is built later, so there is nothing behind it now. Add a **forward-compatible stub** on `LudeoManager` so the gate is a no-op today and correct once phase 5 · tasks 3–4 lands; don't invent a different check:

```cpp
#if LUDEO_SDK_ENABLED
    // Returns false until restoration (phase 5 · tasks 3–4) sets m_is_restoring true while
    // a Ludeo replay is being reconstructed. Gates batch registration so we don't
    // double-register objects that restoration will recreate.
    bool IsRestoring() const { return m_is_restoring; }
private:
    bool m_is_restoring = false;  // set by the restoration phase, not here
#endif
```

Propose this stub as part of the batch-registration change. Do not gate on a pending-ludeo id or other ad-hoc signal — `IsRestoring()` is the seam the later phases expect.

> **⚠️ Capture the world/session ENTRY IDENTITY here — restoration's first step depends on it.** From the `phase 4` map, emit the singleton world/session metadata object (level/map id, `start_mode`, save slot, or the procedural `RunMetadata` inputs) as one-shot identity captures. The restoration phase reads it back **before** anything else to decide which level to reach (`07 §2.2`, `read_entry_identity`); you can only restore what this phase wrote. **Corollary — adding *or renaming* any captured attribute (here or in a later phase) invalidates every previously captured Ludeo for that attribute: there is no migration.** A Ludeo captured before the entry-identity attribute existed reads back empty — distinct from a genuine "level not found" (see `07`). After any capture-schema change, **re-capture** before testing restore; a fresh run re-samples valid data.

### Step 7: Reconciliation Wiring (Per-Entity, Only Where the Matrix Says So)

For entities marked **reconciliation** in `GAME_ANALYSIS_SAVE_SYSTEM.md §8.1`: locate the entity's existing `Serialize`/`Save` method and add a Ludeo capture that mirrors the fields it writes. For **manual** entities, all writes are explicit per Step 5 — no reconciliation wiring.

> ⚠️ **Reconciliation only applies when the save writes named fields.** If the entity's `Serialize`/`Save` produces an opaque/packed blob rather than discrete named fields, you **cannot** mirror it into Ludeo's named-attribute API — capture discrete attributes (Step 5) instead and treat the entity as manual, regardless of what the matrix says. If you find a "reconciliation" entry that actually serializes a blob, flag it for the user rather than wiring a blob-mirroring capture (`02F §8`, `06 §1.4`).

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
1. Run `phase 3 · task 5` to verify clean compile both with and without LUDEO_SDK_ENABLED
2. Capture a real session and verify it contains the expected objects + attributes — a clean compile does not prove tracking works. Search the capture/session log for `Expected type` (attribute type-lock mismatches are dropped silently at runtime; see `11-TROUBLESHOOTING.md §1`).
3. Run `phase 5 · task 2` next
```

## Important Notes

- **Propose-confirm-execute** for every change. The two new files (`LudeoCaptureMacros.h`, `LudeoStateAdapter`) are project-wide infrastructure — get explicit approval before creating.
- Every SDK call wrapped in `#if LUDEO_SDK_ENABLED` (CR-001).
- `EnterObject` / `LeaveObject` paired only via `ObjectScope` (CR-002) — the macros enforce this; don't hand-pair.
- **Attributes by default, not blobs** — emit discrete typed `LUDEO_CAPTURE_*` calls (06 §1.4). Use blob/serialized storage only for entities the plan explicitly flagged; don't ask the user per property.
- Track stable game IDs for references, never pointers (06 §4).
- Update game state first, then track.
- Do not modify game logic — only add SDK calls. If a hook site doesn't exist, propose adding it as a separate, named change first.
- Match `objectType` strings exactly to `OBJECT_TRACKING.md` — restoration looks them up by name.

## Related Phases

- `phase 4` — produces the plan this command consumes (run FIRST)
- `phase 3 · task 5` — run after to verify compilation
- `phase 5 · task 2` — consumes the same plan + stable-ID strategy

## ✅ Exit gate — rebuild + run (REQUIRED — do not advance without it)

This phase edited source files, so it is **not done** until the game still builds and runs. The agent
cannot see a running game, so this gate falls to the integrator — make the ask explicit and wait:

1. **Rebuild** and confirm a **clean build with `LUDEO_SDK_ENABLED=1` and `=0`** — run the build-and-fix
   loop in `phase 3 · task 5` and read the build log.
2. **Run the game and confirm it still runs** — enter gameplay, verify registration logs at gameplay
   session begin, then sample a **real capture** and confirm planned objects + attributes are present
   (and none were dropped). Check the log for `Expected type` (server-side type-locking;
   `11-TROUBLESHOOTING.md §1`). A clean build does **not** prove tracking works — the log is the evidence.

The agent reads build/run logs where they exist but **cannot truly verify** a clean build or a live run
on its own — beyond the logs it relies on the integrator's word, and if they confirm without checking,
that's their call. **Do not offer to advance until the user confirms both** (or explicitly skips). Then
run `phase 5 · task 2`.
