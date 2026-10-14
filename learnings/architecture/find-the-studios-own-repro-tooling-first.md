---
category: architecture
tier: generalizable
sourceGame: TPSSample
phase: "2"
question: "Does the game generate its world at runtime (procedural/seeded), or otherwise have a QA 'reproduce this exact run' need? Search for the studio's own snapshot/repro dev tool BEFORE designing capture or restore."
sanitized: true
origin: "unity:architecture/find-the-studio-s-own-repro-tooling-first"
---

# Before designing capture/restore for a generated world, find the studio's own repro tool

**Precondition:** the world is generated at runtime, or QA otherwise needs to reproduce an exact run.

A studio that ships runtime-generated content almost always builds an internal **"reproduce this exact run"**
tool — QA cannot file a useful bug against a world that no longer exists. It is usually a dev-only snapshot: dump
some state to a file or the clipboard, reload, re-apply. It is the highest-value artifact of the mapping phase and
easy to walk past, because it lives in a debug or tools folder, not in the gameplay code you are mapping.

## What it gives you

1. **The real generation inputs** — not "the seed" but the actual set: typically a primary seed plus a secondary
   roll, a theme selector, a difficulty, a progress cursor and a scaling counter, already validated against real
   bug repros. Record them in `CODE_MAP.json` (`game-patterns/procedural-world.md` §3).
2. **Empirical proof of reproducibility** — the studio depends on it daily.
3. **A validated restore order.** Observed: wait for the player to exist → world/seed → progression and loadout →
   collections (inventory, buffs) → **absolute position last** — consistent with two-pass ordering (CR-006).
4. **Non-obvious re-registration steps.** Here, after teleporting to a restored position the destination chunk had
   to be explicitly re-registered with the game's spatial index, or spatial queries silently missed the player.
   Nothing in the generator hints at that.

## How to search

Grep the whole project, not just gameplay roots, for `snapshot`, `repro`, `dump`, `seed`, `debug` near `json`, a
dev-only UI page, and clipboard writes (`SetClipboardData`, the engine's clipboard wrapper) — repro tools copy to
the clipboard so QA can paste into a ticket. Check any `Util`, `Debug`, `Dev` or `Test` folder.

## Two cautions

- **Do not call it from Ludeo code.** It is dev-tool code — file and clipboard I/O, often compiled out of shipping
  configurations. Port its field list and ordering; do not invoke the implementation. And note **where it runs**:
  it restores *into* an established session — it does not create one
  (`learnings/architecture/boot-the-replay-through-the-games-own-entry-flow.md`).
- **Check what it does not cover.** Repro tools restore the player and the world, because that reproduces a bug.
  They usually ignore enemy population, container state, projectiles and boss phase — what a *playable* moment
  needs. Treat its field list as a validated wave-1 floor, not the tracking set.
