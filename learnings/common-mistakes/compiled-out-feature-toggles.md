---
category: common-mistakes
tier: generalizable
sourceGame: ActionRoguelike
phase: "2,6"
question: "Does the game use preprocessor feature toggles (#define USE_X 0/1, #if FEATURE_X) that could compile out an event system or the broadcast you plan to hook?"
sanitized: true
origin: "unreal:common-mistakes/compiled-out-feature-toggles"
---

# Feature-toggle defines can compile out the event you're hooking

**Symptom:** a listener registers fine and never fires. In the incident, the "monster killed" broadcast sat inside
`#if USE_MESSAGING_SYSTEM`, and the game header defined it as `0`.

**Fix:** check the **broadcast site** for an enclosing `#if`, resolved for the shipping configuration. If it's
off, hook something else (health crossing zero, a death flag). Don't flip the game's toggle.

**Prevention:** in phase 2, grep for feature toggles (`#define USE_`, `WITH_`, `ENABLE_`) and record the
compiled-out subsystems in `CODE_MAP.json`.
