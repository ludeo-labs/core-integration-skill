# Phase 5 · Task 0 — Deep-Scope a Wave

> Runs **once per wave**, dispatched by [`5-tracking-restore-orchestrator.md`](5-tracking-restore-orchestrator.md).
> It executes phase 4's **Part B** procedure for this wave's types only and appends the result.

## 1. Goal / Purpose

Turn this wave's **census entries** (the object types tagged `wave: N` in `OBJECT_TRACKING.md`) into full entity
blocks: stable id, every property with its kind, type, write strategy and disposition, hook sites, cross-entity
references, the reconciliation-vs-manual approach, and batch-registration paths. What you append is exactly what this
wave's capture (task 1) writes and its restore (tasks 2 and 4) mirrors — **scoped to this wave**, so later waves'
types are untouched until their turn.

## 2. Inputs (Input Contract)

- [ ] **The wave** — its number `N` and the `objectType`s tagged `wave: N` (from the orchestrator).
- [ ] `ludeo-integration-plan/OBJECT_TRACKING.md` — the approved Part A census and wave plan, and the blocks earlier
      waves already appended (read them, so cross-wave references resolve and a shared type isn't duplicated).
- [ ] [`4-map-game-objects.md`](4-map-game-objects.md) → **Part B** — the procedure you run.
- [ ] `ludeo-integration-plan/CODE_MAP.json` (`core_classes`, `event_systems`, `session_boundaries`, `save_system`)
      and `GAME_ANALYSIS_SAVE_SYSTEM.md` (the per-entity matrix from `phase 3 · task 6`).
- [ ] `integration.json → intake` — the items phase 4's "From the intake" line says must be in a given wave.
- [ ] Context: `ludeo-integration-docs/06-TRACKING-PATTERNS.md` (§1.4–§1.6, §3, §4, §6, §9), the matching
      `game-patterns/<genre>.md` checklist, `open-world-tracking.md` if the world streams.

## 3. Steps

1. **Resolve the wave's type set** from the census. Wave 1 is the restorable spine (entry identity, player,
   time-base) plus the must-have collections; later waves are their assigned types.
2. **Run phase 4 Part B (Steps B1–B6), scoped to those types.** Sweep each entity's **whole subsystem** — the
   class, its components and the managers that hold its state — not just the census class, and give **every field a
   disposition** (`capture | defer → wave M | exclude`), with the tally (`06 §9.6`). Stopping at the anchor class, or
   listing only visibly changing fields, drops the invisible state that drives what happens next (`06 §9.1`).
3. **Resolve cross-wave references.** If a type in this wave references a type not yet captured, either pull the
   target into **this** wave (when the reference is load-bearing for this wave's replay — tell the orchestrator,
   since it changes the wave plan) or mark the reference **deferred to wave M**. Never drop it silently.
4. **Append, don't rewrite.** Add one `## Entity: <ObjectType> (wave: N)` block per type (schema in phase 4's
   output), extend `## Cross-Entity References`, and append this wave's entities to the per-entity save matrix.
   Leave earlier waves' blocks and the Part A tables unchanged.
5. **Return** a summary, the appended `objectType`s, and any questions for the user.

## 4. Questions to ask the human

Return them to the orchestrator; don't ask directly:
- A type whose stable id is unresolved.
- An entity whose "reconciliation" path actually serializes an opaque blob (treat it as manual — phase 4 Step B5).
- A load-bearing cross-wave reference that should reshape the wave plan.

## 5. Patterns to apply

- **Attributes by default, not blobs** (`06 §1.4`).
- **Stable game ids only** — never pointers, handles or pool indices (`06 §4.2`).
- **When in doubt, capture** — under-capture produces silently broken replays (`06 §9.1`).
- **Scope discipline** — only this wave's types; append-only.

## 6. Output Contract

- `OBJECT_TRACKING.md` — wave N's `## Entity` blocks appended; `## Cross-Entity References` extended.
- The per-entity save matrix — wave N's entities added (`GAME_ANALYSIS_SAVE_SYSTEM.md §8.1` /
  `CODE_MAP.save_system`).
- A return summary for the orchestrator.

## 7. ✅ Success Criteria

- [ ] Every type tagged `wave: N` has an entity block with a stable id, its hook sites and approach.
- [ ] Every field of those types has a disposition, with the tally recorded.
- [ ] Every cross-wave reference is pulled in or explicitly deferred.
- [ ] Earlier waves' blocks and the Part A tables are unchanged.

## 8. Common Mistakes

- **Deep-scoping the whole census at once** — later waves are scoped when their turn comes.
- **Rewriting earlier waves' blocks** — append only.
- **Listing only the fields that visibly change** — invisible forward-play state is lost.
- **Silently dropping a reference** into a type that isn't captured yet.
