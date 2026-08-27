# 06 - Object Tracking Patterns

> **Purpose:** Comprehensive guide to tracking game object state for Ludeo SDK
> **Audience:** AI agents implementing object tracking during active gameplay
> **Scope:** Proprietary C++ engines. Unity and Unreal have dedicated integration guides — if the game uses either, stop and use the engine-specific doc instead of this one.
> **Prerequisites:** [05-LIFECYCLE-MANAGEMENT.md](05-LIFECYCLE-MANAGEMENT.md), [00-CRITICAL-REQUIREMENTS.md](00-CRITICAL-REQUIREMENTS.md)
> **Related:** [08-CODE-PATTERNS.md](08-CODE-PATTERNS.md), [07-RESTORATION-PATTERNS.md](07-RESTORATION-PATTERNS.md)

---

> ⚠️ **Treat every `ludeo_*` snippet here as a shape, not a contract — verify against your cloned headers.** The C-API signatures in this document (object lifecycle in §3, the adapter in §4, actions in §7) reflect the **4.1.x** API surface as last reviewed. The skill clones the **latest** Ludeo SDK release, so parameter lists, struct fields, `*_API_LATEST` macro names, and return types (`LudeoBool` for setters vs `LudeoResult` for handle+params calls) can drift between releases. Before pasting any call into a game, open the matching header in the clone (`Include/Ludeo/DataWriter.h`, `DataWriterTypes.h`, …) and confirm the exact signature. Don't assume these are authoritative for your SDK version.

---

## How to use this document

This file covers the full object-tracking surface. You rarely need to read it end-to-end — most skills point you at a specific section. Jump to the one that matches your current task:

- **Classifying the game's object-handling style before writing code?** → §2 Object Handling Patterns in the Codebase
- **Writing the register / update / unregister SDK calls?** → §3 Object Lifecycle Pattern
- **Handling relationships (owner, parent, target) across capture/restore?** → §4 Identity and Reference Mapping
- **Plugging into a central manager or factory?** → §5 Manager and Factory Integration
- **Registering everything that already exists when gameplay begins?** → §6 Batch Registration
- **Discrete events (kills, pickups, jumps, objectives)?** → §7 Ludeo Actions
- **Suspending tracking during cutscenes / menus / tutorials?** → §8 Tracking State Management
- **Deciding what to track at all?** → §9 What to Track — Decision Guide
- **Per-object-type reference snippets (player, enemy, weapon, door, projectile)?** → §10 Common Patterns by Object Type
- **Performance cost or tuning?** → §11 Performance Considerations
- **Self-check before moving on?** → §12 Validation Checklist

A skill asking for "object tracking implementation" typically needs §2, §3, §4, §5, §6. A skill asking for "actions" typically needs §7. A skill asking for "tracking pause during cutscenes" typically needs §8. Load only what the current step actually requires.

---

## Table of Contents

1. [Tracking Strategy Overview](#1-tracking-strategy-overview)
2. [Object Handling Patterns in the Codebase](#2-object-handling-patterns-in-the-codebase)
3. [Object Lifecycle Pattern](#3-object-lifecycle-pattern)
4. [Identity and Reference Mapping](#4-identity-and-reference-mapping)
5. [Manager and Factory Integration](#5-manager-and-factory-integration)
6. [Batch Registration](#6-batch-registration)
7. [Ludeo Actions (Discrete Events)](#7-ludeo-actions-discrete-events)
8. [Tracking State Management](#8-tracking-state-management)
9. [What to Track — Decision Guide](#9-what-to-track--decision-guide)
10. [Common Patterns by Object Type](#10-common-patterns-by-object-type)
11. [Performance Considerations](#11-performance-considerations)
12. [Validation Checklist](#12-validation-checklist)

---

## 1. Tracking Strategy Overview

### 1.1 Core Principle

**Track ALL game objects that affect the gameplay experience.**

The Ludeo SDK exists so the player sees a captured moment played back **perfectly from their perspective** — a continuous, playable reconstruction, not a screenshot, a highlight reel, or an "approximate" replay. The integration's job is to identify *what set of state* makes up that complete picture for this game. **The destination is always full reconstruction**, not partial.

**Do not ask the user "do you want full state tracking?"** — that's the SDK's defining purpose, not a scoping choice. Scope questions go the other way (*"is this entity / this property part of the complete picture?"*) and are answered by `§9` and the genre checklists, not by negotiation.

**Legitimate iterative rollout (large/complex games only):** instead of capturing every entity in one pass, an integration can stage coverage in waves — start with the most critical state (player + primary entities) to get a working capture/replay loop end-to-end, then expand to full coverage in subsequent passes. That's a **staging strategy**, not a partial destination. Record it in `OBJECT_TRACKING.md` as "covered now" vs "planned for next wave" so the iterative path is explicit and the end goal (full reconstruction) is unchanged. The agent doesn't need permission to use this rollout — it's a planning decision, not a fidelity decision. When in doubt, track it.

### 1.2 What Gets Tracked

| Category | Examples | Priority |
|----------|----------|----------|
| **Player Entities** | Player character, stats, inventory, position | CRITICAL |
| **NPCs/Enemies** | AI entities, health, state, position | CRITICAL |
| **Interactive Objects** | Pickups, doors, switches, vehicles | CRITICAL |
| **Projectiles** | Bullets, grenades, spells (if persistent) | IMPORTANT |
| **Environment State** | Destructible objects, lighting, weather | IMPORTANT |
| **UI State** | HUD mode, active overlays (if affects experience) | OPTIONAL |
| **Audio State** | Music state, combat intensity (if affects experience) | OPTIONAL |

### 1.3 Tracking vs Actions

| Aspect | **Tracking (Continuous State)** | **Actions (Discrete Events)** |
|--------|--------------------------------|-------------------------------|
| **Nature** | Ongoing, changes over time | Happens at a moment in time |
| **Frequency** | Updated when properties change | Fired once when event occurs |
| **Purpose** | Restore exact game state | Objectives, scoring, highlights |
| **API** | `ludeo_DataWriter_Set*()` | `ludeo_DataWriter_SendAction()` |
| **Examples** | `health=75`, `position=(10,5,3)` | `"Kill"`, `"CollectCoin"`, `"Headshot"` |

**Both are required** for a complete Ludeo integration.

### 1.4 Attributes vs Blobs — default to attributes

The SDK can store and reconstruct state two ways:

- **Attribute integration** — capture each property as a named, typed attribute (`ludeo_DataWriter_Set*` → `ludeo_DataReader_Get*`). This is what every pattern in this document uses.
- **Blob integration** — serialize an object's (or the world's) state into one opaque buffer and stuff it into a single string/byte attribute, then deserialize it on restoration.

**Ludeo strongly prefers attribute integrations. Default to attributes — do not ask the user which to use.** Attributes are the default for good reason: the platform can read individual values, so objectives, scoring, and highlights can key off real state (`health`, `kills`, `position`); restoration can be partial and version-tolerant; captures are inspectable and debuggable; and a field added or removed on one side doesn't corrupt everything else. A blob is opaque to the platform — it can only be handed back verbatim, defeats per-attribute objectives/scoring, and breaks the moment the game's serialization format shifts.

**Only deviate to a blob when one of these is true:**
1. **The user explicitly asks for blob/serialized storage** for an entity or the whole game.
2. **The integration genuinely calls for it** — e.g. an entity's state is an already-opaque, large, or deeply-nested structure with no stable field-level schema (a procedural world buffer, a third-party physics state blob, a scripting VM heap) where mapping individual attributes is infeasible or would be wildly more complex than round-tripping the existing serialized form.

When neither holds, use attributes and move on — do **not** prompt the user per entity. When a blob *is* warranted under (2), note the entity and the specific reason in the plan's Open Questions / Notes so the human reviewer sees the rationale; you don't need a live answer to proceed. Prefer the narrowest blob possible (one sub-object), never a whole-world blob, when a blob is unavoidable.

> Note: this is distinct from how the *game's own* save system serializes state (see `02F-RESEARCH-SAVE-SYSTEM.md`). A game that saves itself as a JSON/binary blob can — and by default should — still be tracked into Ludeo as discrete attributes.

---

## 2. Object Handling Patterns in the Codebase

Before writing any tracking code, read enough of the game to **classify how it handles objects**. §3 describes *what SDK calls to make*; this section describes *where those calls go*. They are independent decisions — the same `RegisterWithLudeo()` body plugs into very different hook sites depending on the pattern.

Large games mix 2–3 patterns; classify per subsystem. If the game is Unity or Unreal, stop — use the engine-specific integration guide instead.

For each pattern below you get: **recognition signs**, **grep starting points**, **creation hook**, **destruction hook**, **property-change hook**, **batch enumeration path**, and **pitfalls** specific to that pattern.

### 2.1 Inheritance-based root class

Common in proprietary C++ engines derived from Source, id Tech, CryEngine, or any engine where every trackable entity derives from a shared root (`BaseEntity`, `CEntity`, `GameObject`, `Actor`).

**Recognition signs:**
- A root class with virtual lifecycle hooks: `OnSpawn`, `OnCreate`, `OnInit`, `OnDestroy`, `OnRemove`, `Shutdown`, `Tick`, `Update`
- Subclasses override virtuals to add type-specific behavior
- Creation via `new Derived(...)` or a typed helper like `CreateEntity<Derived>(...)`

**Grep starting points:**
```
class\s+\w+\s*:\s*public\s+(BaseEntity|Entity|GameObject|Actor)
virtual\s+void\s+(On(Spawn|Create|Init|Destroy|Remove)|Shutdown|Tick)
```

**Creation hook:** Add `RegisterWithLudeo()` to the root class's `OnSpawn` / `OnCreate` / `PostInitialize`, called *after* the object is fully constructed. Do not hook the constructor — `this` may still be mid-initialization, and virtual dispatch from constructors is a well-known trap.

**Destruction hook:** The root class's `OnDestroy` / `OnRemove`, called before subclass cleanup.

**Property-change hook:** Setter methods (`SetHealth`, `SetPosition`). If the game lacks setters (direct field mutation from friend code), fall back to a per-tick diff (see §2.8).

**Batch enumeration:** The engine's global entity list (`g_entityList`, `EntityManager::GetAll()`, a scene node tree).

**Pitfalls:**
- **Diamond / multiple inheritance** — pick the common ancestor that covers *every* trackable type. If no single ancestor does, you're actually in §2.2 territory.
- **Constructor-body hooks** — if `OnSpawn` is invoked from the constructor body, `this` may not be fully constructed. Defer to a post-construction phase.
- **Partial construction failure** — if `OnSpawn` runs before the engine commits the object as live, you may register objects that are then discarded. Hook after the engine's "this object is now real" barrier.

### 2.2 Manager / factory centralization

Objects are never created with `new` in game code; a central manager or factory owns all creation. Usually combined with §2.1.

**Recognition signs:**
- `Entity* EntityManager::Create(...)`, `GameObject* ObjectFactory::Spawn(...)`, `World::SpawnActor(...)`
- Game code calls the manager, not constructors directly
- Manager owns an internal collection and handles destruction

**Grep starting points:**
```
\w+Manager::(Create|Spawn|Make|Add)
\w+Factory::(Create|Build|Produce)
World::(Spawn|Create)
```

**Creation hook:** Inside the manager's `Create` / `Spawn`, after construction completes and before returning to the caller. This is typically the cleanest integration point the codebase offers.

**Destruction hook:** Inside the manager's `Destroy` / `Remove`, before deletion.

**Property-change hook:** Delegated to the objects themselves (§2.1) or to manager-level "update all" passes.

**Batch enumeration:** The manager already owns the list — expose a `ForEach` or `GetAll` if it isn't already there.

**Pitfalls:**
- **Multiple managers** — games often have `PlayerManager` + `EntityManager` + `ProjectileManager` + `LevelManager`. Instrument each.
- **Fast-path bypasses** — some games skip the manager for performance-critical spawning (pool pullouts, bulk loads). Search for direct `new`, pool `acquire`, or `emplace_back` calls that bypass the manager.
- **Manager-side vs engine-side ordering** — manager hooks may fire after engine-side state is already committed; if the SDK needs earlier visibility, use §2.1.

**If this pattern is available, prefer it over patching individual classes.** See §5 for the full integration pattern.

### 2.3 Entity-Component-System (ECS)

Objects are opaque entity IDs; state lives in arrays of components, processed by systems each tick. Common via **entt**, **flecs**, or a hand-rolled custom registry.

**Recognition signs:**
- `entt::registry`, `flecs::world`, or a custom `Registry` / `World` type
- `registry.create()`, `registry.emplace<Component>(entity, ...)`, `registry.destroy(entity)`
- Systems iterate via `view<>`, `group<>`, `each`, or component queries
- No single "class" per entity type — types are defined by component composition

**Grep starting points:**
```
entt::|flecs::
registry\.(create|emplace|destroy|view|group)
class\s+\w+System\b
```

**Creation hook:** The registry's creation signal. For entt: `registry.on_construct<T>().connect<...>()` where `T` is the component whose presence marks "this entity is trackable" — usually `Transform` or a dedicated `Tracked` tag component. For custom ECS: instrument the `CreateEntity` method directly.

**Destruction hook:** `registry.on_destroy<T>()` in entt, or the equivalent in the custom registry. Fire before the components are actually destroyed so the data is still readable.

**Property-change hook:** This is ECS's hardest problem — components rarely have setters. Three options, in descending order of reliability:

1. **Capture system each tick** — add a Ludeo system that iterates tracked entities, diffs components against the previous frame's snapshot, emits captures for changes. Always correct; does a diff every tick.
2. **Wrapped mutations** — replace direct `registry.get<Component>(e).field = x` with helpers that also emit captures. Requires discipline, touches many call sites, easy to bypass.
3. **`patch<>` / `replace<>` hooks** — some ECS libraries (entt) emit `on_update<T>` when mutations go through `registry.patch<T>`. Only works if mutations actually use that API; direct field writes won't fire the signal.

**Batch enumeration:** Iterate the registry with the tagging-component view — `registry.view<Tracked, Transform>().each(...)`.

**Pitfalls:**
- **Type isn't fixed** — an entity's component set can change mid-gameplay. Pick a tagging component whose presence is stable for the entity's whole life.
- **Parallel systems** — many ECS frameworks run systems on worker threads. SDK capture calls may need to be on a single thread; defer into a command buffer consumed by one single-threaded capture system.
- **Group caching** — entt caches group membership until invalidated by component adds/removes. Don't hold view/group references across structural changes.
- **Component removal ≠ entity death** — an entity can shed a component without being destroyed. Decide whether that counts as "unregister" or "property change to absent."

**ECS is the hardest pattern to integrate.** Budget extra time; prototype the capture-system approach early to confirm it actually sees every change.

### 2.4 Handle / pool-based objects

Objects live in contiguous arrays; handles (index + generation) stand in for pointers. "Destruction" bumps the slot's generation; "creation" acquires a slot. Common in Bitsquid / Stingray-lineage engines and custom data-oriented engines.

**Recognition signs:**
- `struct Handle { uint32_t index; uint32_t generation; };` or equivalent
- `Pool<T>`, `ObjectPool<T>`, `FreeList`, `SlotMap`, slab allocators
- `acquire()` / `release()` methods; no raw `new` / `delete`
- Defensive generation checks at every access: `if (slot.generation != handle.generation) return nullptr;`

**Grep starting points:**
```
Pool<|FreeList|SlotMap
struct\s+\w*Handle\s*\{
acquire\(|release\(
generation
```

**Creation hook:** The pool's `acquire` / `allocate` path, **but only after the game has initialized the slot's payload.** A freshly acquired slot is raw memory — registering before the game writes meaningful data produces garbage captures. Most pool-based codebases have an explicit commit or `OnInit` step post-acquire; that is the real hook.

**Destruction hook:** The pool's `release` / `free` path, before the generation bump. After the bump the slot's data is invalid.

**Property-change hook:** Pools rarely expose setters. Use the capture-system approach from §2.3 — iterate the active-slot list each tick and diff.

**Batch enumeration:** The pool's active-slot iterator (`pool.ForEachActive(...)`). If none exists, iterate indices and validate generations.

**Pitfalls:**
- **Slot reuse race** — during a reuse cycle, an old slot's memory may briefly match a stale handle's generation. Always use the current handle's generation to validate.
- **Silent pool reset** — some pools are "cleared" by zeroing a count and reusing memory without invoking destructors. You need an explicit release hook; if none exists, add one.
- **Raw slot capture is tempting and wrong** — pools include metadata (handle, generation, flags) that isn't gameplay state. Capture fields deliberately.

### 2.5 Event-driven / observer-bus

Lifecycle changes are broadcast as events on a central bus. No single class is the authority; subscribers listen.

**Recognition signs:**
- `EventBus`, `Dispatcher`, `Broadcaster`, `MessageBus` classes
- `Subscribe<Event>(...)`, `Publish(Event{...})`, `Dispatch<Event>(...)`
- Events named `EntityCreatedEvent`, `ObjectSpawnedEvent`, `PlayerDiedEvent`

**Grep starting points:**
```
EventBus|Dispatcher|MessageBus|Broadcaster
Subscribe<|Publish<|Dispatch<
class\s+\w+Event\b
```

**Creation hook:** Subscribe to the creation event for each trackable type. `LudeoStateAdapter` (or equivalent) owns the subscriptions.

**Destruction hook:** Subscribe to the destruction event.

**Property-change hook:** Property-change events if emitted. If not, pair this pattern with a per-tick capture system (§2.3 / §2.8) for the property side.

**Batch enumeration:** The event bus doesn't know the current set. Find the underlying store (whatever the events describe) and iterate that for the initial batch.

**Pitfalls:**
- **Events fire on worker threads** — marshal capture calls to the SDK's expected thread. Never call SDK from an arbitrary subscriber.
- **Mid-construction / mid-destruction events** — data may be only partially valid. Document which attributes may be unreliable at event time.
- **Forgetting to unsubscribe** — event-bus subscriptions outlive callers unless explicitly released. Disconnect on `LudeoManager::Shutdown` to avoid dangling callbacks.
- **Event ordering** — if creation/destruction events can arrive out of order across threads, serialize subscription handling.

### 2.6 Data-driven / prefab spawn

Objects are spawned from data definitions (prefab IDs, blueprint names, archetypes). A single `Spawn(prefabId, transform)` can produce any object type.

**Recognition signs:**
- `Spawn(const char* prefabId, ...)`, `Instantiate(BlueprintId, ...)`, `LoadArchetype(...)`
- Entity definitions live in data files (JSON, YAML, custom binary)
- No one-class-per-type; the runtime composes types from prefab definitions

**Grep starting points:**
```
Spawn\s*\(|Instantiate\s*\(
Prefab|Blueprint|Archetype|Template
LoadDefinition|EntityDef
```

**Creation hook:** The central `Spawn` / `Instantiate` function, after the instance is fully constructed.

**Destruction hook:** The corresponding `Despawn` / `Destroy` function.

**Object-type naming:** Use the prefab / blueprint ID as Ludeo's `objectType` string. This is the most faithful mapping — restoration can look up the same prefab ID to recreate the object.

**Property-change hook:** Usually paired with §2.1, §2.3, or §2.4 for the actual object representation — follow that pattern for properties.

**Batch enumeration:** The spawn system maintains a registry of live instances; iterate it.

**Pitfalls:**
- **Multiple spawn paths** — editor-placed objects, runtime-spawned objects, and save-restored objects often go through different code paths. Instrument all of them.
- **Prefab composition** — a prefab may be a tree of sub-objects (weapon with attachments, character with equipment). Decide which levels to track as independent Ludeo objects and which as attributes of the root.
- **Hot-reloaded prefabs** — if the game hot-reloads definitions, `objectType` strings may diverge from what restoration expects. Pin the `objectType` string to the ID at spawn time, not to a pointer into live definitions.

### 2.7 Save-system-driven discovery (planning technique, not a hook)

If the game has a save / load system, **its serializer is a ready-made inventory of what the game considers state.** Read it before writing any tracking code. This is not a hook pattern — it is a planning input you combine with whichever actual pattern (2.1–2.6, 2.8) the game uses to own lifecycles.

**Recognition signs:**
- `Serialize(Archive&)`, `Save(Writer&)`, `Load(Reader&)` methods
- Classes named `SaveGame`, `GameSnapshot`, `SaveFile`, `Checkpoint`
- Versioned data files (`.sav`, `.dat`)

**Grep starting points:**
```
Serialize\s*\(|Save\s*\(Writer|Load\s*\(Reader
class\s+(SaveGame|Snapshot|Checkpoint)
```

**What to extract before writing any tracking code:**
- Object types to track — the full set the serializer iterates
- Properties per type — every field `Serialize` writes
- Relationships — every reference the serializer resolves (and how — this often reveals the game's stable-ID strategy)
- Batch-enumeration path — the serializer already walks the world at save time; that walk is your initial-registration template

**Why this matters:** For custom engines, the save system often encodes years of "what state actually matters" knowledge. Recreating that analysis from scratch is expensive and error-prone. Treat the save system as a first draft of the tracking scope.

**Pitfalls:**
- **Save systems often skip transient state** (current velocity, AI perception, in-flight projectiles) that Ludeo *does* need. Treat save scope as a floor, not a ceiling.
- **Save systems may include meta state** (user settings, menu preferences, cheat codes used) that Ludeo *should not* capture.
- **Save systems may serialize at checkpoints only** — if the game saves every few minutes, the serializer won't show you anything that changes faster than that. "Not in save" ≠ "not gameplay state."

**Note:** A separate forthcoming doc will cover reusing save-system code at runtime. This section is purely about reading the save system as a specification.

### 2.8 Scene-graph / frame iteration (fallback)

Some engines expose no creation / destruction callbacks at all; game code observes the world only by walking it. Use this as a fallback — prefer any real hook from §2.1–§2.6 if one exists.

**Recognition signs:**
- No `OnSpawn` / `OnDestroy`-style methods anywhere
- World access is `GetScene()->ForEachNode(...)` or similar tree walk
- Object lifetime is opaque to gameplay code

**Strategy:** Run a Ludeo capture system each frame:

1. Iterate all objects in the world.
2. Build the current-frame snapshot: `(stable_id, type, property values)`.
3. Diff against the previous frame's snapshot.
4. Register newcomers, unregister vanished ones, emit captures for changed properties.

**Hook points:** None external — the capture system itself is the hook. Call it from `LudeoManager::Tick`, which is already on the per-frame path.

**Pitfalls:**
- **Diff cost** — scales with world size × property count. For large worlds this is the most expensive pattern. Throttle less-important objects (§11) or apply §2.7 to narrow scope before using this.
- **Stable identity** — pointer identity isn't stable across frames if objects are pooled. The game must expose a stable ID (entity handle, GUID). If it doesn't, you'll need to synthesize one — and that usually requires enough engine visibility to use §2.4 instead.
- **Last resort** — if you're reaching for this pattern, read the codebase once more. Real engines usually have *some* hook, just named non-obviously.

### 2.9 How to classify the game in front of you

Run this diagnosis in order. Apply the first match, then check for combinations:

1. **Is there a central `Spawn` / `Create` function every object goes through?**
   → Primary pattern: **§2.2 Manager / Factory.** Check if §2.6 (data-driven) also applies.

2. **Do you find ECS headers (`entt::`, `flecs::`) or a `Registry` class with component views?**
   → Primary pattern: **§2.3 ECS.**

3. **Are object references handles (index + generation) rather than pointers?**
   → Primary pattern: **§2.4 Handle / Pool.**

4. **Does lifecycle broadcast through an event bus?**
   → Primary pattern: **§2.5 Event bus.**

5. **Is there a root class with virtual `OnSpawn` / `OnDestroy`?**
   → Primary pattern: **§2.1 Inheritance.**

6. **Does a save system exist?**
   → Apply **§2.7** *in addition to* whichever pattern above matched.

7. **None of the above found any hook?**
   → Re-check once more (hooks are often named non-obviously). If truly none: **§2.8 Frame iteration.**

**Most common combination:** §2.2 (Manager) + §2.1 (Inheritance) + §2.7 (save-system input). If that is what you're looking at, you're on the happy path.

Once classified, proceed to §3 for the SDK calls themselves. The classification tells you *where* the calls go; §3 tells you *what* those calls are.

---

## 3. Object Lifecycle Pattern

### 3.1 Three-Phase Lifecycle

Every tracked object follows this pattern:

```
1. CREATE → Register with SDK, get LudeoObjectId
2. UPDATE → Track property changes during gameplay  
3. DESTROY → Unregister from SDK, cleanup
```

### 3.2 Phase 1: Object Creation & Registration

#### When to Register
- **During object creation** (constructor or initialization function)
- **After gameplay session begins** (when DataWriter is available)
- **Batch registration** for existing objects when level loads

#### Registration Pattern

```cpp
class GameObject
{
public:
    void OnCreate()
    {
        // Game initialization logic...
        
#if LUDEO_SDK_ENABLED
        RegisterWithLudeo();
#endif
    }

private:
    void RegisterWithLudeo()
    {
        LudeoHDataWriter writer = LudeoManager::Get().GetDataWriter();
        if (writer == nullptr) {
            return;  // DataWriter not ready yet
        }
        
        // Create tracked object in SDK
        LudeoDataWriterCreateObjectParams params = {};
        params.apiVersion = LUDEO_DATAWRITER_CREATEOBJECT_API_LATEST;
        params.objectType = "game_object";  // Your object type name
        
        LudeoResult result = ludeo_DataWriter_CreateObject(writer, &params, &m_ludeo_object_id);
        if (result != LudeoResult::Success) {
            LogWarning("[LUDEO] Failed to create object: %d", result);
            m_ludeo_object_id = LUDEO_INVALID_OBJECTID;
            return;
        }
        
        LogDebug("[LUDEO] Registered object %llu (type: %s)", m_ludeo_object_id, "game_object");
        
        // Set initial property values
        SendInitialLudeoValues();
    }
    
    void SendInitialLudeoValues()
    {
        if (m_ludeo_object_id == LUDEO_INVALID_OBJECTID) return;
        
        // Use capture macros to set initial state
        LUDEO_CAPTURE_VEC3(this, "game_object", "position", m_position);
        LUDEO_CAPTURE_FLOAT(this, "game_object", "health", m_health);
        LUDEO_CAPTURE_UINT64(this, "game_object", "entity_id", m_entity_id);
        // ... all other properties
    }

private:
    LudeoObjectId m_ludeo_object_id = LUDEO_INVALID_OBJECTID;
    Vec3 m_position;
    float m_health;
    uint64_t m_entity_id;
};
```

#### Critical Requirements

- **Store LudeoObjectId** in the object (for later updates)
- **Check DataWriter validity** before registration
- **Set initial values immediately** after registration
- **Handle registration failure gracefully** (game must continue)
- **Atomicity: register-and-write-statics is one transaction, retried until both succeed.** A successful `CreateObject` that's followed by a *partial* one-shot write (e.g. one identity attribute drops due to a type-lock mismatch) leaves the object registered-but-incomplete; restoration then fills the gap with defaults and produces duplicates / wrong identities (real-world failure mode: "4 copies of the player on Ludeo load"). Track success on the **`statics_written`** flag, not on "have I seen this object before" — and retry from the top until that flag is set. Don't treat registration as a proxy for "fully initialized."

---

### 3.3 Phase 2: Property Updates

#### When to Update
- **Immediately after property changes** in game code
- **From setter functions** (recommended)
- **From update loops** (if no setters exist)

#### Update Pattern

```cpp
class GameObject
{
public:
    // Setter pattern (RECOMMENDED)
    void SetHealth(float newHealth)
    {
        m_health = newHealth;  // Update game state FIRST
        
        LUDEO_CAPTURE_FLOAT(this, "game_object", "health", newHealth);
    }
    
    void SetPosition(const Vec3& newPos)
    {
        m_position = newPos;
        
        LUDEO_CAPTURE_VEC3(this, "game_object", "position", newPos);
    }
    
    void SetOwner(uint64_t ownerGameId)
    {
        m_owner_game_id = ownerGameId;
        
        // Track the GAME ID, not pointers or LudeoObjectId
        LUDEO_CAPTURE_UINT64(this, "game_object", "owner_id", ownerGameId);
    }
    
    void SetAlive(bool isAlive)
    {
        m_is_alive = isAlive;
        
        LUDEO_CAPTURE_BOOL(this, "game_object", "is_alive", isAlive);
    }
};
```

#### Update Best Practices

| DO | DON'T |
|----|-------|
| Update game state first, then track | Track before updating game state |
| Use capture macros (handles errors) | Call SDK directly from game code |
| Track stable IDs (entity_id) | Track pointers or memory addresses |
| Check if gameplay active before tracking | Assume tracking is always active |
| Update only when value actually changes | Update every frame unconditionally |

---

### 3.4 Phase 3: Object Destruction

#### When to Unregister
- **During object destruction** (destructor or cleanup function)
- **Before object is deleted or pooled**
- **When gameplay session ends** (automatic cleanup)

#### Destruction Pattern

```cpp
class GameObject
{
public:
    void OnDestroy()
    {
#if LUDEO_SDK_ENABLED
        UnregisterFromLudeo();
#endif
        
        // Game cleanup logic...
    }

private:
    void UnregisterFromLudeo()
    {
        if (m_ludeo_object_id == LUDEO_INVALID_OBJECTID) {
            return;  // Not registered
        }
        
        LudeoHDataWriter writer = LudeoManager::Get().GetDataWriter();
        if (writer == nullptr) {
            return;  // DataWriter already released
        }
        
        LudeoDataWriterDestroyObjectParams params = {};
        params.apiVersion = LUDEO_DATAWRITER_DESTROYOBJECT_API_LATEST;
        params.objectId = m_ludeo_object_id;
        
        LudeoResult result = ludeo_DataWriter_DestroyObject(writer, &params);
        if (result != LudeoResult::Success) {
            LogWarning("[LUDEO] Failed to destroy object %llu: %d", m_ludeo_object_id, result);
        }
        
        m_ludeo_object_id = LUDEO_INVALID_OBJECTID;  // Clear ID
    }
};
```

#### Destruction Best Practices

- **Always clear LudeoObjectId** after destruction
- **Handle nullptr DataWriter** (may be already shut down)
- **Log failures but continue** (don't crash game)
- **Call before game object is deleted**

> **Streaming worlds: the destruction hook fires on stream-out too.** If the world streams cells/chunks
> in and out, this same `OnDestroy`/destructor/`pool.release()` runs when a cell **unloads** — but a
> streamed-out object isn't dead, so unregistering it would drop it from the replay. Gate
> `UnregisterFromLudeo` on a real removal signal (death/consume/destroy), not on the raw destructor /
> pool release alone. See [`game-patterns/open-world-tracking.md`](game-patterns/open-world-tracking.md) §2 (presence ≠ existence).

---

## 4. Identity and Reference Mapping

### 4.1 The Identity Problem

**Problem:** Game objects reference each other (owner, parent, target, etc.). During restoration, these relationships must be recreated.

**Solution:** Use stable, deterministic game IDs + maintain bidirectional maps.

### 4.2 Stable ID Requirements

| Good ID Types | Bad ID Types |
|---------------|--------------|
| `uint64_t entity_id` (generated deterministically) | `GameObject* pointer` (memory address) |
| `uint32_t blueprint_id` (content ID) | `LudeoObjectId` (SDK internal ID) |
| `std::string unique_name` (if stable) | `int array_index` (changes) |
| Steam user ID, player profile ID | `void* handle` (opaque pointer) |

### 4.3 Bidirectional Mapping Pattern

#### Maintain Maps in Manager or Adapter

```cpp
class LudeoStateAdapter
{
private:
    // Bidirectional mapping
    std::unordered_map<LudeoObjectId, uint64_t> m_ludeo_to_game_id;
    std::unordered_map<uint64_t, LudeoObjectId> m_game_to_ludeo_id;
    
    // Object registry (for restoration)
    std::unordered_map<uint64_t, GameObject*> m_game_objects;

public:
    // Register mapping during object creation
    void RegisterObject(GameObject* obj, LudeoObjectId ludeoId, uint64_t gameId)
    {
        m_ludeo_to_game_id[ludeoId] = gameId;
        m_game_to_ludeo_id[gameId] = ludeoId;
        m_game_objects[gameId] = obj;
    }
    
    // Unregister during destruction
    void UnregisterObject(uint64_t gameId)
    {
        auto ludeoIt = m_game_to_ludeo_id.find(gameId);
        if (ludeoIt != m_game_to_ludeo_id.end()) {
            m_ludeo_to_game_id.erase(ludeoIt->second);
            m_game_to_ludeo_id.erase(ludeoIt);
        }
        m_game_objects.erase(gameId);
    }
    
    // Lookup functions
    LudeoObjectId GetLudeoId(uint64_t gameId) const
    {
        auto it = m_game_to_ludeo_id.find(gameId);
        return (it != m_game_to_ludeo_id.end()) ? it->second : LUDEO_INVALID_OBJECTID;
    }
    
    uint64_t GetGameId(LudeoObjectId ludeoId) const
    {
        auto it = m_ludeo_to_game_id.find(ludeoId);
        return (it != m_ludeo_to_game_id.end()) ? it->second : 0;
    }
    
    GameObject* GetGameObject(uint64_t gameId) const
    {
        auto it = m_game_objects.find(gameId);
        return (it != m_game_objects.end()) ? it->second : nullptr;
    }
};
```

### 4.4 Tracking Relationships

#### Always Track Game IDs for Relationships

```cpp
class Weapon
{
public:
    void SetOwner(Player* owner)
    {
        m_owner = owner;  // Game state (pointer)
        
        // Track the GAME ID, not the pointer
        uint64_t owner_game_id = owner ? owner->GetEntityId() : 0;
        LUDEO_CAPTURE_UINT64(this, "weapon", "owner_id", owner_game_id);
    }
    
    void SetAttachedTo(GameObject* parent)
    {
        m_parent = parent;
        
        uint64_t parent_game_id = parent ? parent->GetEntityId() : 0;
        LUDEO_CAPTURE_UINT64(this, "weapon", "parent_id", parent_game_id);
    }
};
```

#### During Restoration: Resolve Game IDs to Objects

```cpp
void RestoreWeapon(LudeoHDataReader reader, LudeoObjectId weaponLudeoId)
{
    // Read relationship IDs from Ludeo data
    uint64_t owner_game_id = 0;
    ludeo_DataReader_GetUInt64("owner_id", &owner_game_id);
    
    uint64_t parent_game_id = 0;
    ludeo_DataReader_GetUInt64("parent_id", &parent_game_id);
    
    // Resolve game IDs to actual game objects
    Player* owner = static_cast<Player*>(LudeoStateAdapter::Get().GetGameObject(owner_game_id));
    GameObject* parent = LudeoStateAdapter::Get().GetGameObject(parent_game_id);
    
    // Recreate relationships
    weapon->SetOwner(owner);
    weapon->SetAttachedTo(parent);
}
```

---

## 5. Manager and Factory Integration

### 5.1 When to Use Manager Integration

Use manager/factory integration when:
- Game has centralized object creation (EntityManager, ObjectFactory, etc.)
- Multiple places create objects (avoids duplication)
- Object lifecycle managed by a system

### 5.2 Manager Pattern

```cpp
class EntityManager
{
public:
    Entity* CreateEntity(const EntityConfig& config)
    {
        Entity* entity = new Entity(config);
        m_entities.push_back(entity);
        
        // Assign stable game ID
        entity->SetEntityId(GenerateUniqueId());
        
#if LUDEO_SDK_ENABLED
        // Register with Ludeo immediately after creation
        entity->RegisterWithLudeo();
        
        // Register in state adapter for mapping
        LudeoStateAdapter::Get().RegisterObject(
            entity,
            entity->GetLudeoObjectId(),
            entity->GetEntityId()
        );
#endif
        
        return entity;
    }
    
    void DestroyEntity(Entity* entity)
    {
        if (!entity) return;
        
#if LUDEO_SDK_ENABLED
        // Unregister from state adapter
        LudeoStateAdapter::Get().UnregisterObject(entity->GetEntityId());
        
        // Unregister from Ludeo
        entity->UnregisterFromLudeo();
#endif
        
        m_entities.erase(std::remove(m_entities.begin(), m_entities.end(), entity));
        delete entity;
    }
    
    // Useful for batch registration when level loads
    const std::vector<Entity*>& GetAllEntities() const { return m_entities; }

private:
    std::vector<Entity*> m_entities;
    uint64_t m_next_id = 1;
    
    uint64_t GenerateUniqueId() { return m_next_id++; }
};
```

### 5.3 Factory Pattern

```cpp
class ObjectFactory
{
public:
    GameObject* CreateObject(const char* objectType, const Vec3& position)
    {
        GameObject* obj = nullptr;
        
        // Create based on type
        if (strcmp(objectType, "player") == 0) {
            obj = new Player();
        } else if (strcmp(objectType, "enemy") == 0) {
            obj = new Enemy();
        } else {
            obj = new GameObject();
        }
        
        obj->SetPosition(position);
        obj->SetEntityId(GenerateId());
        
#if LUDEO_SDK_ENABLED
        // Register immediately
        obj->RegisterWithLudeo();
#endif
        
        return obj;
    }
};
```

### 5.4 Centralized "pull" adapter (a first-class alternative to entity-embedded capture)

Everything above (and §3) assumes the **entity-embedded** style: `RegisterWithLudeo()`/`UnregisterFromLudeo()` methods and `LUDEO_CAPTURE_*` macros live *inside* the game's entity classes, and entities push their own state. That is one valid style — not the only one.

The other style is a **centralized pull adapter**: a single module (the `LudeoStateAdapter`) holds the SDK calls, iterates the game's objects through their existing public accessors, and **pulls** each property into Ludeo. The entity classes are never touched.

**Prefer the centralized pull adapter when most of these hold:**

- Objects are created/owned through a **manager or factory** (§2.2) with clean public **getters** for the state you need to track.
- You already register everything at **session start via batch registration** (§6), and per-frame/per-event diffs can be read from the same accessors.
- The codebase enforces (or you want to honor) a **"no SDK calls outside the integration module"** rule — the spirit of CR-009. Embedding macros in entity headers spreads `#if LUDEO_SDK_ENABLED` and SDK includes across game files; a pull adapter keeps all of that in one place.
- You want the integration to touch **zero game files** (e.g. the game is third-party, or you can't modify entity classes).

**Prefer entity-embedded capture when:**

- State changes through **setters/events** you can hook precisely, and per-change capture is cheaper than re-reading everything (large object counts, expensive accessors).
- There is **no clean accessor** for some state, so the only place to observe a change is inside the class.
- Object lifetimes are irregular and a central walker can't reliably observe creation/destruction.

You can mix: pull for managed entities with clean getters, embedded for the awkward ones.

**Sketch — pull adapter:**

```cpp
// LudeoStateAdapter.cpp — the ONLY place SDK calls live in this style.
void LudeoStateAdapter::RegisterAllExistingObjects()
{
    for (Entity* e : EntityManager::Get().GetAllEntities()) {
        LudeoObjectId id = CreateLudeoObject(e, "entity");   // CreateObject + store mapping
        RegisterObject(e, id, e->GetEntityId());
        CaptureStatic(e, id);                                // one-shot identity/static, via getters
    }
}

void LudeoStateAdapter::CaptureDynamic()   // called each tracked tick / on a diff signal
{
    for (Entity* e : EntityManager::Get().GetAllEntities()) {
        LudeoObjectId id = LudeoIdFor(e);
        if (id == LUDEO_INVALID_OBJECTID) continue;
        LudeoCapture::ObjectScope scope(id);
        const Vec3 pos = e->GetPosition();                 // pull via accessor
        ludeo_DataWriter_SetVec3Float("position", &pos.x); // SetVec3Float takes const float*
        ludeo_DataWriter_SetFloat    ("health",   e->GetHealth());
        // ... only the fields in the plan
    }
}
```

Identity/reference rules (§4), the active-tracking gate, `ObjectScope` pairing (CR-002), and `#if LUDEO_SDK_ENABLED` guards are **identical** to the embedded style — they just all live in the adapter. Capture types must still match the locked server schema (see `11-TROUBLESHOOTING.md §1`).

---

## 6. Batch Registration

### 6.1 When to Batch Register

Batch registration happens when:
- **Level loads** (register all pre-existing objects)
- **Gameplay session begins** (after Room/Player/GameplaySession ready)
- **Restoration completes** (register all restored objects)

### 6.2 Batch Registration Pattern

```cpp
class LudeoStateAdapter
{
public:
    void RegisterAllExistingObjects()
    {
        LudeoHDataWriter writer = LudeoManager::Get().GetDataWriter();
        if (writer == nullptr) {
            LogWarning("[LUDEO] Cannot register objects - no DataWriter");
            return;
        }
        
        if (!LudeoManager::Get().IsGameplayActive()) {
            LogWarning("[LUDEO] Cannot register objects - gameplay not active");
            return;
        }
        
        LogInfo("[LUDEO] Batch registering all existing objects...");
        
        // Register players
        int player_count = 0;
        for (Player* player : PlayerManager::Get().GetAllPlayers()) {
            player->RegisterWithLudeo();
            player_count++;
        }
        
        // Register entities
        int entity_count = 0;
        for (Entity* entity : EntityManager::Get().GetAllEntities()) {
            entity->RegisterWithLudeo();
            entity_count++;
        }
        
        // Register world objects
        int world_count = 0;
        for (WorldObject* obj : WorldManager::Get().GetAllWorldObjects()) {
            obj->RegisterWithLudeo();
            world_count++;
        }
        
        // Register level metadata
        RegisterLevelMetadata();
        
        // Register camera
        RegisterCameraState();
        
        LogInfo("[LUDEO] Registered %d players, %d entities, %d world objects",
                player_count, entity_count, world_count);
    }
    
private:
    void RegisterLevelMetadata()
    {
        // Create level metadata object
        LudeoHDataWriter writer = LudeoManager::Get().GetDataWriter();
        
        LudeoDataWriterCreateObjectParams params = {};
        params.apiVersion = LUDEO_DATAWRITER_CREATEOBJECT_API_LATEST;
        params.objectType = "level_metadata";
        
        LudeoObjectId level_obj_id = LUDEO_INVALID_OBJECTID;
        LudeoResult result = ludeo_DataWriter_CreateObject(writer, &params, &level_obj_id);
        if (result != LudeoResult::Success) {
            LogError("[LUDEO] Failed to create level metadata object");
            return;
        }
        
        // Set level properties
        ludeo_DataWriter_SetCurrent(writer);
        if (ludeo_DataWriter_EnterObject(level_obj_id)) {
            ludeo_DataWriter_SetString("level_id", LevelManager::Get().GetCurrentLevelId());
            ludeo_DataWriter_SetString("level_name", LevelManager::Get().GetCurrentLevelName());
            ludeo_DataWriter_SetInt32("game_mode", (int32_t)GameManager::Get().GetGameMode());
            ludeo_DataWriter_SetInt32("difficulty", (int32_t)GameManager::Get().GetDifficulty());
            ludeo_DataWriter_LeaveObject();
        }
        
        m_level_metadata_id = level_obj_id;
    }
    
    void RegisterCameraState()
    {
        // Similar pattern for camera tracking
        // See Section 10 in master plan for camera details
    }

private:
    LudeoObjectId m_level_metadata_id = LUDEO_INVALID_OBJECTID;
    LudeoObjectId m_camera_id = LUDEO_INVALID_OBJECTID;
};
```

### 6.3 When to Call Batch Registration

```cpp
// In level load completion handler
void OnLevelLoadComplete()
{
#if LUDEO_SDK_ENABLED
    if (LudeoManager::Get().IsRestoring()) {
        // Restoration mode - skip batch registration
        // Objects will be created during restoration
    } else {
        // Normal gameplay - register all existing objects
        LudeoStateAdapter::Get().RegisterAllExistingObjects();
    }
#endif
    
    // Start gameplay...
}
```

> **Two distinct gates — don't conflate them.** `IsRestoring()` is the **restore-window** seam (`LudeoSelected` → end of apply): use it to skip batch registration here (in Player Flow the level loads *inside* the restore, so objects come from the snapshot, not from `RegisterAllExistingObjects()`) and to gate pre-match skips (`07 §9.11`). It is a forward-compatible stub: in a tracking-only integration (before restoration is wired in phase 5 · tasks 3–4) add `bool IsRestoring() const { return m_is_restoring; }` returning `false`, so this gate is a harmless no-op now and becomes correct once restoration lands — no need to revisit the call site.
>
> **Separately, *all* state capture must stay off for the entire Player-Flow replay** — `CreateObject`, `Set*`, and especially **per-tick `CaptureFrame`**. Gate those on a **session-scoped** "is this a Player-Flow replay?" flag (set when this gameplay session's `OpenRoom` carried a `ludeoId`, cleared at session end), **not** on `IsRestoring()`. `IsRestoring()` goes false the instant the snapshot lands, so per-tick capture gated on it alone **resumes mid-replay** and turns the scored replay into a new recording (`06 §7`, `07 §2.3`). Don't substitute an ad-hoc "is this a replay" check for either gate.

---

## 7. Ludeo Actions (Discrete Events)

Actions are discrete gameplay events (`"Kill"`, `"CollectCoin"`, `"ObjectiveComplete"`) sent at a single moment in time, as opposed to the continuous state that §3 tracks.

**Actions fire in BOTH flows — unlike state, which is capture-only.**

- **Creator Flow (recording):** `SendAction` records each event alongside the state stream.
- **Player Flow (playback):** the *same* `SendAction` sites fire again as the player replays the captured moment. The SDK uses these to evaluate the Ludeo's **win/fail conditions** — did the player land the kill, finish before the timer, hit the objective? Without action sends during playback, the SDK has no signal to score the player's run.

This means action call sites **must not** be gated behind `IsRestoring()` or any "are we in player flow?" check. They fire identically in both flows. (State writes — `CreateObject`, `Set*`, per-tick capture, batch registration — *are* off for the **entire** Player-Flow replay: gate them on a **session-scoped** "is this a Player-Flow replay?" flag — set when this gameplay session's `OpenRoom` carried a `ludeoId`, cleared at session end — **not** on `IsRestoring()`, which is only the restore window and goes false mid-replay. See `07 §2.3` and §6.3.)

**Ownership of action work is split across three places — this section owns only the SDK surface:**

| Concern | Owned by |
|---|---|
| Which events should become Actions (discovery, genre catalogs, categories, naming conventions) | `6a-map-game-actions.md` + `research-context/02C-RESEARCH-ACTIONS.md` + `game-patterns/*.md` |
| Inserting action calls at discovered sites (propose-confirm-execute flow, insertion rules, edge cases) | `6b-implement-game-actions.md` |
| The `SendAction` method and `LUDEO_ACTION` macro (below) | This section |

If you're picking action names, reading genre catalogs, or deciding where in the game code an action belongs, you're in the wrong document — go to `phase 6 · task 1` or `02C`. This section is only for the SDK call definitions.

> ⚠️ **Verify every SDK signature against your cloned headers before using.** The C-API snippets in this document are illustrative of the *shape* of each call, not a version-locked contract. The skill clones the **latest** Ludeo SDK release (`github.com/EdgeGamingGG/ludeo-sdk-releases`), so exact parameter lists, struct fields, `*_API_LATEST` macro names, and enum spellings can drift between releases. Before you paste any `ludeo_*` call into a game, open the matching header in the cloned SDK (e.g. `ludeo_DataWriter.h`) and confirm the signature. The signatures here reflect the 4.1.x API surface as last reviewed.

### 7.1 `SendAction` on LudeoManager — canonical definition

`ludeo_DataWriter_SendAction` takes the **DataWriter handle** plus a params struct, and **`playerId` is required** — the SDK needs to know which player the action applies to. Do **not** call it with just an action name; that older one-argument form does not exist in the current SDK.

```c
// From the SDK headers (verify against your clone):
LudeoResult ludeo_DataWriter_SendAction(
    LudeoHDataWriter handle,
    const LudeoDataWriterSendActionParams* params);

struct LudeoDataWriterSendActionParams {
    int32_t     apiVersion;  // set to LUDEO_DATAWRITER_SENDACTION_API_LATEST
    const char* playerId;    // REQUIRED — player the action applies to
    const char* action;      // REQUIRED — the action name, e.g. "Kill"
};
```

Header declaration inside the `LudeoManager` class. The single-argument overload defaults to the local player the manager added in `AddPlayer` (`m_player_id`), so existing call sites stay simple:

```cpp
#if LUDEO_SDK_ENABLED
    void SendAction(const char* actionName);                       // uses the local player id
    void SendAction(const char* actionName, const char* playerId); // explicit player
#endif
```

Implementation:

```cpp
#if LUDEO_SDK_ENABLED
void LudeoManager::SendAction(const char* actionName)
{
    // m_player_id is the id passed to ludeo_Room_AddPlayer during gameplay-session setup.
    SendAction(actionName, m_player_id.c_str());
}

void LudeoManager::SendAction(const char* actionName, const char* playerId)
{
    if (!m_gameplay_session_active || m_data_writer == nullptr) {
        return;  // Not ready for actions — silently drop
    }

    ludeo_DataWriter_SetCurrent(m_data_writer);

    LudeoDataWriterSendActionParams params = {};
    params.apiVersion = LUDEO_DATAWRITER_SENDACTION_API_LATEST;
    params.playerId   = playerId;    // REQUIRED
    params.action     = actionName;  // REQUIRED

    LudeoResult result = ludeo_DataWriter_SendAction(m_data_writer, &params);
    if (result != LudeoResult::Success) {
        LogWarning("[LUDEO] SendAction('%s') failed: %d", actionName, result);
        return;
    }

    LogDebug("[LUDEO] Action: %s (player %s)", actionName, playerId);
}
#endif
```

Actions sent before `BeginGameplaySession` or after `EndGameplaySession` are silently dropped, not errors. This lets callers invoke the action API freely without guarding every call site against session state. If `m_player_id` is empty when an action fires, the action is dropped server-side — confirm the manager stores the id it passed to `ludeo_Room_AddPlayer` (see `05-LIFECYCLE-MANAGEMENT.md`).

### 7.2 `LUDEO_ACTION` macro

Defined in `LudeoCaptureMacros.h`:

```cpp
#if LUDEO_SDK_ENABLED
    #define LUDEO_ACTION(actionName) \
        LudeoManager::Get().SendAction(actionName)
#else
    #define LUDEO_ACTION(actionName)
#endif
```

The macro compiles to nothing when `LUDEO_SDK_ENABLED=0`. Callers do not need to wrap `LUDEO_ACTION(...)` in their own `#if` guards.

**Note:** `6b-implement-game-actions.md` currently inserts direct `LudeoManager::Get().SendAction(...)` calls, not the macro. A forthcoming Phase 2 pass will replace those direct calls with `LUDEO_ACTION` once `LudeoCaptureMacros.h` ships.

### 7.3 Non-ludeoable area boundary actions

Some segments of live play should never become a Ludeo — shops, NPC dialogue, tutorials, safe zones, in-game menus. These are **non-ludeoable areas**, and they are handled entirely through the action stream, **not** by pausing tracking (tracking keeps running normally through them — see §8.5).

The integration's responsibility is two things, and nothing more:

1. **Emit boundary actions.** Send an ordinary action at each edge of the area — e.g. `ShopEntered` when the player opens the shop and `ShopExited` when they leave; `DialogueStarted` / `DialogueEnded` around NPC conversations; `MenuOpened` / `MenuClosed` for an in-game menu. They go through the exact same `SendAction` path as every other action (§7.1) — there is nothing special about them in code, and they are **never** gated.
2. **Connect them once to the global triggers** on Ludeo's platform. This is a one-time, out-of-code configuration step: map each enter/exit action onto the platform's non-ludeoable-area start/end triggers. From then on the **backend** marks those time windows and excludes them from Ludeo creation.

Discovery of these boundaries belongs to `phase 6 · task 1` (they are an action category), emission to `phase 6 · task 2`. The platform-trigger wiring is a manual step the agent cannot do from the codebase — flag it for the user.

---

## 8. Tracking State Management

### 8.1 When to Pause Tracking

Tracking should be paused during:
- Game pause menu open (simulation frozen)
- Cutscenes or cinematics playing (scripted/cosmetic motion, not gameplay state)
- Loading screens or transitions

These are **local capture-hygiene** pauses tied to the gameplay-session lifecycle. They are a different thing from **non-ludeoable areas** (shops, NPC dialogue, tutorials, safe zones, in-game menus): those are backend-controlled, do **not** pause tracking, and are handled via boundary actions — see §7.3 and phases `phase 6`.

### 8.2 Tracking State Manager

```cpp
class LudeoManager
{
private:
    bool m_tracking_paused = false;
    bool m_in_cutscene = false;

public:
    // Check if tracking is currently active
    bool IsTrackingActive() const
    {
        return m_gameplay_session_active 
            && !m_tracking_paused 
            && !m_in_cutscene;
    }
    
    // Pause/Resume (game pause menu)
    void PauseTracking()
    {
        if (m_tracking_paused) return;
        m_tracking_paused = true;
        LogInfo("[LUDEO] Tracking paused");
    }
    
    void ResumeTracking()
    {
        if (!m_tracking_paused) return;
        m_tracking_paused = false;
        LogInfo("[LUDEO] Tracking resumed");
    }
    
    // Cutscene handling
    void OnCutsceneStart()
    {
        m_in_cutscene = true;
        LogInfo("[LUDEO] Cutscene started - tracking suspended");
    }
    
    void OnCutsceneEnd()
    {
        m_in_cutscene = false;
        LogInfo("[LUDEO] Cutscene ended - tracking resumed");
    }
};
```

### 8.3 Integrating State Checks

#### Option 1: Check in Capture Macros

```cpp
#define LUDEO_CAPTURE_FLOAT(obj, objectType, attrName, floatValue) \
    do { \
        if (LudeoManager::Get().IsTrackingActive()) { \
            LudeoCapture::AttributeCapture<...>::CaptureFloat(...); \
        } \
    } while(0)
```

#### Option 2: Check in Capture Functions

```cpp
static void CaptureFloat(T* obj, LudeoObjectId objId, const char* attrName, float value)
{
    if (!LudeoManager::Get().IsTrackingActive()) {
        return;  // Skip capture during pause/cutscene
    }
    
    LudeoHDataWriter writer = LudeoManager::Get().GetDataWriter();
    if (writer == nullptr) return;
    
    // ... rest of capture logic
}
```

### 8.4 Game Integration Points

```cpp
// In game pause handler
void GameManager::OnGamePaused()
{
    // Game logic...
    
#if LUDEO_SDK_ENABLED
    LudeoManager::Get().PauseTracking();
#endif
}

void GameManager::OnGameResumed()
{
    // Game logic...
    
#if LUDEO_SDK_ENABLED
    LudeoManager::Get().ResumeTracking();
#endif
}

// In cutscene system
void CutsceneManager::PlayCutscene(const char* cutsceneId)
{
#if LUDEO_SDK_ENABLED
    LudeoManager::Get().OnCutsceneStart();
#endif
    
    // Play cutscene...
}

void CutsceneManager::OnCutsceneComplete()
{
    // Cleanup...
    
#if LUDEO_SDK_ENABLED
    LudeoManager::Get().OnCutsceneEnd();
#endif
}
```

### 8.5 Non-ludeoable areas are NOT a tracking concern

"Non-ludeoable areas" — shops, NPC dialogue, tutorials, safe zones, in-game menus — are **backend-controlled**. They do **not** pause or alter local tracking: capture keeps running through them. You mark their **boundaries** by sending ordinary Ludeo **actions** (e.g. `ShopEntered` / `ShopExited`) and connecting those actions, once, to the **global triggers** on Ludeo's platform; the backend then excludes those time windows from Ludeo creation. This is an *actions* task — see §7.3 and phases `phase 6`. Do **not** implement it with the local tracking-pause flags above.

---

## 9. What to Track — Decision Guide

### 9.1 The principle behind the rule

**Rule of thumb: track every object whose state change a viewer would notice, or that another tracked object depends on.**

The goal of a Ludeo replay is that the viewer sees the same gameplay the capturing player saw. If something visible changed (a door opened, an enemy died, a crate exploded), the replay must reflect it. If an invisible thing changed but influenced a visible thing — say, an AI's targeting state decides which player it shoots at — that change matters too. Anything that satisfies neither criterion can be skipped.

This rule has three failure modes you should recognize:

1. **Over-tracking** is cheap. The worst case is a slightly larger capture and some SDK overhead. It does not break the replay.
2. **Under-tracking visible state** produces a loudly broken replay: objects missing, doors stuck closed, enemies in the wrong place. Easy to catch in QA.
3. **Under-tracking derived state** produces a subtly broken replay: an enemy seems to target the wrong player, physics drifts, AI state resets feel arbitrary. These are the ones that slip through testing.

**When in doubt, track. The cost of over-tracking is measurable; the cost of under-tracking is a silently wrong replay.**

### 9.2 Decision flow for a single object type

```
1. Is any instance of this object type visible during gameplay?
   ├─ Yes → Track
   └─ No → continue to 2

2. Does its state influence a tracked object's behavior?
   ├─ Yes → Track (at minimum, track the state that matters)
   └─ No → continue to 3

3. Is it referenced by a tracked object (owner, parent, attachment, target)?
   ├─ Yes → Track as a reference target, even if not otherwise interesting
   └─ No → Skip

If you're unsure which branch applies, track it. The cost is small.
```

### 9.3 Decision flow for a single property on a tracked object

For each candidate property, evaluate in order:

1. **Does its value change during gameplay?** If not, skip — it's a constant, no capture needed.
2. **Can a viewer or another tracked object's logic notice the change?** If not, skip.
3. **Is it derivable from other tracked state?** If yes (e.g., world position is `parent.position + local_offset`), skip — but only if restoration code will actually do the derivation.
4. **Does the value carry meaning across sessions?** A raw pointer, memory address, or allocator slot index does not — use a stable game ID instead (see §4).

**Track if (1) AND (2 OR 3-not-derivable) AND (4-has-meaning).**

### 9.4 Starting heuristics — common cases, not rules

These tables are *examples of the decision applied to typical games*, not a rubber stamp. For any game that differs from the typical case, go back to §9.1–§9.3 and apply the reasoning directly. The caveats column exists because the binary answer is almost always wrong somewhere.

#### Object types

| Object type | Typical answer | Why | Caveats — when the typical answer is wrong |
|---|---|---|---|
| Player character | Track | Visible, central | Split-screen / multi-player games must track all players |
| AI enemy / NPC | Track | Visible, affects gameplay | Pooled enemies: register on pool pullout, not pool construction (§2.4) |
| AI perception / target state (property) | Track | Drives visible behavior | Debug tools may mutate it — suppress tracking in dev builds |
| Bullet (hitscan, no tracer) | Skip | Instant, invisible | Kill-cam, time-to-live damage, or tracer rendering all flip this to Track |
| Bullet (tracer / ballistic) | Track | Visible trajectory | Very short lifetime — weigh registration overhead vs capture value |
| Grenade / travel-time projectile | Track | Visible, affects gameplay | Track owner reference to attribute kills |
| Health / ammo pickup (respawning) | Track | Visible, affects gameplay | Respawn timer matters — track "available" or "consumed at T" state |
| Static decorative prop | Skip | Never changes | Check for hidden physics / destructibility before assuming "static" |
| Destructible crate | Track | Can be destroyed | "Destroyed" is a state, not a destruction event — set a flag, don't unregister |
| Door / switch / lever | Track | State changes affect gameplay | Mid-animation state matters if replay can pause between frames |
| Particle / VFX | Skip | Visual only | Track if the VFX *is* the gameplay signal (e.g., charge-attack indicator) |
| Dynamic light source | Depends | Skip if decorative | Stealth games often make lights gameplay-critical → Track |
| Audio source | Skip | Audio-only | Track if audio carries gameplay state (alarm triggered, boss theme) |
| UI / HUD element | Skip | Not part of world | Track the *underlying state* the UI shows, not the UI itself |
| Cutscene state | No captures, set pause flag | Captured differently | See §8 — tracking pauses, not tracks, cutscene content |

#### Property kinds

| Property kind | Typical answer | Why | Caveats |
|---|---|---|---|
| Position / rotation / scale | Track | Visible | For attached objects, track the attachment relationship instead |
| Velocity / acceleration | Usually track | Motion looks wrong without it | Skip only if restoration reconstructs motion from position-over-time |
| Health / mana / ammo | Track | Visible via HUD and behavior | Track current, not max (max is usually static) |
| Enum state (alive/dead, AI mode, door open) | Track | Drives visible behavior | Serialize as integer + document meaning; don't send strings |
| Inventory contents | Track | Affects what player can do | Track as array of item IDs; never as pointers to item objects |
| Cooldown / timer | Track | Affects gameplay timing | Track *remaining* time, not elapsed — restoration sets "time until" |
| Animation frame / blend weight | Usually skip | Derivable from state + time | Track if a stuck animation would be visibly wrong |
| Pointer / reference to another object | Never as pointer | Meaningless across sessions | Track the target's stable ID (see §4) |
| Random seed | Track if gameplay-deterministic | Needed for exact replay | Most games don't rely on seeds for visible outcomes |
| Visual-only transient (animation, particle color) | Skip | No gameplay impact | If the value encodes gameplay state (red = hostile), track |

### 9.5 When the table is wrong for your game

The tables are typical cases, not rules. Clear examples of them being wrong:

- A game with **kill-cams** shows bullet trajectories after the fact. Hitscan bullets become visible-in-replay → track them, despite the default answer.
- A **rhythm game** has no meaningful position on most objects; the important state is hit-timing. Most "track position" rows don't apply.
- An **RTS** has hundreds or thousands of units — over-tracking has real bandwidth cost. Evaluate granularity (track squads rather than individuals if that preserves the experience).
- A **stealth game** elevates lighting and AI-perception state from "usually skip" to gameplay-critical.
- An **open-world / streaming game** scopes to the loaded neighborhood and adds world/cell state — see [`game-patterns/open-world-tracking.md`](game-patterns/open-world-tracking.md).

When your game differs from the examples, don't patch the table — re-apply §9.1–§9.3 from scratch.

---

## 10. Common Patterns by Object Type

### 10.1 Player Entity

```cpp
class Player
{
public:
    void RegisterWithLudeo()
    {
        // Create player object
        LudeoDataWriterCreateObjectParams params = {};
        params.objectType = "player";
        ludeo_DataWriter_CreateObject(writer, &params, &m_ludeo_object_id);
        
        // Set initial values
        LUDEO_CAPTURE_VEC3(this, "player", "position", m_position);
        LUDEO_CAPTURE_VEC3(this, "player", "velocity", m_velocity);
        LUDEO_CAPTURE_VEC4(this, "player", "rotation", m_rotation);
        LUDEO_CAPTURE_FLOAT(this, "player", "health", m_health);
        LUDEO_CAPTURE_FLOAT(this, "player", "armor", m_armor);
        LUDEO_CAPTURE_INT32(this, "player", "ammo", m_ammo);
        LUDEO_CAPTURE_INT32(this, "player", "score", m_score);
        LUDEO_CAPTURE_UINT64(this, "player", "player_id", m_player_id);
        LUDEO_CAPTURE_STRING(this, "player", "player_name", m_player_name.c_str());
    }
    
    // Update methods use capture macros...
};
```

### 10.2 Enemy/NPC Entity

```cpp
class Enemy
{
public:
    void RegisterWithLudeo()
    {
        LudeoDataWriterCreateObjectParams params = {};
        params.objectType = "enemy";
        ludeo_DataWriter_CreateObject(writer, &params, &m_ludeo_object_id);
        
        LUDEO_CAPTURE_VEC3(this, "enemy", "position", m_position);
        LUDEO_CAPTURE_VEC4(this, "enemy", "rotation", m_rotation);
        LUDEO_CAPTURE_FLOAT(this, "enemy", "health", m_health);
        LUDEO_CAPTURE_UINT32(this, "enemy", "blueprint_id", m_blueprint_id);  // Enemy type
        LUDEO_CAPTURE_INT32(this, "enemy", "ai_state", (int32_t)m_ai_state);
        LUDEO_CAPTURE_UINT64(this, "enemy", "target_id", m_target_entity_id);  // Who it's attacking
        LUDEO_CAPTURE_BOOL(this, "enemy", "is_alert", m_is_alert);
    }
};
```

### 10.3 Weapon/Item

```cpp
class Weapon
{
public:
    void RegisterWithLudeo()
    {
        LudeoDataWriterCreateObjectParams params = {};
        params.objectType = "weapon";
        ludeo_DataWriter_CreateObject(writer, &params, &m_ludeo_object_id);
        
        LUDEO_CAPTURE_VEC3(this, "weapon", "position", m_position);
        LUDEO_CAPTURE_VEC4(this, "weapon", "rotation", m_rotation);
        LUDEO_CAPTURE_UINT32(this, "weapon", "weapon_type", (uint32_t)m_weapon_type);
        LUDEO_CAPTURE_INT32(this, "weapon", "ammo", m_ammo);
        LUDEO_CAPTURE_UINT64(this, "weapon", "owner_id", m_owner_entity_id);
        LUDEO_CAPTURE_BOOL(this, "weapon", "is_equipped", m_is_equipped);
    }
};
```

### 10.4 Interactive Object (Door, Switch, etc.)

```cpp
class Door
{
public:
    void RegisterWithLudeo()
    {
        LudeoDataWriterCreateObjectParams params = {};
        params.objectType = "door";
        ludeo_DataWriter_CreateObject(writer, &params, &m_ludeo_object_id);
        
        LUDEO_CAPTURE_VEC3(this, "door", "position", m_position);
        LUDEO_CAPTURE_VEC4(this, "door", "rotation", m_rotation);
        LUDEO_CAPTURE_BOOL(this, "door", "is_open", m_is_open);
        LUDEO_CAPTURE_BOOL(this, "door", "is_locked", m_is_locked);
        LUDEO_CAPTURE_FLOAT(this, "door", "open_progress", m_open_progress);  // 0.0 to 1.0
    }
};
```

### 10.5 Projectile

```cpp
class Projectile
{
public:
    void RegisterWithLudeo()
    {
        LudeoDataWriterCreateObjectParams params = {};
        params.objectType = "projectile";
        ludeo_DataWriter_CreateObject(writer, &params, &m_ludeo_object_id);
        
        LUDEO_CAPTURE_VEC3(this, "projectile", "position", m_position);
        LUDEO_CAPTURE_VEC3(this, "projectile", "velocity", m_velocity);
        LUDEO_CAPTURE_UINT32(this, "projectile", "projectile_type", m_projectile_type);
        LUDEO_CAPTURE_UINT64(this, "projectile", "owner_id", m_owner_entity_id);
        LUDEO_CAPTURE_FLOAT(this, "projectile", "damage", m_damage);
    }
};
```

---

## 11. Performance Considerations

Performance is game-specific. **Measure, don't trust this document.** Actual overhead varies with SDK version, object count, properties per object, throttling policy, CPU, and compiler. What follows is *what to pay attention to*, not *what values to expect*.

### 11.1 What causes overhead (ordered from largest to smallest, typically)

1. **Number of property captures per frame.** Every `LUDEO_CAPTURE_*` call crosses the SDK boundary, performs an attribute-name lookup, and writes to a data buffer. Thousands per frame add up.
2. **Batch registration at gameplay start.** All existing objects register at once; with large worlds this is a visible one-time hitch unless amortized.
3. **Object creation / destruction churn.** Steady-state count matters less than the rate of adds/removes.
4. **Walking the tracked-object list** for diff-based discovery (see §2.3 ECS, §2.4 Pool, §2.8 Frame iteration). Cache-unfriendly data layouts make this worse.
5. **`ludeo_Tick` itself.** Per-frame SDK work — typically small, but not zero.

### 11.2 Levers, ordered by impact

Apply in order until measured overhead is acceptable:

1. **Skip unchanged values.** `if (m_health == newHealth) return;` before the capture call. Almost free and typically eliminates most redundant traffic.
2. **Throttle distant or off-screen objects.** A far enemy updating position every few frames instead of every frame is visually indistinguishable in replay; capture cost drops proportionally.
3. **Batch via `EnterObject` / `LeaveObject`.** Multiple captures to the same object inside a single `EnterObject` scope share context setup; the SDK skips re-resolving the object ID each time.
4. **Shrink the tracked set.** Re-apply §9 ruthlessly. It is common to find a meaningful fraction of tracked objects contribute nothing visible.
5. **Defer non-critical captures.** UI/HUD state and environmental metadata usually change less often than per-frame; capture on change rather than on tick.
6. **Move discovery off the hot path.** For pool / ECS / scene-graph patterns (§2.3, §2.4, §2.8), run the tracking sweep less often than the game tick when you can get away with it.

### 11.3 Red flags to watch for

These patterns reliably indicate a problem — investigate rather than explain away:

- **Frame time regresses only when `LUDEO_SDK_ENABLED=ON`.** Isolates the cost to SDK activity. Profile per-call to find the hottest capture.
- **Memory grows across a session with no new objects spawning.** Suggests `UnregisterFromLudeo` is being skipped on destruction — objects accumulate in the SDK's registry.
- **Hitch at gameplay start scales with object count.** Batch registration is blocking; consider amortizing across multiple frames (§6.3).
- **Hitch at level transition.** Many destructions in one burst — unregister progressively or pool-destroy in smaller batches.
- **Replay data rate spikes.** Over-tracking produces large data volumes; check the SDK's reported capture size per frame against the game's budget.

### 11.4 How to measure

Use the SDK's own telemetry (see `03-SDK-FUNDAMENTALS.md` and `12-SDK-API-REFERENCE.md`) for capture volume, combined with the game's existing frame profiler:

- **Per-frame cost** — wrap SDK Tick + captures with a timer for a fixed scenario; compare SDK ON vs OFF.
- **Per-scenario cost** — run representative scenarios (combat peak, traversal, scripted events) with and without SDK. Differences that exceed the game's budget flag candidates for the levers in §11.2.
- **Stress test** — artificially spawn the worst-case scenario (max concurrent enemies + projectiles). If the budget is blown here, apply throttling before shipping.

### 11.5 Scalability considerations

- **Object count alone is misleading.** Update frequency and properties-per-object multiply the cost. 100 objects captured heavily can cost more than 1000 captured sparsely.
- **Multiplayer multiplies replay data** if tracking is per-player. Shared world state should be captured once, not N times.
- **Long sessions accumulate** handle counts and capture volume. Ensure cleanup paths run on level change, not only on shutdown.

---

## 12. Validation Checklist

### Implementation Checklist

**Object Lifecycle:**
- [ ] All game objects have `LudeoObjectId` member
- [ ] Objects register during creation/initialization
- [ ] Objects set initial values after registration
- [ ] Objects unregister during destruction
- [ ] Registration failures handled gracefully

**Property Tracking:**
- [ ] All critical properties tracked via capture macros
- [ ] Setters update game state before tracking
- [ ] Stable game IDs used for relationships (not pointers)
- [ ] DataWriter validity checked before tracking
- [ ] Return values checked for SDK calls

**Identity Mapping:**
- [ ] Bidirectional maps maintained (Ludeo ID ↔ Game ID)
- [ ] Maps updated during registration/unregistration
- [ ] Object registry maintained for restoration lookup

**Actions:**
- [ ] Key gameplay actions identified (kills, pickups, objectives, etc.)
- [ ] Action macros integrated at event trigger points
- [ ] Action names follow convention (PascalCase, descriptive)
- [ ] Combat, collection, movement, and progression actions covered

**Tracking State:**
- [ ] Tracking pauses when game paused
- [ ] Tracking suspends during cutscenes
- [ ] Non-ludeoable area boundaries (shop/NPC/menu/tutorial/safe-zone) emit enter/exit Ludeo actions (§7.3, `phase 6`) — tracking is *not* paused for them

**Performance:**
- [ ] Measured frame-time impact against the game's budget
- [ ] Throttling applied to distant / off-screen objects where overhead demanded it
- [ ] Redundant updates skipped (value-change guards in setters)
- [ ] No memory growth across a long play session

### Testing Checklist

**Basic Tracking:**
- [ ] Objects register successfully (check logs)
- [ ] Object count matches expected (compare lists)
- [ ] Properties update in real-time (verify in debug tools)
- [ ] Objects unregister on destruction (no leaks)

**Relationships:**
- [ ] Owner/parent relationships tracked correctly
- [ ] Game IDs resolve to objects during restoration
- [ ] Circular references handled (if applicable)

**Actions:**
- [ ] Actions fire when expected (check logs)
- [ ] No duplicate actions
- [ ] No missing actions for key events
- [ ] Action names consistent

**State Management:**
- [ ] Tracking pauses/resumes correctly
- [ ] Cutscenes don't track state
- [ ] Non-ludeoable area boundary actions fire (enter/exit) and are connected to global triggers so the backend excludes those windows
- [ ] State consistency after resume

**Performance:**
- [ ] Frame-time impact within the game's budget (measured, not assumed)
- [ ] No stutters or hitches during tracking
- [ ] Memory usage stable across a representative session

---

## Quick Reference

### Key APIs

```cpp
// Object creation
ludeo_DataWriter_CreateObject(writer, &params, &objectId);

// Property tracking
ludeo_DataWriter_SetFloat(attrName, value);
ludeo_DataWriter_SetVec3Float(attrName, vec3);
ludeo_DataWriter_SetUInt64(attrName, value);
ludeo_DataWriter_SetBool(attrName, value);
// ... etc.

// Object destruction
ludeo_DataWriter_DestroyObject(writer, &params);

// Actions (handle + params struct; playerId and action are both REQUIRED)
LudeoDataWriterSendActionParams actionParams = {};
actionParams.apiVersion = LUDEO_DATAWRITER_SENDACTION_API_LATEST;
actionParams.playerId   = playerId;
actionParams.action     = actionName;
ludeo_DataWriter_SendAction(writer, &actionParams);

// Context management
ludeo_DataWriter_SetCurrent(writer);
ludeo_DataWriter_EnterObject(objectId);
ludeo_DataWriter_LeaveObject();
```

### Capture Macro Usage

```cpp
LUDEO_CAPTURE_FLOAT(this, "object_type", "attribute", value);
LUDEO_CAPTURE_VEC3(this, "object_type", "position", vec3);
LUDEO_CAPTURE_BOOL(this, "object_type", "is_active", flag);
LUDEO_CAPTURE_UINT64(this, "object_type", "entity_id", id);
LUDEO_ACTION("ActionName");
```

### Common Patterns

```cpp
// Registration
obj->RegisterWithLudeo();

// Update
LUDEO_CAPTURE_*(this, "type", "attr", value);

// Unregistration
obj->UnregisterFromLudeo();

// State management
LudeoManager::Get().PauseTracking();
LudeoManager::Get().ResumeTracking();
```

---

**Next Steps:**
- Tracking patterns implemented → Proceed to [07-RESTORATION-PATTERNS.md](07-RESTORATION-PATTERNS.md)
- Need capture macros → See [08-CODE-PATTERNS.md](08-CODE-PATTERNS.md)
- Need lifecycle setup → See [05-LIFECYCLE-MANAGEMENT.md](05-LIFECYCLE-MANAGEMENT.md)

**Related Documentation:**
- [00-CRITICAL-REQUIREMENTS.md](00-CRITICAL-REQUIREMENTS.md) - Non-negotiable rules
- [07-RESTORATION-PATTERNS.md](07-RESTORATION-PATTERNS.md) - How to restore tracked state
- [08-CODE-PATTERNS.md](08-CODE-PATTERNS.md) - Macro implementations and helpers
