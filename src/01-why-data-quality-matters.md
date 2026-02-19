# Why Data Quality Matters

<!-- TODO: Expand with real-world cost examples, industry stats -->

Data quality is the silent killer of analytics projects. Studies estimate that poor data quality costs organisations between 15–25% of revenue. Yet most teams discover quality issues *after* they've built dashboards, trained models, or made decisions.

## The Usual Suspects

Common data quality problems include:

- **Format inconsistency** — dates as `DD/MM/YYYY`, `MM-DD-YY`, `January 5th`, all in the same column
- **Encoding issues** — UTF-8 vs Latin-1 collisions, invisible characters, BOM markers
- **Structural drift** — a column that was numeric last month now contains free text
- **Semantic ambiguity** — "NULL", "N/A", "none", "", and actual nulls all meaning different things
- **Population shifts** — 95% of records follow one pattern, but the other 5% break everything

## The Read Problem

Most data quality tooling assumes you control the pipeline. But increasingly, data arrives from sources you don't control:

- Third-party feeds
- Scraped web data
- Legacy system exports
- Partner integrations
- Open data portals

You can't fix the source. You can only understand what you've received. That's **Data Quality on Read**.
