---
category: common-mistakes
tier: generalizable
sourceGame: PlatformerSample
phase: "6"
question: "About to emit the PauseLudeo/ResumeLudeo pair from the game's pause primitive? Read EVERY call site first — a symmetric-looking pause function is commonly also used as a terminal freeze (death, level end) that nothing ever resumes, and one such emit leaves the objective timer stopped for the rest of the run."
sanitized: true
origin: "unity:common-mistakes/check-the-pause-primitive-for-terminal-callers"
---

# A pause primitive with terminal callers leaves your span open forever

**Precondition:** one low-level pause function is shared by the pause menu and other systems.

The game had one obvious pause function everything funnels through, so the `PauseLudeo`/`ResumeLudeo` pair went there
(`phase 6 · task 2` Step 5). A playtest produced **one Pause and no Resume**, and the objective timer stayed stopped for
the rest of the run. The pause menu used the function symmetrically, but the death and level-end handlers used it as a
**terminal freeze** that is never resumed — the level reload just resets the flag.

**Read every call site of a pause primitive before wiring a span to it**, classify each as symmetric or terminal, and
put the pair where the pause is genuinely a pause and genuinely symmetric — here, the live pause manager's own
`Pause()`/`Unpause()`, not the shared primitive underneath.

## Decide per window whether the clock stops

The same log showed the death screen emitting **both** span pairs at once, because it was wired to the pause primitive.
The pairs mean different things to the backend (`06 §7.3`): **non-ludeoable** keeps the objective timer running;
**pause** stops it. A death sequence suspends play while the clock must keep running, so it sends **only** the
non-ludeoable pair — no `PauseLudeo`. A screen that genuinely freezes the simulation (the pause menu, the overlay pause)
sends **both**, nested: `PauseLudeo` first, `StartNoneLudeable` inside, closed in reverse (`06 §7.3`).

## Three more things that bit on the same work

- **Two implementations of the same system.** The pair was wired to the legacy pause class, which the input binding
  never reaches. Find the live one by tracing from the input poll, not by grepping a class name — and remove the emit
  from the dead one so it can't double-fire later.
- **Close both spans at the level-return hook.** Death/cutscene paths that load additively bypass the game's pre-load
  function, so the normal close never runs there. Back in a live playable level, neither span can still be in effect.
- **Guard the close on the frame number, not a boolean.** Two windows close at the same hook — one opened frames
  earlier (death), one opened in the same frame (a cutscene whose init runs before the hook within one load pass). A
  plain "already opened" flag fixes one by breaking the other. Related:
  `learnings/common-mistakes/per-frame-open-needs-a-closed-latch.md`.

## Attribute a log line before believing it

A single `PauseLudeo` was reported as "the pause works". It came from the **replay ending** — the backend ends a Ludeo
via `PauseGameRequest` (`05 §6.11`), which the CR-011 handler correctly reports as a pause. The key press had produced
nothing. When one line has two possible producers, attribute it first: a genuine pause lacks the session-end and
freeze lines immediately before it.
