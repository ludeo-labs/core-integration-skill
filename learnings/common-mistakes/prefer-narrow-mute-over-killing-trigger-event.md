---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: "5"
question: null
sanitized: true
origin: "unreal:common-mistakes/prefer-narrow-mute-over-killing-trigger-event"
---

# Mute the one subsystem; don't kill the broadcast that feeds several

## The mistake

To stop a briefing voice-over from playing on restore, a plan proposed skipping the level's "gameplay phase
started" event entirely. That would have silenced the VO, and also cut off everything else the level script does
on that event: opening doors and gates, starting spawns, activating objective markers, switching HUD state. With
a perfect restore it might not have mattered. With an imperfect or partial restore, or the next slice, it leaves
the level empty. The blast radius was far wider than the symptom.

## The lesson

When one event drives several subsystems and you need to suppress only one of them, **mute that subsystem; don't
gag the event**:

- ❌ `if (IsRestoring()) return;` before raising the phase-started event: dialog, spawns and markers all die.
- ✅ `dialog.SuppressNextCue()` while restoring: the dialog is dropped, and spawns and markers run normally.

| Symptom | Fix at this layer |
|---|---|
| Audio / dialog cue | Mute the audio or dialog manager |
| UI widget appears | Hide it, or gate the function that creates it |
| Cutscene plays | Cancel that specific sequence (and see `07 §11.3`: keep the presentation, skip the reposition) |
| Animation plays | Short-circuit that specific ability or animation call |
| Timer / delay | Cancel that timer by handle, not the whole manager |

Kill the broadcast **only** when every subscriber is the thing you're silencing, you've confirmed none does
gameplay-critical work, and no narrower mute exists.

## Test for wide-blast-radius patches

Before gating any event, delegate or callback:

1. Find every subscriber (grep the event name and its registration calls).
2. Read each subscriber's body and classify it: audio/VO, UI, gameplay, statistics, networking.
3. If more than one class is hit and only one is the symptom, the patch is too wide.

One early return looks like less work than finding a mute API. Over the life of the fix it's usually more work,
because broad patches regress in later phases.

Related: `learnings/architecture/suppress-briefing-vo-by-muting-the-dialog-system.md`,
`learnings/common-mistakes/verify-vo-path-before-proposing-skip.md`.
