---
category: common-mistakes
tier: generalizable
sourceGame: ActionGame
phase: "5"
question: "Is the player's view direction (camera yaw/pitch) owned by a controller or camera rig separate from the body entity's transform?"
sanitized: true
origin: "unreal:common-mistakes/fps-camera-needs-setcontrolrotation"
---

# Restoring the player body's transform doesn't restore where the camera looks

**Precondition:** the view direction lives on a controller or camera rig.

Writing the body's transform leaves the controller's rotation at its spawn default, so the player faces the wrong
way. Capture the view yaw/pitch and restore it through the controller:

```cpp
player.SetTransform(captured.transform);
if (auto* ctrl = player.GetController())
    ctrl->SetControlRotation(captured.viewYaw, captured.viewPitch);
```

Only the player needs this; AI turns its own body. See `07 §8.4`.
