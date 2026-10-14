---
category: common-mistakes
tier: universal
sourceGame: ActionRoguelike
phase: "4,5"
question: null
sanitized: true
origin: "unreal:common-mistakes/missing-gamemetadata-breaks-ludeo-creation"
---

# A missing world/session entry-identity object fails silently, and far downstream

When the world/session metadata object (level/map id and the other entry identity, `4` and `5b`) was not created
in Creator Flow, **nothing complained**. There were no SDK errors and no warnings, and the overlay showed the
highlight as captured. The failure surfaced only when someone tried to turn that highlight into a Ludeo: on that
integration, creation itself failed without the map identity. Even where creation succeeds, a capture without it
cannot be validated or restored: `07 §2.2` ignores the selection.

An earlier note framed the object as "needed for Player Flow level loading". That understated it, so it wasn't
treated as a hard requirement during tracking work.

## How to apply

- Create the entry-identity object **first**, before any entity object, as soon as the `DataWriter` is available,
  and write its identity attributes in the same transaction (`06 §3.2`, atomicity).
- **Fail loud:** after registration, if the object's id is invalid or its identity writes failed, log an error.
  Treat it as a broken capture, not as optional metadata.
- **Detection:** if a user reports "highlights record but can't become Ludeos", or every selection is ignored at
  validation, check for this object before anything else.
