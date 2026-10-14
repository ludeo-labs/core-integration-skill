---
category: architecture
tier: generalizable
sourceGame: TacticsGame
phase: "2"
question: "Is the game turn-based (initiative order, action points, discrete unit actions)? If so, has the team agreed whether captures are anchored to turn starts?"
sanitized: true
origin: "unreal:architecture/turn-based-capture-at-turn-boundaries"
---

# Turn-based games: agree on turn-boundary captures early; it changes what must be restored

**Applies when** the game is turn-based (rounds, initiative, discrete unit actions), as confirmed in the intake
and by the code.

## Lessons

1. **Ask the team whether captures snap to turn starts.** One team answered "assume a capture always starts at
   the beginning of a turn". That one decision dropped unit velocity and heading, mid-animation poses and
   projectiles in flight from the first-frame must-restore list. Record it prominently in the plan: if the team
   later wants mid-turn captures, all of that comes back. (The intake's "what must the first frame show" question
   is where it comes up.)
2. **Turn-boundary state suits manual restore well.** At a boundary the key state is discrete: grid positions,
   health, faction, action points, initiative order, ability cooldowns, objective flags. There's no physics settle
   and no mid-motion restore, so manual `DataWriter`/`DataReader` restore is tractable even without a save system.
3. **Turn-system state must be captured and restored.** Round number, initiative order and active-unit index
   decide whose move it is and drive the music, UI and AI pressure. Capture the runtime **ordered** list, not the
   per-unit initiative stat it was derived from. Restoring the units without whose turn it is breaks the first
   frame.
4. **Ability and cooldown state is must-restore, not enrichment.** In a tactics game a restored battle with reset
   cooldowns changes every decision. Ask about it explicitly when you tier entities.
5. **Actions need a turn-based heartbeat.** The shooter-style "per-shot damage" heartbeat becomes per-attack /
   per-hit plus `TurnEnded`. Per-class kill identity can become per-unit-class destroy actions if the team wants
   richer highlights.
6. **Room = the whole battle.** One battle (map load → victory/defeat) is the gameplay session. Turns are not
   rooms.

## Watch out

- Turn-based UX often has custom waits (enemy-turn delays, camera pans) implemented without the engine's pause.
  Find the real pause primitive before wiring `PauseLudeo`/`ResumeLudeo` (`phase 6 · task 1`).
- Non-deterministic combat RNG after the restore is usually fine. Only chase seed capture if the restore-time
  layout or a scripted outcome depends on it.
- Turn-boundary capture is a UX decision the team can't judge from a description. Watch a real replay early;
  see `learnings/architecture/turn-boundary-quantized-write-cadence.md`.
