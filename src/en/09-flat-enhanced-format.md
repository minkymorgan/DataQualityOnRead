# The Flat Enhanced Format: A Feature Store for Data Quality

The preceding chapters described the techniques — masking, population analysis, error codes, treatment functions — but left open the question of how the outputs of all this profiling and treatment are actually stored and delivered to consumers. The answer is the **flat enhanced format**, and it is arguably the most important architectural decision in the entire DQOR framework.

## From Nested to Flat

To understand the flat enhanced format, start with what bytefreq produces in its standard enhanced mode (`-e`). For each record, every field becomes a nested JSON object containing the raw value, its masks, and any inferred rules:

```json
{
  "Accounts.LastMadeUpDate": {
    "HU": "99_99_9999",
    "LU": "9_9_9",
    "Rules": { "std_date": "2019-09-30", "string_length": 10 },
    "raw": "30/09/2019"
  }
}
```

This is rich and self-describing, but nested structures can be awkward to query in flat analytical tools (SQL engines, DataFrames, spreadsheets). The flat enhanced format (`-E`) is a **flattened key-value pair schema, sourced from nested data** — one pair per attribute:

```json
{
  "Accounts.LastMadeUpDate.raw": "30/09/2019",
  "Accounts.LastMadeUpDate.HU": "99_99_9999",
  "Accounts.LastMadeUpDate.LU": "9_9_9",
  "Accounts.LastMadeUpDate.Rules.std_date": "2019-09-30",
  "Accounts.LastMadeUpDate.Rules.string_length": 10
}
```

Each record is now a self-contained set of key-value pairs. The quality metadata travels with the data it describes — no joins, no lookups, no separate tables. Every record carries its own profiling output.

This is important because key-value pairs do not assume a fixed schema. The flat enhanced format is a **flexible, floating schema** where:

- **Ragged rows are handled gracefully.** If one record has twelve fields and the next has eight, each record simply carries its own set of pairs. There is no need for null-padding to fit a rigid column structure, and no schema-on-write enforcement that rejects records with unexpected shapes. Real-world data is ragged — files from different sources, different vintages, different levels of completeness — and the key-value pair format absorbs that variation without friction.

- **Annotations are easily added.** Adding a new quality rule, a new treatment, or a new derived attribute is just adding another key-value pair to the record. There is no ALTER TABLE, no schema migration, no reprocessing of historical records. The format is inherently additive — new annotations appear alongside existing ones, and consumers that do not need them simply ignore keys they do not recognise.

- **Field names use namespace dot notation, providing provenance and scoping.** The key `Accounts.LastMadeUpDate.Rules.std_date` is not just a column name — it is a path that tells you exactly where this value came from: the `Accounts.LastMadeUpDate` field, its `Rules` annotation layer, specifically the `std_date` rule. This dot-separated namespace convention means that the key itself carries provenance. You can programmatically group all keys under `Accounts.LastMadeUpDate.*`, or extract all `*.Rules.*` annotations across every field, or filter to just `*.raw` to recover the original data. The namespace is the schema.

This pattern originated in the Hadoop era, where the economics were clear: joins across distributed datasets were expensive (network shuffles scaled with data size), while storage was cheap and getting cheaper. Co-locating related information in the same record — rather than normalising into separate tables — eliminated the most costly operation in the pipeline. The pattern persists today in Delta Lake, Iceberg, and other lakehouse architectures, and it underpins the design of feature stores in machine learning, where pre-computed features are stored alongside the raw data so that serving pipelines can retrieve everything in a single read.

## From Nested Input to Flat Output

The previous section showed how bytefreq's output transforms nested quality metadata into flat key-value pairs. But there is an equally important input-side question: how does the profiler handle nested *source* data? When the input is deeply nested JSON — not a flat CSV — the profiler must first discover the structure before it can profile the values.

bytefreq walks the JSON tree of each record, generating dot-notation paths for every leaf value. A six-level-deep field in the JMA earthquake data becomes `Body.Intensity.Observation.Pref.Area.City.IntensityStation.Name`. An array produces one path per element, with the array items treated as repeated instances of the same path. The result is a flat inventory of field paths — the structure discovery step described in Chapter 6.

This flattening is not a lossy transformation for profiling purposes. The dot-notation path preserves the nesting hierarchy: you can always reconstruct where a field sits in the original structure by reading its path. And because the path is just a string, it can be used as a key for grouping, filtering, and wildcard queries (`*.Name`, `*.PostCode`).

The input flattening and the output flattening are conceptually the same operation applied at different stages. On input, nested source data is flattened into field paths for profiling. On output, nested quality metadata is flattened into key-value pairs for consumption. The flat enhanced format is the common representation at both ends of the pipeline.

This means bytefreq can accept CSV, JSON (including deeply nested), Parquet, and Excel as input, and produce the same flat enhanced output regardless of the source format. The input format determines how field paths are discovered; the output format is always the same flattened key-value pair schema. The profiler abstracts away the structural complexity of the source and presents a uniform interface to downstream consumers.

## The Column Structure

For each field in the original data, the flat enhanced format produces a family of parallel columns:

**`.raw`** contains the original, untouched value exactly as it was received from the source. This column is immutable — it is never modified, never overwritten, and never deleted. It is the single source of truth and the foundation of the audit trail. If a downstream consumer needs to verify what was originally received, the `.raw` value is the authoritative record.

**`.HU`** contains the high-grain Unicode mask of the raw value. This is the structural fingerprint, the profiling output. It shows the shape of the data without revealing the content, making it safe for sharing in contexts where the raw data is sensitive (names, addresses, financial details) but the structural patterns need to be reviewed.

**`.LU`** contains the low-grain Unicode mask — the collapsed version that groups consecutive characters of the same class. This is useful for high-level pattern discovery and for comparing structural families across fields or datasets.

**`.Rules`** contains automatically inferred properties and suggested treatments. This is where the profiler records what it has discovered about the value and what it recommends doing with it. For example:

```json
{
  "is_unix_timestamp": "milliseconds",
  "std_datetime": "2025-12-19 22:00:40 UTC"
}
```

This tells the consumer: the raw value `1766181640870` appears to be a Unix timestamp in milliseconds, and if you choose to interpret it as a datetime, the suggested standardised form is `2025-12-19 22:00:40 UTC`. The consumer can adopt the suggestion, ignore it, or apply their own interpretation. The rules column is advisory, not prescriptive.

## Suggestions, Never Mandates

This last point is a fundamental design principle. The flat enhanced format can contain **multiple competing rules** for the same field. A value that looks like it could be either a Unix timestamp in seconds or a large integer might have both `is_unix_timestamp: seconds` and `is_numeric: true` in its rules. A date string that could be parsed as either `DD/MM/YYYY` or `MM/DD/YYYY` (the eternal ambiguity of `03/04/2025`) might carry both interpretations. The profiler does not resolve the ambiguity — it surfaces it, documents both possibilities, and leaves the decision to the consumer.

This non-prescriptive approach is deliberate. In a DQOR architecture, consumers have different requirements and different tolerances. A data science team might prefer to keep the raw timestamp and parse it themselves. A reporting team might want the standardised datetime. A compliance team might need to see both the raw value and the suggested interpretation side by side. The flat enhanced format supports all of these use cases from the same output, without requiring separate pipelines or separate quality processes.

## Adding New Derivations

The architectural beauty of the flat enhanced format is that adding new quality checks, new treatments, or new derived features is simply a matter of adding new columns. The existing columns — `.raw`, `.HU`, `.LU`, `.Rules` — are never modified. If a new version of the profiler detects a new pattern (say, UK National Insurance numbers in a field that was previously unprofiled for that format), a new rule is added to the `.Rules` column. If a new treatment function is developed (say, a geocoding lookup for postcode fields), a new `.geo` column can be added alongside the existing family.

This additive, append-only approach means that the flat enhanced format is inherently **backwards compatible**. Consumers that were written against an earlier version of the format, which did not include the new columns, continue to work unchanged — they simply do not see the new columns. Consumers that want the new features select the additional columns. There is no migration, no schema change, no reprocessing of historical data.

This is the same property that makes feature stores effective in machine learning: the ability to add new features without disrupting existing model-serving pipelines. In the data quality context, it means that the quality process can improve continuously — new rules, new treatments, new detections — without requiring coordinated releases across all downstream consumers.

## Practical Implications

The flat enhanced format has several practical implications that are worth noting.

**Storage cost** increases because every field is replicated multiple times (raw, HU, LU, Rules, plus any treatment columns). In practice, this overhead is modest — mask columns are typically shorter than the raw values they describe, and Rules columns are sparse (most fields have only a few applicable rules). On modern storage (cloud object stores, columnar formats like Parquet), the incremental cost is negligible compared to the raw data volume.

**Column naming conventions** matter. A consistent naming scheme — `fieldname.raw`, `fieldname.HU`, `fieldname.LU`, `fieldname.Rules.rule_name` — makes the format self-documenting and allows consumers to discover the available quality metadata programmatically. DataRadar and bytefreq use this convention by default.

**Columnar storage formats** (Parquet, ORC) are particularly well suited to the flat enhanced format because consumers typically read only a subset of columns. A consumer that needs only the raw values reads only the `.raw` columns and pays no I/O cost for the quality metadata. A consumer that needs only the masks reads only the `.HU` or `.LU` columns. The wide-table format, which would be wasteful in a row-oriented store, is efficient in a columnar store because unused columns are never read.

**The format works at any scale**: as a JSON or NDJSON file from the browser tool (DataRadar), as a CSV or Parquet output from the CLI tool (bytefreq), or as a distributed dataset in a Spark-based engine. The principle is the same at every scale; only the storage medium and the processing engine change.
