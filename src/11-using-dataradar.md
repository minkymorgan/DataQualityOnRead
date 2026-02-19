# Using DataRadar: A Walkthrough

The previous chapters described the theory: masks, grain levels, population analysis, error codes, treatment functions, and the flat enhanced format. This chapter puts it into practice using DataRadar, the browser-based profiling tool. We will walk through a complete profiling session, from uploading a file to interpreting the output and exporting the results.

## Getting Started

Open [dataradar.co.uk](https://dataradar.co.uk) in any modern browser. There is nothing to install, no account to create, and no data leaves your machine — all processing happens client-side using WebAssembly.

The interface presents a file upload area at the top. You can either click to browse for a file, or drag and drop one onto the page. DataRadar supports four input formats:

- **CSV / Tabular** — comma, pipe, tab, semicolon, or custom delimited files
- **Excel** — .xlsx, .xls, .xlsb, and .ods spreadsheets (with sheet selection)
- **JSON / NDJSON** — newline-delimited JSON (one record per line), or standard JSON arrays
- **URLs** — paste a URL to a JSON API endpoint and DataRadar will fetch and profile the response directly

For CSV files, the delimiter is auto-detected but can be overridden. For Excel files, you can select which sheet to profile and whether the first row contains headers.

## The Report Options

Before running the profiler, three settings control what output you get:

### Report Type

- **Data Quality (DQ)** — the default. Generates mask-based frequency profiles for each column, showing the structural patterns and their counts. This is what you want for the workflow described in this book.
- **Character Profiling (CP)** — generates byte-level or code-point-level frequency analysis of the file content. This is the forensic mode described in Chapter 5, useful for diagnosing encoding issues, identifying unexpected control characters, or determining the character sets present in the data.

### Masking Level

Four grain levels are available:

- **High Unicode (HU)** — detailed masks with full Unicode character class support. Every character maps individually. This is the default and the most generally useful mode.
- **Low Unicode (LU)** — compressed masks where consecutive characters of the same class are collapsed. Use this for initial discovery when you want to see structural families rather than exact formats.
- **High ASCII (H)** — the classic A/a/9 mask at full resolution, treating all non-ASCII bytes as "other." Useful for legacy data or when you specifically want ASCII-only profiling.
- **Low ASCII (L)** — compressed ASCII masks. The original bytefreq mode, equivalent to the `sed` one-liner described in Chapter 4.

For most work, start with **LU** (Low Unicode) to get the broad structural picture, then switch to **HU** (High Unicode) to examine specific columns in detail.

### Output Format

The profiling results can be displayed and exported in several formats:

- **Human-readable Text** — a formatted report suitable for reading in the browser or pasting into a document.
- **JSON** — structured output for programmatic consumption.
- **Markdown** — formatted for inclusion in documentation or GitHub README files.

## Running a Profile

With a file loaded and the options set, click **Analyze Data**. The profiler runs in the browser and results appear below the controls.

The output is organised by column. For each column in the input data, the profiler shows:

- The **column name** (or column number for headerless files).
- The **total count** of values profiled.
- A **frequency table** of masks, sorted by count descending.

For example, profiling a CSV with a `phone_number` column at High Unicode grain might produce:

```
=== phone_number (1,000 values) ===

Mask                    Count    %
99999 999999              812   81.2%
+99 9999 999999            95    9.5%
9999 999 9999              42    4.2%
(999) 999-9999             31    3.1%
aaaa                       12    1.2%
99999999999                 4    0.4%
Aaaa aaa Aaaa               2    0.2%
                             2    0.2%
```

This is the population profile described in Chapter 6. The dominant mask (`99999 999999`) represents UK mobile numbers. The long tail reveals international formats, US formats, placeholders (`aaaa` — probably `null` or `none`), names in the wrong field (`Aaaa aaa Aaaa`), and empty strings.

## Inspecting the Data

Before running the full profile, DataRadar offers a **data preview** that shows the first rows of the parsed file. This is worth checking — it confirms that the delimiter was detected correctly, that headers were identified, and that the columns are aligned. If the preview looks wrong (columns misaligned, headers appearing as data rows, or delimiter issues), adjust the format settings and re-check before profiling.

For JSON input, the preview shows the flattened field paths, which is useful for understanding the structure of nested data before profiling it.

## The Flat Enhanced Export

The most powerful output mode is the **Flat Enhanced JSON** export, selected from the Output Format dropdown. This produces the flat enhanced format described in Chapter 9: for every field in every record, the output includes the parallel column families:

```json
{
  "phone_number.raw": "+44 7700 900123",
  "phone_number.HU": "+99 9999 999999",
  "phone_number.LU": "+9 9 9",
  "phone_number.Rules": {
    "string_length": 15,
    "poss_postal_country": null
  },
  "postcode.raw": "SW1A 1AA",
  "postcode.HU": "AA9A 9AA",
  "postcode.LU": "A9A 9A",
  "postcode.Rules": {
    "string_length": 8,
    "is_uk_postcode": true,
    "poss_postal_country": ["UK"]
  }
}
```

Each record in the input becomes a single JSON line in the output, with every field expanded into its `.raw`, `.HU`, `.LU`, and `.Rules` sub-columns. This is the file you would load into Pandas, Polars, DuckDB, or any other analytical tool for downstream processing.

### Loading Flat Enhanced Output in Python

```python
import pandas as pd

df = pd.read_json('output.ndjson', lines=True)

# Use the raw values
df['postcode.raw']

# Use the mask for quality checks
df['postcode.HU']

# Use the Rules suggestions
df['postcode.Rules'].apply(lambda r: r.get('is_uk_postcode') if r else None)
```

### Loading in DuckDB

```sql
SELECT
    "postcode.raw" AS postcode,
    "postcode.HU" AS mask,
    "postcode.Rules"->>'is_uk_postcode' AS is_valid
FROM read_ndjson_auto('output.ndjson');
```

## Working With JSON and API Data

One of DataRadar's distinguishing features is its ability to profile JSON data directly, including data fetched from API endpoints. This is particularly useful for open data projects where the data arrives as GeoJSON, REST API responses, or NDJSON feeds.

To profile an API endpoint, paste the URL into the URL field and click fetch. DataRadar will retrieve the response, detect the format, and present it for profiling. If the response is a paginated API response (a single JSON object containing an array), DataRadar detects this and offers to extract and convert the array to NDJSON format automatically.

For example, profiling the USGS earthquake feed:

```
https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson
```

DataRadar will detect the nested GeoJSON structure, flatten the `properties` and `geometry` objects into dot-notation field paths (`properties.time`, `properties.mag`, `geometry.coordinates.0`), and profile each flattened field. The flat enhanced export then produces output like:

```json
{
  "properties.time.raw": "1766181640870",
  "properties.time.HU": "9999999999999",
  "properties.time.LU": "9",
  "properties.time.Rules": {
    "string_length": 13,
    "is_numeric": true
  }
}
```

From this output, it is immediately clear that the `time` field contains 13-digit numeric values — Unix timestamps in milliseconds. A downstream consumer can parse these into datetimes with confidence, knowing that the mask confirms structural consistency across all records.

## Multilingual Data

DataRadar handles international data without configuration. When profiling a dataset containing names, addresses, or descriptions in non-Latin scripts, the Unicode-aware masking produces structurally meaningful masks for every script:

- Chinese characters (Lo category) mask to `a`, so 北京饭店 becomes `aaaa`
- Arabic text with spaces preserves word boundaries: `a a a`
- Cyrillic names follow the same uppercase/lowercase distinction as Latin: `Aaaaaaa`
- Mixed-script fields (Latin + CJK, Arabic + digits) reveal the mixing in the mask

The profiler also reports detected scripts per field, flagging columns that contain mixed scripts — which may indicate encoding issues, data from multiple sources, or legitimate multilingual content.

## The Workflow in Practice

A typical DataRadar session follows the two-pass workflow described in Chapter 6:

1. **Load the file** and check the data preview to confirm correct parsing.
2. **Run a Low Unicode (LU) profile** to survey the structural landscape. Scan each column's masks to understand the dominant patterns and spot obvious anomalies.
3. **Switch to High Unicode (HU)** and re-profile to examine specific columns where format precision matters (postcodes, phone numbers, dates, identifiers).
4. **Export Flat Enhanced JSON** for any data you want to process further — the export preserves raw values, masks, and rule suggestions for every record.
5. **Load the export** into your analytical tool of choice (Pandas, DuckDB, Excel) and proceed with your analysis, using the mask and Rules columns to guide quality decisions.

The entire process — from opening the browser to having a flat enhanced export loaded in a notebook — typically takes less than five minutes. No installation, no configuration, no data leaving your machine.
