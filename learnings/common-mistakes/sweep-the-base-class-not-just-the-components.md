---
category: common-mistakes
tier: generalizable
sourceGame: RoguelikeSample
phase: "4,5"
question: "Is the entity's field surface being enumerated from the classes and components attached to it, without walking what those classes INHERIT? A shared character base class is where health, status effects and invulnerability windows usually live."
sanitized: true
origin: "unity:common-mistakes/sweep-the-base-class-not-just-the-components"
---

# Sweep the base class, not just the sibling components

Applies when the deep scope enumerates an entity's fields from its anchor class and attached components.

The completeness rule for an entity's field surface is well known: the entity isn't the one class the census names,
it's the whole subsystem — every component it owns plus the managers and data assets holding its state. That rule is
stated **sideways**. It says nothing about **upward**, and inheritance is where the most load-bearing state sits.

On one integration the player's anchor was a ~6,400-line status class, so the sweep looked comprehensive: dozens of
files, hundreds of fields, several manager singletons folded in. Then the declaration turned out to read:

```cpp
class PlayerStatus : public CharacterStatus { /* ... */ };
class EnemyStatus  : public CharacterStatus { /* ... */ };
```

The **base** held current/max health and the secondary resource, cooldowns, ~25 runtime state booleans (stunned,
dead, dodging, deflecting, post-hit invulnerable, enraged…), the invulnerability-frame counter and the run's upgrade
multipliers. **The entity had no health in its field surface**, and the tally still passed.

## Why it's easy to miss

- A huge anchor class is *reassuring*; nobody suspects an under-scoped sweep.
- The tally makes it worse: `N = C + D + X` audits the numerator; a wrong **denominator** gives a confident,
  complete-looking, wrong answer.
- It's a **shared** base, so one omission hits every character type at once.
- Nothing fails at compile or capture time. It surfaces as characters restored at default health with every status
  cleared — read as a restore bug, not a plan gap.

## The rule

| Axis | Enumerate |
|---|---|
| **sideways** | other components / sub-objects the entity owns; managers, singletons and data assets holding its state |
| **upward** | the anchor class's **base chain**, to the engine's own base entity type — and each base's own fields |

Read the class declaration for its base before enumerating anything, and repeat until you reach the engine type.
(Watch multiple inheritance and mixins too.)

Two sanity checks that expose a miss:

- **Check the surface against the genre, not the count.** A combat entity with no health, no death flag and no
  invulnerability window is under-scoped however many fields it has.
- **Watch for shared bases.** Two entities with different anchor classes that behave alike (both take damage, both
  die) very likely share a base — which appears in neither anchor row.

**Tooling note:** a field extractor that keeps only class-member declarations (by brace depth) is worth writing once
— and make **the file list you feed it** the reviewed artifact. The bug is almost never in the parsing; it's in which
files you handed it.

Related: `learnings/common-mistakes/investigate-before-asking.md`.
