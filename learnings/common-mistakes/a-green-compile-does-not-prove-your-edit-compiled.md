---
category: common-mistakes
tier: generalizable
sourceGame: TPSSample
phase: "3,5,6"
question: "Are you adding a member to an existing GAME file (an accessor so the layer can read private state, a hook call)? Before trusting the compile gate that follows, confirm the insertion point is LIVE code — an addition nothing references yet compiles clean inside a commented-out block, an `#if 0` region, or a file the build target does not include."
sanitized: true
origin: "unity:common-mistakes/a-green-compile-does-not-prove-your-edit-compiled"
---

# A green compile gate does not prove your edit compiled

**Precondition:** you add a definition to a game file and run the compile gate before anything references it.

> **Code that nothing references yet, added to a region that is not compiled, produces a clean compile.** The gate
> goes green. The member does not exist.

The player's free-look camera angles were private, so the integration added a small public accessor to the file that
declared them. Compile gate: **0 errors.** The next compile — the one that *called* the accessor — failed: the class
has no such member. The whole file body sat inside a `/* … */` block comment; a second, live copy of that camera
logic existed under a different class nearby, and that was the one the game ran.

## Why the ordering hides it

| Compile | Contains | Result |
|---|---|---|
| after adding the accessor | a definition nobody calls | **passes**, live region or not |
| after writing the caller | definition **and** reference | fails loudly if the definition isn't real |

Gate-checking between the two and reporting the first as verified reports a check that could not have failed — it
launders an unknown into a stated fact.

## The check — cheap, before you edit

- **Block comments.** `grep -n '/\*\|\*/' <file>` — a `/*` near the top with its `*/` at the bottom means the file
  is inert.
- **Preprocessor fences.** `#if 0`, or a define that is off in the configuration you build (see
  `learnings/common-mistakes/a-compile-gate-cannot-see-code-fenced-out-of-its-configuration.md`).
- **Not in the build.** A `.cpp` absent from the target's source list (CMake `add_executable`/`target_sources`, the
  `.vcxproj` `ClCompile` items) compiles nothing, and an inline header member is only checked where the header is
  included.
- **A duplicate live implementation.** If a grep for the member name returns two classes, find which one the game
  constructs before editing either.

## The general rule

**Verify against the thing that would fail.** A definition proves nothing alone; a *reference to it* proves it
exists. When the two land in separate steps, report the first compile as "nothing broke", not "the change works".
Ask what the observation would look like if the change were absent — if identical, it is not evidence. Related:
`learnings/common-mistakes/investigate-before-asking.md`.
