---
category: engine-quirks
tier: universal
sourceGame: ActionGame
phase: "5"
question: null
sanitized: true
origin: "unreal:common-mistakes/ludeo-trimmer-trims-state-and-video-together"
---

# The Ludeo trimmer trims the captured state stream too, not just the video

## The rule

The platform's trimmer cuts **both the video and the captured data stream**. When a creator trims a Ludeo, Player
Flow restores the state at the trim point, the same moment as the first frame of the trimmed video. Capture is a
continuous stream of per-tick deltas, and the trim selects the point in that stream to restore.

**Never tell a user** that the snapshot is one moment at room close and the trim only affects the video, so a
mismatch is expected. That is wrong, and it points the investigation away from the real bug.

## How the wrong conclusion forms

A user reports "the player isn't where I trimmed to; enemies are missing; the combat state is wrong". The agent
looks at the capture, sees an early-looking value on the world object (combat phase 0), and concludes the cloud
picked an early snapshot because the trim is video-only. That blames the platform for what is almost always an
integration bug, tells the user something they know to be false, and burns a debugging session.

## What to investigate instead

1. **The capture path.** Is every dynamic attribute written every tick in Creator Flow? If one stops updating,
   the trim point reads stale data (see the per-tick world-state lesson).
2. **The read side.** Does the reader, through `ludeo_DataReader_GetObjectsInfo`, return what existed at the trim
   moment? Log the counts and key values.
3. **Bisect integration versus backend.** Revert to a known-good integration commit, capture and trim the same
   way, and replay. If the trim restores correctly there, the bug is in the integration. If it doesn't, take it to
   the SDK/backend team with both logs.

Related: `learnings/common-mistakes/no-puppet-mode-ludeo-is-snapshot-restore.md`,
`learnings/common-mistakes/dynamic-session-state-must-be-written-every-tick.md`.
