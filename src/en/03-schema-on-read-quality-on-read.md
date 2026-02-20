# Schema on Read, Quality on Read

The idea of deferring structural interpretation until the point of consumption is well established in data architecture. In the Hadoop era, it acquired a name — **Schema on Read** — and it changed how large-scale data platforms were designed. Rather than enforcing a rigid schema at the point of ingest (Schema on Write, the relational database approach), data lakes accept raw data in whatever format it arrives, store it cheaply, and apply structural interpretation only when a consumer reads the data for a specific purpose.

The benefits of Schema on Read are widely understood. Raw data is preserved in its original form, providing provenance and auditability. Multiple consumers can apply different schemas to the same underlying data, supporting different use cases without duplicating pipelines. When schemas change — and they always change — historical data does not need to be reprocessed, because the raw material is still there. The trade-off is that consumers bear the cost of interpretation, but in practice this cost is modest compared to the flexibility gained.

**Data Quality on Read** (DQOR) applies exactly the same principle to data quality processing. Instead of cleansing, validating, enriching, and remediating data at the point of ingest — which requires perfect upfront knowledge of the data, slows pipeline velocity, and risks overwriting original values with incorrect corrections — DQOR defers all quality processing until the moment the data is actually consumed.

The core workflow is simple:

1. Ingest raw data as fast as possible, preserving it exactly as received.
2. At read time, profile the data to discover its structural characteristics.
3. Generate quality metadata (masks, assertions, suggested treatments) alongside the raw values.
4. Let downstream consumers choose which treatments to apply — or to ignore them entirely and work with the original.

The raw data is never overwritten. The quality metadata is never mandated. Consumers see both the original value and the profiler's assessment of it, and they make their own decisions about what to trust. This is a fundamental design choice: **suggestions, never mandates**.

## Why This Matters

There are several practical reasons why deferring quality processing to read time is advantageous, particularly for data received from external sources.

First, it preserves the original data as an immutable audit trail. In regulated industries (financial services, healthcare, government), the ability to trace a derived value back to the exact bytes that were received from the source system is not a convenience — it is a compliance requirement. DQOR provides this by construction, because the raw data is never modified.

Second, it accommodates imperfect knowledge. When you first receive a new data feed, you rarely understand it fully. The documentation may be incomplete, the specification may be out of date, and the actual data may contain patterns that nobody anticipated. If you apply quality rules at ingest time based on incomplete understanding, you risk discarding or corrupting valid data. By deferring quality processing, you give yourself time to learn the data before committing to a treatment strategy — and when your understanding improves, you can reprocess the history without re-ingesting it.

Third, it supports multiple consumers with different quality requirements. A data science team exploring patterns in raw sensor data may want the original values, noise and all. A reporting team feeding a customer-facing dashboard may want aggressively cleaned and normalised data. A compliance team may want to see every record that was flagged as anomalous, with the raw value alongside the flag. DQOR supports all three from the same source, without separate pipelines.

Fourth, it decouples ingest velocity from quality processing. Data acquisition pipelines can focus on reliability and throughput — landing data on the platform as fast as the source can deliver it — without being slowed by the computational overhead of profiling, validation, and remediation. Quality processing happens later, on the consumer's schedule, using the consumer's compute budget. In streaming architectures, where latency matters, this decoupling is particularly valuable.

## The Parallel With Feature Stores

For anyone who has worked with machine learning feature stores, the DQOR pattern will feel familiar. A feature store holds pre-computed features alongside the raw data they were derived from, so that model-serving pipelines can retrieve prediction-ready inputs without recomputing them at request time. The raw data is never discarded; the features are additive layers that sit alongside it.

DQOR follows the same structural logic. The raw value is preserved. Quality metadata — masks, assertions, suggested treatments — are generated as additional columns that sit alongside the raw value in the same row. Downstream consumers select the columns they need. Adding a new quality check or a new treatment is just adding another column; it never touches the original data, and it never requires reprocessing existing outputs.

The enhanced output is a nested record format — each field in the original data becomes a JSON object containing the raw value, its masks, and any inferred rules. The *flat enhanced format* takes this a step further: a flattened key-value pair schema, sourced from nested data (e.g. `fieldname.raw`, `fieldname.HU`, `fieldname.Rules.is_numeric`). Quality metadata travels with the data it describes — no joins, no lookups, no separate tables. We will return to the specific implementation of this pattern in Chapter 9.
