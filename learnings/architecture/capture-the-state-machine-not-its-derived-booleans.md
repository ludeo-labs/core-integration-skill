---
category: architecture
tier: generalizable
sourceGame: TPSSample
phase: "5"
question: "Are you capturing an encounter/wave/phase system through boolean flags (started, finished, active) instead of its underlying state enum? Find every writer of each boolean — if any writer clears it while the system is still mid-life, moments captured at that instant are misclassified."
sanitized: true
origin: "unity:architecture/capture-the-state-machine-not-its-derived-booleans"
---

# Capture the state machine, not its derived booleans

**Precondition:** an encounter, wave or phase system is a state machine that also exposes booleans, and the
capture reads the booleans.

The booleans are projections of the machine, written for the game's own narrow needs, and a projection can be
momentarily false about the whole. Here the only writer of `is_spawning = false` was the routine that fires when
the encounter runs **out of configured waves** — even while survivors are still fighting. A moment marked there
captured "never started" for a live fight; the restore discarded the recorded enemies and the game ran a fresh
encounter over the room.

The compounding factor is behavioural: **players mark moments right after clearing a wave**, so clip starts
cluster exactly on the boundaries where derived flags are least truthful. This one family of misreads produced
three separately diagnosed bugs before the pattern was named: a finished-flag nothing ever set, an alive-list that
dropped members at transitions, and the started-classification miss.

## The fix

Capture the enum itself — a one-line read-only accessor on the manager keeps the field private — and classify on
restore from the enum.

- **Transient states cannot be restored as themselves.** A state that exists only inside a synchronous call, or
  whose in-flight work cannot be rebuilt from a recording (a `Spawning` state with pending spawn jobs), maps to the
  nearest **stable** state, and the machine re-derives the transition through its own logic (`07 §1.2`).
- **Keep the boolean path as a fallback** for recordings made before the enum was captured; read the new attribute
  as optional (`11 §6.8`).

## How to find it before it bites

For every boolean you plan to capture from a state-machine owner, grep for **every assignment** to it and ask
whether each writer runs only at the transition the name implies. A writer that clears "started" or "active" at
some other boundary is the tell. Then test a moment captured within a second of a wave or phase boundary — that is
where viewers will mark them.
