---
category: common-mistakes
tier: universal
sourceGame: TPSSample
phase: "5"
question: null
sanitized: true
origin: "unity:common-mistakes/prefer-a-signal-over-polling-in-per-tick-capture"
---

# Never discover state by scanning from a per-tick capture writer — take the signal

Capture writers run on **every tick**. Restore code runs **once**. They look and read alike, and it is easy to write
one in the shape of the other. A world-wide search per tick is not a mild inefficiency: it is felt immediately as a
frame-rate collapse, reported as "the game got slow" long before anyone connects it to the integration.

The concrete failure: a new tracked family needed "which destructible scenery is currently broken". The obvious
implementation asked the engine for every object of that type — including inactive ones, several hundred — inside
the writer. The next session opened with "performance is really bad now, could it be something you did?" It was.

## The rule

**Before writing per-tick capture code, ask what already announces this change.** Objects are spawned, despawned,
damaged, opened, broken, equipped — and gameplay code overwhelmingly emits *something* at that instant, because its
own systems need to react. Look, in order:

1. **An existing event or callback on the object**, fired at the right moment. Trap: a per-*instance* event still
   requires enumerating every instance to subscribe, which reintroduces the scan.
2. **A single hook call added at the source** — one line in the game's state-change method calling the
   integration's hook façade, the same shape used for spawn/despawn registration (`06 §3`). Cheapest, exact, and
   removes searching entirely.
3. **A cache with a rescan interval** — only when neither is reachable. A mitigation, not a design: you trade frame
   time for a staleness window and must say precisely what that window can miss.

Polling feels safer — stateless, can't miss anything, needs no game edit — while its cost is invisible on the
writer's machine. A single façade call at a state change is the smallest, most reviewable, most removable edit
available, and integrations are expected to make exactly those.

## Shape that works

Keep a small collection in the capture layer, appended by the hook the instant the change happens; the writer
serialises what it holds and searches for nothing.

- Record the **value you need** at signal time (a position, a stable id), not an object pointer — nothing can dangle.
- Record it **whether or not a room is open**: state that changed before recording started is still true inside the
  recorded stretch.
- Clear it when the world is rebuilt, so one level's state never bleeds into the next.

**Generalization:** any time integration code searches for something, ask whether the thing could have told you
instead. A signal carries the exact moment of the change; a poll only says what was true the last time you looked.
