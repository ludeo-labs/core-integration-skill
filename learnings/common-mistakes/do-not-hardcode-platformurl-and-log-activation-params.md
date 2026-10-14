---
category: common-mistakes
tier: universal
sourceGame: Lyra
phase: "3"
question: null
sanitized: true
origin: "unreal:common-mistakes/do-not-hardcode-platformurl-and-log-activation-params"
---

# Log the resolved activation parameters, and don't assume a hard-coded platform URL is portable

## Always log what you pass to `ludeo_Session_Activate`

An activation `InvalidParameters` doesn't say which field is wrong. Log what was resolved right before the call
instead of theorizing:

```cpp
LUDEO_LOG("[Ludeo] Activating: apiKey=%s gameVersion='%s' platformUrl=%s authMode=%s window=%p",
          cfg.GetApiKey().empty() ? "<EMPTY!>" : "set",          // never log the key itself
          cfg.GetGameVersion().c_str(),
          cfg.GetPlatformUrl().empty() ? "<sdk default>" : cfg.GetPlatformUrl().c_str(),
          AuthModeName(cfg.GetAuthMode()), hwnd);
```

In the incident, this one line turned "activation fails, why?" into "the SDK rejected the URL I just set" in a
single run.

## The platform URL: empty can be the safer default

On the incident's SDK build, an **explicit** production URL string was rejected:

```
[Ludeo] Session: Error: … "https://services.ludeo.com" is not a valid url
[Ludeo] Core: Error: ludeo_Session_Activate failed with LudeoResult::InvalidParameters
```

An **empty** URL activated fine: the SDK used its internal production default. A reference integration on another
SDK build used the same string successfully, so a URL default copied from a sample or template isn't guaranteed to
be portable.

**Do:** read `platformUrl` from `ludeo.ini` (`04 §4`). If activation rejects the URL, try leaving it empty and
record which form works on this SDK build. Keep the phase-7 check that the shipped `ludeo.ini` targets the
intended environment. Check the other activation fields for empty values too: API key, game version, auth and
window handle.
