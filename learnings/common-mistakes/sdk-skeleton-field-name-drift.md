---
category: common-mistakes
tier: universal
sourceGame: multiple
phase: "3"
question: null
sanitized: true
origin: "unreal:common-mistakes/sdk-skeleton-field-name-drift, unreal:common-mistakes/sdk-43-session-manager-instance-and-async-activate"
---

# Reference skeletons drift behind SDK releases: verify every struct and signature against the headers

## The mistake

The agent copied the activation skeleton verbatim from a reference file. Its intent was right (explicit Steam
auth, values resolved from config), but the **field names and struct nesting were stale**. The auth id field had
been renamed, and the beta-branch field had moved into the auth struct. The code didn't compile against the
current SDK, and nothing in the reference signalled that it was out of date.

On another integration, a whole SDK release changed **call shapes**, not just field names. Calls the reference
modelled as synchronous returns had become async with a completion callback, and session creation had moved
behind a different entry point. Copied verbatim, nothing compiled.

## Correct behavior

- **Before using any SDK struct, enum or function from a reference snippet,** grep the headers of the cloned SDK
  release for the exact name, and confirm the field names, nesting, `*_API_LATEST` version macros and whether the
  call is sync or async. **If the header and the reference disagree, trust the header** (`06 §7`, the "verify every
  SDK signature" note; `12-SDK-API-REFERENCE.md` lists names, not exact signatures).
- Treat reference skeletons as **structure and intent**, not as a contract for signatures.
- When you find drift, record the old and new signature as a learning, and flag the reference for the maintainer.
