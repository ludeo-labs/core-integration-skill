# 00-INTEGRATION-MISSION-BRIEF.md - Instructions for AI Integration Agents

> **Purpose:** Complete instructions for AI agents performing Ludeo SDK integration  
> **Read This:** BEFORE starting any integration work  
> **Status:** Mandatory starting document

---

## 🎯 **Your Mission**

Integrate Ludeo SDK into [GAME_NAME] following these documentation files and continuously improve them based on what you learn.

---

## 📋 **Mandatory Operating Procedures**

### 1. **Test Every Step** ⚠️ NON-NEGOTIABLE

After EVERY code change:
- [ ] Code compiles with `LUDEO_SDK_ENABLED=1`
- [ ] Code compiles with `LUDEO_SDK_ENABLED=0`
- [ ] No new compiler warnings
- [ ] Game launches successfully
- [ ] Log output matches expectations

**DO NOT proceed to next step until current step passes all tests.**

---

### 2. **Propagate All Learnings Back** ⚠️ NON-NEGOTIABLE

When you discover:
- ❗ **Errors in documentation** → Update the relevant file immediately
- ❗ **Missing information** → Add to the relevant file
- ❗ **Better approaches** → Propose update to relevant file
- ❗ **Edge cases** → Document in 11-TROUBLESHOOTING.md
- ❗ **Game-specific patterns** → Update GAME_ANALYSIS.md

**Format for propagation:**
```markdown
## [File]: [Section]
**Issue Found:** [Description]
**Current Text:** [What doc says now]
**Should Be:** [What it should say]
**Reason:** [Why this is better]
```

---

### 3. **Report Progress Continuously**

After each phase completion:
```markdown
## Phase [N] Completion Report

**Date:** [Date]
**Phase:** [Phase name]
**Status:** ✅ Complete / 🟡 Partial / ❌ Failed

**What was completed:**
- [List deliverables]

**Tests passed:**
- [ ] Compilation (SDK on)
- [ ] Compilation (SDK off)
- [ ] Runtime test
- [ ] Logs verified

**Issues encountered:**
- [List any issues and how resolved]

**Documentation updates made:**
- [List files updated and why]

**Next phase:** [Phase name]
```

---

### 4. **Ask Questions Early**

When you encounter:
- 🤔 **Ambiguity** - Ask for clarification, don't guess
- 🤔 **Conflicting information** - Report conflict, ask for resolution
- 🤔 **Missing game code** - Ask where to find it
- 🤔 **Unclear integration point** - Ask before implementing

**Better to ask than to implement incorrectly.**

---

### 5. **Validate Against Critical Requirements**

Before marking any phase complete:
- [ ] Review [00-CRITICAL-REQUIREMENTS.md](./00-CRITICAL-REQUIREMENTS.md)
- [ ] Verify no critical rules violated
- [ ] Cross-check implementation against requirements

---

## 🚀 **Integration Workflow**

### Phase 0: Initialization
1. Read [00-CRITICAL-REQUIREMENTS.md](./00-CRITICAL-REQUIREMENTS.md)
2. Read [01-AI-AGENT-GUIDE.md](./01-AI-AGENT-GUIDE.md)
3. Complete [02-RESEARCH-TEMPLATE.md](./02-RESEARCH-TEMPLATE.md)
4. Create `GAME_ANALYSIS_[GameName].md` with findings
5. **TEST:** All research questions answered
6. **REPORT:** Phase 0 completion

### Phase 1: Build Setup
1. Load [04-BUILD-INTEGRATION.md](./04-BUILD-INTEGRATION.md)
2. Create `LudeoConfig.h`
3. Modify build system
4. **TEST:** Compiles both ways (SDK on/off)
5. **PROPAGATE:** Any build system issues found
6. **REPORT:** Phase 1 completion

### Phase 2-7: [Continue pattern]
[Each phase follows same pattern: Load → Implement → Test → Propagate → Report]

---

## 🔄 **Iterative Refinement Process**

When implementation reveals documentation issues:
```
Discovery → Document Issue → Propose Fix → Get Approval → Update Docs → Continue
```

**Example:**
```
Found: Game uses job system for all object updates (not in docs)
Document: Added Section 9.2 finding to GAME_ANALYSIS.md
Propose: Update 02-RESEARCH-TEMPLATE.md Section 9 with job system questions
Approval: [User confirms]
Update: Modified 02-RESEARCH-TEMPLATE.md
Continue: Proceed with thread-safe queue implementation
```

---

## 📊 **Success Metrics**

Integration is complete when:
- [ ] All phases 0-7 completed
- [ ] All tests in [10-TESTING-VALIDATION.md](./10-TESTING-VALIDATION.md) pass
- [ ] Game can capture Ludeos successfully
- [ ] Game can restore Ludeos successfully
- [ ] No critical requirements violated
- [ ] Documentation updated with all learnings
- [ ] Final integration report written

---

## ⚠️ **Critical Don'ts**

**DON'T:**
- ❌ Skip validation checkpoints
- ❌ Proceed with failing tests
- ❌ Ignore documentation errors
- ❌ Implement without understanding
- ❌ Guess when uncertain
- ❌ Leave learnings undocumented

**DO:**
- ✅ Test every step
- ✅ Propagate all learnings
- ✅ Report progress continuously
- ✅ Ask questions early
- ✅ Validate against requirements
- ✅ Document everything

---

## 📝 **Documentation Update Protocol**

When updating docs:

1. **Minor fixes** (typos, clarifications):
   - Update directly
   - Note in progress report

2. **Significant changes** (new sections, major rewrites):
   - Propose change first
   - Get approval
   - Update with version note

3. **New discoveries** (patterns not documented):
   - Add to appropriate file
   - Cross-reference from other files
   - Update index if new file created

---

## 🎯 **Your Deliverables**

At end of integration:

1. **Working Integration:**
   - Game with Ludeo SDK integrated
   - All tests passing
   - Shipped-ready (Release build)

2. **Documentation:**
   - `GAME_ANALYSIS_[GameName].md` (completed research)
   - Updated integration docs (with learnings)
   - `INTEGRATION_REPORT_[GameName].md` (final report)

3. **Knowledge Transfer:**
   - All edge cases documented
   - All issues and solutions documented
   - Recommendations for future integrations

---

## 🚦 **Start Here**

Your first action:
```
1. Read 00-CRITICAL-REQUIREMENTS.md (5 min)
2. Read 01-AI-AGENT-GUIDE.md (10 min)
3. Load 02-RESEARCH-TEMPLATE.md
4. Begin Phase 0: Research
5. Report when Phase 0 complete
```

**Remember:** Test every step. Propagate all learnings. Report continuously.