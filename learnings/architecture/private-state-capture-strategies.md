---
category: architecture
tier: generalizable
sourceGame: ActionGame
phase: "4"
question: "Does the integration need to capture members that are private to a game class — and, per class, how many are there and how complex are their types (maps keyed by type, nested structs, absolute timestamps)?"
sanitized: true
origin: "unreal:architecture/engine-private-state-capture-strategies"
---

# Two valid ways to capture a class's private state — pick one per class, consciously

**Precondition:** the state to capture lives in private or internal members of a game class. Public members need no
game-code edit.

## Strategy A — per-field access

Expose each member the integration needs: a gated getter/setter pair, or — if the engine has a reflection/property
system — registering the member with it.

- Each field is independently addressable; generic tooling (inspectors, dump-and-diff) can see it.
- Works only for types that map simply to attributes (numbers, strings, ids, vectors).
- One game-code edit per field; the edits accumulate.

## Strategy B — class-owned snapshot

Add a snapshot struct plus capture/restore methods inside the class:

```cpp
#if LUDEO_SDK_ENABLED
struct WaveDirectorSnapshot {
    Phase phase;
    std::vector<std::pair<std::string, float>> cooldowns;   // key → remaining seconds
    float phaseElapsedSeconds;                              // relative to capture, not an absolute clock
};
WaveDirectorSnapshot LudeoCaptureSnapshot() const;
void LudeoRestoreSnapshot(const WaveDirectorSnapshot& s);
#endif
```

- Full access to every private member; one edit per class however many fields.
- Handles complex containers and nested structs.
- Time fields can be stored as **deltas from the capture moment**, which survive the replay's new clock.
- More code per class, and invisible to generic field tooling.

Whichever you choose, the adapter still writes the snapshot's fields as **individual attributes** (`06 §1.4`) — the
snapshot struct is a game-side access mechanism, not permission to store an opaque blob.

## The rule

1. One strategy per class, chosen deliberately; never mixed silently within a class.
2. **A** when the class has few fields of simple types.
3. **B** when it has many fields, complex types, or timestamps that need delta normalization.
4. Record every game-code edit with its strategy in the plan (`OBJECT_TRACKING.md`, per class: strategy → fields →
   reason). These edits are load-bearing; the next maintainer must know how each field is reached.
5. A third option for read-only needs: a single gated getter, when you only read a value and never restore it.

All of these edits sit behind `LUDEO_SDK_ENABLED`, with every reference gated as well
(`learnings/architecture/compile-gate-must-cascade-to-every-reference.md`).
