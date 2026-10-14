# 04A - Agent Build Automation Guide

> **Purpose:** Programmatic detection and automation for AI agents setting up Ludeo SDK  
> **For:** AI agents only  
> **Prerequisite:** Read [04-BUILD-INTEGRATION.md](../04-BUILD-INTEGRATION.md) first

---

## Overview

This guide provides step-by-step detection and automation for setting up the Ludeo SDK build environment programmatically.

---

## 1. Operating System Selection

**Goal:** Prompt user to select target OS. Build only for the selected OS.

```python
supported_os = ["Windows", "Linux", "macOS"]

print("Select target operating system:")
for i, os_name in enumerate(supported_os, 1):
    print(f"{i}. {os_name}")

selected_index = input("Enter number (1-3): ")
target_os = supported_os[int(selected_index) - 1]

build_config = {
    "target_os": target_os,
    "platform": {"Windows": "Win64", "Linux": "Linux", "macOS": "macOS"}[target_os]
}
```

---

## 2. Build System Detection

**Goal:** Identify the project's build system type.

**Priority Order:** engine check (stop) → CMake → Visual Studio → Makefile

```python
def detect_build_system():
    # This skill covers proprietary C++ engines. Unity and Unreal have their own
    # skills, which install a real engine plugin rather than a hand-rolled one.
    if exists("Assets/") and exists("ProjectSettings/"):
        stop("Unity project — use ludeo-unity-integration")
    if exists("*.uproject") and exists("Source/"):
        stop("Unreal project — use ludeo-unreal-integration")

    if exists("CMakeLists.txt"):
        return "CMake", "CMakeLists.txt"
    if exists("*.sln"):
        return "Visual Studio", find_largest("*.sln")
    if exists("Makefile") or exists("makefile"):
        return "Makefile", "Makefile"
    return None, None
```

---

## 3. SDK Acquisition

**Goal:** Clone the latest Ludeo SDK release. On failure, prompt the user to clone it manually and provide the path.

```python
SDK_REPO = "https://github.com/EdgeGamingGG/ludeo-sdk-releases"

# Clone the latest release of the SDK
try:
    run(f"git clone {SDK_REPO}.git")
    sdk_path = "ludeo-sdk-releases"
    # If the repo uses tagged releases, check out the latest tag
    run("git -C ludeo-sdk-releases fetch --tags")
    latest_tag = run("git -C ludeo-sdk-releases describe --tags --abbrev=0").strip()
    if latest_tag:
        run(f"git -C ludeo-sdk-releases checkout {latest_tag}")
except CloneError:
    # No network / no access / git error → hand off to the user
    sdk_path = prompt_user(
        f"Could not clone the Ludeo SDK from {SDK_REPO}. "
        "Please clone it manually and provide the local SDK path."
    )

# Extract version from directory name (format: LudeoCoreSDK_X_X_X)
import re
match = re.search(r'LudeoCoreSDK_(\d+)_(\d+)_(\d+)', sdk_path)
if match:
    version = f"{match.group(1)}.{match.group(2)}.{match.group(3)}"
```

> **Note:** Verify cloned DLL/SO files are real binaries (> 1MB), not Git LFS pointer files (~130 bytes). If pointer-sized, run `git lfs pull` inside the SDK repo.

**Platform-Specific Required Files:**

| Platform | Static Library | Dynamic Library |
|----------|---------------|-----------------|
| Win64 | `Lib/Win64/{Debug\|Release}/LudeoSDK-Win64-{Debug\|Release}.lib` | `Bin/Win64/{Debug\|Release}/LudeoSDK-Win64-{Debug\|Release}.dll` |
| Linux | `Lib/Linux/{Debug\|Release}/libLudeoSDK-Linux-{Debug\|Release}.a` | `Bin/Linux/{Debug\|Release}/libLudeoSDK-Linux-{Debug\|Release}.so` |
| macOS | `Lib/macOS/{Debug\|Release}/libLudeoSDK-macOS-{Debug\|Release}.a` | `Bin/macOS/{Debug\|Release}/libLudeoSDK-macOS-{Debug\|Release}.dylib` |

---

## 4. Target Name Detection

### CMake
```python
# Parse CMakeLists.txt for add_executable()
executable_pattern = r'add_executable\s*\(\s*(\w+)'
matches = re.findall(executable_pattern, content)
target_name = matches[0] if matches else None
```

### Visual Studio
```python
# Parse .sln for project definitions
project_pattern = r'Project.*=.*"([^"]+)"'
# First non-solution-folder project is usually main target
```

### Makefile
```python
# Look for TARGET variable
target_pattern = r'TARGET\s*[:=]\s*(\w+)'
```

---

## 5. Logging System Detection

**Goal:** Detect game's logging system to adapt `LudeoConfig.h` macros.

```python
logging_patterns = {
    r'LogInfo\s*\(': "Custom LogInfo",
    r'LOG_INFO\s*\(': "Custom LOG_INFO",
    r'OutputDebugString': "Windows Debug",
    r'printf\s*\(|std::cout': "Standard Output"
}

# Generate adapted macros based on detected system
def get_logging_macros(system):
    # Map onto whatever the game already uses; fall back to printf.
```

---

## 6. Source Directory Detection

```python
source_patterns = ["src/", "Source/", "source/", "code/", "Code/"]

for pattern in source_patterns:
    if exists(pattern):
        source_root = pattern
        break

# Ludeo integration path: {source_root}/core/ludeo or {source_root}/ludeo
```

---

## 7. Agent Workflow Summary

| Step | Action | Output |
|------|--------|--------|
| 1 | Select OS | `target_os`, `platform` |
| 2 | Detect build system | `build_system`, `primary_file` |
| 3 | Clone SDK (latest release) | `sdk_path`, `version` |
| 4 | Detect target name | `target_name` |
| 5 | Detect logging | `logging_system`, `macros` |
| 6 | Detect source structure | `source_root`, `ludeo_path` |
| 7 | Create directory structure | `src/core/ludeo/` |
| 8 | Generate LudeoConfig.h | Configuration header |
| 9 | Modify build files | Platform-specific config |
| 10 | Verify setup | SDK-enabled + SDK-disabled builds |

---

## 8. Error Handling and Retry

**⚠️ MANDATORY:** Automatically retry builds after fixing errors until both SDK-enabled and SDK-disabled builds succeed.

```python
max_retries = 10

while retry_count < max_retries:
    build_result = attempt_build(sdk_enabled=True)
    
    if build_result.success:
        break
    
    errors = parse_build_errors(build_result.output)
    fixes = identify_fixes(errors)
    apply_fixes(fixes)
    retry_count += 1
```

### Common Errors and Fixes

| Error | Fix | Action |
|-------|-----|--------|
| SDK Clone Failed | Ask user to clone manually | Verify clone of `EdgeGamingGG/ludeo-sdk-releases`; prompt user for path on failure |
| Target Not Found | Re-parse build file | List available targets, prompt selection |
| Missing Include | Add include directory | Update `target_include_directories()` |
| Linker Error | Fix library linking | Verify lib path and filename |
| DLL Not Found | Copy to output | Add post-build copy command |

### Error Resolution Priority

1. Configuration errors (SDK path, target name)
2. Include/header errors
3. Compilation errors
4. Linker errors
5. Runtime errors

### Rollback Strategy

```python
# Create backups before modification
backup_files = ["CMakeLists.txt.backup", "LudeoConfig.h.backup"]

def rollback_changes():
    restore_file("CMakeLists.txt.backup", "CMakeLists.txt")
    remove_directory("src/core/ludeo")  # if created
```

---

## Related Documentation

- [04-BUILD-INTEGRATION.md](../04-BUILD-INTEGRATION.md) - Main build integration guide
- [05-LIFECYCLE-MANAGEMENT.md](../05-LIFECYCLE-MANAGEMENT.md) - SDK initialization

