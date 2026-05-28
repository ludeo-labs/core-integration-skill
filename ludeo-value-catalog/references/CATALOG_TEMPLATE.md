# Value Catalog Template

> Structure for the `LUDEO_VALUE_CATALOG.md` deliverable. Group by
> `objectType` → (optional `component` if the integration uses one) →
> attribute, preserving the codebase scan's grouping. One subsection per
> attribute (one per family for indexed sets). Fill every field; if a fact
> is unknown, write "unknown — see Needs Human Review," never a guess.

---

```markdown
# Ludeo Value Catalog — <GameName>

**Source:** codebase scan of `ludeo_DataWriter_Set*` / `LUDEO_CAPTURE_*` call sites
**Codebase commit / path:** <ref>
**Capture sites scanned:** <N call sites>   **Attributes cataloged:** <M> (after family fold and dedupe)
**Generated:** <date>
**High / Medium / Low confidence:** <a / b / c>

> **Editing rules (read first):**
> - The JSON stores the **raw value**, not the symbol. Write `3`, not `"Shotgun"`.
> - **Keep the value type.** Attribute types are type-locked server-side; an edit
>   that changes an `int32` to another type is dropped silently. Each attribute's
>   type is listed below — do not change it.
> - **Possible** = complete legal set (enumerated/bounded). **Probable** = common
>   values only; other values may be legal. Editing outside a probable range is
>   not necessarily wrong, but is unverified.
> - **Respect couplings.** See each attribute's *Edit notes* before changing it.

---

## Object: `<ObjectType>`  ·  Component: `<Component>`

*(If the integration doesn't use components, drop the `·  Component: ...` part of the heading and the per-component subsections — go straight from object to attribute subsections.)*

### `<attribute>` <— Friendly label (only if a trailing comment was harvested)>

- **Capture site:** `<file:line>`  ·  **SDK type (JSON):** `<int32 | float | bool | string | vec3f | ...>`
- **Domain:** `<Enumerated | Bounded | Counter | Open | Reference | Identity>`
- **Backing field:** `<m_field>` at `<file:line>`  ·  **Confidence:** `<high|medium|low>`
- **Integration sanity note** *(only when the backing field's name reads as semantically distant from the attribute name, or the expression couldn't be fully resolved)*: `<e.g. "captured field `m_armor_value` does not obviously match attribute `weapon` — confirm with integrator">`

**Possible values** *(Enumerated / Bounded only)*

| Value (write in JSON) | Meaning | Source |
| --- | --- | --- |
| `0` | <symbol — display name> | `<file:line>` |
| `3` | Shotgun | `<file:line>` |
| ... | ... | ... |

*(Bounded form: state the range instead of a row per value.)*
**Range:** `[<min>, <max>]` — `<file:line>`. Notable: `0` = <…>, `<max>` = <…>.

**Probable values** *(Counter / Open continuous)*

- `<value or range>` — <rationale (default, common max, spawn point, level bound)> — `<file:line>`
- Labeled **probable**: other values may be legal.

**Edit notes**

- <couplings: e.g. must be in `loadweap0..N`; ammo slot indexed by this enum; ≤ MAX_HEALTH>
- <reference: valid targets are `<ObjectType>` ids present in this capture>
- <unit/representation: degrees vs radians; packed RGBA; ms vs ticks>
- <"do not edit" for identity fields>

---

<repeat per attribute, then per component, then per object>

---

## Needs Human Review

Attributes whose domain or values could not be resolved from the codebase.

| Object | Attribute | sdk_type | What's missing | Best guess (unverified) |
| --- | --- | --- | --- | --- |
| <Player> | <skill> | int32 | enum definition not found via capture site | likely 0–4 difficulty rating |
| ... | ... | ... | ... | ... |

## Coupling Summary

Cross-attribute invariants a curator must keep consistent.

| Attributes | Constraint |
| --- | --- |
| `weapselect`, `loadweap0..N`, `loadweapCount` | selected weapon must be in the loadout |
| `weapAmmoClip<i>` / `weapAmmoReserve<i>`, weapon enum | slot `i` indexed by weapon enum; meaningful only if owned |
| `health`, `MAX_HEALTH` | `0 ≤ health ≤ MAX_HEALTH` |
| `<*_id>` | must reference an object present in the capture |
| ... | ... |
```

---

## Notes for the agent filling this in

- **One subsection per attribute**, even for index families — but you may collapse
  `weapAmmoClip0..16` into a single subsection that explains the indexing once,
  rather than 17 near-identical sections. State the index range explicitly.
- Put the **integer to write** in the "Value" column for enums; the symbol is the
  meaning, not the value.
- A row with no `Source` is not allowed — move it to **Needs Human Review**.
- Keep **Possible** and **Probable** visually distinct; never merge them into one
  "values" list, or the curator will assume probable lists are complete.
