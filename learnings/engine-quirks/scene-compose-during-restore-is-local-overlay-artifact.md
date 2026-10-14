---
category: engine-quirks
tier: universal
sourceGame: multiple
phase: "5"
question: null
sanitized: true
origin: "unreal:common-mistakes/scene-compose-during-restore-is-local-overlay-artifact"
---

# Watching the scene compose during a restore is a local artifact, not a cloud bug

## What you see locally

Testing a restore on your own machine, you can watch the level assemble during the restore: entities popping in,
async spawns settling, the world composing itself. It looks as though the viewer will see an ugly "level
building" moment, and the instinct is to add a reveal cover (a loading screen or a black overlay held until the
world settles).

## Why that fix is wrong

The visible composition is a **local-only artifact**: on a local run the overlay draws in-process over a game
window you are already looking at, so you see the world assemble.

On a **cloud** run the viewer sees nothing until the stream to them is connected, after `OpenRoom` → `AddPlayer`.
Under the restore order (CR-010, `07 §2.1`), the apply and the settle finish **before** `OpenRoom`. The viewer's
first frame is the finished moment, frozen behind the overlay. A cover is exactly what CR-010 rules out
("not the menu, not a loading cover"). Reveal-cover machinery is a speculative mitigation for a non-bug
(`learnings/common-mistakes/speculative-mitigations-distort-ludeo-fidelity.md`).

## The correct model

- **Local run:** you can see the composition. That's expected; ignore it.
- **Cloud run:** the composition happens before any frame is streamed to the viewer.
- The freeze holds the simulation, and the room-open ordering hides the assembly. Nothing extra is needed.

## When it is a real bug

If gameplay actually **resumes** while the world is still assembling (unfrozen, `Begin` fired, entities in the
void, actors falling through the floor, wrong counts), that is a genuine ordering or settle problem. Fix the
order: `OpenRoom` only after the settle, and `Begin` only on `player_added && room_ready && applied`. Don't fix the
presentation. "I can see it compose locally" is not "it begins too early".
