# Glossary

This glossary defines the key technical terms used throughout this book. In translated editions, these terms are kept in English to maintain consistency with the tools and code examples. The definitions below serve as the reference for all translations.

**allow list** — A list of masks that are considered acceptable for a given column. Values whose masks do not appear in the allow list are flagged as anomalies. Compare with *exclusion list*.

**assertion** — A property or suggestion automatically inferred by the rules engine about a data value. For example, `is_uk_postcode: true` or `std_country_iso3: "GBR"`. Assertions are advisory — consumers choose whether to act on them.

**bytefreq** — An open-source command-line data profiling tool, written in Rust, that implements mask-based profiling and the flat enhanced output format. Originally written in awk in 2007. Short for *byte frequencies*.

**character class** — A category of character defined by the Unicode General Category standard: uppercase letter (Lu), lowercase letter (Ll), digit (Nd), punctuation, symbol, separator, and so on. Mask-based profiling translates each character to a symbol representing its class.

**character profiling (CP)** — A report mode that analyses the frequency of individual byte values or Unicode code points in a file. Used for encoding detection, invisible character discovery, and script composition analysis. Compare with *data quality profiling*.

**coverage** — The percentage of values in a column that match the top N masks. High coverage (>95%) indicates a structurally uniform column; low coverage indicates structural diversity.

**DataRadar** — A browser-based data quality profiling tool that runs entirely client-side using WebAssembly. Implements the same profiling engine as bytefreq. Available at dataradar.co.uk.

**data quality on read (DQOR)** — An architecture principle where data quality profiling, validation, and remediation are deferred until the moment of consumption, rather than applied at ingest time. A parallel to *schema on read*.

**data quality profiling (DQ)** — The default report mode in bytefreq and DataRadar. Generates mask frequency tables for each column, showing structural patterns and their occurrence counts.

**exclusion list** — A list of masks that are known to be problematic for a given column. Values whose masks match the exclusion list are flagged as errors. Compare with *allow list*.

**flat enhanced format** — An output format where each field in the original data is expanded into a family of parallel columns: `.raw` (original value), `.HU` (high-grain mask), `.LU` (low-grain mask), and `.Rules` (assertions and suggestions). Inspired by the denormalised wide-table pattern used in Hadoop-era feature stores.

**grain** — The resolution level of a mask. *High grain* maps every character individually, preserving exact lengths. *Low grain* collapses consecutive characters of the same class into a single symbol, reducing cardinality for structural discovery.

**HU (High Unicode)** — High-grain masking with Unicode character class support. Every character maps individually using its Unicode General Category. The most detailed masking level.

**LU (Low Unicode)** — Low-grain masking with Unicode support. Consecutive characters of the same class are collapsed. The default masking level in bytefreq, and the recommended starting point for exploratory profiling.

**mask** — A structural fingerprint of a data value, produced by translating each character to a symbol representing its character class. Uppercase letters become `A`, lowercase become `a`, digits become `9`, and punctuation is kept as-is. For example, `John Smith` produces the mask `Aaaa Aaaaa`.

**mask cardinality** — The number of distinct masks found in a column. Low cardinality (1–3 masks) indicates a well-structured column; high cardinality may indicate structural diversity or data quality issues.

**population check** — A test that determines whether each field in a record is populated or empty. When aggregated, it produces a per-field population percentage showing the proportion of non-null values.

**population profile** — A frequency table of masks for a column, sorted by count. Shows the dominant structural patterns and the long tail of rare masks.

**provenance** — The ability to trace a derived or treated value back to the original raw value it was computed from. The flat enhanced format preserves provenance by keeping the `.raw` column immutable alongside all derived columns.

**.raw** — The column in the flat enhanced format that contains the original, untouched value exactly as received from the source. Never modified, never overwritten.

**reservoir sampling** — A statistical technique used by bytefreq to select a truly random example value for each mask in a profiling report, without requiring a second pass over the data.

**.Rules** — The column in the flat enhanced format that contains automatically inferred assertions and suggested treatments for a value. Rules are advisory, not prescriptive — multiple competing suggestions can coexist.

**schema on read** — A data architecture principle where structural interpretation is deferred until the point of consumption, rather than enforced at ingest time. The foundation of modern data lake architectures, and the conceptual predecessor of *data quality on read*.

**script detection** — Automatic identification of the dominant Unicode scripts present in each column (e.g., Latin, Cyrillic, Arabic, CJK). Used to flag encoding issues and inform downstream processing.

**treatment function** — A remediation action mapped to a specific (column, mask) combination. For example, applying title-case normalisation to values with the mask `AAAA AAAAA`, or replacing placeholder values (mask `A/A`) with nulls. Treatment functions are non-destructive — the original value is always preserved.

**WebAssembly (WASM)** — A binary instruction format that allows code written in languages like Rust to run in web browsers at near-native speed. DataRadar uses WASM to run the bytefreq profiling engine client-side, ensuring that data never leaves the user's machine.
