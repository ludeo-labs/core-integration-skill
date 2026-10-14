---
category: common-mistakes
tier: generalizable
sourceGame: RoguelikeSample
phase: "1,3,5,6"
question: "Are you establishing a compile-warning baseline (or checking whether a change added warnings) on a build that uses a compiler or build-artifact cache — ccache, sccache, a distributed or shared build cache, or a build system that restores outputs from its own cache?"
sanitized: true
origin: "unity:engine-quirks/deleting-scriptassemblies-does-not-force-a-recompile"
---

# A recompile you forced can still be a cache restore — a zero-warning baseline is usually a lie

Applies when the build sits on top of an artifact cache. The compile gate (`phase 3 · task 5`) checks "no new warnings
introduced", which needs a **baseline warning count** — on a large codebase, "did my change add warnings?" is
otherwise unanswerable. The obvious way to force a real compile is to delete the build outputs and rebuild.

That **appears** to work: the run takes longer than a no-op, the object files and binaries come back with fresh
timestamps, and the log shows the build steps running — every signal you would look for. Observed on a ~1000-file
project:

```
errors: 0
warnings: 0
```

Both numbers were wrong to trust. The next run that genuinely invalidated the cache (it changed the compilation
inputs) reported **114 warnings, 88 from game code that had not changed at all**.

## Why

The build system kept its own cache of compiled artifacts, separate from the output folder. Deleting the outputs did
not invalidate that cache; it **restored** them without invoking the compiler. No compiler invocation → no
diagnostics → warnings that genuinely exist in the source never reach the log. A compiler cache (`ccache`/`sccache`)
does the same on a hit unless it is configured to replay diagnostics.

The failure is silent and **directional** — it always under-reports. A baseline of 0 makes every later compile look
like a regression, or (worse) makes a real regression invisible because you assume the tool is noisy.

## Get a number you can use

**Measure the baseline from a run that was genuinely invalidated, not one you believe you forced.** Cheapest first:

- **Take it from the first run that changes the compilation inputs anyway** — e.g. the first build with the SDK
  enabled (CR-001's macro flips). Attribute warnings by path: game code is the pre-existing baseline; the SDK headers
  and the integration layer are separate numbers worth recording.
- **Confirm the compiler actually ran** before believing any count — look for real compile invocations (per-file
  compile lines, cache-miss statistics), not for "build step ran".
- **Bypass the cache explicitly** for the baseline run (disable the cache or force a miss, per its documentation).
- **Sanity-check against zero.** A codebase of any size with exactly 0 warnings is far more likely a cache restore than
  a pristine project. Treat 0 as a claim to verify.

## Mind the path separator when attributing

Windows compilers write `src\game\…`, not `src/game/…`. A grep for the forward-slash path returns almost nothing and
reads as "no game-code warnings" — the same wrong conclusion by another route. Match the separator the log uses.

Related: `learnings/common-mistakes/a-green-compile-does-not-prove-your-edit-compiled.md` — same family: a clean
result that never exercised the thing you care about.
