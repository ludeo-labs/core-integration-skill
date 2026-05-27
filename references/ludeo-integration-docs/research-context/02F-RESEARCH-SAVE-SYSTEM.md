# 02F-RESEARCH-SAVE-SYSTEM.md — Save System Classification

> **Purpose:** Classify the game's save/load system into one of three groups so
> that downstream stages can choose the right state-capture strategy.
> **For:** Save-System role (logically the same agent that does tracking/restoration)
> **Prerequisites:** `02A-RESEARCH-ARCHITECTURE.md` (helpful)
> **Output:** `CODE_MAP.json → save_system` block + `GAME_ANALYSIS_SAVE_SYSTEM.md`

**Last Updated:** May 2026

---

## 📋 Instructions

Run the detection patterns in Section 3, then complete the questionnaire in
Section 4. Use Section 5 to assign a group. Cross-check against the validation
checklist in Section 7 before locking the decision.

Write your findings to `ludeo-integration-plan/GAME_ANALYSIS_SAVE_SYSTEM.md`
and merge the structured fields into `CODE_MAP.json → save_system` (schema in
Section 6).

---

## 🧭 SECTION 1 — Why This Matters

The save-system group determines:

- **Which restoration approach is viable per entity type** (reconciliation vs manual)
- **Where AI assistance adds the most value** (Group 3 > Group 2 > Group 1)
- **How much state-capture code needs to be written from scratch**
- **Whether existing save infrastructure can be reused**
- **How brittle the integration is to future game changes**

Misclassifying a Group 3 game as Group 1 typically wastes the entire State
Restoration phase: code is generated that calls a serializer which only
persists settings, the playback is empty, and the symptom appears far
downstream during testing.

**Classify before designing anything downstream.**

---

## 🗂️ SECTION 2 — The Three Groups

### Group 1 — Full Save System

The game can serialize **arbitrary gameplay state at any point** in the
session. The save format covers entity positions, health, inventories, AI
state, world flags, etc. — not just settings or progress markers.

- **Typical signals:** A dedicated save subsystem with per-entity hooks; a
  game-wide save interface implemented by gameplay actors; a save format
  that includes per-frame-ish data.
- **Strategy:** Route Ludeo state through the existing save plumbing.
  Restoration is largely "load the saved blob, dispatch to entities."
- **Implementation cost:** Wiring, not invention. Lowest-novelty, highest-reliability.

### Group 2 — Checkpoint-Only Save System

The game has a save system, but it **only fires at predefined points**
(level transitions, save altars, autosave triggers). Arbitrary mid-session
state is not captured.

- **Typical signals:** `Checkpoint`, `SavePoint`, `AutoSave` classes;
  saving is gated by a manager that only allows it in specific zones;
  saved data is sparse (e.g., level + progress flags + inventory snapshot).
- **Strategy:** Extend the checkpoint system to be callable from arbitrary
  game states. May require relaxing constraints on what's "safe" to save.
- **Implementation cost:** Moderate. Identify the constraints, design extensions, wire.

### Group 3 — No Save System

No persistence beyond session, or persistence covers only settings /
progression metadata, not in-session gameplay state.

- **Typical signals:** Only `PlayerPrefs`-style persistence; no
  per-entity serialization hooks; "save" methods exist but only write
  level number + unlocks.
- **Strategy:** Build state capture from scratch. Define entity-by-entity
  what gets written, read, and applied.
- **Implementation cost:** Highest. No existing pattern to follow, but also no
  legacy constraints to honor.

---

## 🔍 SECTION 3 — Detection: Run These Greps First

Capture matches and counts. Empty results are themselves a signal (likely
Group 3).

### 3.1 Engine-Agnostic Patterns

```
# Save classes / interfaces
Grep "class\s+\w+\s*:\s*public\s+(USaveGame|ISaveable|ISaveLoad|ISerializable)"
Grep "interface\s+\w*Save\w*"

# Save / load entry points
Grep "(SaveGameToSlot|LoadGameFromSlot|AsyncSaveGameToSlot)"
Grep "(SaveToFile|LoadFromFile|Save\(|Load\()"
Grep "Serialize\(|Deserialize\("

# Persistence layers
Grep "(PlayerPrefs|EditorPrefs)\." --glob="*.cs"
Grep "(NSUserDefaults|SharedPreferences)"

# Checkpoint systems
Grep "(Checkpoint|SavePoint|AutoSave|QuickSave|HardSave)"

# Per-property opt-in (UE)
Grep "UPROPERTY\s*\([^)]*SaveGame"

# Per-property opt-in (Unity)
Grep "\[SerializeField\]" --glob="*.cs" -B 1   # often paired with custom serializer

# Custom serializers / blockers
Grep "(FFastArraySerializer|NetDeltaSerialize|Custom.*Serializer)"
Grep "override\s+(Serialize|ToJson|FromJson)"
```

### 3.2 What Each Result Means

| Pattern hits | Likely signal |
|---|---|
| Save classes + per-entity hooks + arbitrary save calls | Group 1 |
| Save classes BUT only called from checkpoint managers | Group 2 |
| Save classes BUT they only serialize progress / settings | Group 3 (verify) |
| Only `PlayerPrefs` / `UserDefaults` calls | Group 3 |
| Custom serializers / delta serializers on gameplay state | **Manual restoration likely needed** regardless of group |
| Per-property opt-in flags present but mostly unset on gameplay state | Group 3 in practice |

---

## ❓ SECTION 4 — Questionnaire

Answer each item. Capture file:line evidence when available. Unknowns are
fine — mark them `?` and they become questions for the human.

### 4.1 Existence of a Save System

- [ ] **Is there a class explicitly designated as the save container?**
  Class name: ____ &nbsp;&nbsp; File: ____
- [ ] **Is there a save interface that gameplay actors implement?**
  Interface: ____ &nbsp;&nbsp; Implementers (count): ____
- [ ] **Are there explicit save/load entry-point functions called from gameplay code?**
  Entry points (file:line):
  - ____
  - ____

### 4.2 Scope of What's Saved

- [ ] **Does the save format include per-entity gameplay state (position, health, inventory, AI state)?**
  - [ ] Yes — examples: ____
  - [ ] Partial — what's missing: ____
  - [ ] No — only settings / progress markers
- [ ] **What is the smallest unit that can be saved?**
  - [ ] Single entity property
  - [ ] Whole entity
  - [ ] Whole world snapshot
  - [ ] Other: ____
- [ ] **Can the save be triggered from arbitrary game states, or only at predefined points?**
  - [ ] Anywhere
  - [ ] Only at checkpoints / specific phases
  - [ ] Unknown

### 4.3 Trigger Conditions

- [ ] **When does the game save?**
  - [ ] On explicit player action (e.g., menu)
  - [ ] At checkpoints
  - [ ] Periodically (auto-save)
  - [ ] Never during a session
  - [ ] Other: ____
- [ ] **Are there restrictions on when save can fire (e.g., in combat, mid-cutscene)?**
  Restrictions: ____

### 4.4 Serialization Mechanism

- [ ] **How does the save system serialize state?**
  - [ ] Reflection over opt-in properties
  - [ ] Each class implements an explicit `Serialize(writer)` method
  - [ ] JSON / binary blob written by hand
  - [ ] Built-in language serialization (e.g., `JsonUtility`, `BinaryFormatter`)
  - [ ] Other: ____
- [ ] **Are there custom serializers on gameplay-relevant types** (delta serializers,
  fast-array serializers, hand-rolled `Serialize()` overrides)? These often
  block reflection-based approaches.
  - [ ] No
  - [ ] Yes — affected types: ____

### 4.5 Per-Property Opt-In

- [ ] **Do gameplay properties opt in to being saved** (e.g., per-property flag,
  attribute, or marker)?
  - [ ] Yes, comprehensively
  - [ ] Partially — only some classes
  - [ ] No — opt-in flags exist but are mostly unset on gameplay state
  - [ ] N/A — save system doesn't use opt-in
- [ ] **If "yes" or "partially": which entity types are NOT opted in?** ____

### 4.6 Restoration Mechanism

- [ ] **Is there an existing load path that recreates entities and applies properties?**
  - [ ] Yes — single pass (load blob → instantiate → set fields)
  - [ ] Yes — multi pass (spawn skeletons → resolve references → set fields)
  - [ ] No
- [ ] **Does the load path resolve cross-entity references** (e.g., "this enemy is targeting that player")?
  - [ ] Yes — how: ____
  - [ ] No — references are stored as raw IDs and never resolved
  - [ ] Unknown

### 4.7 Coverage Reality Check

- [ ] **Save and reload a session at an arbitrary point — does the resulting game state match the original?**
  - [ ] Yes, perfectly
  - [ ] Mostly, with these gaps: ____
  - [ ] No, significant divergence
  - [ ] Couldn't test
- [ ] **Are there entities or properties that exist in memory but are deliberately not saved?**
  List: ____

---

## 📊 SECTION 5 — Classification Decision

Walk the table top-down. The first row whose criteria all hold wins.

| Group | All of these must hold |
|---|---|
| **1 — Full Save** | (a) Explicit save container/interface exists; (b) Per-entity gameplay state is in the save format; (c) Save can be triggered from any game state; (d) Per-property opt-in (if any) is comprehensive on gameplay classes; (e) Round-trip save→load preserves state. |
| **2 — Checkpoint-Only** | (a) Explicit save system exists; (b) Save format includes gameplay state; (c) Save is gated to predefined points — **but the gating is policy, not mechanism** (you could extend it). |
| **3 — No Save** | Default if neither of the above holds. Includes the "save exists but only persists settings / progression" case. |

**Important nuance:** A game can be classified Group 1 globally but still need
**manual restoration for specific entity types** (see Section 8). Record per-entity
notes in `GAME_ANALYSIS_SAVE_SYSTEM.md` even after the group is set.

---

## 📦 SECTION 6 — CODE_MAP Output Schema

Merge this block into `CODE_MAP.json → save_system`:

```json
{
  "save_system": {
    "group": 1 | 2 | 3,
    "rationale": "One sentence on why this group, not the others.",
    "classified_on": "YYYY-MM-DD",
    "container_class": "FQN or null",
    "interface": "FQN or null",
    "entry_points": [
      { "kind": "save" | "load", "symbol": "...", "file": "...", "line": 0 }
    ],
    "serialization": "reflection-optin" | "explicit-serialize" | "json-blob" | "language-builtin" | "other",
    "opt_in_coverage": "comprehensive" | "partial" | "absent" | "n/a",
    "checkpoint_gated": true | false,
    "blockers": [
      { "type": "delta-serializer" | "fast-array" | "custom-serialize" | "other",
        "affected_classes": ["..."],
        "note": "..." }
    ],
    "round_trip_verified": true | false | "untested",
    "per_entity_overrides": [
      { "entity": "EnemyAI",
        "approach": "reconciliation" | "manual",
        "reason": "..." }
    ],
    "notes": "Free-form for anything the schema doesn't cover."
  }
}
```

---

## ✅ SECTION 7 — Validation Before Locking In

Before downstream stages consume this classification, verify:

- [ ] At least one save/load round-trip was observed (or explicitly marked untested with a reason).
- [ ] At least three gameplay-critical properties were spot-checked for inclusion in the save format.
- [ ] If the game has custom serializers on gameplay types, the `blockers` list is populated.
- [ ] If classified Group 1, the load path has been read end-to-end (not just the save path).
- [ ] If classified Group 3, you've confirmed that "save" calls in the code are persisting settings / progress only, not gameplay state.
- [ ] Human has reviewed and approved the classification before `/10-plan-state-restoration`.

---

## 🧪 SECTION 8 — Per-Entity Restoration Approach

Even within Group 1, individual entity types may need different approaches.
Decide per entity type after the global group is set.

### Approach: Reconciliation

Reuse the game's own save/load path for this entity type. Ludeo writes via
the same plumbing; restoration is mostly "load and dispatch."

**Choose when:**
- The game's save covers this entity comprehensively
- No custom serializer / delta serializer is in the way
- The opt-in coverage is complete

### Approach: Manual

Read each property from the SDK's `DataReader`, apply to spawned entities
directly via setters or reflection.

**Required when:**
- Properties live on dynamically-added sub-components that the save system can't see
- Native serializers (custom `Serialize()`, delta serializers, fast-array serializers) block reflection
- The entity is part of a Group 3 game and there's no existing path

### 8.1 Per-Entity Decision Matrix

For each entity type in `02B-RESEARCH-OBJECTS.md`, fill:

| Entity Type | In save format? | Has blockers? | Approach | Rationale |
|---|---|---|---|---|
| Player | ☐ Yes ☐ Partial ☐ No | ____ | ☐ reconciliation ☐ manual | |
| Enemy | ☐ Yes ☐ Partial ☐ No | ____ | ☐ reconciliation ☐ manual | |
| ... | | | | |

---

## 🚨 SECTION 9 — Common Pitfalls

1. **"Save system exists" ≠ "gameplay state is saved."** Many games have a
   `Save*` class that only persists progress and settings. Read the load path
   to see what actually comes back.
2. **Opt-in flags are silently default-off.** When a per-property opt-in
   mechanism exists, gameplay properties are routinely missing the flag. The
   save call succeeds, the saved blob is empty for that entity, and the
   symptom only appears on load.
3. **Custom serializers on gameplay types poison reflection.** A single
   delta-serialized array on a critical class can make a reflection-based
   approach unworkable for that whole class. Detect these early — they
   usually force manual restoration.
4. **Dynamically-added components are invisible to most save systems.**
   If a game attaches health/weapon/state components at runtime, the save
   path that walks "design-time" component lists won't see them. Manual
   restoration via the spawn path is usually required.
5. **"Save anywhere" is often a lie.** Some games allow `Save()` calls
   from any state but only correctly restore state captured at checkpoint
   boundaries. Test mid-combat save→load before trusting Group 1.

---

## 🔗 Cross-References

- `/10-plan-state-restoration` reads `save_system.group` and per-entity approaches
- `07-RESTORATION-PATTERNS.md` branches by group
- `02B-RESEARCH-OBJECTS.md` provides the entity list for Section 8.1
- `02E-RESEARCH-TECHNICAL.md` Section on save-system patterns is complementary —
  this file is about classification, that file is about technical constraints
