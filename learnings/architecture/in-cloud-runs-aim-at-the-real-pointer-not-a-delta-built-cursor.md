---
category: architecture
tier: generalizable
sourceGame: RoomActionSample
phase: "7"
question: "Does the game aim with a virtual cursor built by summing mouse deltas (OS cursor hidden and confined), and will it be played through the cloud stream?"
sanitized: true
origin: "unity:architecture/in-cloud-runs-aim-at-the-real-pointer-not-a-delta-built-cursor"
---

# In cloud runs, aim at the real pointer instead of a cursor built from mouse deltas

**Precondition:** the game hides and confines the OS cursor and moves its own virtual cursor by accumulating raw
mouse deltas, and the build will be played over the Ludeo cloud stream.

## What happened

A cloud tester reported the aiming as "input lag". The game summed raw mouse deltas times a sensitivity into a
hidden cursor, and its aim ray ran only every other frame. Over a stream, mouse input arrives batched and rescaled,
and the confined pointer hits the window edges, so the summed cursor drifts away from where the viewer's pointer
really is. The in-game sensitivity setting was out of reach, because the pause menu is blocked for cloud players.

## Fix — cloud runs only

Behind a cloud-only launch argument that the uploaded `run.bat` (the build's `--exec-path`, `7-upload-build.md`)
passes — off by default:

1. Aim at the **real pointer position** (the OS cursor position in window coordinates). This game already had that
   mode for its editor; a flag switched it on.
2. Refresh the aim **every frame**.
3. Cap the frame rate at the stream's rate (60 fps), vsync off — frames above what the stream shows only cost
   encoder time.

Keep all three cloud-only. Locally the result feels less snappy (60 instead of 144 fps, OS pointer acceleration
instead of raw deltas), so judge it on the cloud build, not the local one. The tester found the cloud build played
better.

## Before the first cloud upload

Find how the game turns the mouse into aim — absolute position, delta accumulation, or a camera-relative stick.
Delta accumulation into a hidden cursor is the case to switch over for streaming.
