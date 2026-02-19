# The Mask-Based Profiling Idea

<!-- TODO: Add diagrams showing the translation visually -->

## The Core Insight

Every character in a text field belongs to a **character class**:

| Character | Class | Mask Symbol |
|-----------|-------|-------------|
| `A`–`Z`  | Uppercase letter | `A` |
| `a`–`z`  | Lowercase letter | `a` |
| `0`–`9`  | Digit | `9` |
| everything else | Punctuation/symbol | *(kept as-is)* |

By translating every character to its class, you get a **mask** — a structural fingerprint of the value.

## Examples

| Original Value | Mask |
|---------------|------|
| `John Smith` | `Aaaa Aaaaa` |
| `07700 900123` | `99999 999999` |
| `2024-01-15` | `9999-99-99` |
| `john.smith@email.com` | `aaaa.aaaaa@aaaaa.aaa` |
| `N/A` | `A/A` |
| `£1,234.56` | `£9,999.99` |

## Why This Works

The mask strips away the *content* and reveals the *structure*. When you profile a column by its masks, clusters of structural patterns emerge:

```
Mask                 Count    %
Aaaa Aaaaa          45,231   72.1%
Aaaa A. Aaaaa        8,102   12.9%
AAAA AAAAA           3,456    5.5%
aaaa aaaaa            2,100    3.3%
9999                    890    1.4%
(other)               2,987    4.8%
```

Instantly you can see: most values are `Firstname Lastname`, some have middle initials, some are ALL CAPS, some are all lowercase, and ~1.4% are just numbers (probably errors).

No regex. No schema. No assumptions. Just structure.
