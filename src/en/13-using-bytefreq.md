# Using bytefreq: Installation, Build, and Command-Line Reference

This chapter covers the practical side of bytefreq: how to install it, how to build it from source, and how to use it from the command line. If the previous chapters described the *what* and *why* of mask-based profiling, this chapter covers the *how*.

## Prerequisites

bytefreq is written in Rust and built using Cargo, Rust's package manager and build system. If you do not already have Rust installed, the standard installation method is:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

This installs `rustc` (the compiler), `cargo` (the build tool), and `rustup` (the toolchain manager). Follow the on-screen prompts — the defaults are fine for most systems. After installation, restart your terminal or run `source $HOME/.cargo/env` to make the tools available.

Verify the installation:

```bash
rustc --version
cargo --version
```

## Installation

There are two ways to install bytefreq.

### From GitHub (recommended)

```bash
cargo install --git https://github.com/minkymorgan/bytefreq
```

This clones the repository, compiles the release binary, and installs it to `~/.cargo/bin/`, which should already be on your PATH if Rust is installed correctly.

### From a local clone

```bash
git clone https://github.com/minkymorgan/bytefreq.git
cd bytefreq
cargo build --release
cargo install --path .
```

Building from a local clone is useful if you intend to modify the code — for example, to add custom assertion rules as described in the previous chapter.

### Verify

```bash
bytefreq --version
```

## Input Formats

bytefreq reads data from standard input (stdin) and supports two input formats:

**Tabular** (`-f tabular`, the default) — delimited text where the first line is a header row and subsequent lines are data records. The delimiter defaults to pipe (`|`) but can be set to any character using the `-d` flag.

**JSON** (`-f json`) — newline-delimited JSON (NDJSON), where each line is a complete JSON object. bytefreq flattens nested structures using dot-notation paths (e.g., `customer.address.postcode`), handling arrays and nested objects to a configurable depth.

A note on CSV: bytefreq defaults to pipe-delimited input rather than comma-delimited, because pipe characters appear far less frequently in real-world data values and thus produce fewer parsing ambiguities. If your data is comma-delimited, pass `-d ','`. For complex CSV files with quoted fields, escaped delimiters, or embedded newlines, it is worth pre-parsing with a dedicated CSV parser (Python's `csv` module, `csvkit`, or `xsv`) and piping clean pipe-delimited output to bytefreq.

## Command-Line Reference

```
bytefreq [OPTIONS]

OPTIONS:
  -g, --grain <GRAIN>          Masking grain level [default: LU]
                                 H  - High grain ASCII (A/a/9)
                                 L  - Low grain ASCII (compressed)
                                 U  - High grain Unicode (HU)
                                 LU - Low grain Unicode (compressed)

  -d, --delimiter <DELIM>      Field delimiter [default: |]

  -f, --format <FORMAT>        Input format [default: tabular]
                                 tabular - Delimited text with header
                                 json    - Newline-delimited JSON

  -r, --report <REPORT>        Report type [default: DQ]
                                 DQ - Data Quality (mask frequencies)
                                 CP - Character Profiling (byte/codepoint frequencies)

  -p, --pathdepth <DEPTH>      JSON nesting depth [default: 9]

  -a, --remove-array-numbers   Collapse array indices in JSON paths

  -e, --enhanced-output        Output flat enhanced JSON (nested format)

  -E, --flat-enhanced           Output flat enhanced JSON (flattened format)

  -h, --help                   Print help
  -V, --version                Print version
```

## Basic Profiling

The most common use case is profiling a delimited file at the default grain level (Low Unicode):

```bash
cat data.csv | bytefreq -d ','
```

The output is a human-readable frequency report, organised by column. For each column, bytefreq lists the unique masks found, their occurrence counts, and a randomly sampled example value for each mask (selected using reservoir sampling to ensure a truly random representative):

```
=== Column: postcode ===
Mask                Count   Example
A9 9A               8,412   SW1A 1AA
A99 9A              1,203   M60 1NW
A9A 9A                892   W1D 3QU
AA9 9A                567   EC2R 8AH
9                     312   N/A
                       44
```

The example column is particularly useful during exploratory profiling — it lets you see an actual value behind each mask without having to go back to the raw data.

## Grain Levels in Practice

### Low Unicode (LU) — the default

```bash
cat data.csv | bytefreq -d ',' -g LU
```

Consecutive characters of the same Unicode class are collapsed. Good for initial discovery: how many structural families exist in each column?

### High Unicode (HU) — exact formats

```bash
cat data.csv | bytefreq -d ',' -g HU
```

Every character maps individually. Good for precision work: what exact postcode formats are present? What date formats are in use?

### High ASCII (H) and Low ASCII (L) — legacy modes

```bash
cat data.csv | bytefreq -d ',' -g H
cat data.csv | bytefreq -d ',' -g L
```

The original A/a/9 masks without Unicode awareness. All non-ASCII characters are left unmapped. Useful when profiling data known to be ASCII-only, or when comparing results against the legacy awk-based bytefreq.

## Character Profiling

The `-r CP` flag switches from mask-based profiling to character-level frequency analysis:

```bash
cat data.csv | bytefreq -d ',' -r CP
```

This reports the frequency of every Unicode code point found in the file, alongside the character itself and its Unicode name. The output is sorted by frequency and grouped by Unicode General Category (Letter, Number, Punctuation, Symbol, Separator, Other).

Character profiling is the forensic tool. Use it when you need to:

- **Determine the encoding** of an unknown file — UTF-8, Latin-1, Windows-1252, and mixed encodings each produce characteristic byte patterns.
- **Find invisible characters** — zero-width spaces, byte order marks, soft hyphens, and other non-printing characters that cause subtle parsing failures.
- **Detect control characters** — tabs, carriage returns, null bytes, and other control characters in fields that should contain only printable text.
- **Understand the script composition** — what proportion of the text is Latin, Cyrillic, CJK, Arabic, or other scripts?

## JSON Profiling

For JSON data, use `-f json`:

```bash
cat data.ndjson | bytefreq -f json
```

bytefreq expects newline-delimited JSON — one complete JSON object per line. It flattens nested structures into dot-notation paths:

```json
{"customer": {"address": {"postcode": "SW1A 1AA"}}}
```

becomes a column named `customer.address.postcode` with value `SW1A 1AA`.

### Controlling nesting depth

For deeply nested JSON, the `-p` flag controls how many levels of nesting bytefreq will traverse:

```bash
cat data.ndjson | bytefreq -f json -p 3
```

This limits flattening to three levels deep, which can be useful for very complex JSON structures where the full path depth produces an unmanageable number of columns.

### Collapsing array indices

JSON arrays produce paths like `items.0.name`, `items.1.name`, `items.2.name`. The `-a` flag collapses the array index, treating all array elements as the same column:

```bash
cat data.ndjson | bytefreq -f json -a true
```

This produces `items.name` instead of separate columns per array position, which is usually what you want for profiling the structural patterns within array elements.

## Enhanced Output

The `-e` and `-E` flags switch bytefreq from profiling mode to enhanced output mode. Instead of producing a frequency report, the tool processes every record and outputs the flat enhanced format described in Chapter 9.

### Nested enhanced (`-e`)

```bash
cat data.csv | bytefreq -d ',' -e
```

Produces one JSON object per input row, with each field expanded into a nested structure:

```json
{
  "postcode": {
    "raw": "SW1A 1AA",
    "HU": "AA9A 9AA",
    "LU": "A9A 9A",
    "Rules": {
      "string_length": 8,
      "is_uk_postcode": true,
      "poss_postal_country": ["UK"]
    }
  }
}
```

### Flat enhanced (`-E`)

```bash
cat data.csv | bytefreq -d ',' -E
```

Produces the same information but flattened to dot-notation keys — one level deep, no nesting:

```json
{
  "postcode.raw": "SW1A 1AA",
  "postcode.HU": "AA9A 9AA",
  "postcode.LU": "A9A 9A",
  "postcode.Rules.string_length": 8,
  "postcode.Rules.is_uk_postcode": true,
  "postcode.Rules.poss_postal_country": ["UK"]
}
```

The flat format is easier to load into columnar tools (Pandas, DuckDB, Parquet) because every key maps directly to a column name without requiring nested JSON parsing.

## Pipeline Recipes

bytefreq is designed for Unix pipelines. Here are some common patterns:

### Profile the first 10,000 rows of a large file

```bash
head -10001 data.csv | bytefreq -d ','
```

(10,001 to include the header row.)

### Profile compressed data

```bash
zcat data.csv.gz | bytefreq -d ','
```

### Profile a remote API response

```bash
curl -s 'https://api.example.com/data' | bytefreq -f json
```

### Generate flat enhanced output and load into DuckDB

```bash
cat data.csv | bytefreq -d ',' -E > enhanced.ndjson
duckdb -c "SELECT * FROM read_ndjson_auto('enhanced.ndjson') LIMIT 10;"
```

### Profile only specific columns (using pre-processing)

```bash
cat data.csv | cut -d',' -f1,3,5 | bytefreq -d ','
```

### Compare two files structurally

```bash
diff <(cat file1.csv | bytefreq -d ',') <(cat file2.csv | bytefreq -d ',')
```

This shows which columns have gained or lost structural patterns between two versions of the same dataset — useful for detecting format drift over time.

### Profile an Excel file (via csvkit)

bytefreq does not read Excel files directly from the command line. Use a conversion tool first:

```bash
in2csv data.xlsx | bytefreq -d ','
```

(`in2csv` is part of the `csvkit` Python package. Alternatively, DataRadar handles Excel files natively in the browser.)

## Understanding the Output

The standard DQ report output follows a consistent format:

```
=== Column: field_name ===
Mask                Count   Example
aaaa.aaaa@aaaa.aaa  45,231  john.smith@email.com
aaaa@aaaa.aaa        8,102  jane@company.org
Aaaa Aaaaa             312  John Smith
99999                   45  12345
                        12
--------END OF REPORT--------
```

Each section corresponds to one column in the input. Masks are sorted by descending frequency, so the most common patterns appear first. The example value is a true random sample selected using reservoir sampling — not the first occurrence, but a statistically representative one.

The `--------END OF REPORT--------` marker signals the end of the output, which is useful when piping to downstream tools.

## Performance

bytefreq uses Rayon for multi-threaded processing, so it will utilise all available CPU cores when generating enhanced output. For standard DQ profiling, the bottleneck is typically I/O rather than computation — the mask function is simple enough that CPU time is negligible compared to the time spent reading input.

On a modern machine, expect throughput of several hundred thousand rows per second for tabular data, depending on the number of columns and the average field length. For most datasets under a few million rows, profiling completes in seconds.
