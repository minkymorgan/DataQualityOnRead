# Traditional Approaches and Their Limits

<!-- TODO: Expand with specific tool comparisons -->

## Schema Validation

The most common approach: define expected types and constraints, reject what doesn't fit. Works well when you control the schema. Breaks down when:

- The schema is wrong or outdated
- Data is "technically valid" but semantically broken (e.g., `0000-00-00` as a date)
- You're exploring data before a schema exists

## Statistical Profiling

Tools like Great Expectations, dbt tests, and pandas-profiling compute summary statistics: nulls, min/max, cardinality, distributions. Powerful, but:

- They tell you *what* is wrong, not *why*
- Aggregate stats hide structural patterns
- A column with 99% valid emails and 1% phone numbers looks "mostly fine"

## Regex-Based Validation

Write patterns, match fields. Precise but brittle:

- Requires knowing what you're looking for in advance
- One regex per expected format — combinatorial explosion
- Doesn't help with discovery ("what patterns exist?")

## What's Missing

All these approaches share a blind spot: they require you to **already know what the data should look like**. Mask-based profiling flips this — it shows you what the data *does* look like, without preconceptions.
