# 00-INDEX.md - Ludeo SDK Integration Documentation
# Master Navigation for AI Agents

> **⚠️ For AI Agents:** Do NOT load all files at once. Load only 2-4 relevant files based on your current task.
> This modular structure is designed for **on-demand, context-efficient navigation**.

**Documentation Version:** 2.1  
**Last Updated:** December 2025

---

## 🎯 **Start Here - Task-Based Navigation**

### **🆕 Starting a New Integration from Scratch**

**Phase 1: Research (Load per-agent)**
1. 🚨 [00-CRITICAL-REQUIREMENTS.md](./00-CRITICAL-REQUIREMENTS.md) - 5 min read - NON-NEGOTIABLE rules
2. 📋 Research files (load only what your agent needs):
   - [research-context/02A-RESEARCH-ARCHITECTURE.md](./research-context/02A-RESEARCH-ARCHITECTURE.md) - Lifecycle integration points
   - [research-context/02B-RESEARCH-OBJECTS.md](./research-context/02B-RESEARCH-OBJECTS.md) - Object inventory
   - [research-context/02C-RESEARCH-ACTIONS.md](./research-context/02C-RESEARCH-ACTIONS.md) - Actions inventory
   - [research-context/02D-RESEARCH-ENVIRONMENT.md](./research-context/02D-RESEARCH-ENVIRONMENT.md) - Environment & pause handling
   - [research-context/02E-RESEARCH-TECHNICAL.md](./research-context/02E-RESEARCH-TECHNICAL.md) - Threading & save system

**Phase 2: Planning (Load 1 file)**
- 🤖 [01-AI-AGENT-GUIDE.md](./01-AI-AGENT-GUIDE.md) - Integration strategy and workflow

**Phase 3+:** Load implementation files on-demand based on current task (see below)

---

### **⚙️ Implementing Specific Features**

**"I need to set up the build system"**
```
Load: [04-BUILD-INTEGRATION.md] + [03-SDK-FUNDAMENTALS.md]
Time: 15-20 min
```

**"I need to initialize SDK and manage sessions"**
```
Load: [05-LIFECYCLE-MANAGEMENT.md] + [03-SDK-FUNDAMENTALS.md]
Time: 20 min
```

**"I need to implement object tracking"**
```
Load: [06-TRACKING-PATTERNS.md] + [08-CODE-PATTERNS.md] + [03-SDK-FUNDAMENTALS.md]
Time: 25-30 min
```

**"I need to implement state restoration"**
```
Load: [07-RESTORATION-PATTERNS.md] + [06-TRACKING-PATTERNS.md]
Time: 20-25 min
```

**"I need platform-specific implementation (Unity/Unreal/C++)"**
```
Load: [09-PLATFORM-SPECIFIC.md] + relevant implementation file
Time: 15 min
```

**"I need to write tests and validate"**
```
Load: [10-TESTING-VALIDATION.md] + [99-QUICK-REFERENCE.md]
Time: 15 min
```

---

### **🐛 Debugging and Troubleshooting**

**"Something is broken / I'm getting errors"**
```
Load: [11-TROUBLESHOOTING.md] → Find error → Load relevant implementation file
Time: 10-20 min
```

**"I need to validate my implementation"**
```
Load: [00-CRITICAL-REQUIREMENTS.md] + [10-TESTING-VALIDATION.md]
Time: 15 min
```

---

### **📚 Quick Reference / Lookup**

**"I need a quick answer (naming convention, API signature, checklist)"**
```
Load: [99-QUICK-REFERENCE.md] ONLY
Time: 5 min
```

**"I forgot a specific SDK concept"**
```
Load: [03-SDK-FUNDAMENTALS.md] ONLY
Time: 10 min
```

---

## 📊 **File Dependency Map**

Understanding which files reference each other:
```
00-CRITICAL-REQUIREMENTS.md (standalone - always keep in context)
    │
    ├── 01-AI-AGENT-GUIDE.md
    │   └── References: All other files
    │
    ├── 02-RESEARCH-TEMPLATE.md (index for split research files)
    │   └── research-context/
    │       ├── 02A-RESEARCH-ARCHITECTURE.md → Lifecycle Agent
    │       ├── 02B-RESEARCH-OBJECTS.md → Tracking Agent
    │       ├── 02C-RESEARCH-ACTIONS.md → Actions Agent
    │       ├── 02D-RESEARCH-ENVIRONMENT.md → Restoration Agent
    │       └── 02E-RESEARCH-TECHNICAL.md → Shared (threading, save system)
    │
    ├── 03-SDK-FUNDAMENTALS.md (referenced by most implementation files)
    │   ├── 04-BUILD-INTEGRATION.md
    │   ├── 05-LIFECYCLE-MANAGEMENT.md
    │   └── 06-TRACKING-PATTERNS.md
    │
    ├── 04-BUILD-INTEGRATION.md
    │   └── Needs: 03-SDK-FUNDAMENTALS.md, 08-CODE-PATTERNS.md
    │
    ├── 05-LIFECYCLE-MANAGEMENT.md
    │   └── Needs: 03-SDK-FUNDAMENTALS.md
    │
    ├── 06-TRACKING-PATTERNS.md
    │   └── Needs: 03-SDK-FUNDAMENTALS.md, 08-CODE-PATTERNS.md
    │
    ├── 07-RESTORATION-PATTERNS.md
    │   └── Needs: 06-TRACKING-PATTERNS.md, 03-SDK-FUNDAMENTALS.md
    │
    ├── 08-CODE-PATTERNS.md
    │   └── Needs: 03-SDK-FUNDAMENTALS.md
    │
    ├── 09-PLATFORM-SPECIFIC.md
    │   └── Needs: Any implementation file based on task
    │
    ├── 10-TESTING-VALIDATION.md
    │   └── Needs: 00-CRITICAL-REQUIREMENTS.md
    │
    ├── 11-TROUBLESHOOTING.md (standalone, references all)
    │
    └── 99-QUICK-REFERENCE.md (standalone)
```

---

## 🗺️ **Detailed File Descriptions**

| File | Purpose | When to Load | Typical Read Time |
|------|---------|--------------|-------------------|
| **00-CRITICAL-REQUIREMENTS** | Non-negotiable rules | ALWAYS keep in context | 5 min |
| **01-AI-AGENT-GUIDE** | How to use docs, strategy | At project start | 10 min |
| **02-RESEARCH-TEMPLATE** | Index for split research files | Reference only | 2 min |
| **research-context/02A** | Game architecture, lifecycle points | Lifecycle Agent | 15 min |
| **research-context/02B** | Object inventory, attributes | Tracking Agent | 15 min |
| **research-context/02C** | Actions for objectives/scoring | Actions Agent | 10 min |
| **research-context/02D** | Environment, pause, non-ludeoable | Restoration Agent | 10 min |
| **research-context/02E** | Threading, save system | Shared/as needed | 10 min |
| **03-SDK-FUNDAMENTALS** | Core concepts, API patterns | Before implementation | 15 min |
| **04-BUILD-INTEGRATION** | CMake, build system, project structure | Setting up project | 15 min |
| **05-LIFECYCLE-MANAGEMENT** | SDK init, sessions, game flow | Implementing SDK lifecycle | 20 min |
| **06-TRACKING-PATTERNS** | Object tracking, actions, pause | Implementing tracking | 25 min |
| **07-RESTORATION-PATTERNS** | State restoration, LudeoSelected | Implementing restoration | 20 min |
| **08-CODE-PATTERNS** | Macros, capture helpers, RAII | Writing integration code | 20 min |
| **09-PLATFORM-SPECIFIC** | Unity, Unreal, C++ patterns | Platform-specific work | 15 min |
| **10-TESTING-VALIDATION** | Tests, checklists, validation | Testing phase | 15 min |
| **11-TROUBLESHOOTING** | Common errors, solutions | When debugging | 10-20 min |
| **99-QUICK-REFERENCE** | Checklists, conventions, quick lookup | Quick lookups | 5 min |

---

## 💡 **Efficient Usage for AI Agents**

### ✅ **DO:**
- Load **maximum 3-4 files** at once based on current task
- Keep `00-CRITICAL-REQUIREMENTS.md` in context (it's short and essential)
- Follow cross-references only when you need deeper information
- Use task-based navigation above
- Load `11-TROUBLESHOOTING.md` when stuck

### ❌ **DON'T:**
- Load all 13 files at once (wastes context window)
- Read files sequentially 00→01→02→... (inefficient)
- Load files "just in case" (load on-demand)
- Ignore the dependency map (load prerequisites first)

### 🎯 **Example Workflows:**

**Workflow 1: Build Setup**
```
Context: 00-CRITICAL-REQUIREMENTS.md (keep always)
Load: 04-BUILD-INTEGRATION.md
Reference: 03-SDK-FUNDAMENTALS.md (if needed)
Total: 2-3 files
```

**Workflow 2: Tracking Implementation**
```
Context: 00-CRITICAL-REQUIREMENTS.md (keep always)
Load: 06-TRACKING-PATTERNS.md, 08-CODE-PATTERNS.md
Reference: 03-SDK-FUNDAMENTALS.md (when needed)
Total: 3-4 files
```

**Workflow 3: Debugging Restoration**
```
Context: 00-CRITICAL-REQUIREMENTS.md (keep always)
Load: 11-TROUBLESHOOTING.md → identify issue → load 07-RESTORATION-PATTERNS.md
Total: 2-3 files
```

---

## 🏷️ **Tag-Based Search**

Use these tags to find relevant files quickly:

### By Topic
- `#architecture` → 03-SDK-FUNDAMENTALS, 05-LIFECYCLE-MANAGEMENT
- `#build` → 04-BUILD-INTEGRATION, 08-CODE-PATTERNS
- `#tracking` → 06-TRACKING-PATTERNS, 08-CODE-PATTERNS
- `#restoration` → 07-RESTORATION-PATTERNS
- `#actions` → 06-TRACKING-PATTERNS (Section 7)
- `#pause` → 06-TRACKING-PATTERNS (Section 8)
- `#testing` → 10-TESTING-VALIDATION
- `#errors` → 11-TROUBLESHOOTING
- `#unity` → 09-PLATFORM-SPECIFIC
- `#unreal` → 09-PLATFORM-SPECIFIC
- `#macros` → 08-CODE-PATTERNS

### By Priority
- `#critical` → 00-CRITICAL-REQUIREMENTS
- `#mustread` → 00-CRITICAL-REQUIREMENTS, 01-AI-AGENT-GUIDE
- `#reference` → 99-QUICK-REFERENCE

### By Phase
- `#planning` → 01-AI-AGENT-GUIDE
- `#research` → 02A (architecture), 02B (objects), 02C (actions), 02D (environment), 02E (technical)
- `#setup` → 04-BUILD-INTEGRATION
- `#implementing` → 05, 06, 07, 08, 09
- `#debugging` → 11-TROUBLESHOOTING
- `#validating` → 10-TESTING-VALIDATION

### By Agent
- `#lifecycle-agent` → research-context/02A, 05-LIFECYCLE-MANAGEMENT
- `#tracking-agent` → research-context/02B, 06-TRACKING-PATTERNS
- `#actions-agent` → research-context/02C, 06-TRACKING-PATTERNS
- `#restoration-agent` → research-context/02D, 07-RESTORATION-PATTERNS

---

> **📋 Integration Phase Roadmap:** See [01-AI-AGENT-GUIDE.md](./01-AI-AGENT-GUIDE.md#2-the-integration-workflow) for detailed phase-by-phase workflow with estimated times.

---

## 📖 **Cross-Reference Conventions**

Files use these markers for references:

- `→ See: [Filename](./filename.md)` - Related information
- `⚠️ Critical: [Filename](./filename.md)` - Must-read dependency
- `📖 Details in: [Filename](./filename.md)` - Deep dive available
- `🔗 Related: [Filename](./filename.md)` - Supplementary info

---

## 🚀 **Quick Start Commands**

### For New Integration:
1. Read `00-CRITICAL-REQUIREMENTS.md` (5 min)
2. Complete `02-RESEARCH-TEMPLATE.md` (30-60 min)
3. Load implementation files based on current task

### For Specific Task:
1. Use task-based navigation above
2. Load 2-4 relevant files maximum
3. Follow cross-references as needed

### For Debugging:
1. Load `11-TROUBLESHOOTING.md`
2. Find your error/symptom
3. Load relevant implementation file

### For Quick Lookup:
1. Load `99-QUICK-REFERENCE.md` ONLY

---

## 📝 **Document Versions**

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Dec 2025 | Initial monolithic plan |
| 2.0 | Dec 2025 | Generic rewrite, research-oriented |
| 2.1 | Dec 2025 | Split into modular docs with task-based navigation |

---

## 🆘 **Need Help?**

**Stuck on where to start?**
→ Read [01-AI-AGENT-GUIDE.md](./01-AI-AGENT-GUIDE.md)

**Have a specific error?**
→ Read [11-TROUBLESHOOTING.md](./11-TROUBLESHOOTING.md)

**Need a quick answer?**
→ Read [99-QUICK-REFERENCE.md](./99-QUICK-REFERENCE.md)

**Starting from scratch?**
→ Follow "Starting a New Integration" above

---

**Remember:** The goal is efficiency. Load only what you need, when you need it.