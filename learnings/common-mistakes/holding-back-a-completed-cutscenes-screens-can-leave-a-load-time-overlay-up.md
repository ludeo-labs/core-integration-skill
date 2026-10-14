---
category: common-mistakes
tier: generalizable
sourceGame: RoomActionSample
phase: "5"
question: "Does the restore complete already-played cutscenes by firing their step events while holding back the presentation calls (UI, sound, camera, post effects)?"
sanitized: true
origin: "unity:common-mistakes/holding-back-a-completed-cutscenes-screens-can-leave-a-load-time-overlay-up"
---

# Holding back a completed cutscene's screens can leave a load-time overlay on screen

Completing played cutscenes at restore is right: their step events carry world changes (doors, unlocked moves), and a
moment the run had already passed should not replay (`07 §11.3`). Firing all steps at once also replays their
presentation, so the restore held back UI, sound, camera and post-effect calls. That fixed a tutorial screen popping
up after Play.

It also broke a level nobody re-tested. Its intro overlay — a full-screen panel with black bars and boot text — is
**visible when the level loads**, and only the intro's own "hide" steps switch it off. Held back as presentation, they
never ran, so every Ludeo of that level would sit behind the overlay. The level's music, muted at start and started
only by an intro step, was held by the sound filter. Every restore check passed: nothing checked the screen.

## Fix

- Screens a completed cutscene switches (on **or** off) are presentation that **ends hidden**: collect the UI objects
  whose show/hide calls were held and hide them after the completion.
- Treat the level's music controller as world state, not a one-shot sound (`07 §8.5`).
- Log held calls and screens left hidden, per cutscene, so the next level's odd case shows.

## How it was found

By a whole-game re-scan before the first upload
(`learnings/common-mistakes/rescan-every-level-before-the-first-cloud-upload.md`), comparing each level's data with
the restore code. A replay after the fix logged five intro screens that had still been on. Check the frozen moment
behind the overlay (CR-010) on a screenshot per level, not only in logs.
