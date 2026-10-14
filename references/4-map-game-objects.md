# Phase 4 — Map Game Objects

Plan what the integration tracks, in two parts. **Part A — the census** (run once, here): the codebase patterns,
**every** candidate entity type, which ones are load-bearing, and a **wave plan** that assigns each type to a wave.
**Part B — the deep scope** (run **per wave**, by `phase 5 · task 0` — [`5a-deep-scope-wave.md`](5a-deep-scope-wave.md)):
for one wave's types, the stable ids, every property, hook sites, references and the restoration approach. The
census is human-approved before any capture code is written; each wave's deep scope is approved when its turn comes.
The model behind the split is `06-TRACKING-PATTERNS.md §1.5`.

## 🚦 Fresh Context Check

This is a sequential workflow — continuing to phase 4 in the **same session as earlier phases is normal**; do **not** stop just because prior phases ran here. Only stop if **phase 4** was already completed in this conversation and you're about to redo/regenerate its output — then confirm with the user first. If context has grown very large you may *suggest* a fresh session, but it is not required.

## Engine Scope

Proprietary C++ engines only. If the game uses Unity or Unreal, stop — use the engine-specific guide instead.

## Prerequisites

**From the intake** (`ludeo-integration-plan/integration.json` → `intake`; [`know-your-game.md`](know-your-game.md)) — `profile` picks the `game-patterns/` files (and `hasBosses` → `bosses.md`); every
`visiblePlayerState.firstFrameRequired` item must be mapped; every `dynamicPhaseMetadata` value that changes or must
be restored is an attribute on the world/session object; every `scriptedSystems` entry with `kind: "trail"` and
`loadBearing` — and every `scriptedSystems.missionProps` entry — is mapped for the first wave, never deferred;
`dynamicPhaseMetadata.staticMetadata` goes on the world/session object once; `visiblePlayerState.deferrable` items may
be deferred to a later wave.

> ⚠️ **REQUIRED:** These must complete first:
> 1. `phase 2` → `ludeo-integration-plan/CODE_MAP.json`
> 2. `phase 3 · task 1` → `SDK_INTEGRATION_POINTS.json`
> 3. `phase 3 · task 6` (Classify Save System) → `GAME_ANALYSIS_SAVE_SYSTEM.md` + `CODE_MAP.save_system.group`. If these don't exist, run `phase 3 · task 6` first — no other phase produces them.
>
> **Recommended:** If `TDD_<GameName>.md` exists, read its **State Capture** section.

## Context Files

**Action Required:** Read the following files. Do not assume they are in context.

- `ludeo-integration-docs/06-TRACKING-PATTERNS.md` — §1.4 (attributes-vs-blobs — default to attributes), §1.5 (waves, census, load-bearing types), §2 (codebase pattern classification), §4 (identity & references), §9 (what-to-track decision flow, §9.6 the per-field disposition). These are the core inputs to this command.
- `ludeo-integration-docs/research-context/02B-RESEARCH-OBJECTS.md` — entity inventory template
- `ludeo-integration-docs/research-context/02F-RESEARCH-SAVE-SYSTEM.md` — per-entity reconciliation vs manual matrix
- `ludeo-integration-docs/game-patterns/INDEX.md` — genre tracking checklists (§3 of each genre file)

---

## Part A — Census (run once, in this phase)

### Step A1: Read Prior Artifacts

From `ludeo-integration-plan/`:
- `CODE_MAP.json` → engine, language, `core_classes`, `save_system`, `event_systems`, `ai`
- `SDK_INTEGRATION_POINTS.json` → session boundaries
- `GAME_ANALYSIS_SAVE_SYSTEM.md` → per-entity restoration matrix
- `TDD_<GameName>.md` (if present) → existing State Capture decisions

### Step A2: Classify the Codebase Pattern (Foundation)

Apply the decision flow in `06-TRACKING-PATTERNS.md §2.9` to identify which of §2.1–§2.8 patterns the game uses. Most games mix 2–3 patterns; classify **per subsystem**.

For each pattern identified, record from §2:
- Creation hook, destruction hook (file:line)
- Property-change hook strategy (setters / events / per-tick diff)
- Batch enumeration path (the iterator for pre-existing objects)
- Pattern-specific pitfalls that apply

### Step A3: Determine Genre & Load Tracking Checklist

- Use the intake's `profile.genres`; only if it's empty, web search `"<game_name>" game genre` and ask the user if that fails. (`phase 6 · task 1` uses the same genre.)
- Read `game-patterns/INDEX.md`, load matching genre file(s), `common.md`, and `bosses.md` when the game has boss encounters.
- **If `CODE_MAP.session_boundaries` has the sub-structure `{ model, start_sites[], exit_sites[], pause_overlay[] }`** (no per-level scenes), also load **both** structural files: `game-patterns/open-world.md` and `game-patterns/open-world-tracking.md`. They are structural, not genre — they don't replace the genre tracking checklist. `open-world.md` tells you the session spans the whole live run, which affects how `pre-existing-at-load` is interpreted (the run's "load" is the new-game / load-save moment, not a level load) and which entities are pre-existing vs. dynamically spawned during the run. `open-world-tracking.md` is the tracking delta you need *here*: presence ≠ existence (don't unregister on stream-out), world/cell object types, persistent-world-ID identity across stream cycles, and scoping the tracked set to the loaded neighborhood rather than the whole save.
- **If `CODE_MAP.session_boundaries.assembly == "procedural"`** (roguelike / procedural dungeon / wave-survival — the level is a container, content assembled at load from data + RNG), also load `game-patterns/procedural-world.md`. The tracking delta you need *here*: capturing "which level" can't relocate the moment (reload yields an empty container and **re-rolls** content), so add a singleton **`RunMetadata`** object type (§3) capturing the **generation inputs** — selection id (room/chunk/seed), sub-roll id (encounter/wave-set), progress cursor (wave/depth), scaling counter (combat level), and — if the generator rolls it independently of the content — the **placement / spatial frame** (§3) — as **stable game ids/values**, and decide seed-vs-resolved capture (§4, default resolved). First answer §2.1's decisive question: if **one** room is live at a time, `RunMetadata` alone is the container; if **several** rooms stay live/navigable, this is **procedural ∩ open-world** — also load `open-world-tracking.md` and add the **layout/connectivity** + per-room **`RoomDelta`** object types, or back-tracking restores into empty rooms.

Use §3 (Tracking Checklist) of each genre file as a **validation checklist** — what *should* be tracked for this genre. Actual hook sites and field names still come from the codebase.

### Step A4: Enumerate Every Candidate Entity Type

Combine the genre checklist with codebase discovery. Apply `06-TRACKING-PATTERNS.md §9.2` to each candidate: visible? influences a tracked object? referenced by a tracked object? If any → it's in the census. The census is **shallow but complete**: every subsystem appears, so nothing goes unseen; per type, record class, file:line, spawn pattern (dynamic / placed / both), and a one-line note of its candidate fields. Deep detail waits for Part B.

> **Look for the singletons on managers, not just on entities.** The **time-base / continuity** state (game clock, timers, the music position for time-driven games — `06 §10.6`) and the **soundtrack** (which track is playing — `06 §1.2`; `07 §8.5` restarts it on restore) usually live on a game or audio manager, not on any spawned entity. Census them as their own types.

> **⚠️ Always include a world/session ENTRY-IDENTITY object — every game, not just procedural/open-world.** Restoration reaches active gameplay on the captured level before it applies anything (`07 §2.1`), and it reads *which* level/map or run to boot **from the captured Ludeo** (`07 §2.2`, `read_entry_identity`) — validation even ignores a selection without it. Capture must include it: the level/map id (or `start_mode` / `room_x` / `room_y` / save slot) for scene/state-machine games — the procedural `RunMetadata` selection id and the open-world persistent-region id are the genre-specific shapes of the same thing. It is always **load-bearing, wave 1**.

### Step A5: Flag Load-Bearing Types and Assign Waves

Per `06 §1.5`:
- **Load-bearing** — the restore can't stand up without it: the entry identity, the player, the time-base singleton when the moment is time-driven, the collections the moment is visibly wrong without (the enemies in the fight, the doors that gate the route), and everything the intake marked as first-frame-required or load-bearing. Load-bearing types are **never deferred**.
- **Wave 1 = the restorable spine + the must-have set.** Every other type gets a later wave and a one-line reason (enrichment, in-flight attacks — `06 §9.7`, cosmetic environment).
- Waves apply to **every** game, small or large — they are delivery order, not a fidelity compromise. The destination is still full reconstruction (`06 §1.1`).

### Step A6: Write the Census and Halt for Review

Write `ludeo-integration-plan/OBJECT_TRACKING.md` with the Part A sections (schema in **Output** below): header,
`## Codebase Pattern Summary`, `## Batch Registration Sites` (known so far), `## Object Type Census`,
`## Wave Rollout`, `## Genre Coverage Check`. Then summarize for the user and ask them to review:
1. Codebase patterns + hook sites
2. Type coverage (missing / over-tracked)
3. The load-bearing flags
4. The wave order, and what wave 1 contains — **walk the restore with only wave 1's types**: would that alone
   produce a coherent moment (the right level, the player in place, the fight the viewer chose)? If not, something
   load-bearing is in a later wave.
5. Low-confidence entries

**Do not start phase 5 until the user approves the census.** Record the approval in the state file's `decisions`.
This gate prevents generating capture code against a misunderstood entity model.

---

## Part B — Deep-Scope Procedure (run per wave, by `phase 5 · task 0`)

Run for **one wave's types only** (`5a-deep-scope-wave.md` says how it's invoked). Append; never rewrite earlier
waves' blocks. Of the Part A tables, only `## Batch Registration Sites` (B6) and `## Time-Base / Continuity` (B1) grow
per wave; the census, wave plan and pattern summary don't change outside a census review.

### Step B1: Time-Base / Continuity Fields

If this wave owns the time-base singleton (normally wave 1): the game clock, timers (captured as deltas), the music
position for time-driven games — `06 §10.6`.

### Step B2: Pin a Stable ID per Entity Type

Per `06-TRACKING-PATTERNS.md §4.2`: stable game IDs (`entity_id`, `blueprint_id`, GUID, player profile ID) — never pointers, raw handles, or pool indices.

Record the ID field + file:line of assignment. If a class lacks a stable ID, flag it as an open question — adding one is a prerequisite for tracking.

### Step B3: Inventory Properties per Entity

**Sweep the entity's whole subsystem** — its class, its components, and the managers that hold its state (inventory, skills, progression, equipment for a player) — not just the census class. Note whether it has **dynamically-attached sub-components** (they often defeat reflection-based serialization). For each property, classify its kind: `identity | static | dynamic-continuous | dynamic-discrete | event-driven | reference`, and give **every field a disposition** — `capture | defer → wave M | exclude (static / settings / derivable)` — recording the tally (`06 §9.6`). Apply `06 §9.3` (incl. the visible-constant exception) to decide what to keep.

Capture each property as a **discrete typed attribute by default** — this is the assumed approach for every entity. Do **not** plan blob/serialized-buffer storage, and do not ask the user which to use, unless the user explicitly requested blobs or an entity genuinely warrants one (opaque/large/no stable field schema). See `06-TRACKING-PATTERNS.md §1.4` for the rule and the narrow exceptions; if an exception applies, record the entity + the specific reason under that entity's Open Questions rather than pausing for an answer. Opaque enums and ids get a readable `_name` companion (`06 §1.6`).

For each kept property pick the write strategy: `one-shot | per-tick | per-change | event-driven | debounced`. Default rules:
- Identity / static → one-shot at registration
- Position / rotation / velocity → per-tick (or debounced if the game is very large)
- Health / ammo / score → per-change (setters)
- Current weapon / active buff → event-driven
- References → per-change, **capture the target's stable game ID** (per §4.4)

### Step B4: Map Cross-Entity References

For every reference-kind property, fill a row in the Cross-Entity References table (From / To / Field / Capture / Restoration). This is the input to two-pass restoration (`07-RESTORATION-PATTERNS.md §3`). Missing entries silently break reference resolution. A reference into a type of a **later** wave is either pulled into this wave (load-bearing) or marked deferred — never dropped.

### Step B5: Apply Save-System Per-Entity Matrix

Look up each entity in `GAME_ANALYSIS_SAVE_SYSTEM.md §8.1`:
- **reconciliation** → tracking will mirror the game's save plumbing
- **manual** → tracking will write each property explicitly

> ⚠️ **A strong save system does not mean reconciliation.** Reconciliation only works when the game serializes to **named fields** that map onto Ludeo's named attributes. A binary/packed/opaque blob save (e.g. a rewind/replay buffer) is **not** reusable as reconciliation even if it's excellent — and it may not even be active in the mode you're capturing. When the save is opaque, mark the entity **manual** and capture discrete attributes (`06 §1.4`). This is often the single most consequential call in this phase — don't default to reconciliation just because a save system exists. See `02F §8`.

If an entity isn't in the matrix, add it there before continuing.

### Step B6: Identify Batch Registration Path

For each entity type with design-time placed instances, record the iterator + the hook function (typically `OnLevelLoadComplete`, after gameplay session begin) per `06-TRACKING-PATTERNS.md §6`, and **append the row to `## Batch Registration Sites`** — `phase 5 · task 1` builds its batch walkers only from that table.

### Step B7: Confidence + Open Questions

Tag each entity row `high | medium | low`. Low-confidence rows go in "Needs Human Review". Genuine ambiguities go in "Open Questions" per entity. Return them to the phase-5 orchestrator, which runs the wave's review gate.

---

## Output

`ludeo-integration-plan/OBJECT_TRACKING.md` — Part A writes the header and the census sections; each wave's Part B
appends its entity blocks and extends the references:

```markdown
# Object Tracking Plan — <GameName>

**Engine:** <name>
**Save-system group:** <1 | 2 | 3>
**Codebase patterns:** <e.g., §2.1+§2.2 for entities, §2.4 for projectiles>
**Assembly:** <authored | procedural (RunMetadata captured)>
**Types in census:** X   **Waves:** N   **Pending human review**

## Codebase Pattern Summary            ← Part A
| Subsystem | Pattern | Creation Hook | Destruction Hook | Property-Change Hook |
|---|---|---|---|---|

## Object Type Census                  ← Part A
| Type | Class (file:line) | Spawn pattern | Load-bearing? | Wave | Candidate fields (one line) | Confidence |
|---|---|---|---|---|---|---|
| WorldSession | src/world/Session.h:12 | singleton | yes — entry identity | 1 | level id, time-base | high |

## Wave Rollout                        ← Part A
| Wave | Types | Why this wave |
|---|---|---|
| 1 | WorldSession, Player, Enemy, Door | restorable spine + must-have set |
| 2 | Pickup, Projectile | enrichment; in-flight attacks (06 §9.7) |

## Batch Registration Sites           ← Part A (known so far) + Part B
| Iterator | Hook | File:Line |
|---|---|---|

## Entity: <EntityType>   (wave: N)   ← Part B, appended per wave
- Class / file:line / Pattern (§2.x) / Spawn pattern
- Stable ID source: `<field>` at `<file:line>`
- Restoration approach: <reconciliation | manual>
- Dynamically-attached sub-components: <yes | no>
- Pre-existing-at-load: <yes | no>
- Swept from: <class + components + managers>
- Field disposition: N = C captured + D deferred + X excluded
- Confidence: <high | medium | low>

### Hook Sites
| Hook | File:Line | Notes |
|---|---|---|
| Creation | ... | After full construction |
| Destruction | ... | Before generation bump / delete |

### Properties
| Property | Kind | Type | Source (file:line) | Strategy | Disposition | Reference to | Notes |
|---|---|---|---|---|---|---|---|

### Open Questions
- ...

## Time-Base / Continuity             ← Part B (the wave that owns it)
| Field | Source | Captured as |
|---|---|---|

## Cross-Entity References            ← Part B, extended per wave
| From | To | Field | Capture | Restoration | Wave |
|---|---|---|---|---|---|

## Genre Coverage Check                ← Part A
| Genre catalog item | In code? | Tracked? (wave) | Notes |
|---|---|---|---|

## Needs Human Review (Low Confidence)
| Candidate | Reason | Action |
|---|---|---|
```

May also update `GAME_ANALYSIS_SAVE_SYSTEM.md §8.1` when Part B surfaces new entities.

## Important Notes

- **Attributes by default, not blobs** — plan discrete typed attributes for every entity (06 §1.4). Reach for a serialized blob only if the user asked or an entity is genuinely opaque/unmappable; record the reason in Open Questions and keep going — don't ask the user per entity.
- **Pattern classification is foundational** — get §2 right or every downstream hook decision is wrong.
- **Stable game IDs only** — restoration cannot resolve pointers across sessions.
- **When in doubt, track it** — over-tracking is cheap; under-tracking produces silently broken replays (06 §9.1).
- **Full state tracking is Ludeo's defining purpose, not a scoping choice** (06 §1.1). Do **not** ask the user "do you want full or partial tracking?" — the SDK exists for perfect replay from the player's POV. The waves are **delivery order** for every game, not a way to stop short: every type in the census is scheduled, and load-bearing types are never deferred.
- **Genre checklists are validation lists** — what to verify is covered, not how to find it in the code.
- **Mixed patterns per game are normal** — classify per subsystem.

## Related Phases

- `phase 2` (run FIRST), `phase 3 · task 1`
- `phase 6 · task 1` — sibling discovery command for discrete events
- `phase 5` — [`5-tracking-restore-orchestrator.md`](5-tracking-restore-orchestrator.md) runs the waves; its task 0 ([`5a-deep-scope-wave.md`](5a-deep-scope-wave.md)) runs Part B

## Next Steps

1. Review the census and wave plan with the user (Step A6)
2. Resolve open questions + low-confidence entries
3. Confirm approval
4. Start phase 5 — [`5-tracking-restore-orchestrator.md`](5-tracking-restore-orchestrator.md), wave 1
