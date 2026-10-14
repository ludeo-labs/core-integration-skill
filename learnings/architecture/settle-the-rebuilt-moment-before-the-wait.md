---
category: architecture
tier: universal
sourceGame: TPSSample
phase: "5"
question: null
sanitized: true
origin: "unity:architecture/settle-the-rebuilt-moment-before-the-wait"
---

# Why the settle exists, and what it costs the checks after it

CR-010 step 5 fixes the order: freeze → apply → **settle ~0.5 s with time running and input off** → freeze again →
`OpenRoom`. It is tempting to skip the settle and freeze straight after the apply, because the moment then waits
frozen behind the overlay anyway. Do not: a freshly rebuilt moment cannot be frozen where it stands.

## Why the frames are needed

- **A teleport needs the simulation running.** A character controller or movement component held at zero time
  can swallow the position write; the move lands only when the movement system next ticks. The same rule
  was found independently on two different engine families.
- **Pooled and spawned objects finish coming up over a frame or two** — activation callbacks, physics bodies,
  attachment.
- **The deferred-property queue drains on the settle's first tick** (`ApplyDeferred()`, `07 §6`).

In the source integration 0.5 s wall-clock was enough; integrations on the other engine family use the same
order of magnitude.

## Implementation notes

- The freeze controller needs an explicit **settle mode**: time released, input hold kept, and any per-frame
  re-assertion of the freeze skipped while settling. Ending the settle — or the freeze being released for any other
  reason — re-freezes or clears the mode. Keep it a separate bit from the overlay pause (CR-011 "INDEPENDENT").
- State-mutating systems that would overwrite the snapshot during those frames stay gated on `IsRestoring()`, which
  is still true until the settle ends (CR-010 "Freeze vs suppress", `07 §9.11`).
- **Expect drift.** Enemies act for half a second, so small movement from their captured spots is normal. Any
  placement check after the settle needs a tolerance — a few metres for AI, tight for the player, who must not move
  (`learnings/architecture/make-the-restore-verify-every-value-it-writes.md`).
- A frozen engine can surface its own noise (e.g. a manually stepped physics world warning about a zero step every
  fixed update). Recognize it as freeze noise, not a restore fault.
