# Treatment Functions and Remediation

<!-- TODO: Add code examples for common treatments -->

## From Detection to Action

Profiling tells you what's wrong. **Treatment functions** fix it — or at least try to.

The key principle: **treatment is mask-driven**. Each error mask maps to a specific remediation action.

## Common Treatments

### Format Normalisation

When the data is correct but inconsistently formatted:

```
Mask "AAAA AAAAA" → apply title_case()
  "JOHN SMITH" → "John Smith"

Mask "aaaa aaaaa" → apply title_case()
  "john smith" → "John Smith"
```

### Trimming and Cleaning

When the structure is right but there's noise:

```
Mask "Aaaa Aaaaa " → apply trim()
  "John Smith " → "John Smith"

Mask " Aaaa Aaaaa" → apply trim()
  " John Smith" → "John Smith"
```

### Placeholder Removal

When values aren't real data:

```
Mask "A/A"    → replace with NULL  ("N/A")
Mask "aaaa"   → replace with NULL  ("null", "none")
Mask "-"      → replace with NULL
```

### Quarantine

When the data is too broken to fix automatically:

```
Mask "9999" in name column → route to manual review
Mask "aaaa://..." → flag as wrong-field error
```

## The Treatment Pipeline

```
Raw Value
  → Generate Mask
    → Lookup Treatment (by mask)
      → Apply Treatment
        → Re-mask to Verify
          → Accept or Escalate
```

The **re-mask** step is crucial: after treatment, re-profile the value to confirm it now matches an expected mask. If not, escalate to manual review.

## Idempotent and Auditable

Good treatment functions are:

- **Idempotent** — applying them twice gives the same result
- **Auditable** — you can trace what was changed and why (the mask is the reason)
- **Reversible** — keep the original value alongside the treated version

## The Data Quality Loop

Over time, treatment functions reduce the long tail of error masks. As new patterns emerge (new formats, new edge cases), you:

1. Profile → discover new masks
2. Classify → whitelist or blacklist
3. Treat → write a treatment function
4. Monitor → watch for recurrence

This creates a **continuous improvement loop** where data quality gets better with each iteration.
