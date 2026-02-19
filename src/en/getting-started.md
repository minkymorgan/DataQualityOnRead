# Getting Started

You have read the book. Now try the technique. Here is the shortest path from zero to a working profile.

## Option 1: DataRadar in Your Browser (30 seconds)

1. Open [dataradar.co.uk](https://dataradar.co.uk).
2. Drop a CSV, Excel, or JSON file onto the page — or paste a URL to an open data endpoint.
3. Click **Profile**. The masks appear immediately.
4. Switch between LU and HU grain to explore structural patterns at different resolutions.
5. Click **Export Flat Enhanced** to download the NDJSON output with `.raw`, `.HU`, `.LU`, and `.Rules` columns.

No installation. No sign-up. No data leaves your machine.

## Option 2: bytefreq on the Command Line (5 minutes)

Install Rust and bytefreq:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
cargo install --git https://github.com/minkymorgan/bytefreq
```

Profile a file:

```bash
cat your_data.csv | bytefreq -d ','
```

Generate flat enhanced output:

```bash
cat your_data.csv | bytefreq -d ',' -E > enhanced.ndjson
```

Query the output with DuckDB:

```bash
duckdb -c "SELECT * FROM read_ndjson_auto('enhanced.ndjson') LIMIT 10;"
```

## Sample Data

If you do not have a dataset to hand, try the UK government's Electric Vehicle Chargepoint Registry — a real open dataset with messy postcodes, mixed formats, and international address data:

```bash
curl -sL 'https://www.gov.uk/guidance/find-and-use-data-on-public-electric-vehicle-chargepoints' -o chargepoints.csv
cat chargepoints.csv | bytefreq -d ','
```

Or paste the URL directly into DataRadar.

## Links

- **DataRadar**: [dataradar.co.uk](https://dataradar.co.uk)
- **bytefreq source**: [github.com/minkymorgan/bytefreq](https://github.com/minkymorgan/bytefreq)
- **This book**: [github.com/minkymorgan/DataQualityOnRead](https://github.com/minkymorgan/DataQualityOnRead)
- **Enterprise support**: [andrew@gamakon.ai](mailto:andrew@gamakon.ai)

## What to Do Next

1. Profile a dataset you are working with right now. Look at the masks. What surprises you?
2. Export the flat enhanced format and load it into your tool of choice (Pandas, Polars, DuckDB, Excel).
3. Identify the top three mask patterns per column — those are your "expected" formats.
4. Look at the long tail — the rare masks. Those are your quality issues.
5. Write treatment functions for the issues you find, keyed by mask (as described in Chapter 8).
6. Repeat. Profile early. Profile often.
