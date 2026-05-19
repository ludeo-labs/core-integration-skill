# 06 - Object Tracking Patterns

> **Purpose:** Comprehensive guide to tracking game object state for Ludeo SDK  
> **Audience:** AI agents implementing object tracking during active gameplay  
> **Prerequisites:** [05-LIFECYCLE-MANAGEMENT.md](05-LIFECYCLE-MANAGEMENT.md), [00-CRITICAL-REQUIREMENTS.md](00-CRITICAL-REQUIREMENTS.md)  
> **Related:** [08-CODE-PATTERNS.md](08-CODE-PATTERNS.md), [07-RESTORATION-PATTERNS.md](07-RESTORATION-PATTERNS.md)

---

## Table of Contents

1. [Tracking Strategy Overview](#1-tracking-strategy-overview)
2. [Object Lifecycle Pattern](#2-object-lifecycle-pattern)
3. [Identity and Reference Mapping](#3-identity-and-reference-mapping)
4. [Manager and Factory Integration](#4-manager-and-factory-integration)
5. [Batch Registration](#5-batch-registration)
6. [Ludeo Actions (Discrete Events)](#6-ludeo-actions-discrete-events)
7. [Tracking State Management](#7-tracking-state-management)
8. [What to Track - Decision Guide](#8-what-to-track---decision-guide)
9. [Common Patterns by Object Type](#9-common-patterns-by-object-type)
10. [Performance Considerations](#10-performance-considerations)
11. [Validation Checklist](#11-validation-checklist)

---

## 1. Tracking Strategy Overview

### 1.1 Core Principle

**Track ALL game objects that affect the gameplay experience.**

The goal is **complete state capture** for faithful restoration. When in doubt, track it.

### 1.2 What Gets Tracked

| Category | Examples | Priority |
|----------|----------|----------|
| **Player Entities** | Player character, stats, inventory, position | 🔴 CRITICAL |
| **NPCs/Enemies** | AI entities, health, state, position | 🔴 CRITICAL |
| **Interactive Objects** | Pickups, doors, switches, vehicles | 🔴 CRITICAL |
| **Projectiles** | Bullets, grenades, spells (if persistent) | 🟡 IMPORTANT |
| **Environment State** | Destructible objects, lighting, weather | 🟡 IMPORTANT |
| **UI State** | HUD mode, active overlays (if affects experience) | 🟢 OPTIONAL |
| **Audio State** | Music state, combat intensity (if affects experience) | 🟢 OPTIONAL |

### 1.3 Tracking vs Actions

| Aspect | **Tracking (Continuous State)** | **Actions (Discrete Events)** |
|--------|--------------------------------|-------------------------------|
| **Nature** | Ongoing, changes over time | Happens at a moment in time |
| **Frequency** | Updated when properties change | Fired once when event occurs |
| **Purpose** | Restore exact game state | Objectives, scoring, highlights |
| **API** | `ludeo_DataWriter_Set*()` | `ludeo_DataWriter_SendAction()` |
| **Examples** | `health=75`, `position=(10,5,3)` | `"Kill"`, `"CollectCoin"`, `"Headshot"` |

**Both are required** for a complete Ludeo integration.

---

## 2. Object Lifecycle Pattern

### 2.1 Three-Phase Lifecycle

Every tracked object follows this pattern:

```
1. CREATE → Register with SDK, get LudeoObjectId
2. UPDATE → Track property changes during gameplay  
3. DESTROY → Unregister from SDK, cleanup
```

### 2.2 Phase 1: Object Creation & Registration

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

✅ **Store LudeoObjectId** in the object (for later updates)  
✅ **Check DataWriter validity** before registration  
✅ **Set initial values immediately** after registration  
✅ **Handle registration failure gracefully** (game must continue)

---

### 2.3 Phase 2: Property Updates

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

| ✅ DO | ❌ DON'T |
|-------|----------|
| Update game state first, then track | Track before updating game state |
| Use capture macros (handles errors) | Call SDK directly from game code |
| Track stable IDs (entity_id) | Track pointers or memory addresses |
| Check if gameplay active before tracking | Assume tracking is always active |
| Update only when value actually changes | Update every frame unconditionally |

---

### 2.4 Phase 3: Object Destruction

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

✅ **Always clear LudeoObjectId** after destruction  
✅ **Handle nullptr DataWriter** (may be already shut down)  
✅ **Log failures but continue** (don't crash game)  
✅ **Call before game object is deleted**

---

## 3. Identity and Reference Mapping

### 3.1 The Identity Problem

**Problem:** Game objects reference each other (owner, parent, target, etc.). During restoration, these relationships must be recreated.

**Solution:** Use stable, deterministic game IDs + maintain bidirectional maps.

### 3.2 Stable ID Requirements

| ✅ Good ID Types | ❌ Bad ID Types |
|------------------|-----------------|
| `uint64_t entity_id` (generated deterministically) | `GameObject* pointer` (memory address) |
| `uint32_t blueprint_id` (content ID) | `LudeoObjectId` (SDK internal ID) |
| `std::string unique_name` (if stable) | `int array_index` (changes) |
| Steam user ID, player profile ID | `void* handle` (opaque pointer) |

### 3.3 Bidirectional Mapping Pattern

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

### 3.4 Tracking Relationships

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

## 4. Manager and Factory Integration

### 4.1 When to Use Manager Integration

Use manager/factory integration when:
- ✅ Game has centralized object creation (EntityManager, ObjectFactory, etc.)
- ✅ Multiple places create objects (avoids duplication)
- ✅ Object lifecycle managed by a system

### 4.2 Manager Pattern

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

### 4.3 Factory Pattern

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

---

## 5. Batch Registration

### 5.1 When to Batch Register

Batch registration happens when:
- **Level loads** (register all pre-existing objects)
- **Gameplay session begins** (after Room/Player/GameplaySession ready)
- **Restoration completes** (register all restored objects)

### 5.2 Batch Registration Pattern

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

### 5.3 When to Call Batch Registration

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

---

## 6. Ludeo Actions (Discrete Events)

### 6.1 What Are Actions?

**Actions are discrete gameplay EVENTS** that happen at a specific moment in time.

| Aspect | Details |
|--------|---------|
| **Purpose** | Define exciting/meaningful gameplay moments |
| **Use Cases** | Objectives ("Get 3 headshots"), Scoring (100 points per kill), Highlights |
| **Frequency** | Fired once when event occurs |
| **API** | `ludeo_DataWriter_SendAction(actionName)` |
| **Examples** | `"Kill"`, `"Headshot"`, `"CollectCoin"`, `"LevelUp"`, `"ObjectiveComplete"` |

### 6.2 Why Actions Are Critical

🔴 **CRITICAL:** Every game integration **MUST** identify and implement key gameplay Actions.

Without Actions:
- ❌ No Ludeo objectives possible
- ❌ No scoring system
- ❌ No highlights or exciting moments marked
- ❌ Poor player engagement with Ludeos

### 6.3 Action Implementation Pattern

#### LudeoManager Action Support

```cpp
class LudeoManager
{
public:
    void SendAction(const char* actionName)
    {
        if (!m_gameplay_session_active || m_data_writer == nullptr) {
            return;  // Not ready for actions
        }
        
        ludeo_DataWriter_SetCurrent(m_data_writer);
        ludeo_DataWriter_SendAction(actionName);
        
        LogDebug("[LUDEO] Action: %s", actionName);
    }
};
```

#### Action Macro (in LudeoCaptureMacros.h)

```cpp
#if LUDEO_SDK_ENABLED
    #define LUDEO_ACTION(actionName) \
        LudeoManager::Get().SendAction(actionName)
#else
    #define LUDEO_ACTION(actionName)
#endif
```

### 6.4 Common Action Categories

#### Combat Actions

```cpp
void CombatSystem::OnEnemyKilled(Entity* killer, Entity* victim, WeaponType weapon, bool isHeadshot)
{
    // Game logic...
    
    LUDEO_ACTION("Kill");
    
    if (isHeadshot) {
        LUDEO_ACTION("Headshot");
    }
    
    switch (weapon) {
        case WeaponType::Sniper:
            LUDEO_ACTION("SniperKill");
            break;
        case WeaponType::Explosive:
            LUDEO_ACTION("ExplosiveKill");
            break;
        case WeaponType::Melee:
            LUDEO_ACTION("MeleeKill");
            break;
    }
}

void Player::OnDeath(Entity* killer)
{
    // Game logic...
    
    LUDEO_ACTION("PlayerDeath");
}
```

#### Collection Actions

```cpp
void ItemSystem::OnItemCollected(Entity* collector, ItemType item)
{
    // Game logic...
    
    switch (item) {
        case ItemType::Coin:
            LUDEO_ACTION("CollectCoin");
            break;
        case ItemType::HealthPack:
            LUDEO_ACTION("CollectHealth");
            break;
        case ItemType::Ammo:
            LUDEO_ACTION("CollectAmmo");
            break;
        case ItemType::PowerUp:
            LUDEO_ACTION("CollectPowerUp");
            break;
    }
}
```

#### Movement Actions

```cpp
void PlayerController::OnJump()
{
    // Game logic...
    
    LUDEO_ACTION("Jump");
    
    if (IsDoubleJump()) {
        LUDEO_ACTION("DoubleJump");
    }
}

void PlayerController::OnDash()
{
    // Game logic...
    
    LUDEO_ACTION("Dash");
}
```

#### Progression Actions

```cpp
void ObjectiveSystem::OnObjectiveComplete(const char* objectiveId)
{
    // Game logic...
    
    LUDEO_ACTION("ObjectiveComplete");
}

void ProgressionSystem::OnLevelUp(int newLevel)
{
    // Game logic...
    
    LUDEO_ACTION("LevelUp");
}
```

### 6.5 Action Naming Best Practices

| ✅ Good Names | ❌ Bad Names | Why |
|--------------|--------------|-----|
| `"Kill"` | `"enemy_killed"` | Simple, clean |
| `"Headshot"` | `"HeadShotKill"` | Consistent capitalization |
| `"CollectCoin"` | `"coin"` | Verb + Noun pattern |
| `"ObjectiveComplete"` | `"obj_complete_1234"` | Readable, no IDs |
| `"LevelUp"` | `"level_up_event"` | Concise, no redundancy |

**Naming Convention:**
- Use PascalCase (e.g., `"CollectCoin"`)
- Start with verb when possible (`"Collect"`, `"Kill"`, `"Complete"`)
- Keep names short but descriptive
- Avoid IDs, timestamps, or dynamic data in names

---

## 7. Tracking State Management

### 7.1 When to Pause Tracking

Tracking should be paused during:
- ❌ Game pause menu open
- ❌ Cutscenes or cinematics playing
- ❌ Tutorial sections (non-ludeoable areas)
- ❌ Loading screens or transitions
- ❌ Menu overlays (inventory, shop, etc.)

### 7.2 Tracking State Manager

```cpp
class LudeoManager
{
private:
    bool m_tracking_paused = false;
    bool m_in_cutscene = false;
    bool m_in_non_ludeoable_area = false;

public:
    // Check if tracking is currently active
    bool IsTrackingActive() const
    {
        return m_gameplay_session_active 
            && !m_tracking_paused 
            && !m_in_cutscene 
            && !m_in_non_ludeoable_area;
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
    
    // Non-ludeoable area handling
    void EnterNonLudeoableArea(const char* areaName)
    {
        m_in_non_ludeoable_area = true;
        LogInfo("[LUDEO] Entered non-ludeoable area: %s", areaName);
    }
    
    void ExitNonLudeoableArea()
    {
        m_in_non_ludeoable_area = false;
        LogInfo("[LUDEO] Exited non-ludeoable area");
    }
};
```

### 7.3 Integrating State Checks

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
        return;  // Skip capture during pause/cutscene/non-ludeoable
    }
    
    LudeoHDataWriter writer = LudeoManager::Get().GetDataWriter();
    if (writer == nullptr) return;
    
    // ... rest of capture logic
}
```

### 7.4 Game Integration Points

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

// In area/trigger system
void AreaTrigger::OnPlayerEnter(Player* player)
{
#if LUDEO_SDK_ENABLED
    if (m_is_tutorial_area || m_is_safe_zone) {
        LudeoManager::Get().EnterNonLudeoableArea(m_area_name.c_str());
    }
#endif
}

void AreaTrigger::OnPlayerExit(Player* player)
{
#if LUDEO_SDK_ENABLED
    if (m_is_tutorial_area || m_is_safe_zone) {
        LudeoManager::Get().ExitNonLudeoableArea();
    }
#endif
}
```

### 7.5 Non-Ludeoable Areas

| Area Type | Reason | Detection Method |
|-----------|--------|------------------|
| **Tutorial** | Players learning, not playing | Level ID, area flag, or game state |
| **Main Menu** | Not gameplay | Scene/screen type |
| **Lobby/Waiting Room** | Pre-game area | Game state machine |
| **Loading Screen** | Technical transition | Loading flag |
| **Shop/Inventory** | Menu overlay | UI state |
| **Safe Zone/Hub** | Non-combat by design | Area trigger/flag |
| **Cutscene** | Passive viewing | Cutscene system state |

---

## 8. What to Track - Decision Guide

### 8.1 Decision Flowchart

```
Is the object visible to the player?
├─ YES → Track it
└─ NO → Does it affect gameplay or experience?
    ├─ YES → Track it
    └─ NO → Does it affect other tracked objects?
        ├─ YES → Track it
        └─ NO → Skip it (optional)
```

### 8.2 Object Type Decision Matrix

| Object Type | Track? | Reason |
|-------------|--------|--------|
| Player character | ✅ YES | Core gameplay entity |
| Enemy AI | ✅ YES | Affects gameplay directly |
| Bullet (instant hit) | ❌ NO | Not visible/persistent |
| Projectile (grenade) | ✅ YES | Visible, affects gameplay |
| Health pickup | ✅ YES | Player can interact |
| Background decoration | ❌ NO | No gameplay impact |
| Destructible crate | ✅ YES | Can be destroyed, affects gameplay |
| Static wall | ❌ NO | Never changes |
| Door (can open) | ✅ YES | State changes affect gameplay |
| Particle effect | ❌ NO | Visual only, not gameplay |
| Light source (dynamic) | 🟡 MAYBE | If affects visibility/gameplay |
| Audio source | 🟡 MAYBE | If affects experience significantly |
| UI element | ❌ NO | Not part of game world |
| HUD mode | 🟡 MAYBE | If affects experience |

### 8.3 Property Decision Matrix

For each object, decide which properties to track:

| Property Type | Track? | Examples |
|---------------|--------|----------|
| **Transform** | ✅ YES | Position, rotation, scale |
| **Health/Stats** | ✅ YES | HP, armor, stamina, mana |
| **State Enum** | ✅ YES | Alive/dead, active/inactive, AI state |
| **Relationships** | ✅ YES | Owner ID, parent ID, squad ID |
| **Gameplay Data** | ✅ YES | Ammo count, score, level, inventory |
| **Visual-Only** | ❌ NO | Animation frame, particle color |
| **Audio-Only** | ❌ NO | Sound volume, pitch |
| **Debug Data** | ❌ NO | Frame render time, debug flags |

---

## 9. Common Patterns by Object Type

### 9.1 Player Entity

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

### 9.2 Enemy/NPC Entity

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

### 9.3 Weapon/Item

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

### 9.4 Interactive Object (Door, Switch, etc.)

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

### 9.5 Projectile

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

## 10. Performance Considerations

### 10.1 Update Frequency Guidelines

| Object Type | Update Frequency | Reason |
|-------------|------------------|--------|
| **Player** | Every change | Critical, low count |
| **Nearby Enemies** | Every change | Visible, affects gameplay |
| **Distant Enemies** | Throttled (every 5 frames) | Less important |
| **Projectiles** | Every change | Fast-moving, critical |
| **Static Objects** | On change only | Rarely changes |
| **UI Elements** | On change only | State-based |

### 10.2 Tracking Overhead

**Expected Overhead:**
- SDK Tick: <0.1ms per frame
- Object Registration: ~0.01ms per object
- Property Update: ~0.001-0.005ms per update
- Network: Bandwidth depends on update frequency

**Scalability Guidelines:**
- ✅ 100-500 tracked objects: No issues
- 🟡 500-1000 objects: Monitor performance
- 🔴 1000+ objects: Optimize (throttle updates, reduce tracked objects)

### 10.3 Optimization Tips

1. **Throttle distant objects:**
```cpp
void Enemy::Update()
{
    // Update game logic every frame
    UpdateAI();
    
    // Track Ludeo state at reduced frequency if far from player
    if (m_frames_since_last_track++ >= GetTrackingInterval()) {
        m_frames_since_last_track = 0;
        UpdateLudeoTracking();
    }
}

int Enemy::GetTrackingInterval() const
{
    float distance = DistanceToPlayer();
    if (distance < 50.0f) return 1;      // Every frame
    if (distance < 100.0f) return 5;     // Every 5 frames
    return 10;                            // Every 10 frames
}
```

2. **Batch property updates:**
```cpp
// Instead of calling capture macro for each property individually,
// batch them in a single function
void UpdateAllLudeoProperties()
{
    LUDEO_CAPTURE_VEC3(this, "enemy", "position", m_position);
    LUDEO_CAPTURE_FLOAT(this, "enemy", "health", m_health);
    LUDEO_CAPTURE_INT32(this, "enemy", "ai_state", m_ai_state);
    // ... all properties
}
```

3. **Skip redundant updates:**
```cpp
void SetHealth(float newHealth)
{
    if (m_health == newHealth) return;  // No change, skip update
    
    m_health = newHealth;
    LUDEO_CAPTURE_FLOAT(this, "enemy", "health", newHealth);
}
```

---

## 11. Validation Checklist

### ✅ Implementation Checklist

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
- [ ] Non-ludeoable areas identified and handled
- [ ] Tutorial/menu areas don't capture Ludeos

**Performance:**
- [ ] Object count reasonable (<1000 tracked objects)
- [ ] Update frequency throttled for distant objects
- [ ] No redundant updates (check for value changes)
- [ ] Tracking overhead measured (<0.1ms per frame)

### ✅ Testing Checklist

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
- [ ] Non-ludeoable areas don't create Ludeos
- [ ] State consistency after resume

**Performance:**
- [ ] Frame time impact <0.1ms
- [ ] Memory usage reasonable (<50MB overhead)
- [ ] No stutters or hitches during tracking

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

// Actions
ludeo_DataWriter_SendAction(actionName);

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
- ✅ Tracking patterns implemented → Proceed to [07-RESTORATION-PATTERNS.md](07-RESTORATION-PATTERNS.md)
- ⚠️ Need capture macros → See [08-CODE-PATTERNS.md](08-CODE-PATTERNS.md)
- ⚠️ Need lifecycle setup → See [05-LIFECYCLE-MANAGEMENT.md](05-LIFECYCLE-MANAGEMENT.md)

**Related Documentation:**
- [00-CRITICAL-REQUIREMENTS.md](00-CRITICAL-REQUIREMENTS.md) - Non-negotiable rules
- [07-RESTORATION-PATTERNS.md](07-RESTORATION-PATTERNS.md) - How to restore tracked state
- [08-CODE-PATTERNS.md](08-CODE-PATTERNS.md) - Macro implementations and helpers


