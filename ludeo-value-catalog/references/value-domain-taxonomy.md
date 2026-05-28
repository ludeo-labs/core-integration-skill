# Value-Domain Taxonomy & Discovery

> **Purpose:** Classify every tracked attribute into a value domain and locate, in
> a C++ codebase, the values that domain allows.
> **Audience:** An AI agent building a value catalog for Ludeo curation.
> **Prerequisite:** `../SKILL.md` (the workflow this supports).

The Step 1 codebase scan gives you each capture's **attribute name**, **value
expression**, **SDK type**, and optionally a trailing-comment friendly label.
That is not enough to know what the attribute may hold — an `int32` can be a
weapon enum, a clamped health pool, an open kill counter, or a packed RGBA
color. Only the code on the other end of the value expression tells you
which. This document is how you find out.

---

## 0. Following the value expression (do this before classifying)

The SKILL.md Step 1 scan hands you a row per capture call — `file:line`,
attribute name, value expression, SDK type, optional trailing comment.
There's no separate manifest; the call site itself is both the input and the
bridge. Your job per row is to **follow the value expression to its origin**:

```cpp
ludeo_DataWriter_SetInt32("weapselect", m_weaponSelect);
//                         ^^attribute  ^^value expression — follow this
```

**Procedure:**
1. Read the value expression at the capture site.
2. Identify the field, getter, or function it names.
3. Jump to its **type** definition — that is what you classify (§1–§6 below).

> **At scale, do this once per type — not per row.** SKILL.md Step 2b's type
> cache reuses one resolution across every row that points at the same C++
> type (a `WeaponType` enum backs many attributes). Per row → lookup. Per
> type → one read.

**Trust the value expression, not the names.** The Ludeo attribute name and the
backing C++ field name **do not have to match**. An integrator may legitimately
write:

```cpp
ludeo_DataWriter_SetInt32("weapon", m_gun_used);   // Ludeo "weapon" ← field m_gun_used
```

This is valid — the capture writes whatever `m_gun_used` holds, under the
attribute name `weapon`. The catalog must reflect what is *actually captured*:
classify `m_gun_used`'s domain, regardless of either side's name. Do not
reject a row because the names differ, and do not "correct" the names back
to each other.

**Follow transformations at the call site.** When the value expression isn't a
bare field, follow it — the captured domain is what's actually written into the
JSON, not the operand's native domain:

- **Pure cast** (`static_cast<int32_t>(m_weapon)`, `(int)e_weapon`) — the
  underlying field's domain holds; note the cast.
- **Getter** (`GetSelectedWeapon()`) — read the getter body, follow to the field
  it returns.
- **Mapping function** (`MapGunToWeaponEnum(m_gun_used)`) — catalog the
  function's **output set** (its switch / lookup table), not `m_gun_used`'s
  domain. If the mapping is many-to-one or lossy, say so.
- **Arithmetic / packing** (`(r<<16) | (g<<8) | b`) — document the packed format
  as the domain; the operands aren't what the curator edits.

**Flag suspicious mismatches as an Integration sanity note.** When the attribute
name reads as semantically unrelated to the backing field's name — e.g.
attribute `"weapon"` backed by `m_armor_value` — the catalog still reports
honestly (the field's actual domain), **and** attaches an Integration sanity
note on that row:

> "Captured field `m_armor_value` does not obviously match attribute
> `weapon` — confirm with the integrator."

This surfaces real integration bugs (the integrator wired the wrong field)
without making the agent silently override what the code says. Don't flag
normal-looking renames (`weapon` ↔ `m_gun_used`, `health` ↔ `m_hp`); only flag
ones a reasonable reader would call semantically unrelated. A harvested
trailing comment, when present, is a tie-breaker — a comment that matches the
attribute name confirms the wiring; one that doesn't is stronger evidence of
a mismatch.

**Index families.** `weapAmmoClip0`..`weapAmmoClip16` are almost never 17
separate `Set*` lines — they're one loop building names with `"weapAmmoClip%d"`
/ `std::format` / string concatenation. SKILL.md Step 1 already folds the
family from the loop; per row in the catalog, the index is the weapon slot
and the loop body names the backing array.

**When the value expression can't be resolved.** Step 1 always gives you a
literal call site, but the expression there may not lead to a concrete
domain:

- The expression calls into a third-party / closed-source library — the
  domain is the function's documented output; if undocumented, **medium**
  confidence with a note.
- The backing field's type is a template or generic with no concrete domain
  visible in this codebase — fall back to the type's typical range for its
  `sdk_type` (e.g. `int32` counter), **medium** confidence.
- The expression composes runtime data (network packet, scripting VM value)
  with no compile-time domain — **low** confidence; goes to Needs Human
  Review, not into the catalog body as a guess.

**SDK type ≠ C++ type.** The capture's `sdk_type` (`int32`) is what the JSON
stores — but the *game type* you classify is what the value expression
resolves to. An enum is almost always captured as `int32`. A color may be an
`int32`/`uint32` packing RGBA. A `vec3f` may be a position *or* an euler
angle. Use `sdk_type` to know what the JSON literal looks like; use the game
type to know its domain.

---

## 1. Enumerated domains — list every value

Finite, discrete value sets. These are the highest-value catalog entries and the
ones curation most wants ("change weapon 3 to the assault rifle").

### 1.1 C++ enums

**Recognition / grep:**
```
enum\s+class\s+\w+         // enum class WeaponType : int32_t { ... }
enum\s+\w+\s*\{            // plain enum WeaponType { WEAP_PISTOL, ... }
```
**Enumerate:** every enumerator and its **integer value**. Plain enums
auto-increment from 0 unless assigned; `enum class` may set explicit values.
Compute the actual integer the JSON must contain — that is what the curator
writes. Watch for:
- Explicit assignments (`Shotgun = 3`) and gaps.
- Sentinels to exclude (`COUNT`, `MAX`, `NONE = -1`, `INVALID`).
- Aliases (two names, same value).

**Meaning:** the enumerator name, plus any trailing comment or a UI/display-name
table that maps the enum to a human string.

### 1.2 `#define` / constant sets

Older engines use `#define WEAP_PISTOL 0`. Grep `#define\s+\w+\s+\d+` clustered by
a common prefix (`WEAP_`, `MOD_`, `TEAM_`). Treat the prefixed group as the enum.
`const int`/`constexpr` groups and X-macro tables (`#define WEAPONS(X) X(Pistol) ...`)
are the same idea — expand the table.

### 1.3 bool

Two values: `false` (0) and `true` (1). Trivial, but still state the meaning of
each (what `true` *means* for this attribute).

### 1.4 Flag bitmasks

**Recognition:** values are powers of two (`1<<0`, `0x04`), combined with `|`,
tested with `&`. Names like `EF_`, `*Flags`, `flags`.
**Enumerate:** each individual flag bit + meaning, and **note that values
combine** — the legal set is any OR of the flags, not just the listed singletons.
Give the curator the bit values so they can compose a mask.

### 1.5 Fixed string sets

A `string` attribute compared against a closed set of literals
(`if (state == "idle") ... "running" ... "dead"`) or assigned only from a known
list. Enumerate the literals. If the string is free-form (player name), it is
**not** enumerated — treat as open (§4) and say so.

### 1.6 Data-table / asset id sets

The value indexes a data table or asset registry (item ids, prefab ids, character
ids loaded from a `.json`/`.csv`/`.def`). Enumerate the table's keys + their
display names. Cite the data file, not just the code. These can be large — list
them, but if there are hundreds, give the table location + a representative subset
and mark it "full set in `<file>`."

---

## 2. Bounded numeric domains — give the range

A numeric field constrained to `[min, max]`.

**Recognition / grep:**
```
Clamp\(|clamp\(|std::clamp|Saturate|Min\(|Max\(   // clamp at the setter
if\s*\(\s*\w+\s*>\s*\w+\s*\)\s*\w+\s*=             // manual cap
assert\(|ensure\(                                  // documented bounds
```
Look at the **setter** for the backing field and at config/constants
(`MAX_HEALTH`, `kMaxArmor`). The min is often 0.

**Catalog:** `[min, max]`, the clamp's `file:line`, and notable values (0 = empty,
max = full, the default/spawn value). This is "every possible value" expressed as
a range.

---

## 3. Counters / accumulators — probable values

Score, kills, deaths, ammo totals, damage-over-time timers and amounts. Open
upward (often `>= 0`), no hard max in code.

**Catalog (probable, not exhaustive):**
- Floor (usually 0) with `file:line` if enforced.
- A **probable** upper range from: weapon clip/reserve sizes for ammo, typical
  match length for score/kills, the DOT's tick duration for `*Time` fields.
- Sensible defaults (spawn value, reset value).
Always label these **probable** — never claim completeness.

`*Time` / `*Damage` pairs (`burnTime`/`burnDamage`, `shockTime`/`shockDamage`) are
status-effect counters: `*Time` is a duration (ms or ticks — check the unit at the
decrement site), `*Damage` is per-tick magnitude. 0 means the effect is inactive;
note that as the "off" value.

---

## 4. Open continuous domains — probable values from world data

Floats with no discrete set: position (`posX/Y/Z`), angles (`yaw`, `pitch`),
velocity. A `vec3f` is usually one of these.

**Catalog (probable):**
- **Position** — level/world bounds if discoverable (map extents, a bounding
  volume, spawn-point tables). Spawn points are the most useful probable values
  for curation ("put the player at spawn N"). Cite the spawn/level data.
- **Angles** — the representation and range: degrees vs radians, `[0,360)` vs
  `[-180,180]` vs `[-π,π]`. Pitch is usually clamped (look-up/down limit) — that
  clamp is a §2 bound; report it.
- **Velocity** — typical magnitude from movement constants (max speed) if you need
  a probable range; usually not worth editing.

Free-form strings (player name) live here too: open, no enumeration.

---

## 5. Reference domains — values come from the capture

An id that points at another object (`owner_id`, `target_id`, `parent_id`, and
often `clientNum`/`team` when those index live objects rather than a fixed enum).

**Recognition:** the field stores another entity's **stable game id** (per the
integration's identity rules), and the integration's restoration resolves it
through an id-map.

**Catalog:** state *which object type* it references. The **legal values are the
object-ids present in the specific capture being edited** — they cannot be
enumerated from code. Tell the curator: "valid targets are the `<ObjectType>`
ids in this capture; pick one, or 0/sentinel for none." Distinguish a true
reference from a small fixed enum that merely *looks* id-like (`team` with two
values is §1, not §5).

---

## 6. Identity domains — do not edit

The object's own stable id (`entity_id`, the field the integration registers as
the object's identity). Editing it orphans every reference that points at the
object. Mark **do not edit**; if a curator must, every referencing attribute must
change in lockstep — flag that.

---

## 7. Finding the *meaning* of a value

A value list without meanings is half a catalog. Sources, in order of authority:
1. **Enumerator / constant name** — `WEAP_SHOTGUN` → "Shotgun."
2. **Trailing comments** at the definition.
3. **Display-name tables** — a `const char* WeaponNames[] = {...}` or a localization
   key map gives the player-facing name; prefer it for the catalog's meaning.
4. **A harvested trailing comment on the capture line** — when the integrator
   left one, it's the curator's vocabulary; include it as the friendly label.
5. **Usage** — how the value is branched on tells you what it does when nothing
   names it.

---

## 8. Cross-attribute couplings (Step 5 of the workflow)

Curation edits one field; the object must remain coherent. Look for these in code
and record them as **Edit notes**:

- **Selection ↔ inventory.** A "selected" index (`weapselect`) should be a value
  the object actually possesses (in `loadweap0..N`, count `loadweapCount`).
  Selecting a weapon not in the loadout may show nothing or crash on restore.
- **Indexed families ↔ the enum that indexes them.** `weapAmmoClip<i>` /
  `weapAmmoReserve<i>` are indexed by the weapon enum. Slot `i`'s ammo is only
  meaningful if weapon `i` is owned; clip size is bounded by that weapon's
  capacity (§2).
- **Bounded by another field.** `health` ≤ a max that may itself be an attribute
  or a per-class constant.
- **Reference integrity.** A `*_id` must point at an object that exists in the
  capture (§5).
- **Mutually-constrained sets.** Team scores vs. per-player team, `gameState` vs.
  `timeRemaining` (a finished state with time left is inconsistent).

You don't need to exhaustively prove invariants — surface the obvious ones the
code makes visible so a curator isn't blindsided.

---

## 9. Confidence rubric & provenance

Every catalog row carries a confidence and at least one `file:line`:

| Confidence | Criteria |
| --- | --- |
| **high** | Domain found directly via the capture-site bridge; enum/clamp/table read from source. |
| **medium** | Resolved by fuzzy name/friendly-name match, or domain inferred from usage but the definition wasn't pinned. |
| **low** | Domain uncertain; only probable values or an educated guess. Belongs in Needs Human Review if you can't give *any* sourced value. |

A value or range with no `file:line` is a hypothesis — mark it as such. Never
present a fabricated enum as fact.

---

## 10. Worked example — `Player` / `Game Object`

Using the `Player` object (with `Game Object` component, where the integration
labels one) from a multiplayer arena shooter:

| Attribute | sdk_type | Likely domain | What the catalog should contain |
| --- | --- | --- | --- |
| `weapselect` | int32 | **Enumerated** (weapon enum) | Every weapon enumerator + its int (`Pistol=0`…`Shotgun=3`…), display names, `file:line` of the enum. Edit note: must be in the loadout. |
| `actorType` | int32 | **Enumerated** (actor/class enum) | All actor/class types + ints + meanings. |
| `team` | int32 | **Enumerated** (small team enum) — *or* reference if it's a team-object id | If a fixed enum (Alpha/Omega/Spectator) list them; verify it's not an id. |
| `state` | int32 | **Enumerated** (player state machine) | Each state + meaning (alive/dead/spectating/respawning). |
| `gameState` | int32 | **Enumerated** (match phase) | Warmup/active/over etc. Coupled with `timeRemaining`. |
| `loadweap0`,`loadweap1` | int32 | **Enumerated** (same weapon enum as `weapselect`) | Same value set as `weapselect`. |
| `loadweapCount` | int32 | **Bounded counter** | `[0, max loadout slots]`; cite the cap. |
| `skill` | int32 | **Enumerated or Bounded** (difficulty/bot skill) | If discrete difficulty enum, list; if a 0–N rating, give the range. |
| `health` | int32 | **Bounded** | `[0, MAX_HEALTH]`; clamp `file:line`; 0=dead, max=full. |
| `colorPrimary`,`colorSecondary` | int32 | **Enumerated palette** *or* **packed RGBA** | If it indexes a color palette, enumerate entries; if packed RGBA, explain the packing and that it's not a free enum. |
| `kills`,`deaths`,`score` | int32 | **Counter** | Floor 0; probable range from match length. Probable, not exhaustive. |
| `weapAmmoClip0..16`,`weapAmmoReserve0..16` | int32 | **Bounded counter, indexed** | Per slot: `[0, clip/reserve capacity]` for that weapon; only meaningful if the weapon is owned. Found via the `"weapAmmoClip%d"` loop. |
| `burnTime`,`corrodeTime`,`shockTime`,`bleedTime` | int32 | **Counter (duration)** | 0 = effect off; probable range = effect's full duration; note the unit (ms/ticks). |
| `burnDamage`,`corrodeDamage`,`shockDamage`,`bleedDamage` | int32 | **Counter (magnitude)** | Per-tick damage; 0 = off; probable range from the effect's config. |
| `yaw` | float | **Open** (angle) | Range + units (deg/rad, wrap). |
| `pitch` | float | **Bounded** (angle, look-limit clamped) | Clamped range + units; cite the look-limit. |
| `posX`,`posY`,`posZ` | float | **Open** (position) | World bounds / spawn points as probable values; cite level data. |
| `name` | string | **Open** (free-form) | Not enumerable; player name. |
| `clientNum` | int32 | **Reference or bounded id** | Player slot index; bounded `[0, maxPlayers-1]`, identifies the client — flag edit caution. |
| `numPlayers`,`timeRemaining`,`teamScoreAlpha`,`teamScoreOmega` | int32 | **Counter** (match-global) | Probable ranges; note these are arguably match state, not per-player — verify the owning object. |

This table is the *shape* of the analysis, not the answer — every "likely" above
must be confirmed against the actual codebase via §0 before it goes in the
catalog with a `file:line`.
