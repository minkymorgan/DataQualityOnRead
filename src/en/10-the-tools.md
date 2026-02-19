# The Tools: DataRadar and bytefreq

The techniques described in this book are implemented in two open-source tools, each designed for a different scale and a different user. The underlying profiling engine is the same across both; what changes is the deployment model, the interface, and the volume of data each can handle.

## DataRadar: Browser-Based Profiling

DataRadar is a browser-based data quality profiler that runs entirely client-side using WebAssembly. You upload a file — CSV, Excel, JSON, or NDJSON — and the profiling happens in your browser. No data is sent to any server. No software needs to be installed.

This matters more than it might initially seem. In many organisations — councils, NHS trusts, universities, small businesses — the people who need to assess data quality are working on locked-down machines where they cannot install software. They have no Python, no R, no SQL tools. What they have is a web browser. DataRadar meets them where they are.

The browser tool supports the full DQOR workflow: mask-based profiling at multiple grain levels, population analysis, script detection, and flat enhanced output. For nested or semi-structured data (JSON, GeoJSON), it can flatten the structure and produce the parallel column families (`.raw`, `.HU`, `.LU`, `.Rules`) as a downloadable NDJSON file that can be loaded directly into Pandas, Polars, DuckDB, or any other tool that reads newline-delimited JSON.

A typical use case: a council data analyst receives a GeoJSON feed of planning applications from a government portal. They paste the URL into DataRadar, the tool fetches and profiles the data, and within seconds they can see the structural patterns in each field — including fields with epoch timestamps that the tool has automatically detected and offered to convert to human-readable datetimes. They export the flat enhanced output, load it into Excel or a notebook, and proceed with their analysis using whichever columns they need: raw values for verification, masks for quality assessment, suggested treatments for convenience.

DataRadar is free and available at [dataradar.co.uk](https://dataradar.co.uk). It handles datasets up to approximately 50,000 rows comfortably, depending on the browser and the machine.

## bytefreq: The Command-Line Profiler

For larger datasets, or for integration into automated pipelines, **bytefreq** is the CLI tool. It is implemented in Rust, multi-threaded using Rayon, and handles CSV, Excel, JSON, and NDJSON formats. It is designed for Unix-style pipe workflows and can process files with millions of rows.

The name is historical. The original bytefreq was written in awk in 2007 as a byte-frequency profiler — a tool for counting the frequency of each byte value in a file to determine encoding, delimiters, and character distributions. Over time, it evolved to include the mask-based profiling functions described in this book. The current Rust implementation is a ground-up rewrite that retains the name and the profiling philosophy while delivering the performance needed for large-scale local processing.

### Installation

```bash
# Install Rust if needed
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install bytefreq from GitHub
cargo install --git https://github.com/minkymorgan/bytefreq
```

### Basic Usage

```bash
# Profile a CSV file using high-grain Unicode masking
cat data.csv | bytefreq -g HU

# Profile with low-grain masking
cat data.csv | bytefreq -g LU

# Profile JSON data
cat data.json | bytefreq -f json

# Character frequency profiling (encoding inspection)
cat data.csv | bytefreq -r CP

# Generate flat enhanced output with quality assertions
cat data.csv | bytefreq -E
```

The `-E` flag produces the flat enhanced format described in Chapter 9: each field in the input is expanded into its family of parallel columns (`.raw`, `.HU`, `.LU`, `.Rules`), with automatically inferred quality assertions in the Rules column. This output can be piped to a file, loaded into a database, or consumed by a downstream pipeline.

bytefreq is designed for pipe-based workflows, which means it composes naturally with other Unix tools:

```bash
# Profile the first 10,000 rows of a compressed file
zcat data.csv.gz | head -10000 | bytefreq -g HU

# Profile and extract only the masks for column 3
cat data.csv | bytefreq -g HU | jq '.columns[2].masks'

# Profile an Excel file (requires the excel feature)
cargo install --git https://github.com/minkymorgan/bytefreq --features excel
bytefreq -f excel --excel-path data.xlsx --sheet 1
```

bytefreq is open source, licensed under MIT, and available at [github.com/minkymorgan/bytefreq](https://github.com/minkymorgan/bytefreq).

## Scaling Beyond a Single Machine

For organisations working with billions of rows, neither a browser tool nor a single-machine CLI is sufficient. The good news is that mask-based profiling is inherently parallelisable, and there are concrete paths to scaling it without building a custom framework from scratch.

### Why It Parallelises Cleanly

The mask function is a stateless per-value transformation: it takes a string in and produces a mask out, with no dependencies on other values, other rows, or other columns. This makes it embarrassingly parallel — the same property that makes `map()` operations fast in Spark, Flink, Polars, and DuckDB. The assertion rules are equally independent: each rule examines a single (field_name, raw, HU, LU) tuple and produces a result with no side effects. The flat enhanced output is a wide table that maps naturally to columnar storage formats like Parquet and Delta Lake.

### Practical Scaling Options

**DuckDB** handles hundreds of millions of rows on a single machine with minimal setup. The bytefreq CLI can generate flat enhanced NDJSON output, which DuckDB reads natively. For datasets in the hundreds-of-millions range, this is often sufficient:

```bash
cat large_dataset.csv | bytefreq -d ',' -E > enhanced.ndjson
duckdb -c "
  CREATE TABLE dq AS SELECT * FROM read_ndjson_auto('enhanced.ndjson');
  SELECT \"postcode.HU\" AS mask, COUNT(*) AS cnt
  FROM dq GROUP BY mask ORDER BY cnt DESC LIMIT 20;
"
```

**Polars** (Python or Rust) can apply the mask function as a custom expression across a LazyFrame, leveraging its multi-threaded query engine. For teams already using Polars for data processing, wrapping the bytefreq mask logic in a Polars UDF is straightforward.

**Apache Spark** remains the standard for datasets measured in billions of rows. The mask function can be implemented as a Spark UDF (in Scala, Python, or — via the Spark Rust bindings — directly in Rust) and applied across a distributed DataFrame. The flat enhanced output writes naturally to Parquet with Snappy compression, partitioned by date or source for efficient downstream querying. The mask function described in Chapter 4 can be implemented in approximately 20 lines of Scala:

```scala
val maskUDF = udf((value: String) => {
  if (value == null) ""
  else value.map {
    case c if c.isUpper => 'A'
    case c if c.isLower => 'a'
    case c if c.isDigit => '9'
    case c => c
  }.mkString
})

df.withColumn("name_HU", maskUDF(col("name")))
  .withColumn("name_LU", /* collapse consecutive same-class chars */)
  .write.parquet("enhanced_output/")
```

**Cloud-native options** such as AWS Glue, GCP Dataflow, and Azure Synapse all support UDF-based transformations at scale. The mask function is small enough to inline in a serverless job definition — no external library dependencies required.

### The Product Ladder

The tools form a natural scaling path:

1. **DataRadar** (browser) — free, zero-install, up to ~50K rows. Perfect for quick checks, exploratory profiling, and environments where software installation is not possible.
2. **bytefreq** (CLI) — free, open source, millions of rows. For data engineers, CI/CD pipelines, and automated profiling workflows on a single machine.
3. **DuckDB / Polars** — hundreds of millions of rows on a single machine, using bytefreq's flat enhanced output as the input.
4. **Spark / cloud engines** — billions to trillions of rows, implementing the mask function as a UDF in a distributed framework.

The profiling philosophy, the mask functions, and the flat enhanced output format are consistent across all of these. A profile generated by DataRadar in a browser is structurally identical to one generated by a Spark job on a thousand-node cluster. The techniques scale; you choose the engine that fits your volume.

## Choosing the Right Tool

The decision is usually straightforward. If you are exploring a dataset for the first time and want to understand its structure quickly, use DataRadar in the browser — it takes seconds and requires nothing to be installed. If you are profiling data as part of an automated pipeline, or the dataset is too large for the browser, use bytefreq on the command line.

In many organisations, both tools coexist. Data analysts use DataRadar for ad-hoc exploration. Data engineers use bytefreq in CI/CD pipelines and automated quality gates. The consistent profiling output across both means that quality rules and treatment functions developed using one tool can be deployed on the other.
