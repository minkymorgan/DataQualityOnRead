# Masks as Error Codes

<!-- TODO: Expand with real-world examples from Andrew's consulting experience -->

## The Key Insight

Here's where mask-based profiling becomes a **data quality framework**, not just a profiling technique:

**Every mask is an implicit error code.**

If you know what masks are "correct" for a column, then every other mask is an error — and the mask itself tells you *what kind* of error.

## Whitelists and Blacklists

### Whitelist Approach

Define the acceptable masks. Everything else is an error.

```
Column: uk_postcode
Whitelist:
  - "AA99 9AA"    → standard format
  - "A99 9AA"     → short prefix
  - "A9 9AA"      → single letter
  - "AA9 9AA"     → two letters + one digit
```

Any value that doesn't produce one of these masks is flagged.

### Blacklist Approach

Define known-bad masks. Everything else passes.

```
Column: customer_name
Blacklist:
  - "9999"         → numeric where text expected
  - ""             → empty value
  - "A"            → single character (likely initial, not name)
  - "aaaa://aaa.aaaa.aaa"  → URL in name field
```

## Masks Tell You Why

Unlike a boolean "valid/invalid" check, the mask gives you diagnostic information:

| Value | Mask | Diagnosis |
|-------|------|-----------|
| `12345` | `99999` | Numeric — wrong field? |
| `N/A` | `A/A` | Placeholder, not a real value |
| `JOHN SMITH` | `AAAA AAAAA` | ALL CAPS — normalisation needed |
| `john smith ` | `aaaa aaaaa ` | Trailing space — trim needed |
| `Jöhn Smith` | `Aa\xC3\xB6aa Aaaaa` | Encoding issue — non-ASCII byte |

The mask **is** the error code. No need to write separate validation logic — the profiler generates the diagnostics for free.

## Building a Quality Gate

Combine population analysis with mask whitelists:

1. Profile the column → get mask distribution
2. Compare against whitelist → flag unknown masks
3. Check population thresholds → alert if known-good masks drop below expected %
4. Route errors by mask → different treatment per error type
