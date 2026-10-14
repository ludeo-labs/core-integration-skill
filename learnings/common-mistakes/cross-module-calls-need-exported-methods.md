---
category: common-mistakes
tier: generalizable
sourceGame: multiple
phase: "3,5"
question: "Does the integration code compile into a different DLL / shared library than the game code it calls (a plugin or integration module, separate game and engine modules)?"
sanitized: true
origin: "unreal:common-mistakes/minimalapi-doesnt-export-methods, unreal:common-mistakes/gameplay-tags-cross-module-linker-error"
---

# Calls across a module boundary need each symbol exported, and the linker only tells you late

**Precondition:** the integration code lives in a different module (DLL / shared library) from the game classes
it touches.

## The mistake

To let the integration module iterate, cast and call methods on a game class, the agent exported only the class's
**type information** (vtable / RTTI / registration), enough for casts and type checks. Compiling passed. The
**link** then failed:

```
error LNK2019: unresolved external symbol "public: void __cdecl SecurityCamera::SetCameraState(enum CameraState)"
```

Exporting a type's metadata does not export its member functions. Each non-inline method the other module calls
needs its own export:

```cpp
class SecurityCamera : public Entity {
public:
    GAME_API void SetCameraState(CameraState s);   // called from the integration module, so exported
    bool IsOn() const { return on_; }              // inline in the header: compiled into the caller, no export
};
```

The same failure hits **global objects and constants** declared `extern` in the game module, for example
registered tag/name constants. Either export them, or resolve them lazily by value inside the integration module:

```cpp
static const TagId& HealthTag() { static TagId t = TagRegistry::Find("Attribute.Health"); return t; }
```

## Rules

- Export per method for every out-of-line method the integration calls. If you call five methods, you need five
  exports, or export the whole class when the build allows it.
- Adding an export to an existing public method has near-zero blast radius; it only makes callable across modules
  what was already callable inside one. Wrap exports added solely for the integration in `#if LUDEO_SDK_ENABLED`
  (CR-001).
- **Don't trust a compile-only pass.** After adding exports, grep the integration for every call site on that
  class, check each declaration, and run a full link in the same session.

The placeholder `GAME_API` stands for the game module's real export macro.
