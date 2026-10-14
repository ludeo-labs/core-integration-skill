---
category: architecture
tier: generalizable
sourceGame: PlatformerSample
phase: "3"
question: "Is the run teardown hooked to the game's 'before I load the next level' wrapper? Grep for direct calls to the level LOADER — every caller that skips the wrapper is an exit path with no teardown, and a persistent singleton's destructor will not save you."
sanitized: true
origin: "unity:architecture/put-the-session-teardown-in-the-scene-loader"
---

# Hook the level loader itself, not the game's pre-load wrapper — and know which exits skip it

**Precondition:** the game has a "before load" wrapper (stops music, banks play time, clears input) that most level
changes go through, and you are placing the CR-007 end-of-gameplay teardown.

The wrapper looked like the choke point; the teardown went there with a comment claiming it "runs before every
level change". It did not. Three exits called the **loader** directly: the game-over screen's exit to the menu, a
demo-end path and a cutscene exit. From a real run log after a game over:

```
action: Death                    <- player out of lives
level loaded: death screen       (additive)
level loaded: menu               <- room STILL OPEN
gameplay session ended -> CloseRoom    <- only when the next level was picked, minutes later
```

The room outlived the run by the whole time the player sat in the menu.

## The backstop that is not one

The integration also called the teardown from the global-state singleton's destructor, as a "backstop for paths
that skip a level change". That singleton persists across level loads, so its destructor runs **only at process
exit** — a quit backstop (`05 §7.4`), not a level-change one. Before trusting any destructor as a teardown site,
confirm a level load actually destroys that object.

## The shape that holds

Hook the point **every** level-replacing load passes — inside the loader's own load entry points (sync and async) —
and leave overlay/additive loads alone: death screens and cutscenes loaded over a live level are non-gameplay spans,
not session boundaries.

Two consequences:

1. **The hook now fires twice** on paths that also go through the wrapper. `ludeo_Room_Close` is async, so the room
   handle stays non-null for a few ticks after the first teardown, and a naive `if (!started && !room) return` guard
   misses the second call — it ends an already-ended session. Add an explicit "teardown done" flag, cleared when the
   next run requests its room.
2. **Not every load is an exit.** A reload of the same level (a death with lives left, a retry) can be the same run
   continuing (`learnings/architecture/in-a-lives-based-game-the-run-ends-at-game-over-not-at-death.md`). If the
   product wants the room to survive it, discriminate at the loader — the reload entry point is the signal — and on
   that path drop tracked objects and re-arm registration instead of ending the session.

Verify by walking every exit in the action map and confirming `End` → `RemovePlayer` → `CloseRoom` appears in the
log **before** the next level's first line.
