---
category: common-mistakes
tier: generalizable
sourceGame: PlatformerSample
phase: "5"
question: "Does the per-tick capture sampler loop over every tracked object with no per-item isolation, and do the writers dereference engine objects captured at registration, trusting a census claim that the type is 'never destroyed'?"
sanitized: true
origin: "unity:common-mistakes/one-throwing-writer-silently-drops-every-object-after-it-in-the-sample-loop"
---

# One failing writer drops every object after it in the sample loop — a stale "never destroyed" claim becomes partial capture

Applies when a centralized per-tick sampler runs every tracked object's writer in one loop, and writers dereference
engine objects resolved at registration.

```cpp
void LudeoStateAdapter::SampleAll() {
    for (auto& t : m_tracked) t.write();   // each write() enters the object and reads the entity it captured
}
```

The writers close over the entity, its transform and its health component. In the observed engine, reading a
**destroyed** engine object threw, and nothing on this path caught it — the exception unwound out of the loop. The
C++ equivalents are worse or equal: a dangling pointer is undefined behaviour (crash or garbage), and an engine that
asserts or early-returns from the sampler on an invalid handle has the same shape.

**The loop doesn't resume.** Every object registered after the failing one is never sampled — not this tick, and
not any later tick, because the same object fails at the same index again. One destroyed entity turns capture into
"the first N objects only", permanently.

## Why it's worse than a crash

- **It isn't one.** Gameplay continues and the Ludeo is playable.
- **The loss is arbitrary** — decided by registration order. The player usually registers first, so the most
  conspicuous state still works, and the missing half is a population of pickups or enemies with no bucket entries.
- **It reads as an under-scoped wave**, not a defect: "a lot of things weren't captured."

## The trigger: a liveness claim that went stale

The census said "this type is never destroyed — its terminal state is a deactivation", which justified a terminal
flag over an unregister (`06 §3.5`) — and removed the null guard. A later content change, a variant, or a cleanup
routine nobody grepped falsified it.

## The fix — not a blanket `try/catch`

Wrapping the loop swallows a wrong liveness model every frame and teaches nothing. Guard the reads in the writer,
keep the attribute count constant, and report the violated assumption **once per key**:

```cpp
const bool alive = m_entity.IsValid();              // the engine's own validity test (handle generation, weak ref)
if (!alive) ReportVanishedOnce(kType, m_key);       // ERROR, once per key, names the census assumption
WriteUInt64("key",    m_key);                       // cached at registration — always writable
WriteVec3  ("pos",    alive ? m_entity->Position() : Vec3{});
WriteBool  ("active", alive && m_entity->IsActive());
```

- The **identity attribute comes from a value cached at registration**, so a vanished object keeps its key.
- The **attribute count doesn't change** on the sad path, so a first-tick attribute-count diagnostic stays auditable.
- The error **names the assumption** ("tracked `<type>` `<key>` was destroyed, but the plan classifies it as
  never-destroyed"), sending the reader to the census row instead of the layer.

## Where else it hides

Any centralized per-item loop over game-owned objects with no per-item containment: an actions dispatcher, the
restore's per-entity apply loop (where one failure aborts the rest of the restore), a heartbeat diagnostic.
**A per-tick loop over N game-owned objects is only as long-lived as its most stale liveness assumption.**
