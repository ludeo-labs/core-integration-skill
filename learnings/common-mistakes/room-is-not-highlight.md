---
category: common-mistakes
tier: universal
sourceGame: FPSGameStarterKit
phase: "2"
question: null
sanitized: true
origin: "unreal:common-mistakes/room-is-not-highlight"
---

# A Ludeo room is not a highlight

## The mistake

Treating the room lifecycle as the highlight lifecycle: proposing "one life = one room" or "one match = one
room", as if each highlight needed its own room open and close.

## The correct model

- **Room:** a long-running recording session that stays open for the gameplay session (typically level load →
  level exit; `05`, CR-009).
- **Highlights:** moments extracted from the data **within** an open room.
- You don't close a room to produce a highlight. Room open/close follows the gameplay **session**, not individual
  moments.

When deciding room boundaries, ask *"when does recording gameplay start, and when does it stop?"* That is the room.
*"What is one highlight?"* is a different question. Small-sounding "session unit" examples (round, wave) tempt
over-narrow rooms.

## Second surface: verification checklists

The same misconception leaked into runtime-test instructions. The agent told the human to "play through to battle
end so the room closes cleanly" as part of the capture step, implying highlights depend on the room closing. The
human corrected it: capture works at any moment while the room is open. Keep the two test items separate:

1. **Capture a highlight mid-play.** It needs only an open room with gameplay begun.
2. **Play to the end.** This is a separate test of the natural room-close path (the game-over signal, then the
   teardown chain). It validates the lifecycle, not capture.

Never word (2) as a prerequisite of (1).
