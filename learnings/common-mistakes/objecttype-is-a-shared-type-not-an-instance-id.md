---
category: common-mistakes
tier: universal
sourceGame: multiple
phase: "4,5"
question: null
sanitized: true
origin: "unity:common-mistakes/objecttype-is-a-shared-type-not-an-instance-id, unreal:common-mistakes/objecttype-is-shared-category-not-instance-id"
---

# `objectType` is a shared TYPE name, not an instance id — the SDK assigns identity

All 22 players record under `"player"`. Every pickup records under `"pickup"`. Every enemy under `"enemy"`. **Never**
`player_0`…`player_21`, never `enemy_<n>`. Which instance is which travels as an **attribute** you write and read
back.

## What the SDK actually does

`objectType` is an **input** to `ludeo_DataWriter_CreateObject`; the `LudeoObjectId` is an **output**, created by the
SDK once per call (`03 §2.4`). Every write is addressed by that id (`ludeo_DataWriter_EnterObject(id)`), never by the
type string. So `CreateObject` with `"enemy"` called fifty times yields fifty independent objects — nothing
collapses. An earlier version of this lesson in another skill claimed the opposite (same string = same object, so
mint a type per instance); that was false, and was corrected after an integrator saw the result in Studio Lab.

## What it costs when you get it wrong

Nothing at runtime: capture, restore and every self-check pass. The damage lands where no agent-side gate looks —
**each `objectType` becomes a schema row in Studio Lab** that a human names and attaches objectives to.

- One `player` row becomes twenty-two, each repeating the full attribute list.
- A type that spawns over time (pickups, projectiles, enemies) grows **a new row every few seconds of play**.
- An objective keyed to that type would have to be defined once per row.

One engagement went from 32 object types to 2 by fixing it: the agent had created each bot as `"Bot_A_0"`,
`"Bot_B_1"`, `"Bot_A_2"`…, and after the fix Studio Lab showed `player` and `bot`, each instance's identity in its
attribute.

## The check that discriminates — and the one that doesn't

Comparing the count of distinct `LudeoObjectId`s against the number of registered writers **can never fail** — the
SDK always makes ids distinct. It tests nothing and reads like evidence
(`learnings/common-mistakes/ask-what-your-check-cannot-see.md`). What does discriminate:

> Open Studio Lab after the first recorded session and count the object rows. N rows for N instances of one thing →
> wrong. One row per type → right.

Static tell: **if you build an `objectType` with string concatenation or a counter, you're probably doing it wrong.**
It should be a constant (`06 §2.6`: the prefab / definition id is the natural type).

## The right shape

- One `objectType` constant per type, shared by every instance (or a stable prefab/type id pinned at spawn time).
- Identity travels as an attribute — a slot key, an index, a minted stable id (`06 §4`). The restore matches on
  that attribute within the type's bucket (`ludeo_DataReader_GetObjectsInfo`).

```cpp
params.objectType = "bot";                                    // shared category, a constant
ludeo_DataWriter_CreateObject(writer, &params, &objId);
// …inside the object's EnterObject scope:
LUDEO_CAPTURE_STRING(self, "bot", "entity_identity", identity.c_str());   // "Bot_A_0", unique per instance
```

- The read side needs no prefix-stripping or regrouping. Writing a strip is the smell that you minted per-instance
  names upstream.

## Why the wrong version survived review

A doc sample showing `enemy_0` / `enemy_1` was read as prescribing uniqueness, then hardened by an anecdote whose
mechanism the SDK rules out. **When a learning rests on an anecdote, check the mechanism in the SDK headers before
propagating it** — and check what the result looks like to the people who use the platform.
