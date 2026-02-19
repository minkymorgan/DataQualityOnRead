# Character Class Translation

<!-- TODO: Add Unicode handling details, bytefreq's actual translation tables -->

## The Translation Function

At its simplest, mask-based profiling is a **character-level map**:

```
function mask(char):
    if char in A-Z  → return 'A'
    if char in a-z  → return 'a'
    if char in 0-9  → return '9'
    else             → return char   // keep punctuation, spaces, symbols
```

Applied to every character in a string, this produces the mask.

## ASCII and Beyond

The basic A/a/9 translation covers ASCII perfectly. But real-world data includes:

- **Accented characters** (`é`, `ñ`, `ü`) — uppercase or lowercase?
- **CJK characters** — no case distinction
- **Arabic, Hebrew** — right-to-left scripts
- **Emoji** — increasingly common in user-generated data
- **Control characters** — tabs, carriage returns, null bytes

bytefreq handles this by operating at the **byte level**, mapping each byte (0–255) to a configurable character class. This gives you deterministic behaviour regardless of encoding assumptions.

## The Byte Frequency Approach

Rather than trying to "understand" Unicode, bytefreq asks a simpler question: **what byte values appear, and how often?**

This sidesteps encoding debates entirely. A UTF-8 `é` is bytes `0xC3 0xA9` — each byte gets its own class mapping. This isn't linguistically "correct," but it's **consistent and fast**, which matters more for profiling.

## Configurable Mappings

<!-- TODO: Show bytefreq's actual config format for custom mappings -->

Advanced users can define custom translation tables — for example, mapping accented characters to their base class, or treating certain punctuation as "expected" (keeping it) vs "unexpected" (flagging it).
