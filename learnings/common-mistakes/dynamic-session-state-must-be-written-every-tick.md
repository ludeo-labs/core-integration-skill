---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: "5"
question: null
sanitized: true
origin: "unreal:common-mistakes/gamemetadata-must-be-per-tick-for-dynamic-state"
---

# Dynamic world/session attributes must be captured every tick, not only at room open

**Symptom:** a Ludeo captured late in a mission restored to the mission's opening phase.

**Cause:** the world/session object's attributes were written once, at room open. At that point the match phase,
wave phase and intensity held their start values. They changed later, but were never re-written.

**Fix:** split the object's attributes:

- **Static** (level id, map name, bot count, entry identity, `5b`): write once at registration.
- **Dynamic** (match/round phase, wave phase, progression, intensity, objective state): write every capture tick,
  inside the same `ludeo_DataWriter_EnterObject` / `LeaveObject` scope as entities.

For every attribute you add to that object, ask *"does this change during play?"* If yes, capture it per tick.
