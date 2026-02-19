# bytefreq: The CLI

<!-- TODO: Pull actual usage, flags, and examples from bytefreq repo -->
<!-- TODO: Add installation instructions -->
<!-- TODO: Show real output from running against sample data -->

## Overview

**bytefreq** is a command-line tool for generating mask-based profiles from delimited data files. It's fast, portable, and designed for Unix pipelines.

## Installation

```bash
# TODO: Add actual installation steps
```

## Basic Usage

```bash
# Profile a CSV file
bytefreq -d ',' -f input.csv

# Specify columns
bytefreq -d ',' -c 3,5,7 -f input.csv

# Low grain mode
bytefreq -d ',' -g low -f input.csv
```

## Key Flags

<!-- TODO: Document actual flags from the tool -->

| Flag | Description |
|------|-------------|
| `-d` | Delimiter character |
| `-f` | Input file |
| `-c` | Column selection |
| `-g` | Grain level (`high` or `low`) |
| `-n` | Number of top masks to show |

## Output Format

bytefreq outputs a frequency table per column:

```
=== Column 3: email ===
Mask                          Count    %
aaaa.aaaa@aaaa.aaa           45,231   45.2%
aaaa.aaaa@aaaa.aa.aa         12,100   12.1%
aaaa_aaaa@aaaa.aaa            8,950    9.0%
...
```

## Pipeline Integration

bytefreq is designed to work with standard Unix tools:

```bash
# Profile and sort by frequency
bytefreq -d ',' -f data.csv | sort -t'|' -k3 -rn

# Profile compressed data
zcat data.csv.gz | bytefreq -d ','

# Sample first 10,000 rows
head -10000 data.csv | bytefreq -d ','
```
