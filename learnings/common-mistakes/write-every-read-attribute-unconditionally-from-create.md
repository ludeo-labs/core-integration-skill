---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: "5"
question: null
sanitized: true
origin: "unreal:common-mistakes/registerentity-must-write-initial-attributes, unreal:common-mistakes/sdk-readdata-asserts-on-missing-attribute"
---

# Every attribute the reader reads must be written, unconditionally, from the moment the object exists

The reader expects an attribute on every object of a type. Two capture-side gaps break that expectation, and both
replays crashed: a variable-length (string/blob) read of a missing attribute **hard-asserted** on that SDK layer
(`11 §6.8`). Where a read returns `false` instead, you silently restore a default.

## Gap 1: a conditional write

```cpp
if (!list.empty()) WriteBlob(obj, "pending_list", Serialize(list));   // WRONG: skipped when empty
```

Objects whose list was empty at capture had no attribute at all. Registering the attribute name elsewhere isn't
enough: it must have been **written for this specific object**. **Fix:** always write it, empty included. An
empty list serializes to a zero-length payload, and the read side loops zero times.

## Gap 2: registration without a write

`RegisterEntity` called `ludeo_DataWriter_CreateObject` and left the attribute writes to the next capture tick.
The object entered the schema immediately. When the capture's cut point fell between registration and that first
tick, the restored object existed with **no attribute values**. On one game this happened when a deployable was
placed mid-mission and the snapshot fell within a frame of its registration.

**Fix:** inside the registration, straight after a successful `CreateObject`, write every attribute the reader
reads for that type: transform, the type/spawn key a transient entity is respawned from, and per-type state
(`06 §3.2`, "set initial values immediately"). Treat registration plus initial writes as one transaction, and
retry until both succeed (`06 §3.2`, atomicity). If some state isn't available yet, mark the entity "needs
initial write" so the next tick writes it before anything else.

## Detection before release

For every type you register, put three things side by side: the `CreateObject` site, the per-tick
`ludeo_DataWriter_Set*` calls, and the read side's `ludeo_DataReader_Get*` calls. Every read needs an
**unconditional** write that also runs at registration. Where a write genuinely must be conditional, guard the read
with an unconditionally written "has X" flag.

Mid-session registrations (spawn handlers) are where this bites hardest, because few ticks separate registration
from the snapshot.
