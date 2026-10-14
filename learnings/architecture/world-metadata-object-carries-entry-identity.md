---
category: architecture
tier: universal
sourceGame: Lyra
phase: "5"
question: null
sanitized: true
origin: "unreal:architecture/game-metadata-writable-object-required"
---

# The world/metadata object is required — create it first, and put the entry identity on it

Every integration needs a world-level object (`objectType` such as `GameMetadata`) created when the room opens,
**before** any entity object. It carries what no single entity owns:

- **entry identity** — which level, which mode/ruleset, which entry point (`07 §2.2`);
- static setup — party or bot count, difficulty, the seed;
- `schema_version` (`learnings/architecture/capture-schema-lifecycle-management.md`).

**Why it matters:** in Player Flow the validate step reads the entry identity first, to decide whether this
integration can play the Ludeo and which level to reach (`07 §2.1` steps 2 and 4). Without it, the level is
hard-coded — which breaks the moment the integration supports a second level, and leaves no way to reject a Ludeo from
an unsupported one.

```cpp
// After OnRoomOpened — before registering any entity object
const LudeoObjectId world = adapter.CreateWritableObject("GameMetadata");   // ludeo_DataWriter_CreateObject
{
    ScopedWriterObject scope(world);                                        // EnterObject / LeaveObject (CR-002)
    adapter.SetString("level_id", game.CurrentLevelId());                   // ludeo_DataWriter_SetString
    adapter.SetString("mode_id",  game.CurrentModeId());
    adapter.SetInt32 ("bot_count", game.BotCount());                        // ludeo_DataWriter_SetInt32
    adapter.SetInt32 ("schema_version", kLudeoSchemaVersion);
}
```

(Shape only — check the exact signatures in the SDK headers, `06 §7`.)

The identity fields are written once. World-level state that changes during the run — time of day, active
soundtrack, loaded sub-areas, progression — lives on the same object and is written every tick like any other
dynamic attribute (`07 §8.1`).
