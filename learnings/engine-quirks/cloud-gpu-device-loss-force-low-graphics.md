---
category: engine-quirks
tier: generalizable
sourceGame: EndlessFPS
phase: "7"
question: "Does the game freeze, go black or stall on the Ludeo cloud shortly after gameplay starts while working locally — with GPU device-loss errors in the cloud log?"
sanitized: true
origin: "unreal:engine-quirks/cloud-gpu-device-loss-force-low-graphics"
---

# Cloud GPU device loss — force a low-graphics profile from integration code, and keep re-asserting it

**Precondition:** the integration works locally, but on the Ludeo cloud the session freezes or the stream stalls
shortly after gameplay starts. The cloud runs the **Windows** build on Linux under **Proton**, translating Direct3D
to Vulkan, on a **shared** GPU (`phase 7` — `--runtime-environment proton`) — a far less forgiving target than a
local discrete GPU with a native driver.

## Symptom in the cloud log

- `DXGI_ERROR_DEVICE_REMOVED (0x887a0005)` and/or `VK_ERROR_DEVICE_LOST` from the D3D-to-Vulkan layer.
- The streamer's frame grab starves (multi-second stalls), because no new frames arrive once the device is lost.
- Distinguish it from a **frozen scene**: no device-loss codes and a healthy frame grab with a static picture
  point to a held pause or a failed restore instead (CR-010 / CR-011).

## Cause

The game's high/ultra settings — global illumination, ray tracing, high-resolution shadows, volumetric fog and
clouds, screen-space reflections, full render resolution — overload the translated, shared GPU.

## Fix

From integration code, at game-ready, apply a low-graphics profile through the engine's **highest-priority**
settings path: frame cap ~30, reduced render scale and view distance, and GI / ray tracing / volumetrics / SSR off.

**Why from code, at top priority:** a settings framework commonly re-applies its own saved or benchmarked settings
on every launch — and on a fresh cloud machine with no saved settings it often picks **high**. That re-apply
overrides config files (engine ini, default settings files), so those "fixes" don't stick. Only an override at a
priority the settings framework can't beat, issued from code the integration owns, wins. A developer console or
launch-time console commands are usually compiled out of release builds, so they aren't an option either.

## Gotchas

- **Re-assert, don't set once.** The framework's apply can run after your game-ready hook. Re-apply every ~30
  frames for the first minute or two after ready.
- **It's a floor, not a target.** Prove stability at minimum, then raise one bucket at a time (render scale and AA
  first — best visual return; GI/RT/volumetrics last), re-uploading and watching for `0x887a0005` after each
  step. The first device loss is your ceiling.
- **Your own logs may be compiled out of the release build** — confirm the profile applied indirectly (e.g. the
  30 fps cap shows up as the SDK's `ludeo_Tick` rate dropping to ~30/s) and by the disappearance of the
  device-loss codes; or mirror a marker to stdout
  (`learnings/engine-quirks/diagnostics-to-stdout-for-cloud-logs.md`).
- Gate the profile to the cloud run (a `ludeo.ini` key or launch arg) if the team doesn't want it locally.
