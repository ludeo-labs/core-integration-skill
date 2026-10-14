---
category: common-mistakes
tier: generalizable
sourceGame: Lyra
phase: "6,8"
question: "Does an action's parameter (damage type, weapon class) come from a set of tags carried by the event, where several entries can match the family you're looking for?"
sanitized: true
origin: "unreal:engine-quirks/use-filter-not-iterate-and-break-for-tags"
---

# When several tags can match, filter the whole family — don't take the first

**Precondition:** an action parameter is picked from an event's tag set.

The kill action reported the damage type by breaking on the first tag containing `DamageType`. The event held both
`DamageType.Basic` and `DamageType.Rifle`; container order put `Basic` first, so every kill reported `Basic`.

```cpp
for (const Tag& t : event.tags.ChildrenOf(Tag("DamageType")))   // hierarchy match, not substring
    ReportKill(killerId, t.Name());                              // send all
```

Send all matches, or pick by an explicit rule — never by container order.
