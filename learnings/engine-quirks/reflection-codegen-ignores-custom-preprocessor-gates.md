---
category: engine-quirks
tier: generalizable
sourceGame: ActionGame
phase: "4,5"
question: "Does the engine run a header-parsing reflection or code-generation tool over game headers (a pre-build step that scans for markers like REFLECT()/PROPERTY() and emits generated code)?"
sanitized: true
origin: "unreal:common-mistakes/uclass-cannot-be-preprocessor-gated"
---

# Don't wrap reflected declarations in the integration's `#if` — gate the implementation instead

**Precondition:** the engine has its own reflection/code-generation tool that parses game headers before the C++
compiler runs (common in proprietary engines with a property system, serializer generator or script binding
generator).

## The mistake

To keep the integration invisible in builds without the SDK, the agent wrapped a reflected class declaration in
the integration's own flag:

```cpp
#if LUDEO_SDK_ENABLED
REFLECTED_CLASS()
class GAME_API ObjectiveDevice : public Entity
#else
REFLECTED_CLASS()
class ObjectiveDevice : public Entity
#endif
{ /* ... */ };
```

The header tool rejected it before the compiler ever ran. These tools run **their own** preprocessor-like scan:
they don't see the compiler's macro definitions and typically honor only a short hardcoded list of engine flags
(editor-only, platform). Around anything else they see two declarations or none and fail, or — worse — silently
generate code for one branch while the compiler builds the other.

## The rule

Reflection markers — on classes, fields, functions, enums — stay **unconditional**. Gate what the tool doesn't
parse:

```cpp
REFLECTED_CLASS()
class GAME_API ObjectiveDevice : public Entity   // export macro: unconditional and cheap
{
public:
#if LUDEO_SDK_ENABLED
    void Ludeo_Capture() const;                  // plain (non-reflected) method: fine to gate
#endif
    REFLECTED_FIELD() int m_state = 0;           // always visible to the tool
};
```

Options, in order of preference: unconditional reflection + gated plain methods; unconditional reflection + a
gated `friend` declaration for an integration helper; a separate non-reflected helper class that lives entirely
under the gate. Use the `LUDEO_CODE(...)` / `LUDEO_INCLUDE` scaffolding from `phase 1` for the gated parts.

## Cost of being clever

Each "let me gate this so production isn't affected" round is a failed pre-build step, time spent on why the gate
isn't taking, and a final round that does the unconditional thing anyway. An export macro on a class is one more
exported symbol table entry — almost never a real concern; raise it with the team separately if it is.

## Detect it first

Before adding any `#if` in a game header, grep the header for the engine's reflection markers. If the line you
want to gate carries one, don't gate it.
