---
category: common-mistakes
tier: universal
sourceGame: Lyra
phase: "3"
question: null
sanitized: true
origin: "unreal:common-mistakes/missing-include-in-header"
---

# Integration headers must include or forward-declare every type they use

An integration header used a game type in method signatures, but its definition was included only in the `.cpp`.
Every other translation unit that included the header saw an unknown type, and the errors cascaded.

**Rule:** if a type appears in a signature, a member or a base class in a `.h`, include it or forward-declare it
in that `.h`. The `.cpp` includes don't help other files that include the header.
