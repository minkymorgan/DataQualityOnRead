# Population Analysis

<!-- TODO: Add statistical thresholds, worked examples -->

## From Masks to Populations

Once you've generated masks for every value in a column, you have a **population distribution** — a frequency table of structural patterns. This is where the real insight lives.

## The 80/20 Rule of Data

In practice, most columns follow a power law:

- **1–3 masks** cover 80–95% of values (the "expected" formats)
- A **long tail** of rare masks covers the rest (anomalies, errors, edge cases)

The rare masks are where data quality issues hide.

## Population Checks

Key metrics to compute from the mask distribution:

### Coverage
What percentage of values match the top N masks? If the top mask covers 99.9% of values, you have a highly uniform column. If the top mask covers only 40%, you have structural chaos.

### Cardinality
How many distinct masks exist? A well-formed date column might have 1–2 masks. A free-text "name" field might have hundreds.

### Outlier Detection
Masks appearing fewer than N times (or below X% of the population) are candidates for investigation. They might be:

- Data entry errors
- Format migrations (old system vs new system)
- Encoding problems
- Legitimate but rare edge cases

## The Population Profile

```
Column: phone_number (1,000,000 rows)

Mask              Count      %      Cumulative
99999 999999    812,000   81.2%      81.2%     ← UK mobile
+99 9999 999999  95,000    9.5%      90.7%     ← international
9999 999 9999    42,000    4.2%      94.9%     ← UK landline
(999) 999-9999   31,000    3.1%      98.0%     ← US format
aaaa             12,000    1.2%      99.2%     ← "none", "null"
(other)           8,000    0.8%     100.0%     ← investigate
```

This single view tells you more about your phone number column than any schema definition could.
