---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: "5"
question: null
sanitized: true
origin: "unreal:common-mistakes/n-silent-errors-then-crash-is-local-indexing-bug"
---

# "N SDK 'invalid parameters' errors, then an access violation": suspect your own indexing, not SDK state

## The signature

A tight loop of attribute reads produces:

- exactly N (small, deterministic) log lines like `ludeo_DataReader_Get* failed because of invalid parameters`,
  then
- an access violation **inside** `ludeo_DataReader_GetFloat` / `GetInt32` on a pointer like
  `0xffffffffffffffff`.

**First hypothesis:** the loop is feeding the SDK garbage from your own memory. Don't start from "SDK state is
corrupted", "the enter scope was lost" or "another system interfered".

## The incident

A helper owned a static table of `{ name, attribute }` bindings but returned **the first element by value**:

```cpp
// WRONG — returns a copy of element 0, not the array
static AttrBinding GetBindings(int& count) {
    static const AttrBinding table[] = { /* 24 entries */ };
    count = int(std::size(table));
    return table[0];
}
const AttrBinding& first = GetBindings(count);
const AttrBinding* b = &first;                       // points at a stack copy
for (int i = 0; i < count; ++i) ReadFloat(b[i].name, v);   // i >= 1 reads past the copy
```

Iteration 0 was valid. Iterations 1–5 passed garbage name pointers, which the SDK's parameter validation rejected
(5 errors). Iteration 6 dereferenced unmapped memory and crashed. Three reactive patches followed, each reasoning
about SDK state or engine cascades that weren't involved, before anyone re-read the helper.

**Fix:** return the array itself (`static const AttrBinding* GetBindings(int&)`, or a `std::span`).

## Why the exact-N pattern is diagnostic

The first N bad pointers happen to look plausible enough for the SDK to reject as invalid. The (N+1)th points at
memory that can't be read. A count that is constant across runs, inside a fixed loop, means **check the
indexing**.

## How to apply

When SDK error spam ends in a crash inside the SDK:

1. Go to your call site and check that the array feeding the loop is a real array head, not a stack-local copy.
2. Check that any helper producing it returns by pointer or span, not by value, and that the count matches the
   valid range.
3. Only then move on to SDK / context-stack (CR-002) theories.

After two patches that don't change the symptom, stop patching and re-read your own code.
