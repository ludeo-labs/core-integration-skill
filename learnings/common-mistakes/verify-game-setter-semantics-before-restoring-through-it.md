---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: "5"
question: null
sanitized: true
origin: "unreal:common-mistakes/list-ufunctions-before-calling-bp-setters"
---

# Don't infer a game setter's behavior from its name: read the signature and the body, then exercise it

Restoration usually re-states a value through the game's own setter, so that its side effects (animation, physics,
UI, sound) follow. Picking the setter by name is the trap. For state-machine setters in shipping code, names hide
the details that matter:

- **More parameters than the name implies.** `SetDoorOpen(door, open)` takes a door selector *and* a bool. A call
  shaped like `SetDoorOpen(true)` puts the bool where the selector belongs.
- **Notification-only variants.** A "multicast"/"on-replicated"/"on-changed" handler with a similar name may only
  broadcast or react to a change. Calling it directly doesn't run the body that actually moves the state, or it
  expects the *old* value as a parameter and silently no-ops when given something else.
- **Authority-only or bitmask setters.** `SetDoorState(uint8)` may take a packed state and may run only on the
  authoritative side.
- **Inverted or conditional semantics.** The body may read the bool differently than the name suggests, or
  dispatch differently by context.

The result was hours of debugging "the call succeeded but nothing happens", blamed on cascades that weren't
involved.

## How to apply

1. **Before writing restore code against a setter,** list every candidate on the class (setter, state setter,
   on-changed handler, network variant). For each, read its full signature and body and note what it touches.
2. **Exercise the candidate in isolation** with a dev console command or debug hook that calls it with concrete
   values. Confirm the visible change matches what you expect before committing it to the restore.
3. **Comment the chosen setter** at the restore site, with why it was chosen over its siblings.
4. Verify the result with a read-back of the live state (`11 §10`), not of the field you just set.

Related: `learnings/common-mistakes/choose-the-restore-write-path-per-field.md` (the per-field decision rule this
lesson is one row of).
