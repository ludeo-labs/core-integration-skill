---
category: common-mistakes
tier: universal
sourceGame: RoguelikeSample
phase: "1,3,5,7"
question: null
sanitized: true
origin: "unity:engine-quirks/the-first-setup-run-throw-is-version-dependent"
---

# Check for the outcome, not for the remembered bug — a version-specific learning is a check, not a prediction

Many learnings record a **defect or behaviour of one specific version** — of the SDK, a toolchain, a build tool. The
trap is reading such a learning as *"here is what will happen"* instead of *"here is a failure mode to check for"*.

The observed case: a learning recorded that a setup step, run headlessly the first time, **throws** and aborts before
its final step, and prescribed running it twice. On a newer version the first run did **not** throw — it completed
end to end. Running it twice was still cheap and harmless. What had to change was what got checked afterwards.

## Two opposite mistakes from the same model

- **A clean run reads as suspicious** — "no error, so maybe it silently did nothing" — and you hunt a problem that
  isn't there.
- **On a version where it does fail, a clean second run is taken as proof that everything ran**, when it only proves
  the second run finished.

Both come from testing for the **bug** rather than for the **outcome**.

## What to do instead

1. **Check the outcome directly**: the last step's own log line, and the artifact on disk — files present, the
   setting written, the library actually loaded. Those are version-independent.
2. **Don't use the exit code as the pass signal** in either direction; a step that threw internally can still exit 0.
3. **Record the version you observed** (SDK version line, toolchain version) next to any learning you write or apply,
   so the next reader can tell drift from disagreement.
4. **When a learning's precondition is a statement about what an installed library does, check the installed code** —
   it takes seconds. Be strictest when the learning's conclusion is to *skip* something the docs require: one
   integration dropped a required pre-play freeze because a learning said freezing would stop SDK callbacks; two
   agents agreed, from the learning's body, and neither looked at the code that drives the callbacks
   (`learnings/common-mistakes/drive-ludeo-tick-from-a-path-the-freeze-does-not-stop.md`). Cite the code in the
   plan, not the learning.

A `universal` tier tag is a claim about **preconditions**, not a promise about every SDK version. When a learning's
symptom is absent, verify the underlying outcome rather than concluding either that the learning was wrong or that
something new is broken. Related: `learnings/common-mistakes/investigate-before-asking.md`.
