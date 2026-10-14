---
category: architecture
tier: universal
sourceGame: multiple
phase: "5"
question: null
sanitized: true
origin: "unreal:architecture/capture-schema-lifecycle-management, unreal:common-mistakes/int-discriminator-probe-before-string-reads, unreal:common-mistakes/readable-object-assert-on-missing-attributes"
---

# Manage the capture schema as a versioned contract from day one — and identify each object before reading it

The attribute set you write **is** a persistence format. Captured Ludeos outlive every code change, QA keeps them as
test assets, and the read side receives inputs your current write side didn't produce: Ludeos captured before you
added or renamed an attribute, captures from before the integration existed, objects your code doesn't recognize.
Reading an attribute the capture lacks has been seen to **hard-assert** on some read paths (a variable-length string
read, `11 §6.8`), while primitive `ludeo_DataReader_GetInt32` / `GetBool` / `GetFloat` reads returned `false`. One
integration went through four schema versions in two days; this is the discipline that made it survivable.

## The rules

1. **Version every capture.** Write an integer `schema_version` on the world / metadata object from the very first
   build. It costs nothing; without it, compatibility handling is impossible later.
2. **Identify each object with one int discriminator before reading it.** Write an `obj_kind` int on every object
   (0 = world/session, 1 = entity, 2 = camera…). On read, inside the `ludeo_DataReader_EnterObject` scope, read
   `obj_kind` **first** with `ludeo_DataReader_GetInt32`. If the read fails, the object isn't one of yours: skip it.
   If it succeeds, the object was written by this integration with its full schema, so the variable-length reads
   that follow are safe. If no object yields the world kind, the Ludeo is foreign or pre-integration.
3. **Bump on any change to the attribute set *or its meaning*.** Adding or removing attributes is obvious. A semantic
   change needs a bump too (one version changed what an entity's `transform` meant — the visible body's pose instead
   of a constant on a dead placeholder — with no structural change). A reader can't tell "right name, wrong meaning"
   without the version.
4. **Keep a minimum supported version and accept a range.** Newer code should play older captures whose data is still
   semantically valid:
   - read the metadata object **first, in its own pass** (`ludeo_DataReader_GetObjectsInfo` order isn't guaranteed)
     and check `min <= version <= current`;
   - gate every newer attribute's **read** on the capture's version — don't probe for its presence;
   - gate the **apply** too: a skipped read leaves a C++ default, and writing that default onto the game clobbers a
     correct fresh-load value (armor = 0 on every unit):
     ```cpp
     if (cap.schema >= 4) { ReadInt32("armor", unit.armor); ApplyArmor(unit); }   // v3 capture: leave the fresh value
     ```
   - set the floor at the oldest *semantically correct* version, not the oldest *readable* one — one integration
     kept v3+ playable but rejected v1/v2, whose transform attribute held wrong data; "successfully" restoring wrong
     data is worse than a clean "re-record required".
5. **Bundle additions; batch the re-records.** Every bump obsoletes part of QA's capture library. When an
   investigation surfaces several missing attributes, ship them as one bump and tell QA which Ludeos need re-recording
   and which still play. If you don't support old schemas at all, say so: document every attribute-set change as
   breaking and tell QA that older Ludeos are incompatible.
6. **Document the history where the constant lives** — one changelog line per version (`v2: +battle_time_s`,
   `v3: transform = body pose`). That is what lets the next agent reason about old captures.
7. **Reject foreign and out-of-range captures in the validate step.** `07 §2.1` validates a selection before
   committing (`07 §2.2.1`); a foreign Ludeo or an unsupported version is an ignored selection — logged with
   "re-record required", nothing torn down. Never an assert, never a half-restore.

## Why day one

Every rule above was back-filled under pressure after an unversioned first schema turned the first incompatibility
into a crash risk. Designed in, it is about thirty lines; retrofitted, it is a debugging arc.
