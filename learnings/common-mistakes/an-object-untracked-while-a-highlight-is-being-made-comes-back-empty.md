---
category: common-mistakes
tier: generalizable
sourceGame: RoomActionSample
phase: "4,5"
question: "Does the capture stop tracking objects (ludeo_DataWriter_DestroyObject) when they leave scope (a room change, streaming out, despawn), and could that happen within seconds after the creator presses the highlight key?"
sanitized: true
origin: "unity:common-mistakes/an-object-untracked-while-a-highlight-is-being-made-comes-back-empty"
---

# An object you stop tracking while a highlight is still being made comes back from that Ludeo empty

The capture tracked only the current room's enemies and called `ludeo_DataWriter_DestroyObject` for the old room's on
every room change. One Ludeo came back with all six enemy objects of its room present by `objectType` but with **no
attributes at all** — every `ludeo_DataReader_Get*` returned false, so the restore skipped them as having no id. The
run's other highlights were fine.

The run log explained it. The highlight key press starts an SDK task that usually finishes in 1–2 s; that one took
**12.7 s**. The player crossed into the next room 11 s after the press, the enemies were destroyed in the writer, and
the task still building the highlight kept the objects but not their values. The game gets no "highlight done"
callback (the overlay handles the key), so there is nothing to wait on.

## Fix

Keep scoped-out objects tracked for a while after they leave scope (30 s here; the longest task seen was 12.7 s), and
destroy them from a per-frame tick when the time is up. If the scope returns inside that window, **reuse the same
objects** instead of creating new ones, so no duplicate ids appear.

Re-check the object budget with the linger included — current scope plus everything left in the last 30 s
(`learnings/architecture/the-state-upload-is-lossy-above-a-ceiling.md`). Here the worst case stayed under 70 of ~100.

## How to spot it

A Ludeo whose objects of one type all read empty while other types are fine, and a scope change within seconds of the
highlight key press. Compare the SDK log's highlight-task finish time with the scope change.
