# dataradar: Configuration-Driven Profiling

<!-- TODO: Pull actual features and config format from dataradar repo/site -->
<!-- TODO: Add screenshots or example configs -->

## Overview

While bytefreq is a CLI tool for ad-hoc profiling, **dataradar** wraps mask-based profiling in a configuration-driven framework. It's designed for repeatable, scheduled data quality checks across many datasets.

## Key Concepts

### Configuration Files

dataradar uses configuration files to define:

- **Sources** — where data comes from (files, databases, APIs)
- **Columns** — which fields to profile
- **Rules** — expected masks, thresholds, and alert conditions
- **Actions** — what to do when rules are violated

### Example Configuration

```yaml
# TODO: Replace with actual dataradar config format
source:
  type: csv
  path: /data/daily_feed.csv
  delimiter: ","

profiles:
  - column: phone_number
    grain: high
    rules:
      - mask: "99999 999999"
        min_population: 70%
      - mask: "aaaa"
        max_population: 2%
        severity: warning
```

## From Ad-Hoc to Automated

The progression:

1. **Explore** with bytefreq — discover what patterns exist
2. **Codify** with dataradar — define expected patterns as rules
3. **Monitor** on schedule — catch drift, new formats, quality degradation

## Integration Points

<!-- TODO: Document actual integrations -->

- Scheduled runs via cron
- CI/CD pipeline integration
- Alerting (email, Slack, webhook)
- Report generation
