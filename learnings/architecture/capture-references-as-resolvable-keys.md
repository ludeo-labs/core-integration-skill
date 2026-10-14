---
category: architecture
tier: universal
sourceGame: ActionGame
phase: "5"
question: null
sanitized: true
origin: "unreal:architecture/path-string-roundtrip-pattern"
---

# Capture lists of references as resolvable keys — and resolve each kind the right way

Game state often holds collections of references: a spawner's queued orders (asset references), its enabled spawn
routes (references to level-placed entities), the targets it has claimed. A pointer means nothing in the next process
(`11 §6.5`). Capture each element as a **key** the restore can resolve, and pick the resolution by what the element is.

## Capture

```cpp
std::vector<std::string> keys;
keys.reserve(source.size());
for (const Object* o : source)
    keys.push_back(o ? KeyOf(o) : std::string{});   // empty string = null at capture
```

`KeyOf` depends on the element's kind:

| Element | Key | Restore by |
|---|---|---|
| An **asset** (data asset, archetype, template) | its asset path / asset id | **loading** it through the game's asset loader |
| A **level-placed entity** | its level-authored stable id | **looking it up** among the live level's entities — never loading a new instance; it already came with the level |
| A **runtime-spawned entity** | its stable id (`06 §4`) | the Pass-1 id map, in Pass 2 (`07 §3.3`) |

## Restore

```cpp
dest.clear();
for (const std::string& key : keys) {
    if (key.empty()) continue;                       // null at capture
    if (Object* o = Resolve(key)) dest.push_back(o); // load, look up or id-map
    else LUDEO_LOG("[Ludeo] unresolved reference %s", key.c_str());
}
```

- **Drop what doesn't resolve** (renamed or removed content), and log it — never push a null into a collection the game
  assumes holds non-null entries.
- **Nullable single references** (an optional exit route): capture `""`, restore as null when the game allows it.
- **Struct-of-arrays data:** capture one key list per field and restore them in lockstep, up to the shortest list's
  length.

Store the keys as attributes the platform can read (`06 §1.4`), not as an opaque blob. Restoring a collection of
references in Pass 2 also means the entities it points to must exist first — that is what two-pass ordering is for
(CR-006).
