---
category: architecture
tier: generalizable
sourceGame: TPSSample
phase: "5,6"
question: "Are you adding behaviour that must run only during playback of a Ludeo (or only during capture)? Gate it on the session-scoped Player-Flow flag set at OpenRoom, never on inferred leftovers."
sanitized: true
origin: "unity:architecture/gate-playback-behavior-on-the-flow-switch"
---

# Gate playback-only behaviour on the session's flow flag, not on inferred state

**Precondition:** the integration needs behaviour that differs by flow — capture writes that must stay off during
playback, playback-only fix-ups (re-asserting a clock, skipping an arrival flourish).

The core already defines the authoritative signal: the **session-scoped "is this a Player-Flow replay?" flag**, set
when this gameplay session's `OpenRoom` carried a `ludeoId` and cleared at session end (`07 §2.3`, `05 §6.2`).
Anything flow-specific gates on that. Two tempting proxies are wrong:

- **A kept restore reference** (`m_last_reader != nullptr`, a cached snapshot object). The manager may hold the last
  reader or restore object indefinitely; a Creator session started after a replay in the same process still sees
  it. Object liveness is not mode.
- **A "gameplay started" flag.** `Begin` happens in Creator Flow too, so that flag says "a recording bracket is
  open", not "this is playback". And `IsRestoring()` is narrower still — it goes false when the settle ends
  (`07 §2.3`).

The safe shape combines the two meanings explicitly:

```cpp
if (!m_is_player_flow_replay || !m_gameplay_session_active) return;   // mode, then timing
```

and clears any per-Ludeo bookkeeping (queues, credited-id sets) when a gameplay session begins, so nothing staged in
one bracket leaks into the next, whatever its flow.

**Actions are the exception:** `SendAction` fires in both flows and is never gated on this flag (`06 §7`). Use the
flag for state writes and playback-only fix-ups, not to decide whether an action is reported.

When the human asks "is this replay-only?", the answer must trace to where the flag is assigned, not to a chain of
inferences. In the source integration an inferred gate survived three reviews before that question exposed it.
