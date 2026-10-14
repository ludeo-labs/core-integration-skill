---
category: common-mistakes
tier: generalizable
sourceGame: TPSSample
phase: "3,5"
question: "Are you citing the ABSENCE of an error line as proof a code path got past a guard? Check the guard can actually fire at all — a singleton accessor that lazily CREATES its instance never returns null, so the null check beneath it is dead code."
sanitized: true
origin: "unity:common-mistakes/a-guard-that-cannot-fire-is-not-evidence"
---

# A guard that cannot fire is not evidence

**Precondition:** you are reasoning from a log line that did *not* appear.

Diagnosing a replay that stopped part-way, the reasoning was: "the boot function logs an error and returns if the
level manager is missing; no such line is in the log; therefore it got past that point." Every clause is true and the
conclusion is worthless — the guard **cannot fire**.

The game's singleton accessor lazily constructs its instance (`if (!s_instance) s_instance = new LevelManager();`, or
a function-local static), so `Get()` **never** returns null and every `if (!LevelManager::Get())` beneath it is dead
code. Worse, the manager existed in no shipping level at all, so on a cold start **the integration's own call was what
brought it into existence.**

## Two costs — the second is the expensive one

1. The dead branch — harmless noise.
2. **A whole session of reasoning anchored on it.** "Neither guard fired" was recorded as positive evidence and
   narrowed the search to everything after that point, when the guard had never been able to say anything.

## What to do instead

- Before treating a missing log line as evidence, **read the guard's condition and confirm it is reachable.**
- Prefer **positive** breadcrumbs to negative inference. A trace that fires on the way through proves the path ran;
  an error that did not fire may be unreachable, never called, or newer than the build.
- Don't generalise across singletons by naming convention. In the same codebase one singleton base auto-created (its
  null check dead) while another was a plain static pointer assigned during init (its null check load-bearing).
  Check the specific accessor.

Same family as `learnings/common-mistakes/a-green-compile-does-not-prove-your-edit-compiled.md`: an absent signal
read as a present one.
