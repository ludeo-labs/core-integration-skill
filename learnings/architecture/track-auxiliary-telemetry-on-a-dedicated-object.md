---
category: architecture
tier: generalizable
sourceGame: CoopShooter
phase: "5"
question: "Are you adding auxiliary per-tick data (input telemetry, debug streams, anything that isn't an entity's restore-state) to the capture?"
sanitized: true
origin: "unreal:architecture/track-telemetry-on-a-dedicated-object-not-ad-hoc-entity-attrs"
---

# Track auxiliary telemetry on its own dedicated object, not as extra attributes on an entity object

**Applies when** you add per-tick data that isn't part of any entity's restore-state (input telemetry, a
diagnostics stream) to the capture.

## What happened

Input telemetry was first written as extra `ludeo_DataWriter_Set*` attributes on the existing player-character
tracked object, inside its per-tick writer. The exported capture showed the character's transform and health,
and the singleton game-metadata object's attributes, but **none** of the added attributes. Moving the same data
onto a **dedicated tracked object** (its own `objectType`, created once like the metadata singleton and written
every tick) made it appear immediately. The root cause on the entity object was never isolated. The dedicated
object is the shape that worked.

A second, independent cause turned up along the way: the entity writer was gated on "is this the locally
controlled player", which was false for the tracked character, so the write was silently skipped.

## The rule

Give auxiliary streams their own object:

- `ludeo_DataWriter_CreateObject` once at session start with its own `objectType` and a **stable id that no
  other tracked object uses**. Two tracked objects on one identity key collide.
- `EnterObject` → `Set*` → `LeaveObject` each write tick, like the metadata singleton.
- `ludeo_DataWriter_DestroyObject` on teardown.
- Gate the writes on the session-scoped replay flag like every other state write (`06 §7`), and on nothing
  entity-specific.

## Verify

After the first capture, inspect the exported data or the capture log for the new attributes (`11 §1`
recommends sampling one capture and diffing the attributes against the plan). Don't assume a write that returns
success has surfaced.
