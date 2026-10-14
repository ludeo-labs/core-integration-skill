---
category: common-mistakes
tier: generalizable
sourceGame: VoyagerV2
phase: "5"
question: "Does the game have tracked entities that are not characters (turrets, vehicles, deployables) while the integration's spawn and restore paths are written around a character type check?"
sanitized: true
origin: "unreal:common-mistakes/non-character-actors-spawn-and-track"
---

# Non-character entities get dropped by character-shaped spawn and restore paths

**Precondition:** some tracked kinds aren't characters, but the integration's hooks were first written for
characters.

1. **Spawn detection:** check for non-character kinds **before** the "is this a character?" early return:
   ```cpp
   void OnEntitySpawned(Entity& e) {
       if (IsTrackedTurret(e)) { RegisterTurret(e); return; }   // first
       auto* c = AsCharacter(e); if (!c) return;               // would have dropped turrets
       ...
   }
   ```
2. **Restore spawn:** don't destroy a spawned entity because it failed a character cast. A turret is a plain
   entity, already placed from the spawn parameters.
3. **Spawner versus spawned:** some games spawn an ability or deployer entity, which then spawns the physical
   one. Track the physical entity; the deployer sits at the origin.
