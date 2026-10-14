---
category: common-mistakes
tier: generalizable
sourceGame: ActionAdventureSample
phase: "5"
question: "Are you deciding whether a captured 'was hit / staggered / interrupted' latch can be restored verbatim — and did you search only the source code for the function that clears it, in an engine where animation events, script bindings or data-driven callbacks invoke functions by NAME from asset or data files?"
sanitized: true
origin: "unity:common-mistakes/a-latch-cleared-by-an-animation-event-looks-like-dead-code-to-a-cs-grep"
---

# A latch whose only clearer lives in a data asset reads as dead code to a source grep — and is never safe to restore verbatim

**Precondition:** the engine lets data files call code by name (animation notifies/events, script bindings,
reflection-registered callbacks).

`07 §1.2` says normalize transient action-phase flags instead of mirroring them; the test is *find the code that
clears the flag and ask whether the restore runs it.* The failure is in how you **find** the clearer.

A damage-reaction latch on an enemy family: `TakeDamage()` sets `m_hit = true`, a public `ClearHit()` sets it false,
and the AI tick early-returns into a Hit state while `m_hit` holds — no chase, no attack. A source-wide grep for
`ClearHit` returned only its declaration. Read literally: *the flag is never cleared* — a ship-blocking bug — so the
natural conclusion is "vestigial field, restore it verbatim, it can't matter."

**Both conclusions are wrong.** Grepping *all* files found the callers: two animation clips whose event tracks invoke
`ClearHit` by name string. The game works; the clear happens when the hit animation reaches its event frame.

## Why this clearer is the worst case for a restore

An animation event fires only if the animation **enters and advances through** the state that owns it, and a restore
cannot promise that: the pose comes back, not a queued transition; the driver that would re-enter the state is the
thing the latch gates; and nothing advances under the freeze. So **`false` is the safe direction** — you give up one
flinch. Drop the captured value, record why, and note the classification **does not expire** (contrast
`learnings/common-mistakes/a-transient-state-classification-expires-when-a-later-wave-restores-its-driver.md`).

## The check

**Search the whole project, not just the source, for the clearer's name:** `grep -rl "ClearHit" .` — animation,
script, level and config files all count. Three string-keyed mechanisms hide from a source grep:

| Mechanism | Restore can drive it? |
|---|---|
| Animation event / notify in an animation asset | **No** — the clip must enter and advance to the event frame |
| Designer-wired event listener in level/template data | Yes, if you fire the event — and it is live from load, with no registration call in code |
| Call-by-name from code or script (string literal) | Sometimes — and a rename silently breaks it |

**The tell:** a public clearer with zero source callers, guarding behaviour whose absence would be an obvious bug.
When "nothing calls this" and "the game works" are both true, the caller is in data. A source-only search doesn't
just miss a caller — it inverts the normalize-vs-mirror verdict.
