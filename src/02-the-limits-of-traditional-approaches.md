# The Limits of Traditional Approaches

Before introducing mask-based profiling, it is worth understanding why the existing approaches leave gaps. Not because they are bad — many of them are excellent at what they do — but because they share a common assumption that limits their applicability to the "quality on read" problem.

## Schema Validation

The most established approach to data quality is schema validation: define the expected types, formats, and constraints for each field, then reject or flag records that do not conform. This is the approach used by database constraints, JSON Schema, XML Schema (XSD), Avro, Protobuf, and a host of other technologies. It works well in systems where you control the schema and the data is produced by software that respects it.

The limitation is that schema validation requires you to know what the data should look like before you receive it. When you are exploring a new dataset — a third-party feed you have never seen before, an open data portal with sparse documentation, or a legacy system export where the specification was written ten years ago and has not been updated since — the schema is precisely the thing you are trying to discover. Validating against an assumed schema at this stage risks either rejecting valid data that does not match your assumptions, or accepting invalid data that happens to pass your checks by coincidence.

There is also the problem of data that is "technically valid" but semantically broken. A date field containing `0000-00-00` will pass a format check for `YYYY-MM-DD` but is clearly not a real date. A numeric field containing `999999` will pass a type check but may be a sentinel value meaning "not applicable." Schema validation catches structural violations but tells you nothing about whether the values themselves make sense.

## Statistical Profiling

Tools like Great Expectations, dbt tests, and pandas-profiling take a different approach: compute summary statistics for each column (null counts, min/max values, cardinality, distributions, standard deviations) and flag deviations from expected ranges. This is useful for ongoing monitoring of data pipelines where you have a baseline to compare against, and it catches population-level issues (sudden spikes in nulls, unexpected changes in cardinality) that schema validation misses.

The limitation is that aggregate statistics hide structural detail. A column with 99% valid email addresses and 1% phone numbers will report a cardinality, a null rate, and a string length distribution that all look reasonable. The phone numbers — wrong data in the wrong field — will not appear as outliers in any statistical measure because they are structurally similar to emails in terms of length and character composition. You need to see the *patterns* to spot the problem, and summary statistics do not show patterns.

Statistical methods also require a baseline: they tell you that something has changed, but not what the data looks like in the first place. For initial exploration of an unfamiliar dataset, they give you numbers without context.

## Regex-Based Validation

Regular expressions allow precise format validation: a UK postcode matches `[A-Z]{1,2}[0-9R][0-9A-Z]? [0-9][ABD-HJLNP-UW-Z]{2}`, an email matches a well-known (and notoriously complex) pattern, a date matches `\d{4}-\d{2}-\d{2}`. When you know exactly what formats to expect, regex validation is powerful and precise.

The limitation is combinatorial. Each expected format requires its own expression. A phone number column that contains UK mobiles, UK landlines, international numbers with country codes, and US-formatted numbers needs at least four regex patterns — and that is before you account for variations in spacing, punctuation, and prefix formatting. For every new format you discover, you write another regex. For every field in every dataset, you maintain a library of patterns. The approach does not scale to exploratory work where you do not yet know what formats exist.

More fundamentally, regex validation is a *confirmation* technique: it confirms that data matches a pattern you already know about. It does not help you *discover* what patterns exist in data you have never seen before. Discovery requires a different tool.

## What They All Share

All three approaches — schema validation, statistical profiling, and regex-based validation — share a common assumption: **you already know what the data should look like**. They are verification techniques, designed to confirm expectations. When those expectations are correct and the data is well-understood, they work beautifully.

The gap they leave is in *discovery*: the initial exploration of unfamiliar data, where you have no schema, no baseline statistics, and no library of expected formats. You need something that will show you what the data *does* look like, without requiring you to tell it what to look *for*. That is the role of mask-based profiling.
