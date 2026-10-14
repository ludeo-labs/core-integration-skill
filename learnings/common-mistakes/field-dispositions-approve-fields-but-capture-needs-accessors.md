---
category: common-mistakes
tier: generalizable
sourceGame: ActionAdventureSample
phase: "5"
question: "Did the per-entity field-disposition table (06 §9.6, phase 4 Part B / phase 5 · task 0) check READABILITY of each capture-marked field from outside its class, or only that the field exists?"
sanitized: true
origin: "unity:common-mistakes/field-dispositions-approve-fields-but-capture-needs-accessors"
---

# A field disposition of "capture" is not the same as "capture code can read it"

**Precondition:** game classes keep state in private members, and the layer captures from outside them.

The per-field disposition gate (`06 §9.6`, run per wave by `phase 5 · task 0`) gives every state field of an entity a
disposition, and the human gate approves the table. It is easy for agent and reviewer alike to read approval as "task
1 can just write the code" — but the table records **existence and relevance**, not **accessibility**.

Gameplay classes routinely expose a setter and no getter: `SetCanPause(bool)` over a private `m_canPause`,
`EnableCollisionsWithEnemies(bool)` over a private flag, `SetSoftRespawnPosition(...)` with no reader, a private
`std::vector<StatusEffect>` behind only `HasStatusEffect(type)`. The writers already know the value; nothing needed to
read it back until capture did.

Result: the reviewer approved *N* accessor edits (the ones task 0 happened to notice) and task 1 needs *N + M*. Silently
dropping the unreadable fields is worse — they were approved as load-bearing, and under-tracked forward-play state
passes a first-frame restore check and diverges later (`06 §9.1` failure mode 4).

## Do it at task 0, not task 1

For each `capture` row, record **how the value will be read**: public member · existing getter · **accessor needed**.
Total the third column into the gate ask as one line ("this wave needs K read-only accessors across F game files").
One approval, no surprises, and the reviewer sees the real edit surface before code exists.

## Three qualifiers

- **Some "missing" accessors already exist.** Verify each against the file, not the plan row — one of three approved
  accessor edits here was unnecessary, and the remaining duration was then computable in the layer with no edit.
- **State on a sibling component needs no accessor** if the entity exposes its components publicly. Check component
  boundaries before proposing a game edit; only members private to the anchor class need one.
- **Never read through a function that recomputes.** A getter like `CanSeePlayer()` may fire raycasts and write a
  cache. Capture runs every tick and must be side-effect-free — add a pure getter returning the cached member.

No offset pokes, `#define private public` or friend-injection hacks: fragile against changes and hidden from review.
