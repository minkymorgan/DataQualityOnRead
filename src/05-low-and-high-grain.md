# Low Grain and High Grain Masks

<!-- TODO: Add worked examples with real datasets -->

## Two Levels of Detail

A single mask like `Aaaa Aaaaa` tells you the exact structure: four uppercase-initial letters, space, five uppercase-initial letters. But sometimes you want a **coarser** view — just the shape, not the exact lengths.

bytefreq supports two grain levels:

### High Grain (default)

Every character maps individually. The mask preserves exact lengths and positions.

```
"John Smith"    → "Aaaa Aaaaa"
"Jane Doe"      → "Aaaa Aaa"
"Bob Lee"       → "Aaa Aaa"
```

Three different masks — three structural variants.

### Low Grain

Consecutive characters of the same class are **collapsed** to a single symbol.

```
"John Smith"    → "Aa Aa"
"Jane Doe"      → "Aa Aa"
"Bob Lee"       → "Aa Aa"
```

One mask — all three share the same structure at the low-grain level.

## When to Use Each

| Grain | Best For |
|-------|----------|
| **High** | Exact format validation (phone numbers, postcodes, IDs) |
| **Low** | Structural discovery, grouping similar patterns, initial exploration |

## The Profiling Workflow

A typical workflow:

1. **Start with low grain** — how many structural families exist?
2. **Drill into interesting families** with high grain — what are the exact formats?
3. **Flag anomalies** — masks that appear rarely are likely errors

This two-pass approach scales well. Low grain might reduce a million unique masks to a dozen patterns, making the data immediately comprehensible.
