# 02C-RESEARCH-ACTIONS.md - Actions Inventory Research

> **Purpose:** Identify all gameplay actions for objectives and scoring  
> **For:** Actions Agent - implementing LUDEO_ACTION() calls  
> **Prerequisites:** Object research helpful but not required

**Last Updated:** December 2025

---

## 📋 **Instructions**

Complete this questionnaire to identify:
- Key exciting gameplay moments
- Discrete events that should trigger actions
- What makes good objectives and scoring opportunities

**Key Distinction:**
- **Actions** = Discrete events (fire once) → Use `LUDEO_ACTION()`
- **Attributes** = Continuous state → Use `LUDEO_CAPTURE_*()`

**Output:** Create `GAME_ANALYSIS_ACTIONS.md` with your findings.

---

## 🎯 **SECTION 6: Actions Inventory**

### 6.1 Action Identification

**What are the key exciting moments in this game?**
1. 
2. 
3. 
4. 
5. 

**What actions would players want to replay or challenge others with?**
1. 
2. 
3. 

**What actions define skill or achievement?**
1. 
2. 
3. 

---

### 6.2 Player Perspective Rule

**Actions are tracked from the PLAYER's perspective only.**

Ludeo actions drive objectives ("Kill 10 enemies") and scoring (100 pts per kill). These are meaningless if every entity's events are recorded — an NPC killing another NPC is not the player's achievement.

**Before mapping any action, identify:**
1. How does the code distinguish the player entity from NPCs/AI?
   - Is there a `IsPlayer()`, `IsLocalPlayer()`, or `IsHuman()` method?
   - Is there a player class separate from enemy/NPC classes?
   - Is there a player ID, team check, or entity type flag?
2. Does the event function receive the acting entity as a parameter?
   - e.g., `OnKill(Entity* killer, Entity* victim)` — check if `killer` is the player
3. Is there a player-specific code path vs a generic one?
   - Prefer player-specific functions (e.g., `Player::OnKill`) over generic ones (e.g., `Entity::OnKill`)

**Document your findings:**

**How does this game identify the player?**
Method/check:
File:

**Player-specific code paths found:**
1.
2.

---

### 6.3 Action vs Attribute Decision

```
Does it happen ONCE at a moment in time?
├─ Yes → It's an ACTION (use LUDEO_ACTION)
│   Examples: Kill, Pickup, Jump, Objective Complete
│
└─ No → It's CONTINUOUS STATE (use LUDEO_CAPTURE_*)
    Examples: Health, Position, Velocity, Rotation
```

---

### 6.4 Complete Action Inventory

Document EVERY action that should be tracked:

#### Combat Actions

| Action Name | Description | Trigger Location | Objective Potential | Scoring Potential |
|-------------|-------------|------------------|---------------------|-------------------|
| Kill | Player kills enemy | | Yes - "Kill 10 enemies" | Yes - 100 pts |
| Headshot | Headshot kill | | Yes - "Get 5 headshots" | Yes - +50 bonus |
| Death | Player dies | | No | No |
| TakeDamage | Player damaged | | Maybe | Maybe |
| CriticalHit | Critical damage dealt | | Yes | Yes |
| | | | | |

#### Movement Actions

| Action Name | Description | Trigger Location | Objective Potential | Scoring Potential |
|-------------|-------------|------------------|---------------------|-------------------|
| Jump | Player jumps | | Yes - "Jump 100 times" | Maybe - 1 pt |
| DoubleJump | Double jump | | Yes - "10 double jumps" | Maybe - 5 pts |
| Dash | Dash ability | | Yes | Maybe |
| WallJump | Wall jump | | Yes | Yes |
| | | | | |

#### Collection Actions

| Action Name | Description | Trigger Location | Objective Potential | Scoring Potential |
|-------------|-------------|------------------|---------------------|-------------------|
| CollectCoin | Coin collected | | Yes - "Collect 50 coins" | Yes - value * 10 |
| CollectHealth | Health pickup | | Maybe | Maybe |
| PickupWeapon | Weapon acquired | | Maybe | Maybe |
| CollectSecret | Secret found | | Yes | Yes - 500 pts |
| | | | | |

#### Progression Actions

| Action Name | Description | Trigger Location | Objective Potential | Scoring Potential |
|-------------|-------------|------------------|---------------------|-------------------|
| CompleteObjective | Objective done | | Yes | Yes - varies |
| LevelUp | Player levels up | | Maybe | Yes - 500 pts |
| UnlockAchievement | Achievement earned | | Maybe | Maybe |
| ReachCheckpoint | Checkpoint reached | | Maybe | Yes |
| | | | | |

#### Interaction Actions

| Action Name | Description | Trigger Location | Objective Potential | Scoring Potential |
|-------------|-------------|------------------|---------------------|-------------------|
| OpenDoor | Door opened | | Maybe | No |
| ActivateSwitch | Switch activated | | Maybe | Maybe |
| DestroyObject | Destructible broken | | Maybe | Maybe - 10 pts |
| UseAbility | Special ability used | | Yes | Maybe |
| | | | | |

#### Social/Multiplayer Actions (if applicable)

| Action Name | Description | Trigger Location | Objective Potential | Scoring Potential |
|-------------|-------------|------------------|---------------------|-------------------|
| Assist | Assisted kill | | Yes | Yes - 50 pts |
| Revive | Revived teammate | | Yes | Yes - 100 pts |
| Capture | Captured objective | | Yes | Yes |
| | | | | |

**Total actions identified:** _____

---

### 6.5 Action Implementation Plan

For each action, document exactly where to add the `LUDEO_ACTION()` call:

#### Example: Kill Action

**Current code location:** `CombatManager.cpp:245`

```cpp
void CombatManager::OnEnemyKilled(Entity* killer, Entity* victim, WeaponType weapon)
{
    // Existing game logic
    killer->AddKills(1);
    UpdateScore(killer, 100);

    // Ludeo actions are PLAYER-PERSPECTIVE ONLY
    // Check that the acting entity is the player before sending actions
    if (killer->IsPlayer()) {
        LUDEO_ACTION("Kill");

        if (IsHeadshot(victim)) {
            LUDEO_ACTION("Headshot");
        }

        if (IsLongRangeKill(killer, victim)) {
            LUDEO_ACTION("LongRangeKill");
        }
    }
}
```

---

#### [Action 2]: [Name]

**Current code location:**  

```cpp
// Show where LUDEO_ACTION will be added
```

---

**(Repeat for ALL actions from inventory)**

---

### 6.6 Action Naming Conventions

Use PascalCase for action names:

| Good | Bad |
|------|-----|
| `"Kill"` | `"kill"`, `"KILL"` |
| `"CollectCoin"` | `"collect_coin"`, `"Collect Coin"` |
| `"Headshot"` | `"head_shot"`, `"HEAD_SHOT"` |

---

### 6.7 Actions That Should NOT Be Tracked

Some events should NOT be actions:

| Event | Why Not an Action |
|-------|-------------------|
| NPC/AI kills another entity | Not player's action — actions are player-perspective |
| Position update | Continuous state, not discrete |
| Health change | Use attribute tracking |
| Animation start | Internal implementation detail |
| UI click | Not gameplay |

---

## ✅ **Actions Research Checklist**

Before moving to implementation:

- [ ] Player identification method documented (IsPlayer, player class, etc.)
- [ ] All actions scoped to player perspective (or justified if not)
- [ ] All exciting moments identified
- [ ] Action vs attribute distinction clear for each
- [ ] All actions have trigger locations documented
- [ ] Code locations identified (file:function:line)
- [ ] Naming conventions consistent (PascalCase)
- [ ] Objective potential assessed
- [ ] Scoring potential assessed

---

## 🔗 **Related Documentation**

- [../06-TRACKING-PATTERNS.md](../06-TRACKING-PATTERNS.md) - Action implementation (Section 8.5)
- [../08-CODE-PATTERNS.md](../08-CODE-PATTERNS.md) - LUDEO_ACTION macro
- [../00-CRITICAL-REQUIREMENTS.md](../00-CRITICAL-REQUIREMENTS.md) - Mandatory rules

---

**Next:** After completing actions research, implement using guidance in [../06-TRACKING-PATTERNS.md](../06-TRACKING-PATTERNS.md) Section 8.5

