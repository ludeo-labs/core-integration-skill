# 02-RESEARCH-TEMPLATE.md - Research Documentation Index

> **⚠️ This file has been split into focused research documents.**  
> Load only the file(s) relevant to your current agent/task.

**Last Updated:** December 2025

---

## 📂 **Split Research Files**

All research files are in the `research-context/` folder:

| File | Sections | Purpose | Primary Agent |
|------|----------|---------|---------------|
| [02A-RESEARCH-ARCHITECTURE.md](./research-context/02A-RESEARCH-ARCHITECTURE.md) | 1, 2, 3 | Game architecture, flow, lifecycle integration points | Lifecycle Agent |
| [02B-RESEARCH-OBJECTS.md](./research-context/02B-RESEARCH-OBJECTS.md) | 4, 5 | Object inventory, attributes, creation patterns | Tracking Agent |
| [02C-RESEARCH-ACTIONS.md](./research-context/02C-RESEARCH-ACTIONS.md) | 6 | Gameplay actions for objectives/scoring | Actions Agent |
| [02D-RESEARCH-ENVIRONMENT.md](./research-context/02D-RESEARCH-ENVIRONMENT.md) | 7, 8 | Environment metadata, non-ludeoable areas, pause | Restoration Agent |
| [02E-RESEARCH-TECHNICAL.md](./research-context/02E-RESEARCH-TECHNICAL.md) | 9, 10, 11 | Threading, save system, technical constraints | Shared |

---

## 🎯 **Which File to Load?**

**"I'm analyzing SDK lifecycle integration points"**  
→ Load: `research-context/02A-RESEARCH-ARCHITECTURE.md`

**"I'm identifying what objects to track"**  
→ Load: `research-context/02B-RESEARCH-OBJECTS.md`

**"I'm identifying gameplay actions"**  
→ Load: `research-context/02C-RESEARCH-ACTIONS.md`

**"I'm planning restoration and environment handling"**  
→ Load: `research-context/02D-RESEARCH-ENVIRONMENT.md`

**"I need threading info or save system patterns"**  
→ Load: `research-context/02E-RESEARCH-TECHNICAL.md`

---

## 🚨 **CRITICAL: Game Code vs Callback-Driven Operations**

> **⚠️ Common Mistake:** Trying to find locations for callback-driven operations.

**🎮 Game Code Integration Points (find locations for these):**
- `ludeo_Initialize()` - game startup
- `ludeo_Session_Activate()` - after init
- `ludeo_Session_OpenRoom()` - when level loading **starts**
- `ludeo_GameplaySession_End()` - **ALL** gameplay exit paths
- `ludeo_Shutdown()` - game exit

**📞 Callback-Driven (DO NOT find locations - these go in LudeoManager callbacks):**
- `ludeo_Room_AddPlayer()` → called from `OnRoomOpenedCallback`
- `ludeo_GameplaySession_Begin()` → called from helper after both conditions met
- `ludeo_Room_RemovePlayer()` → called from `OnGameplayEndedCallback`
- `ludeo_Room_Close()` → called from `OnPlayerRemovedCallback`

→ **See:** [05-LIFECYCLE-MANAGEMENT.md Section 6.1](./05-LIFECYCLE-MANAGEMENT.md#61-overview) for callback flow
→ **See:** [00-CRITICAL-REQUIREMENTS.md CR-009](./00-CRITICAL-REQUIREMENTS.md) for detailed rules

---

## 📋 **Complete Research Checklist**

After all research is complete, verify:

### Architecture (02A)
- [ ] Game loop location identified
- [ ] 🎮 Game code integration points documented (file:function:line):
  - [ ] Initialize, Activate, OpenRoom, **ALL EndGameplaySession paths**, Shutdown
- [ ] 📞 Callback-driven operations confirmed NOT in game code:
  - [ ] AddPlayer, BeginGameplaySession, RemovePlayer, CloseRoom
- [ ] State machine documented
- [ ] LudeoSelected interrupt handling planned

### Objects (02B)
- [ ] All object types inventoried
- [ ] Attributes documented for each type
- [ ] Creation/destruction patterns documented
- [ ] Stable ID strategy determined

### Actions (02C)
- [ ] All gameplay actions identified
- [ ] Trigger locations documented
- [ ] Naming conventions consistent

### Environment (02D)
- [ ] Level metadata documented
- [ ] Non-ludeoable areas identified with enter/exit boundary hooks (marked via actions, not a local gate)
- [ ] Pause/resume hooks identified (local capture hygiene — distinct from non-ludeoable areas)

### Technical (02E)
- [ ] Threading model understood
- [ ] Thread-safety strategy chosen (if needed)
- [ ] Save system patterns analyzed (if exists)

---

## 🔗 **Related Documentation**

- [00-INDEX.md](./00-INDEX.md) - Master navigation
- [01-AI-AGENT-GUIDE.md](./01-AI-AGENT-GUIDE.md) - Integration workflow
- [00-CRITICAL-REQUIREMENTS.md](./00-CRITICAL-REQUIREMENTS.md) - Mandatory rules
