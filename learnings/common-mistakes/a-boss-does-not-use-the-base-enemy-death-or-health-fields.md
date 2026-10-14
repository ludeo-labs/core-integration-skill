---
category: common-mistakes
tier: generalizable
sourceGame: PlatformerSample
phase: "5,6"
question: "Does a boss (or any special enemy) derive from the base enemy class? Check that it actually reaches the base class's death method and reads the base health field — bosses commonly keep their own life count and route defeat through their own method, so a hook or accessor on the base class silently never applies to them."
sanitized: true
origin: "unity:common-mistakes/a-boss-does-not-use-the-base-enemy-death-or-health-fields"
---

# A boss inherits the enemy class but uses none of its death path or its health field

**Precondition:** you put a hook (an action emit) or a capture accessor on a base enemy class and assume every
subclass reaches it.

The boss class derived from the ordinary enemy class, so the enemy work was assumed to cover it. Two separate bugs
came from that, each reported as its own mystery:

1. **The kill action never fired.** The `EnemyKill`/`BossKill` emit sat in the base enemy's death method, branching
   on "is this a boss". No boss ever reached that method: each boss decremented its **own** life counter in its own
   hit handler and called a shared defeat method on the boss base class, which went straight to the level-end
   logic. The branch was dead code for every boss.
2. **The boss captured and restored at full health.** The capture read the base class's lives accessor, which
   returns the base field. Bosses never touch it, so every boss was captured — and restored — at its authored
   starting health.

## The fixes

Emit the action from the boss base class's shared defeat method — every boss routes through it, and if it receives
the player as a parameter that *is* the player guard. Emit before the level-end call, so the kill precedes the
level-complete it cascades into.

For health, make the two capture accessors `virtual` on the base enemy and override them on the boss base to map to
the boss's own field — no new attribute, no change to capture or restore call sites. Check the accessors have no
other callers first, and check no boss declares its **own** field with the base field's name (a shadow the override
would read but the boss never decrements).

## The same pattern one layer down: overrides that never call the base

The kill action for *ordinary* enemies failed the same way: the player-attribution mark was set in the base damage
method, and a dozen subclasses override it **without calling the base implementation**. Move the mark to the
**caller** — the player's attack/collision code sets it immediately before the virtual call, where no override can
bypass it.

Before trusting any hook on a virtual member: count the overrides, count those that never call the base version,
and grep which subclasses actually reach the member. Inheritance is not participation. Related:
`learnings/common-mistakes/a-green-compile-does-not-prove-your-edit-compiled.md`.
