# The Flat Enhanced Format: A Feature Store for Data Quality

The preceding chapters described the techniques — masking, population analysis, error codes, treatment functions — but left open the question of how the outputs of all this profiling and treatment are actually stored and delivered to consumers. The answer is the **flat enhanced format**, and it is arguably the most important architectural decision in the entire DQOR framework.

## The Hadoop Insight

The flat enhanced format is a trick from the Hadoop era, and it is worth understanding where it came from to appreciate why it works.

In traditional relational database design, the instinct is to normalise. Raw data goes in one table, quality metadata goes in another, treatment outputs go in a third, and consumers join them together at query time. This is clean, avoids redundancy, and works well when joins are cheap — which they are in a well-tuned relational database.

In Hadoop, joins were not cheap. Joining two large datasets distributed across a cluster of commodity machines involved shuffling data across the network, and the cost scaled with the size of the datasets being joined. The pragmatic response was to **denormalise aggressively**: rather than storing related information in separate tables and joining at query time, you widen the row to include everything a consumer might need, accepting the redundancy in exchange for eliminating the join.

Storage was cheap and getting cheaper. Network shuffles were expensive and getting more expensive as datasets grew. The economics were clear: denormalise, widen the table, co-locate related information in the same row. This pattern became standard practice in Hadoop-era data platforms — and persists today in Delta Lake, Iceberg, and other modern lakehouse architectures — and it underpins the design of feature stores in machine learning — where pre-computed features are stored alongside the raw data they were derived from, so that model-serving pipelines can retrieve everything they need in a single read without joining against a feature computation pipeline at request time.

The flat enhanced format applies this same principle to data quality. Rather than storing raw data in one place and quality metadata in another, we widen every row to include the raw value, its masks, and any suggested treatments as parallel columns. The result is a single, self-contained record that carries its own quality metadata with it.

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
