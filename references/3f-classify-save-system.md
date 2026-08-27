# Phase 3 · Task 6 — Classify Save System

Classify the game's save/load system into one of three groups and record a per-entity restoration approach (reconciliation vs manual). This produces the artifacts that `phase 4` and `phase 5 · task 1` require — without this phase, those phases reference a classification that nothing produced.

## 🚦 Fresh Context Check

This is a sequential workflow — continuing to phase 3 · task 6 in the **same session as earlier phases is normal**; do **not** stop just because prior phases ran here. Only stop if **phase 3 · task 6** was already completed in this conversation and you're about to redo/regenerate its output — then confirm with the user first. If context has grown very large you may *suggest* a fresh session, but it is not required.

## Engine Scope

Proprietary C++ engines only. If the game uses Unity or Unreal, stop — use the engine-specific guide instead.

## Prerequisites

> **REQUIRED:** These must be complete before running this command:
> 1. `phase 2` → `ludeo-integration-plan/CODE_MAP.json` (provides the light `save_system` field and `core_classes`)
> 2. `phase 3 · task 1` → `ludeo-integration-plan/SDK_INTEGRATION_POINTS.json`
>
> **Recommended:** Run before `phase 4`. If `TDD_<GameName>.md` (phase 3 · task 2) already exists, its State Reconstruction section is provisional until this classification is done — reconcile any conflicts here.

## Context Files

**Action Required:** Read the following before starting. Docs live at `ludeo-integration-docs/` (relative to this workflow file).

- `ludeo-integration-docs/research-context/02F-RESEARCH-SAVE-SYSTEM.md` — **the procedure for this phase.** Detection greps (§3), questionnaire (§4), classification decision (§5), CODE_MAP schema (§6), validation (§7), and the per-entity reconciliation-vs-manual matrix (§8). Follow it end-to-end.
- `ludeo-integration-docs/research-context/02B-RESEARCH-OBJECTS.md` — entity list that feeds the §8.1 per-entity matrix.
- `ludeo-integration-docs/06-TRACKING-PATTERNS.md` §1.4 — why a great save system does **not** imply reconciliation (named-attribute constraint).

## Your Task

### Step 1: Read Prior Artifacts
From `ludeo-integration-plan/`: `CODE_MAP.json` (`save_system`, `core_classes`) and the entity inventory (from `02B`/phase 2).

### Step 2: Run the Classification
Execute `02F-RESEARCH-SAVE-SYSTEM.md` in order:
1. Run the detection greps (§3) and capture matches + counts.
2. Answer the questionnaire (§4) with file:line evidence; mark unknowns `?`.
3. Assign the group (§5): Group 1 (full save), Group 2 (checkpoint-only), or Group 3 (no gameplay-state save).
4. Cross-check against the validation checklist (§7) before locking it in.

### Step 3: Decide Per-Entity Approach
Fill the §8.1 matrix for each entity type: **reconciliation** or **manual**.

> ⚠️ **Do not default Group-1 games to reconciliation.** Reconciliation only works when the save serializes to **named fields** that map onto Ludeo attributes. A binary/packed/opaque blob save (e.g. a rewind/replay buffer) is **not** reusable as Ludeo reconciliation even if it's excellent — that entity is **manual**. See `02F §8` caveat and `06 §1.4`.

### Step 4: Write Outputs
- Write `ludeo-integration-plan/GAME_ANALYSIS_SAVE_SYSTEM.md` (narrative + §8.1 per-entity matrix).
- Merge the structured block into `ludeo-integration-plan/CODE_MAP.json → save_system` (schema in `02F §6`), including `save_system.group`.

### Step 5: Halt for Human Review
Summarize the group, the rationale, and the per-entity matrix. Ask the user to confirm the classification before downstream phases consume it (`02F §7` requires human sign-off).

## Output

| File | Purpose |
|------|---------|
| `ludeo-integration-plan/GAME_ANALYSIS_SAVE_SYSTEM.md` | Group classification + per-entity reconciliation/manual matrix (§8.1) |
| `ludeo-integration-plan/CODE_MAP.json → save_system` | Structured `group` + fields consumed by phase 4, phase 5 · task 1 (and later task 2) |

## Important Notes

- **Classification is a prerequisite, not a formality.** Misclassifying a Group-3 game as Group-1 wastes the entire restoration phase downstream (`02F §1`).
- **A strong save system ≠ reconciliation.** Check whether the save is field-named or opaque (`02F §8`, `06 §1.4`).
- **Per-entity overrides are normal.** A Group-1 game can still need manual restoration for specific entity types.

## Related Phases

- `phase 2` (run FIRST), `phase 3 · task 1`
- `phase 3 · task 2` — TDD; its reconstruction section is provisional until this classification exists
- `phase 4` — consumes `GAME_ANALYSIS_SAVE_SYSTEM.md` + `CODE_MAP.save_system.group` (run AFTER this)
- `phase 5 · task 1` — uses the per-entity matrix to decide reconciliation vs manual wiring

## Next Steps

1. Review the classification + per-entity matrix with the user
2. Resolve any `?` unknowns and validation gaps
3. Proceed to `phase 3 · task 3` (lifecycle) — the classification waits until `phase 4` needs it
