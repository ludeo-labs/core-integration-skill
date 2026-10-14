---
category: common-mistakes
tier: generalizable
sourceGame: TPSSample
phase: "5,8"
question: "Are you diagnosing entities the player reports as missing or invisible with a check that reads a component's render-enabled flag (or any component state)? Component state is not what the player sees — measure the player's view."
sanitized: true
origin: "unity:common-mistakes/renderer-enabled-is-not-visible-to-the-player"
---

# A render-enabled flag is not "visible to the player"

Applies when diagnosing "missing" or "invisible" restored entities from component state.

An audit that counts enabled renderers will fight the human's eyes and lose. Ways an entity is "rendered" by its
flags yet invisible, all hit in one integration:

- **Distance / frustum culling.** The game's own culling system disables renderers of distant or off-screen entities
  **by design** and re-enables them on approach. An audit flagging these reports the feature, not a bug — the tell is
  that they "heal" when the player nears. Conversely an idle enemy parked out of sight is hidden legitimately forever;
  the defect there is the AI that parked it, not the renderer.
- **Dissolve materials.** Renderer on, dissolve parameter at full — a ghost.
- **Entombed in scenery.** Renderer on, in view, standing inside a collider (spawn placement or knockback into
  geometry the creator's run had destroyed).
- **Inconsistent checks.** A check that also requires the whole parent chain to be active counts differently from
  one that doesn't — know which yours reads before quoting a number.

**Measure the player's truth, not the engine's flags:** project the entity through the **real** game camera (in
front, inside the viewport, within draw distance), read the material's dissolve value, and run an overlap probe at
chest height for entombment (a small probe can't tell buried from wall-hugging).

The single most decisive instrument is a **debug beacon**: a fresh primitive with its own unlit material, attached
to every entity the books count as alive. It lives outside every managed renderer list, the culler and the dissolve,
so "ball with no body" = invisible, "ball in rock" = entombed, "no ball while the count says alive" = the entity
doesn't exist where the books claim. One run with beacons ended a week of argument. Compile it out of shipping
builds.

Also: log volume is frame time. A per-entity line every sweep tanks the frame rate and the human's patience —
aggregate routine events per sweep, print anomalies individually, and repeat a health line only when it **changes**.
