---
category: common-mistakes
tier: generalizable
sourceGame: PlatformerSample
phase: "4"
question: "Is a census type on the list because the genre checklist demands it and a matching class or counter exists in the code — rather than because you proved the mechanic is live in the SHIPPING content and configuration?"
sanitized: true
origin: "unity:common-mistakes/prove-a-genre-checklist-type-is-live-in-the-shipping-config-first"
---

# The genre checklist says what to look for, not what exists — prove a type is live before flagging it

Applies when a census row exists because a `game-patterns/<genre>.md` checklist demanded it and the code has a match.

The genre files are a **validation** checklist, and phase 4's "when in doubt, track" makes over-tracking cheap. But
there's a third outcome: a type the checklist demands, with a real class and real fields, that **is not live in the
game that ships**. Tracking it isn't cheap over-tracking — it's a wave-1 row, a stable-key prerequisite and a field
sweep spent on something that never changes, plus a load-bearing flag that misrepresents what a moment needs. Three
tells surfaced in one census, each defeating a different kind of evidence:

## 1. The class exists but nothing instantiates it

A full leveling/XP system with a public API and change events, and a dialogue controller with live call sites in
other code — **referenced by no level, no entity definition, no spawn table**. Grepping the *code* finds them;
grepping the *content* doesn't. Check every candidate class for a content reference (level files, archetype/entity
definitions, factory registrations). Trap inside the trap: other code *calling into* the dead component isn't
evidence of life — a lookup that returns null is silent, so those call sites are dead too. (Run the mirror check as
well — a live component that hides from a level grep because it's composed in from a template:
`learnings/common-mistakes/a-static-level-census-is-a-hypothesis-until-the-enumerator-confirms-it.md`.)

## 2. A data-driven config flag disables the mechanic

"Ammo (current + reserve)" had a counter, a consumption site and world pickups in three levels — and is dead, because
the shipping player definition sets `infiniteAmmo = true` and consumption sits inside `if (!infiniteAmmo)`. **The
flag's value lives in data, not code**: reading the code says the mechanic exists; reading the shipping data says
it's off.

## 3. The counter is never incremented

The same counter had one write in the project: a decrement. Several grep hits *feel* like confirmation; classifying
them by **direction** settles it. Grep a resource's **increment**, not its name.

## What to do with a type that fails

**Exclude it in the census table with the evidence inline** — "unreachable (no content reference)", "static (flag
off in shipping data)", "dead counter (no increment)". Don't silently omit it: a reviewer comparing against the
genre checklist reads a missing row as an oversight, and the next agent re-adds it. And **don't fix it** — dead
subsystems are the game team's decision; just map no state and no actions onto them.

**Generalization:** reachability is part of the census, not a deep-scope detail. Before assigning a load-bearing flag
and a wave, answer "is this live in the shipping content?" with content and data as the source of truth: *referenced
anywhere? · enabled in shipping config? · ever incremented?*
