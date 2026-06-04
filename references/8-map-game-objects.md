# Map Game Objects - Discover Trackable Entities & Properties

Analyze the game codebase to produce an Object Tracking Plan: codebase pattern, entity types to track, properties per entity, hook sites for SDK calls, and the stable-ID strategy that ties tracking to restoration. Human-approved before any code is generated.

## 🚦 Fresh Context Check

This is a sequential workflow — continuing to phase 8 in the **same session as earlier phases is normal**; do **not** stop just because prior phases ran here. Only stop if **phase 8** was already completed in this conversation and you're about to redo/regenerate its output — then confirm with the user first. If context has grown very large you may *suggest* a fresh session, but it is not required.

## Engine Scope

Proprietary C++ engines only. If the game uses Unity or Unreal, stop — use the engine-specific guide instead.

## Prerequisites

> ⚠️ **REQUIRED:** These must complete first:
> 1. `phase 1` → `ludeo-integration-plan/CODE_MAP.json`
> 2. `phase 2` → `SDK_INTEGRATION_POINTS.json`
> 3. `phase 2c` (Classify Save System) → `GAME_ANALYSIS_SAVE_SYSTEM.md` + `CODE_MAP.save_system.group`. If these don't exist, run `phase 2c` first — no other phase produces them.
>
> **Recommended:** If `TDD_<GameName>.md` exists, read its **State Capture** section.

## Context Files

**Action Required:** Read the following files. Do not assume they are in context.

- `ludeo-integration-docs/06-TRACKING-PATTERNS.md` — §1.4 (attributes-vs-blobs — default to attributes), §2 (codebase pattern classification), §4 (identity & references), §9 (what-to-track decision flow). These are the core inputs to this command.
- `ludeo-integration-docs/research-context/02B-RESEARCH-OBJECTS.md` — entity inventory template
- `ludeo-integration-docs/research-context/02F-RESEARCH-SAVE-SYSTEM.md` — per-entity reconciliation vs manual matrix
- `ludeo-integration-docs/game-patterns/INDEX.md` — genre tracking checklists (§3 of each genre file)

## Your Task

### Step 1: Read Prior Artifacts

From `ludeo-integration-plan/`:
- `CODE_MAP.json` → engine, language, `core_classes`, `save_system`, `event_systems`, `ai`
- `SDK_INTEGRATION_POINTS.json` → session boundaries
- `GAME_ANALYSIS_SAVE_SYSTEM.md` → per-entity restoration matrix
- `TDD_<GameName>.md` (if present) → existing State Capture decisions

### Step 2: Classify the Codebase Pattern (Foundation)

Apply the decision flow in `06-TRACKING-PATTERNS.md §2.9` to identify which of §2.1–§2.8 patterns the game uses. Most games mix 2–3 patterns; classify **per subsystem**.

For each pattern identified, record from §2:
- Creation hook, destruction hook (file:line)
- Property-change hook strategy (setters / events / per-tick diff)
- Batch enumeration path (the iterator for pre-existing objects)
- Pattern-specific pitfalls that apply

### Step 3: Determine Genre & Load Tracking Checklist

Same flow as `phase 6`:
- Web search `"<game_name>" game genre`; ask the user if web search fails.
- Read `game-patterns/INDEX.md`, load matching genre file(s).
- **If `CODE_MAP.session_boundaries` has the sub-structure `{ model, start_sites[], exit_sites[], pause_overlay[] }`** (no per-level scenes), also load **both** structural files: `game-patterns/open-world.md` and `game-patterns/open-world-tracking.md`. They are structural, not genre — they don't replace the genre tracking checklist. `open-world.md` tells you the session spans the whole live run, which affects how `pre-existing-at-load` is interpreted (the run's "load" is the new-game / load-save moment, not a level load) and which entities are pre-existing vs. dynamically spawned during the run. `open-world-tracking.md` is the tracking delta you need *here*: presence ≠ existence (don't unregister on stream-out), world/cell object types, persistent-world-ID identity across stream cycles, and scoping the tracked set to the loaded neighborhood rather than the whole save.

Use §3 (Tracking Checklist) of each genre file as a **validation checklist** — what *should* be tracked for this genre. Actual hook sites and field names still come from the codebase.

### Step 4: Discover Trackable Entity Types

Combine genre checklist with codebase discovery. Apply `06-TRACKING-PATTERNS.md §9.2` decision flow to each candidate: visible? influences a tracked object? referenced by a tracked object? If any → track. Otherwise skip.

For each entity, record class, file:line, spawn pattern (dynamic / placed / both), and whether it has dynamically-attached sub-components (these often defeat reflection-based serialization).

### Step 5: Pin a Stable ID per Entity Type

Per `06-TRACKING-PATTERNS.md §4.2`: stable game IDs (`entity_id`, `blueprint_id`, GUID, player profile ID) — never pointers, raw handles, or pool indices.

Record the ID field + file:line of assignment. If a class lacks a stable ID, flag it as an open question — adding one is a prerequisite for tracking.

### Step 6: Inventory Properties per Entity

For each entity, list properties and classify each kind: `identity | static | dynamic-continuous | dynamic-discrete | event-driven | reference`. Apply `06 §9.3` to decide what to keep.

Capture each property as a **discrete typed attribute by default** — this is the assumed approach for every entity. Do **not** plan blob/serialized-buffer storage, and do not ask the user which to use, unless the user explicitly requested blobs or an entity genuinely warrants one (opaque/large/no stable field schema). See `06-TRACKING-PATTERNS.md §1.4` for the rule and the narrow exceptions; if an exception applies, record the entity + the specific reason under that entity's Open Questions rather than pausing for an answer.

For each kept property pick the write strategy: `one-shot | per-tick | per-change | event-driven | debounced`. Default rules:
- Identity / static → one-shot at registration
- Position / rotation / velocity → per-tick (or debounced if the game is very large)
- Health / ammo / score → per-change (setters)
- Current weapon / active buff → event-driven
- References → per-change, **capture the target's stable game ID** (per §4.4)

### Step 7: Map Cross-Entity References

For every reference-kind property, fill a row in the Cross-Entity References table (From / To / Field / Capture / Restoration). This is the input to two-pass restoration (`07-RESTORATION-PATTERNS.md §3`). Missing entries silently break reference resolution.

### Step 8: Apply Save-System Per-Entity Matrix

Look up each entity in `GAME_ANALYSIS_SAVE_SYSTEM.md §8.1`:
- **reconciliation** → tracking will mirror the game's save plumbing
- **manual** → tracking will write each property explicitly

> ⚠️ **A strong save system does not mean reconciliation.** Reconciliation only works when the game serializes to **named fields** that map onto Ludeo's named attributes. A binary/packed/opaque blob save (e.g. a rewind/replay buffer) is **not** reusable as reconciliation even if it's excellent — and it may not even be active in the mode you're capturing. When the save is opaque, mark the entity **manual** and capture discrete attributes (`06 §1.4`). This is often the single most consequential call in this phase — don't default to reconciliation just because a save system exists. See `02F §8`.

If an entity isn't in the matrix, add it there before continuing.

### Step 9: Identify Batch Registration Path

For each entity type with design-time placed instances, record the iterator + the hook function (typically `OnLevelLoadComplete`, after gameplay session begin) per `06-TRACKING-PATTERNS.md §6`.

### Step 10: Confidence + Open Questions

Tag each entity row `high | medium | low`. Low-confidence rows go in a "Needs Human Review" section. Genuine ambiguities go in "Open Questions" per entity.

### Step 11: Produce Output

Write `ludeo-integration-plan/OBJECT_TRACKING.md`:

```markdown
# Object Tracking Plan — <GameName>

**Engine:** <name>
**Save-system group:** <1 | 2 | 3>
**Codebase patterns:** <e.g., §2.1+§2.2 for entities, §2.4 for projectiles>
**Entities:** X   **Properties:** Y   **Pending human review**

## Codebase Pattern Summary
| Subsystem | Pattern | Creation Hook | Destruction Hook | Property-Change Hook |
|---|---|---|---|---|
| ... | ... | ... | ... | ... |

## Batch Registration Sites
| Iterator | Hook | File:Line |
|---|---|---|
| ... | ... | ... |

## Entity: <EntityType>
- Class / file:line / Pattern (§2.x) / Spawn pattern
- Stable ID source: `<field>` at `<file:line>`
- Restoration approach: <reconciliation | manual>
- Dynamically-attached sub-components: <yes | no>
- Pre-existing-at-load: <yes | no>
- Confidence: <high | medium | low>

### Hook Sites
| Hook | File:Line | Notes |
|---|---|---|
| Creation | ... | After full construction |
| Destruction | ... | Before generation bump / delete |

### Properties
| Property | Kind | Type | Source (file:line) | Strategy | Reference to | Notes |
|---|---|---|---|---|---|---|
| ... | ... | ... | ... | ... | ... | ... |

### Open Questions
- ...

## Cross-Entity References
| From | To | Field | Capture | Restoration |
|---|---|---|---|---|
| ... | ... | ... | Track <Target>.EntityId | id-map lookup in Pass 2 |

## Genre Coverage Check
| Genre catalog item | In code? | Tracked? | Notes |
|---|---|---|---|
| ... | ... | ... | ... |

## Needs Human Review (Low Confidence)
| Candidate | Reason | Action |
|---|---|---|
| ... | ... | ... |
```

### Step 12: Halt for Human Review

After writing the plan, summarize for the user and ask them to review:
1. Codebase patterns + hook sites
2. Entity coverage (missing / over-tracked)
3. Stable ID strategy
4. Property kinds + write strategies
5. Cross-entity references
6. Open questions
7. Low-confidence entries

**Do not proceed to `phase 9` automatically.** This gate prevents generating tracking code against a misunderstood entity model.

## Output

| File | Purpose |
|------|---------|
| `ludeo-integration-plan/OBJECT_TRACKING.md` | Approved plan that `phase 9` consumes |

May also update `GAME_ANALYSIS_SAVE_SYSTEM.md §8.1` if new entities surfaced.

## Important Notes

- **Attributes by default, not blobs** — plan discrete typed attributes for every entity (06 §1.4). Reach for a serialized blob only if the user asked or an entity is genuinely opaque/unmappable; record the reason in Open Questions and keep going — don't ask the user per entity.
- **Pattern classification is foundational** — get §2 right or every downstream hook decision is wrong.
- **Stable game IDs only** — restoration cannot resolve pointers across sessions.
- **When in doubt, track it** — over-tracking is cheap; under-tracking produces silently broken replays (06 §9.1).
- **Full state tracking is Ludeo's defining purpose, not a scoping choice** (06 §1.1). Do **not** ask the user "do you want full or partial tracking?" — the SDK exists for perfect replay from the player's POV. For large games, a "critical state now, full coverage in the next wave" staging plan in `OBJECT_TRACKING.md` is legitimate; the negotiation is about *order of rollout*, not whether to reach complete coverage.
- **Genre checklists are validation lists** — what to verify is covered, not how to find it in the code.
- **Mixed patterns per game are normal** — classify per subsystem.

## Related Phases

- `phase 1` (run FIRST), `phase 2`
- `phase 6` — sibling discovery command for discrete events
- `phase 9` — consumes this plan after approval
- `phase 10` — also consumes this plan

## Next Steps

1. Review `OBJECT_TRACKING.md` with the user
2. Resolve open questions + low-confidence entries
3. Confirm approval
4. Run `phase 9`
