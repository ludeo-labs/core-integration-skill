# 04-BUILD-INTEGRATION.md - Build System Integration

> **Purpose:** Set up project structure and build system for Ludeo SDK integration  
> **For:** AI agents and developers  
> **Read Time:** 10 minutes  
> **When to Load:** Phase 1 - Build Setup

---

## Table of Contents

1. [Overview](#1-overview)
2. [Important Notes](#2-important-notes)
3. [Directory Structure](#3-directory-structure)
4. [Configuration Header](#4-configuration-header)
5. [CMake Integration](#5-cmake-integration)
6. [Visual Studio Integration](#6-visual-studio-integration)
7. [Makefile Integration](#7-makefile-integration)
8. [Unity Integration](#8-unity-integration)
9. [Unreal Engine Integration](#9-unreal-engine-integration)
10. [Verification](#10-verification)

**For AI Agents:** See [build-integration/04A-AGENT-AUTOMATION.md](./build-integration/04A-AGENT-AUTOMATION.md) for programmatic detection and automation.

---

## 1. Overview

### Goals

By the end of this setup:
- ✅ SDK files organized in project
- ✅ Build system configured
- ✅ Conditional compilation macros defined
- ✅ Project compiles with SDK enabled and disabled
- ✅ SDK libraries linked and DLLs copied to output

### Prerequisites

- [ ] Ludeo SDK cloned from `https://github.com/EdgeGamingGG/ludeo-sdk-releases` (latest release)
- [ ] Build system identified (CMake, VS, Makefile, etc.)
- [ ] Project structure documented (see [02-RESEARCH-TEMPLATE.md](./02-RESEARCH-TEMPLATE.md))

---

## 2. Important Notes

> ⚠️ **Read these once - they apply to ALL sections below.**

### SDK Enabled by Default
The SDK is **enabled by default** (`LUDEO_SDK_ENABLED=1`). To disable, explicitly set `LUDEO_SDK_ENABLED=0`.

### Single OS Build
Build for **ONE operating system only**. Do not configure for multiple platforms simultaneously.

### Use SDK Files As-Is
Do NOT rename DLLs, static libraries, or shared libraries. Use the platform/build-specific names provided:
- Windows: `LudeoSDK-Win64-Development.dll`, `LudeoSDK-Win64-Release.dll`
- Linux: `libLudeoSDK-Linux-Development.so`, `libLudeoSDK-Linux-Release.so`
- macOS: `libLudeoSDK-macOS-Development.dylib`, `libLudeoSDK-macOS-Release.dylib`

### Development vs Release
- **Development builds:** For testing only, NOT for shipping (larger, slower, extra logging)
- **Release builds:** Required for shipping to customers

---

## 3. Directory Structure

### Recommended Layout
```
<project_root>/
├── external/ludeo/LudeoCoreSDK_X_X_X/    # SDK location
│   ├── Include/Ludeo/                     # Headers
│   ├── Lib/<platform>/{Development|Release}/                    # Static libraries
│   ├── Bin/<platform>/{Development|Release}/                    # SDK runtime binary
│   └── ThirdParty/<platform>/{Development|Release}/Bin/         # 3rd-party runtime deps — copy whole dir to output
│
├── src/core/ludeo/                        # Integration files
│   ├── LudeoConfig.h                      # ⭐ CREATE THIS
│   ├── LudeoManager.h                     # ⭐ CREATE THIS
│   └── LudeoManager.cpp                   # ⭐ CREATE THIS
│
└── CMakeLists.txt                         # ⭐ MODIFY THIS
```

### Platform-Specific Paths

| Platform | Static Library | Dynamic Library |
|----------|---------------|-----------------|
| Win64 | `Lib/Win64/{Config}/LudeoSDK-Win64-{Config}.lib` | `Bin/Win64/{Config}/LudeoSDK-Win64-{Config}.dll` |
| Linux | `Lib/Linux/{Config}/libLudeoSDK-Linux-{Config}.so` | `Bin/Linux/{Config}/libLudeoSDK-Linux-{Config}.so` |
| macOS | `Lib/macOS/{Config}/libLudeoSDK-macOS-{Config}.a` | `Bin/macOS/{Config}/libLudeoSDK-macOS-{Config}.dylib` |

*{Config} = Development or Release*

---

## 4. Configuration Header

Create `src/core/ludeo/LudeoConfig.h`:

```cpp
#pragma once

// ============================================================================
// SDK Enable/Disable
// ============================================================================
#ifndef LUDEO_SDK_ENABLED
#define LUDEO_SDK_ENABLED 1
#endif

// ============================================================================
// Conditional Compilation Macros
// ============================================================================
#if LUDEO_SDK_ENABLED
    #define LUDEO_CODE(...) __VA_ARGS__
    #define LUDEO_INCLUDE(x) x
#else
    #define LUDEO_CODE(...)
    #define LUDEO_INCLUDE(x)
#endif

// ============================================================================
// Type Definitions
// ============================================================================
#if LUDEO_SDK_ENABLED
    #include <Ludeo/Common.h>
#else
    using LudeoObjectId = uint64_t;
    #define LUDEO_INVALID_OBJECTID 0
    enum class LudeoResult { Success = 0 };
#endif

// ============================================================================
// Logging (adapt to your game's logging system)
// ============================================================================
#define LogInfo(...)    /* YourGame::Log(Info, __VA_ARGS__) */
#define LogWarning(...) /* YourGame::Log(Warning, __VA_ARGS__) */
#define LogError(...)   /* YourGame::Log(Error, __VA_ARGS__) */
```

### Runtime Configuration (REQUIRED — file-based)

Ludeo runtime values (API key, game version, Steam auth fields, platform URL, debug-activation ludeo id) **must be loaded from an external file at startup** — `ludeo.ini` next to the executable by default — so QA, ops, and end users can change them **without rebuilding the game**. The values in the header are placeholder fallbacks only.

> **Extension:** `ludeo.ini` is the skill default — `.ini` matches the on-disk format (key=value + `#` comments) and gets editor syntax highlighting out of the box. **If the game already ships its own config-file convention (`.cfg`, `.conf`, etc.), match that instead** — consistency with the host project beats the default.

#### `LudeoConfig.h`

```cpp
#include <string>
#include <fstream>

enum class LudeoAuthMode { Implicit, Explicit };

class LudeoConfig {
public:
    static LudeoConfig& Instance() {
        static LudeoConfig instance;
        return instance;
    }

    // Load runtime values from a key=value file (typically `ludeo.ini` next to
    // the executable). Returns false if the file is absent / unreadable; in
    // that case the constructor placeholders below remain in effect. Call ONCE
    // at startup, BEFORE any Ludeo API call.
    bool LoadFromFile(const std::string& filepath);

    // Required (used in BOTH modes)
    LudeoAuthMode GetAuthMode()           const { return m_authMode; }
    const std::string& GetApiKey()        const { return m_apiKey; }
    const std::string& GetGameVersion()   const { return m_gameVersion; }
    const std::string& GetPlatformUrl()   const { return m_platformUrl; }
    // Explicit-mode-only Steam fields. Empty string ⇒ "not set" (SDK call site passes nullptr).
    const std::string& GetExplicitAuthID()const { return m_explicitAuthId; }
    const std::string& GetBetaBranch()    const { return m_betaBranch; }
    // Debug affordance: if non-empty, the integration synthesizes a LudeoSelected
    // with this id once the session is active (see /11 Step 3). Persistent
    // alternative to the --ludeo=<id> launch arg.
    const std::string& GetActivationLudeoId() const { return m_activationLudeoId; }

private:
    // Defaults are PLACEHOLDERS — real values come from ludeo.ini at startup.
    LudeoConfig()
        : m_authMode(LudeoAuthMode::Implicit),
          m_apiKey("YOUR_API_KEY"),
          m_gameVersion("1.0"),
          m_platformUrl("https://services.ludeo.com"),
          m_explicitAuthId(""),       // empty ⇒ unset
          m_betaBranch(""),           // empty ⇒ no branch
          m_activationLudeoId("") {}  // empty ⇒ disabled

    LudeoAuthMode m_authMode;
    std::string m_apiKey;
    std::string m_gameVersion;
    std::string m_platformUrl;
    std::string m_explicitAuthId;
    std::string m_betaBranch;
    std::string m_activationLudeoId;
};
```

#### `LudeoConfig.cpp` (key=value parser — no third-party lib)

```cpp
#include "LudeoConfig.h"
#include <algorithm>
#include <cctype>

bool LudeoConfig::LoadFromFile(const std::string& filepath) {
    std::ifstream in(filepath);
    if (!in) {
        LogWarning("[Ludeo] Config file not found: %s — using built-in placeholder defaults", filepath.c_str());
        return false;
    }
    auto trim = [](std::string& s) {
        size_t a = s.find_first_not_of(" \t\r\n");
        size_t b = s.find_last_not_of(" \t\r\n");
        s = (a == std::string::npos) ? "" : s.substr(a, b - a + 1);
    };
    auto iequals = [](std::string a, std::string b) {
        std::transform(a.begin(), a.end(), a.begin(), [](unsigned char c){ return std::tolower(c); });
        std::transform(b.begin(), b.end(), b.begin(), [](unsigned char c){ return std::tolower(c); });
        return a == b;
    };
    std::string line;
    while (std::getline(in, line)) {
        auto hash = line.find('#'); if (hash != std::string::npos) line.erase(hash);
        auto eq   = line.find('='); if (eq   == std::string::npos) continue;
        std::string key = line.substr(0, eq);
        std::string val = line.substr(eq + 1);
        trim(key); trim(val);
        if      (key == "apiKey")             m_apiKey            = val;
        else if (key == "gameVersion")        m_gameVersion       = val;
        else if (key == "platformUrl")        m_platformUrl       = val;
        else if (key == "authMode")           m_authMode          = iequals(val, "explicit") ? LudeoAuthMode::Explicit : LudeoAuthMode::Implicit;
        else if (key == "explicitAuthId")     m_explicitAuthId    = val;
        else if (key == "betaBranch")         m_betaBranch        = val;
        else if (key == "activationLudeoId")  m_activationLudeoId = val;
    }
    return true;
}
```

#### Sample `ludeo.ini` (shipped alongside the game executable)

```ini
# Ludeo SDK runtime configuration.
# Edit these values to change Ludeo behavior WITHOUT rebuilding the game.
# Format: key = value. Lines starting with '#' are comments.

# REQUIRED — your Ludeo API key. Until set, Session_Activate fails with InvalidAuth.
apiKey       = YOUR_API_KEY_HERE

# Game version recorded with each Ludeo. Leave blank to fall back to the placeholder.
gameVersion  = 1.0

# Ludeo platform endpoint (staging vs production).
platformUrl  = https://services.ludeo.com

# Auth mode: 'implicit' (Ludeo initializes Steam itself) | 'explicit' (you supply Steam creds below).
authMode     = implicit

# Explicit-mode-only fields. Leave empty if authMode = implicit.
explicitAuthId =
betaBranch     =

# Debug affordance: if set, the integration auto-fires a LudeoSelected with this id
# once the session is active (equivalent to passing --ludeo=<id> on the command line,
# but persistent). Leave blank to disable. See /11 Step 3.
activationLudeoId =
```

#### Wiring it up

Call `LudeoConfig::Instance().LoadFromFile("ludeo.ini")` **once at startup**, before `ludeo_Session_Activate` (typically the first line of `LudeoManager::Initialize`). Every later read goes through the getters — there are no literal values anywhere in the SDK call path.

**Build-side note:** ship `ludeo.ini` to the game's output directory the same way the SDK DLLs are copied (see §5). Without the file present, the game falls back to the placeholder defaults and `Session_Activate` will reject the unset API key.

### Usage
```cpp
#include "core/ludeo/LudeoConfig.h"

#if LUDEO_SDK_ENABLED
    #include <Ludeo/DataWriter.h>
#endif

void Player::SetHealth(float health) {
    m_health = health;
#if LUDEO_SDK_ENABLED
    LUDEO_CAPTURE_FLOAT(this, "player", "health", health);
#endif
}
```

---

## 5. CMake Integration

### Add to Existing CMakeLists.txt

#### Step 1: SDK Option (near top)
```cmake
option(LUDEO_SDK_ENABLED "Enable Ludeo SDK integration" ON)

if(LUDEO_SDK_ENABLED)
    message(STATUS "Ludeo SDK: ENABLED")
    
    set(LUDEO_SDK_VERSION "1.2.3")  # Update to your version
    set(LUDEO_SDK_ROOT "${CMAKE_SOURCE_DIR}/external/ludeo/LudeoCoreSDK_${LUDEO_SDK_VERSION}")
    
    if(NOT EXISTS "${LUDEO_SDK_ROOT}")
        message(FATAL_ERROR "Ludeo SDK not found at: ${LUDEO_SDK_ROOT}")
    endif()
    
    # Platform configuration. LUDEO_BIN_DIR holds the Ludeo SDK runtime binary;
    # LUDEO_THIRDPARTY_BIN_DIR holds the third-party runtime deps the SDK ships
    # for the matching configuration — overlay UI (cohtml + v8 family), video
    # capture (libx264), media decode, HTTP, and audio. Copy the WHOLE ThirdParty
    # Bin/ directory to the game's output dir (don't cherry-pick); missing common
    # ones — at minimum cohtml and libx264 — crashes the game at startup with a
    # missing-DLL error, and copying the directory is forward-compatible if the
    # SDK adds or renames deps in future releases.
    if(WIN32)
        if(CMAKE_BUILD_TYPE STREQUAL "Debug" OR CMAKE_BUILD_TYPE STREQUAL "Development")
            set(LUDEO_LIB_DIR "${LUDEO_SDK_ROOT}/Lib/Win64/Development")
            set(LUDEO_BIN_DIR "${LUDEO_SDK_ROOT}/Bin/Win64/Development")
            set(LUDEO_THIRDPARTY_BIN_DIR "${LUDEO_SDK_ROOT}/ThirdParty/Win64/Development/Bin")
            set(LUDEO_LIB_FILE "LudeoSDK-Win64-Development.lib")
            set(LUDEO_DLL_FILE "LudeoSDK-Win64-Development.dll")
        else()
            set(LUDEO_LIB_DIR "${LUDEO_SDK_ROOT}/Lib/Win64/Release")
            set(LUDEO_BIN_DIR "${LUDEO_SDK_ROOT}/Bin/Win64/Release")
            set(LUDEO_THIRDPARTY_BIN_DIR "${LUDEO_SDK_ROOT}/ThirdParty/Win64/Release/Bin")
            set(LUDEO_LIB_FILE "LudeoSDK-Win64-Release.lib")
            set(LUDEO_DLL_FILE "LudeoSDK-Win64-Release.dll")
        endif()
    elseif(UNIX AND NOT APPLE)
        if(CMAKE_BUILD_TYPE STREQUAL "Debug" OR CMAKE_BUILD_TYPE STREQUAL "Development")
            set(LUDEO_LIB_DIR "${LUDEO_SDK_ROOT}/Lib/Linux/Development")
            set(LUDEO_BIN_DIR "${LUDEO_SDK_ROOT}/Bin/Linux/Development")
            set(LUDEO_THIRDPARTY_BIN_DIR "${LUDEO_SDK_ROOT}/ThirdParty/Linux/Development/Bin")
            set(LUDEO_LIB_FILE "libLudeoSDK-Linux-Development.so")
            set(LUDEO_SO_FILE "libLudeoSDK-Linux-Development.so")
        else()
            set(LUDEO_LIB_DIR "${LUDEO_SDK_ROOT}/Lib/Linux/Release")
            set(LUDEO_BIN_DIR "${LUDEO_SDK_ROOT}/Bin/Linux/Release")
            set(LUDEO_THIRDPARTY_BIN_DIR "${LUDEO_SDK_ROOT}/ThirdParty/Linux/Release/Bin")
            set(LUDEO_LIB_FILE "libLudeoSDK-Linux-Release.so")
            set(LUDEO_SO_FILE "libLudeoSDK-Linux-Release.so")
        endif()
    endif()
else()
    message(STATUS "Ludeo SDK: DISABLED")
endif()
```

#### Step 2: Target Configuration
```cmake
# After your add_executable() call:
if(LUDEO_SDK_ENABLED)
    target_compile_definitions(YourGameName PRIVATE LUDEO_SDK_ENABLED=1)
    target_include_directories(YourGameName PRIVATE "${LUDEO_SDK_ROOT}/Include")
    target_link_libraries(YourGameName PRIVATE "${LUDEO_LIB_DIR}/${LUDEO_LIB_FILE}")
    
    # Copy SDK + third-party runtime binaries to output.
    # Third-party deps (cohtml, libx264, MediaDecoders, HttpServer, RenoirCore,
    # openAL32, v8 family) are runtime deps the Ludeo SDK loads on startup.
    # `copy_directory` the WHOLE ThirdParty Bin/ — don't cherry-pick — to avoid
    # the "missing cohtml/libx264 at startup" failure and to stay forward-compatible.
    if(WIN32)
        add_custom_command(TARGET YourGameName POST_BUILD
            COMMAND ${CMAKE_COMMAND} -E copy_if_different
                "${LUDEO_BIN_DIR}/${LUDEO_DLL_FILE}"
                "$<TARGET_FILE_DIR:YourGameName>"
            COMMAND ${CMAKE_COMMAND} -E copy_directory
                "${LUDEO_THIRDPARTY_BIN_DIR}"
                "$<TARGET_FILE_DIR:YourGameName>")
    elseif(UNIX AND NOT APPLE)
        add_custom_command(TARGET YourGameName POST_BUILD
            COMMAND ${CMAKE_COMMAND} -E copy_if_different
                "${LUDEO_BIN_DIR}/${LUDEO_SO_FILE}"
                "$<TARGET_FILE_DIR:YourGameName>"
            COMMAND ${CMAKE_COMMAND} -E copy_directory
                "${LUDEO_THIRDPARTY_BIN_DIR}"
                "$<TARGET_FILE_DIR:YourGameName>")
    endif()
else()
    target_compile_definitions(YourGameName PRIVATE LUDEO_SDK_ENABLED=0)
endif()
```

### Build Commands
```bash
# SDK enabled (default)
cmake .. && cmake --build .

# SDK disabled
cmake .. -DLUDEO_SDK_ENABLED=OFF && cmake --build .
```

---

## 6. Visual Studio Integration

### Property Sheet (Recommended)

Create `Ludeo.props`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<Project ToolsVersion="4.0" xmlns="http://schemas.microsoft.com/developer/msbuild/2003">
  <PropertyGroup Label="UserMacros">
    <LudeoSDKPath>$(SolutionDir)external\ludeo\LudeoCoreSDK_1_2_3</LudeoSDKPath>
  </PropertyGroup>
  
  <ItemDefinitionGroup>
    <ClCompile>
      <AdditionalIncludeDirectories>$(LudeoSDKPath)\Include;%(AdditionalIncludeDirectories)</AdditionalIncludeDirectories>
      <PreprocessorDefinitions>LUDEO_SDK_ENABLED=1;%(PreprocessorDefinitions)</PreprocessorDefinitions>
    </ClCompile>
  </ItemDefinitionGroup>
  
  <ItemDefinitionGroup Condition="'$(Configuration)'=='Debug'">
    <Link>
      <AdditionalLibraryDirectories>$(LudeoSDKPath)\Lib\Win64\Development;%(AdditionalLibraryDirectories)</AdditionalLibraryDirectories>
      <AdditionalDependencies>LudeoSDK-Win64-Development.lib;%(AdditionalDependencies)</AdditionalDependencies>
    </Link>
  </ItemDefinitionGroup>
  
  <ItemDefinitionGroup Condition="'$(Configuration)'=='Release'">
    <Link>
      <AdditionalLibraryDirectories>$(LudeoSDKPath)\Lib\Win64\Release;%(AdditionalLibraryDirectories)</AdditionalLibraryDirectories>
      <AdditionalDependencies>LudeoSDK-Win64-Release.lib;%(AdditionalDependencies)</AdditionalDependencies>
    </Link>
  </ItemDefinitionGroup>
</Project>
```

**Post-Build Event** (copy DLL):
```
rem Map VS Configuration names to SDK folder names (Debug→Development)
if "$(Configuration)"=="Debug" (set LUDEO_CONFIG=Development) else (set LUDEO_CONFIG=$(Configuration))
xcopy /Y /D "$(SolutionDir)external\ludeo\LudeoCoreSDK_1_2_3\Bin\Win64\%LUDEO_CONFIG%\*.dll" "$(OutDir)"
```

---

## 7. Makefile Integration

```makefile
LUDEO_SDK_ENABLED ?= 1

ifeq ($(LUDEO_SDK_ENABLED), 1)
    LUDEO_SDK_PATH = external/ludeo/LudeoCoreSDK_1_2_3
    CXXFLAGS += -I$(LUDEO_SDK_PATH)/Include -DLUDEO_SDK_ENABLED=1
    
    ifeq ($(BUILD_TYPE), Debug)
        LDFLAGS += -L$(LUDEO_SDK_PATH)/Lib/Linux/Development -lLudeoSDK-Linux-Development
        LUDEO_SO_PATH = $(LUDEO_SDK_PATH)/Bin/Linux/Development
    else
        LDFLAGS += -L$(LUDEO_SDK_PATH)/Lib/Linux/Release -lLudeoSDK-Linux-Release
        LUDEO_SO_PATH = $(LUDEO_SDK_PATH)/Bin/Linux/Release
    endif
    
    LDFLAGS += -Wl,-rpath,'$$ORIGIN'
else
    CXXFLAGS += -DLUDEO_SDK_ENABLED=0
endif

$(TARGET): $(OBJS)
	$(CXX) $(OBJS) -o $(TARGET) $(LDFLAGS)
ifeq ($(LUDEO_SDK_ENABLED), 1)
	cp $(LUDEO_SO_PATH)/*.so $(OUT_DIR)/
endif
```

---

## 8. Unity Integration

### Plugin Structure
```
Assets/Plugins/
├── Ludeo/
│   ├── x86_64/
│   │   ├── LudeoSDK-Win64-Development.dll
│   │   └── LudeoSDK-Win64-Release.dll
│   └── Android/
│       └── libLudeoSDK-Android-Release.so
└── LudeoIntegration/
    └── LudeoNative.cs
```

### Native Wrapper
```csharp
using System.Runtime.InteropServices;

public static class LudeoNative
{
#if LUDEO_SDK_ENABLED
    // Use actual DLL name (without extension)
    const string DLL_NAME = "LudeoSDK-Win64-Release";
    
    [DllImport(DLL_NAME)]
    public static extern int ludeo_Initialize(IntPtr initParams);
    
    [DllImport(DLL_NAME)]
    public static extern void ludeo_Tick();
#endif
}
```

### Enable/Disable
- **Enable:** Project Settings → Player → Scripting Define Symbols → Add `LUDEO_SDK_ENABLED`
- **Disable:** Remove `LUDEO_SDK_ENABLED` from Scripting Define Symbols

---

## 9. Unreal Engine Integration

### Plugin Structure
```
Plugins/Ludeo/
├── Ludeo.uplugin
├── Source/Ludeo/
│   ├── Ludeo.Build.cs
│   ├── Private/
│   └── Public/
└── ThirdParty/LudeoSDK/
    ├── Include/
    ├── Lib/Win64/
    └── Bin/Win64/
```

### Build.cs
```csharp
public class Ludeo : ModuleRules
{
    public Ludeo(ReadOnlyTargetRules Target) : base(Target)
    {
        bool bEnableLudeoSDK = true;
        
        if (bEnableLudeoSDK)
        {
            PublicDefinitions.Add("LUDEO_SDK_ENABLED=1");
            
            string SDKPath = Path.Combine(ModuleDirectory, "../../ThirdParty/LudeoSDK");
            PublicIncludePaths.Add(Path.Combine(SDKPath, "Include"));
            
            string LibName = (Target.Configuration == UnrealTargetConfiguration.Debug
                          || Target.Configuration == UnrealTargetConfiguration.Development)
                ? "LudeoSDK-Win64-Development.lib" 
                : "LudeoSDK-Win64-Release.lib";
            
            PublicAdditionalLibraries.Add(Path.Combine(SDKPath, "Lib/Win64", LibName));
            RuntimeDependencies.Add(Path.Combine(SDKPath, "Bin/Win64/*.dll"));
        }
        else
        {
            PublicDefinitions.Add("LUDEO_SDK_ENABLED=0");
        }
    }
}
```

---

## 10. Verification

### Compilation Tests

| Test | Command | Expected |
|------|---------|----------|
| SDK Enabled | `cmake .. && cmake --build .` | Builds successfully |
| SDK Disabled | `cmake .. -DLUDEO_SDK_ENABLED=OFF && cmake --build .` | Builds successfully |

### Runtime Tests

**Windows:**
```powershell
dumpbin /DEPENDENTS YourGame.exe | findstr LudeoSDK
```

**Linux:**
```bash
ldd YourGame | grep LudeoSDK
```

### Checklist

Before proceeding to next phase:

- [ ] SDK files in `external/ludeo/`
- [ ] `LudeoConfig.h` created
- [ ] Build system configured
- [ ] `LUDEO_SDK_ENABLED` macro works
- [ ] Compiles with SDK enabled
- [ ] Compiles with SDK disabled
- [ ] Libraries linked correctly
- [ ] DLLs/SOs copied to output
- [ ] No linker errors

---

## Related Documentation

- **Agent Automation:** [build-integration/04A-AGENT-AUTOMATION.md](./build-integration/04A-AGENT-AUTOMATION.md)
- **Next Step:** [05-LIFECYCLE-MANAGEMENT.md](./05-LIFECYCLE-MANAGEMENT.md) - SDK initialization
- **Reference:** [03-SDK-FUNDAMENTALS.md](./03-SDK-FUNDAMENTALS.md) - SDK concepts
- **Requirements:** [00-CRITICAL-REQUIREMENTS.md](./00-CRITICAL-REQUIREMENTS.md) - Macro-based compilation
