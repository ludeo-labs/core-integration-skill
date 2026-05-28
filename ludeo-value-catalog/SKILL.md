---
name: ludeo-value-catalog
description: Build a value catalog for a Ludeo game's tracked attributes. Scan the game codebase for every `ludeo_DataWriter_Set*` call and `LUDEO_CAPTURE_*` macro invocation, follow each captured value expression to its origin, and enumerate, per attribute, every possible value (enums, bools, flag masks, bounded ranges) and — where the domain is open — the probable values, each with its meaning and source. Use when the internal team needs to hand-edit Ludeo capture JSON to curate a gameplay moment and needs to know what each attribute may legally be set to. Triggers: "what values can this attribute take", "build a value catalog from the codebase", "enumerate attribute values for curation", "what can I change weapselect to".
metadata:
  version: 0.0.0
---

# Ludeo Value Catalog

This skill produces a **value catalog**: for every attribute the integration
code captures, what values it can hold, what each value *means*, and how
confident we are — so a human curator can safely hand-edit a capture JSON to
craft a gameplay moment.

It is **not** part of game integration. It is an **offline curation aid**.
Integration (the `ludeo-integration` skill) *writes* attributes during gameplay;
this skill explains, after the fact, what those attributes are allowed to be.

## When to use

Activate when someone on the internal team wants to curate a captured Ludeo by
editing its JSON directly and asks any of:

- "What values can `<attribute>` take on this object?"
- "Build a value catalog for this game / this codebase."
- "Enumerate the possible values for every tracked attribute."
- "If I change `weapselect` from 3, what are the other options?"

## What you are given

**The game codebase — and nothing else.** The integration code is both the
manifest and the source of truth: every `ludeo_DataWriter_Set*` call and
`LUDEO_CAPTURE_*` macro invocation is an attribute the SDK captures, and the
expression each one passes names the game value to follow. The catalog covers
exactly what the scanned code captures — no API fetch, no `gameVersionId`, no
out-of-band manifest.

What this approach **doesn't** give you, and how the skill handles it:

- **No friendly name.** There's no human-readable label like "Selected Weapon"
  unless the integrator left one as a trailing `// comment` on the capture
  line. Harvest those when present (Step 1); otherwise leave the field blank.
  Do not humanize the attribute name into a fake label (`weapselect` →
  "Weapselect" reads worse than the bare name).
- **Components are optional but explicit when used.** Components are an
  optional level *between* `objectType` and its attributes — when an
  integration uses them, the codebase expresses them plainly (the SDK call,
  a sub-object, a per-component capture method — whatever shape that
  integration uses). Where they appear, label each row's component; where
  they don't, group under `objectType` alone. Take the grouping from the
  code as given; don't infer one that isn't there, and don't drop one that
  is.
- **Captures outside the scanned code aren't catalogued.** If part of the
  integration lives in another repo or composes attribute names at runtime,
  those attributes won't appear here. Make this scope explicit in the catalog
  header.

The codebase tells you both *what is captured* (the call sites) and *what each
value can be* (the field types, enums, clamps the expressions resolve to).

## The core idea: possible vs. probable

Every attribute falls into one **value domain**. The domain decides whether you
can list *every* legal value or only the *probable* ones:

| Domain | Can enumerate fully? | What the catalog gives |
| --- | --- | --- |
| **Enumerated** — enum, `#define` set, bool, flag bitmask, fixed string set, data-table id | **Yes** | Every value + its meaning |
| **Bounded** — clamped/min-maxed numeric | **Yes** (the range) | `[min, max]` + notable values |
| **Counter** — score, kills, ammo, timers | No (open upward) | Probable range + sane defaults |
| **Open continuous** — position, angle, velocity | No | Probable values from level/spawn data |
| **Reference** — id pointing at another object | From the capture, not code | Which object-ids in *this* capture are valid targets |
| **Identity** — the object's own stable id | Do not edit | Flag as off-limits |

"Every possible value" applies to **Enumerated** and **Bounded**. "Probable
values" is what you fall back to for **Counter** and **Open continuous**. The
domain taxonomy and how to recognize each in C++ is in
`references/value-domain-taxonomy.md` — read it before classifying anything.

## Workflow

> Read `references/value-domain-taxonomy.md` first. It holds the recognition
> signs, grep recipes, and probable-value heuristics each step below relies on.

### Step 1 — Scan the codebase for capture sites (the input)
The catalog's input is **the integration code itself**. Run a single ripgrep
over the codebase for both forms of the SDK capture surface:

```
ludeo_DataWriter_Set\w+\s*\(|LUDEO_CAPTURE_\w+\s*\(
```

Parse each hit into a row:
`(file:line, attribute_name, value_expression, sdk_type, trailing_comment?)`.

- **attribute_name** — the first-argument string literal (`"weapselect"`).
- **value_expression** — the value being written (`m_weaponSelect`,
  `GetSelectedWeapon()`, `static_cast<int32_t>(state)`, `MapGun(g)`, …).
- **sdk_type** — from the function/macro name (`SetInt32` → `int32`,
  `LUDEO_CAPTURE_VEC3` → `vec3f`). This is the JSON value type — what curators
  must preserve.
- **trailing_comment** — if a `// ...` follows on the same line, capture it as
  the friendly-name source.

**Fold index families.** When the first arg is a *format string*
(`"weapAmmoClip%d"`, `std::format("loadweap{}", i)`) rather than a static
literal, the call is in a loop emitting one attribute per index. Find the
loop's iteration range and emit **one family row** covering the range
(`weapAmmoClip0..N`), not N separate rows.

**Drop SDK-internal attributes.** Skip any attribute whose name begins with
`~~` (e.g. the SDK's synthetic `~~dummy`). Do not look them up, do not
catalog them, do not flag as Needs Human Review.

The result is the working list of rows the rest of the skill operates on.

### Step 2 — Label each row's `objectType` + prep the type cache

**2a — Label each row with its `objectType`.** Every capture sits inside an
object's scope. Two integration styles to handle:

- **Entity-embedded** — the call is inside a method of a class (e.g.
  `Player::SendInitialLudeoValues`) whose `RegisterWithLudeo` called
  `ludeo_DataWriter_CreateObject` with `params.objectType = "Player"`. The
  row's `objectType` is `"Player"`.
- **Centralized pull adapter** — the call sits inside an
  `EnterObject(id) / LeaveObject` scope (often via an RAII `ObjectScope`).
  The `id` was returned by an earlier `CreateObject(..., "<X>", ...)` for the
  iterated entity; trace it back through the local variable to that
  `objectType`.

One ripgrep over `CreateObject` capturing the `objectType` string supplies
both mappings (`class → objectType` and `id-variable → objectType`); label
every Step-1 row against it.

**If the integration uses components, label them too.** Components are
optional but, when present, are plain in the code (per-component capture
methods, a sub-object, an SDK call, a naming convention — whichever shape
this integration uses). Pick up the component label from that explicit
source and attach it to each row; if no component pattern is present, leave
the component field empty for that row.

**Dedupe by `(objectType, component, attribute)`.** The same attribute set
from multiple call sites is one catalog entry. If two sites write
**different value expressions** to the same key, flag a conflict — one is
likely an integration bug; record both for review.

**2b — Type-resolution cache (lazy).** As Step 3 resolves backing-field types,
cache by **C++ type name**: `type_name → { domain, values | range, file:line }`.
One `WeaponType` enum typically backs many rows (`weapselect`, every
`loadweap*` slot, the index of `weapAmmoClip*`/`weapAmmoReserve*`) — read it
**once** and reuse the cache entry. Same for shared clamps (`MAX_HEALTH`),
shared data tables, and shared state-machine enums.

### Step 3 — Resolve and classify
For each row (single attribute or family), follow the **value expression** at
the capture site to its origin — no new grep here; Step 1 already pulled the
expression. Read it to identify the backing field, then its C++ type, then
check the type cache (Step 2b) **before** reading the type definition. Apply
the taxonomy in `value-domain-taxonomy.md` to that type — it dictates Step 4.

**Names need not match.** The Ludeo attribute name (`"weapon"`) and the backing
C++ field (`m_gun_used`) **do not have to align**. Trust the value expression —
that's what's actually captured — not name similarity. If the expression is a
cast, getter, mapping function, or packing op, follow the transform: the
captured domain is the function's *output set*, not the operand's native
domain. See taxonomy §0 (Trust the value expression / Follow transformations).

**Flag suspicious mismatches.** If the backing field's name reads as
semantically unrelated to the attribute name (e.g. attribute `"weapon"` backed
by `m_armor_value`), report the field's actual domain honestly and attach an
**Integration sanity note** to the row — likely an integration bug worth a
human review (taxonomy §0). A harvested trailing comment, when present, is an
extra tie-breaker.

**Tier the effort — not every domain needs a deep dive:**

- **Enumerated / Bounded** → full source dive (read the enum body, the clamp).
  This is where the catalog earns its keep; spend time here.
- **Counter / Open / Identity / Reference** → short canned treatment from the
  taxonomy: a counter is `[0, probable-max]` with probable-max from match
  length / clip size; an open float is "probable from level/spawn data"; an
  identity is "do not edit"; a reference is "ids in this capture." Don't
  re-derive these per attribute.

### Step 4 — Enumerate
- **Enumerated** → list every value, its symbolic name/meaning, and `file:line`.
  For an `int32` holding an enum, give the **integer** the curator must write in
  the JSON next to the enumerator name (the JSON stores the int, not the name).
- **Bounded** → record `[min, max]`, where the clamp lives, and notable values
  (0, max, default).
- **Counter / open continuous** → give a **probable** range or value set with the
  rationale (default, common max, level bounds, spawn points) — never claim it's
  exhaustive.
- **Reference** → state which object type it points at; the *valid* values are the
  ids of those objects present in the specific capture being edited (note this —
  it can't come from code).
- **Identity** → mark "do not edit."

### Step 5 — Find cross-attribute couplings and edit constraints
Curation edits one field but the object must stay coherent. Surface couplings the
code reveals, e.g.:
- `weapselect` should be a weapon that is actually in the loadout
  (`loadweap0`..`loadweapN`, `loadweapCount`).
- `weapAmmoClip<i>` / `weapAmmoReserve<i>` index by the same weapon enum as
  `weapselect`/`loadweap*` — slot `i` only matters if that weapon is owned.
- `health` shouldn't exceed the max the clamp enforces.
- A `*_id` reference must point at an object that exists in the capture.

These go in the catalog's per-attribute **Edit notes** so a curator doesn't
produce an internally inconsistent object.

### Step 6 — Confidence + provenance
Tag every row `high | medium | low`:
- **high** — found the enum/clamp/table directly via the value-expression walk.
- **medium** — inferred from naming/usage, value set likely but unverified.
- **low** — couldn't resolve the domain; only probable values, or a guess.

Every concrete value or range **must cite a `file:line`**. A value with no source
is a hypothesis — label it as such. Collect unresolved attributes in a
**Needs Human Review** section rather than inventing values.

### Step 7 — Write the catalog
Emit `LUDEO_VALUE_CATALOG.md` using `references/CATALOG_TEMPLATE.md`. Group by
`objectType` → (`component` if labelled) → attribute. Record the codebase
commit/path and the number of capture sites scanned in the catalog header.

## Important rules

- **The codebase is the authority, never a guess.** Every enumerated value and
  every range is backed by a `file:line`. If you can't find it, say so and drop
  the row to low confidence — do not fabricate a plausible-looking enum.
- **The JSON stores the raw value, not the symbol.** An `int32` weapon enum is
  written as `3` in the capture, not `"Shotgun"`. Always give the integer to
  write, with the symbol as its meaning.
- **Preserve the value type when editing.** Ludeo attribute types are type-locked
  server-side (see the integration skill's troubleshooting §1). A hand-edit must
  keep each attribute's `sdk_type`; the catalog records the type so edits don't
  silently drop. Never advise changing an `int32` attribute to a float, etc.
- **Possible vs. probable is not optional.** Only call a value list complete for
  Enumerated/Bounded domains. For everything else, label it "probable."
- **References resolve against the capture, not the code.** For `*_id` attributes,
  the legal targets are object-ids in the specific JSON being edited.
- **Surface couplings.** A single-field edit that breaks an object's invariants is
  worse than no edit. Flag the related fields.
- **One pass, then cache.** Step 1 builds the capture-site set in a single grep;
  Step 2 labels by `objectType` and lazily caches shared types. Per attribute,
  **look up — do not re-grep**. Shared types are read once and reused; index
  families are resolved once, not per index. This is the single biggest
  determinant of how the skill scales — for a 100-attribute codebase, the
  difference is roughly one order of magnitude in codebase reads.

## Reference material

- `references/value-domain-taxonomy.md` — the value-domain classes, how to
  recognize and locate each in a C++ codebase, expression-to-origin following,
  and probable-value heuristics. **Read first.**
- `references/CATALOG_TEMPLATE.md` — the output `LUDEO_VALUE_CATALOG.md` structure.

## Start here

Read `references/value-domain-taxonomy.md`, then run the Workflow: scan the
codebase for capture sites (Step 1) and classify each.
