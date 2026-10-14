---
category: common-mistakes
tier: universal
sourceGame: ActionRoguelike
phase: "5"
question: null
sanitized: true
origin: "unreal:common-mistakes/use-scoped-guards-not-manual-enter-leave"
---

# Generate scoped Enter/Leave guards, never hand-paired EnterObject/LeaveObject

A hand-written `EnterObject`/`LeaveObject` pair leaks the context on any early return or added failure branch; the
next object's attributes then land in the wrong place (CR-002).

```cpp
{
    LudeoCapture::ObjectScope scope(id);    // 06 §7.2
    if (!scope.IsEntered()) return;
    ludeo_DataWriter_SetFloat(/* "health", hp */);
}                                           // LeaveObject on every path
```

**How to apply:** whenever generating capture or restore code, emit the scope — writer side `ObjectScope`, reader
side its mirror (`phase 5 · task 5`). Never emit raw pairs.
