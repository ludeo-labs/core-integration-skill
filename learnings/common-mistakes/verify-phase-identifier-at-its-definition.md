---
category: common-mistakes
tier: generalizable
sourceGame: Lyra
phase: "2,3"
question: "Does the integration hook a game phase/state transition identified by a string, tag, hashed name or data-defined id (rather than a C++ enum the compiler checks)?"
sanitized: true
origin: "unreal:common-mistakes/wrong-gameplay-phase-tag"
---

# Verify a phase/state identifier where it is defined, not where the code mentions it

**Precondition:** phases are named by strings, tags or data-defined ids the compiler can't check.

The integration's gameplay-start hook subscribed to the "playing" phase using the name found in the phase manager's
comments. The game's real identifier carried a feature prefix from its data-defined hierarchy. The subscription
matched nothing.

A wrong identifier fails **silently**: no error, the callback never fires, no room opens, `Begin` never runs — it
looks like an SDK lifecycle bug, not a typo.

**Catch it in `phase 2`** — find the **definition**, not a reference:

1. Grep config and data files (ini/json/data tables) for the name, prefixes included.
2. Grep the source for the registration/definition site, not call sites.
3. Run the game and grep its log — many games log the exact identifier when a phase starts.
4. Record the full identifier and where it is defined in `CODE_MAP.json`.

Give every such handler an entry log, so a never-firing subscription shows up as a missing line in the first run.
