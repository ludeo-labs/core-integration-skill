---
category: common-mistakes
tier: universal
sourceGame: multiple
phase: "3,6"
question: null
sanitized: true
origin: "unreal:common-mistakes/sendaction-playerid-must-match-addplayer, unreal:common-mistakes/remove-player-uses-string-id-not-handle, unreal:common-mistakes/room-playerid-avoid-unexported-uniquenetid-tostring"
---

# One player id string, used for `AddPlayer`, every `SendAction` and `RemovePlayer`

## The mistakes

- **Per-entity ids in `SendAction`.** The agent gave each bot its own player id (`"Bot_A_0"`, `"Bot_B_1"`) when
  sending bot kills and deaths. Only the human player had been added to the room. The SDK documentation says to use
  the **same player id you used when adding the player**. Bot events are events in the human's gameplay session,
  not separate players. Actions carrying an id that was never added are dropped (`06 §7.1`).
- **Treating `RemovePlayer` like `AddPlayer`'s result.** Adding a player hands back a gameplay-session handle, but
  removal is keyed by the **player id string**, and the removal callback reports the id, not a handle. An
  integration that kept only the handle had nothing to remove with.
- **Deriving the id from a platform identity that wasn't available.** One integration built the id from the
  platform's online-identity object, which dragged an online-services dependency into the integration (and failed
  to link) for a value that was empty in a single-player game anyway.

## The rule

- The player id only has to be **stable and unique per player within the room**. It doesn't need to be a
  platform account id. For single-player, a fixed or locally derived id (`"Player0"`) is enough. Use a platform
  id only when one is available and meaningful.
- Store it once, as `m_player_id` (`05`, `06 §7.1`), when you call `ludeo_Room_AddPlayer`. Use that same string
  for every `ludeo_DataWriter_SendAction` and for `RemovePlayer`.
- Multiple player ids in `SendAction` make sense only in multiplayer, where each human was added with
  `AddPlayer`. Count the `AddPlayer` calls: if there is one, there is exactly one id.

**Before writing any action code,** read the SDK's guidance on player actions, and check how many players this
integration adds to the room.
