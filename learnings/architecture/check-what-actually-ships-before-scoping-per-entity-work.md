---
category: architecture
tier: generalizable
sourceGame: PlatformerSample
phase: "4"
question: "Before scoping per-entity work (bosses, level types, mechanics), have you checked which levels the shipped build actually contains and can reach? The shippable set is often a fraction of what the repo holds, and it decides what you can verify."
sanitized: true
origin: "unity:architecture/check-what-actually-ships-before-scoping-per-entity-work"
---

# Scope against the levels that actually ship, not the ones in the repo

**Precondition:** the repository holds more levels or content variants than the build packages — a level list,
packaging manifest or build script decides what ships.

A boss wave was planned across the three boss types in the repo. Reading the build's level list first would have
changed the plan: only **one** boss level was enabled. Of the other two, every variant was disabled and one had no
level in the list at all. That fact reordered the work:

- the only **testable** boss was the hardest — no phase field, many timed sequences — so its fight progress had to
  be inferred from an observable proxy;
- the boss with a clean phase index — the nearly free case — **could not be verified at all**, so wiring it would
  have meant shipping unverified code. It was deliberately left unwired: shipping unverified is how the previous
  wave's bugs got in;
- the third boss was never read.

The same check paid off elsewhere: the shipped build contained **five** levels of the game's full set, so a
question about "level 2" was really about one of five reachable levels, and two bosses could not be reached by
playing at all.

## The check

Find what decides shipping — the level list the build packages, the content manifest, the packaging script — and
list what is **enabled and reachable** in the build you will upload. Then, in the census (`OBJECT_TRACKING.md`):

- mark each entity type **reachable / not reachable in this build**;
- put reachable and load-bearing types first;
- for anything unreachable, either get a level enabled for testing or record it as *unwired because unverifiable* —
  a plan that silently includes unverifiable work reads as coverage it does not have;
- watch the variant trap: a folder may hold a normal and an alternate version of a level, and only one ships. The
  one you open in a tool is not necessarily the one the player plays.

Related: `learnings/architecture/audit-every-level-against-the-games-own-save-list-before-calling-restore-done.md`.
