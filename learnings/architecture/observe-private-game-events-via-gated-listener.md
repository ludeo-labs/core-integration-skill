---
category: architecture
tier: generalizable
sourceGame: ActionGame
phase: "5,6"
question: "Does the integration need to react to a moment detected inside a private game method, or to an event whose only callback slot is single-assignment and already taken by another game system?"
sanitized: true
origin: "unreal:architecture/expose-hook-via-multicast-not-ufunction, unreal:architecture/parallel-multicast-when-single-cast-already-bound"
---

# Observe a private game event through a gated listener list — don't reshape the method or steal its callback

**Precondition:** the integration needs a notification (to `SendAction`, or to mark state dirty) at a moment the game
detects inside a private method, and that method's logic is fine as it is.

## The alternatives, and their cost

| Option | Cost |
|---|---|
| Make the method public | Widens the class's API; unrelated callers can reach it. |
| Re-implement the detection in the integration | Drifts from the original; double fires; misses edge cases. |
| Poll every frame, or hook destruction | Wrong timing — too late, too often, or tied to cleanup instead of the gameplay moment. |
| **A gated listener list next to the method** | One member and one broadcast line; existing call sites untouched; gone when the define is off. |

## The pattern

```cpp
class WaveDirector {
#if LUDEO_SDK_ENABLED
public:
    std::vector<std::function<void(const SquadOrder&)>> ludeoOnSquadKilled;   // integration-only observers
#endif
private:
    void OnSquadKilled(const SquadOrder& order) {
        // ... existing logic, untouched ...
#if LUDEO_SDK_ENABLED
        for (auto& cb : ludeoOnSquadKilled) cb(order);
#endif
    }
};

// Integration side
director.ludeoOnSquadKilled.push_back([](const SquadOrder&) { LudeoManager::Instance().SendAction("SquadKilled"); });
```

## Variant: the callback slot already exists but is taken

The event already has a callback at the right site — but it is **single-assignment** (one function pointer / one
`std::function`), and another game system (an event reactor, analytics, audio) has already set it. Setting it from the
integration silently **replaces** that consumer; its gameplay reactions stop. Don't convert the slot into a list
either — that changes the API its owner uses. Add a gated listener list beside it and invoke both at the same call
site:

```cpp
void EventBroker::PostNpcCaptured(Character& npc) {
    if (onNpcCaptured) onNpcCaptured(npc);          // existing consumer, preserved
#if LUDEO_SDK_ENABLED
    for (auto& cb : ludeoOnNpcCaptured) cb(npc);    // integration observers
#endif
}
```

One listener type can serve several hooks with the same parameter shape.

## Caveats

- **Look first.** If the event already has a multi-listener mechanism, subscribe to it — no game-code edit.
- **Ordering** between the original consumer and the integration is undefined; depend on neither order.
- **Host-only sites.** A broadcast on an authority/server path fires only on the host; account for that in per-player
  attribution in multiplayer games.
- **Lifetime.** Remove the integration's listeners before the observed object or the integration is destroyed.
- Per-instance filtering ("only some instances") belongs in the integration's handler, not at the broadcast site; if
  the data you need is not in the method's scope, the broadcast signature has to change.
- Gate the member, the broadcast and every reference (`learnings/architecture/compile-gate-must-cascade-to-every-reference.md`).
