---
category: architecture
tier: generalizable
sourceGame: multiple
phase: "5"
question: "Does the gameplay level finish loading asynchronously after the player entity exists — a gameplay chunk streamed behind a loading screen, or a player loadout (equipment, meshes, abilities) loaded after the level?"
sanitized: true
origin: "unreal:architecture/gate-player-flow-on-streamed-level-not-pawn, unreal:architecture/gate-openroom-on-loadout-ready"
---

# "Reached active gameplay" means the game's async loads are done — not "a player entity exists"

**Precondition:** the level becomes playable in stages: a root level loads, a loading-screen flow streams the real
gameplay chunk in, and/or the player's loadout is loaded after the level. The integration's per-level hooks fire on
the root, before the gameplay content exists.

## The trap

The obvious readiness check for `07 §2.1` step 4 is "the player entity exists". On a staged load it is **false
ready**:

- the loading flow may control a **placeholder** player entity before the real one spawns;
- the gameplay chunk isn't streamed — the apply puts entities into a world with no floor, no navigation, none of the
  level's own entities;
- the loadout isn't loaded — and the level's scripts deliberately wait for it. One level held its briefing dialogue
  until "loadout ready"; the restore ran first, `Begin` came, the dialogue suppression ended, and *then* the briefing
  played over the replay, the weapon equipped late and a cosmetic transition animated visibly. User report: "if I wait
  a few seconds before clicking Play, it works".

## Why Creator Flow hides it

The same early gate can *look* right in Creator Flow by timing luck: session activation's network round trips take
seconds, long enough for the stream to finish. A Player-Flow restore reuses the activated session and passes the gate
in well under a second — before the stream. Don't conclude the gate is fine from Creator Flow; test it in Player Flow.

## The fix

Make step 4's "reached active gameplay" check all of:

1. **The gameplay chunk is in:** an entity that exists only in the gameplay chunk is present (a wave director, a level
   manager — usually one you need a handle to anyway), or the streaming system reports that chunk loaded **and**
   visible.
2. **The player entity is the real gameplay type**, not the loading placeholder, and its animation/visual components
   are initialized.
3. **The loadout is ready:** check the game's "loadout loaded" query; if not yet, subscribe to its completion event
   with a once-guard. If secondary loads (meshes, cosmetics) lag behind that signal, add a short frame buffer.
4. The game's own "is loading" flags are clear.

Poll **unfrozen**, with the input hold on — freezing here stops the very streaming you're waiting for (CR-010,
"Freeze vs suppress"). Bound every wait with a timeout that logs which condition never passed. Only then freeze →
apply → settle → `OpenRoom`.

Waiting costs nothing on the SDK side: nothing happens there until `OpenRoom`.
