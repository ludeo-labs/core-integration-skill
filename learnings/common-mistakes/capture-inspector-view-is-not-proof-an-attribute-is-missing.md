---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: "5"
question: null
sanitized: true
origin: "unreal:common-mistakes/ludeo-json-inspector-omits-per-tick-attributes"
---

# An inspector view of the capture is not proof that an attribute is missing

The JSON inspector view of a captured Ludeo showed the object schema and some values, but not every per-tick
attribute. It especially missed attributes first written mid-session. Match phase, a mode flag, an equip index,
wave phase, intensity and progression were all absent from the view. The agent spent time debugging "missing
attributes" that were present in the data: `ludeo_DataReader_Get*` at runtime returned the right values (match
phase 5, intensity 0.641).

**Rule:** don't conclude an attribute is missing from an offline view alone. Verify at runtime: log every
attribute on both sides, the write (`ludeo_DataWriter_Set*`) and the read (`ludeo_DataReader_Get*` result plus
value).
