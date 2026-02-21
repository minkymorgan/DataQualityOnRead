# Population Analysis

Once masks have been generated for every value in a column, the next step is to count them. The resulting frequency table — a list of unique masks and their occurrence counts — is the *population profile* of the column, and it is where the real insight lives.

## The Power Law of Data

In practice, most columns in structured data follow a power law distribution when profiled by masks. A small number of masks (typically one to three) account for 80 to 95 percent of all values, representing the "expected" formats. A long tail of rare masks accounts for the remainder, representing anomalies, edge cases, errors, and format variations that the documentation did not mention.

The dominant masks tell you what the column is *supposed* to contain. The long tail tells you what has gone wrong, what has drifted, or what was never documented in the first place. The population profile is, in effect, a structural census of the column.

## Reading a Population Profile

Consider a phone number column with one million rows. After masking at high grain, the population profile might look like this:

```
Mask                    Count      %       Cumulative
99999 999999          812,000   81.2%       81.2%
+99 9999 999999        95,000    9.5%       90.7%
9999 999 9999          42,000    4.2%       94.9%
(999) 999-9999         31,000    3.1%       98.0%
aaaa                   12,000    1.2%       99.2%
99999999999             4,200    0.4%       99.6%
Aaaa aaa Aaaa           2,100    0.2%       99.8%
(other)                 1,700    0.2%      100.0%
```

This single view tells us more about the phone number column than any schema definition could. We can see that the dominant format is UK mobile (`99999 999999`, 81.2%), with significant minorities of international numbers, UK landlines, and US-formatted numbers. We can see that 1.2% of values are alphabetic — likely the strings `null`, `none`, or similar placeholders masking as `aaaa`. We can see 0.2% of values that look like names (`Aaaa aaa Aaaa`), almost certainly data in the wrong field. And we can see that the format without spaces (`99999999999`) is present but relatively rare, suggesting it might be a data entry variant rather than an error.

None of this required writing a single regex. None of it required a schema. The profiler generated the structural census mechanically, and the interpretation is immediate to anyone who can read the mask notation.

## Key Metrics

From the population profile, several metrics are worth computing:

**Coverage** measures what percentage of values match the top N masks. If the top mask covers 99.9% of values, the column is structurally uniform and easy to process. If the top mask covers only 40%, the column contains significant structural diversity and will require more complex handling. Coverage is a quick indicator of how much work a column will create downstream.

**Mask cardinality** counts the number of distinct masks in the column. A well-formed date column might have one or two masks. A free-text name field might have hundreds. High mask cardinality suggests either legitimate diversity (names vary in length and format) or structural chaos (multiple unrelated data types in the same column). The distinction is usually obvious from the masks themselves. Note that columns containing non-Latin scripts (as discussed in Chapter 5) tend to have higher mask cardinality at high grain, because CJK, Arabic, and Cyrillic names vary in length just as Latin names do — the structural diversity is real, not an error.

**Rare mask frequency** identifies masks appearing fewer than N times, or below some percentage threshold of the total population. These are the candidates for investigation. They might be data entry errors, format migrations (records from an old system using a different format), encoding problems, or legitimate edge cases. The threshold is domain-dependent — in a million-row dataset, a mask appearing 10 times is probably an anomaly, while in a thousand-row dataset it might represent 1% of the data and be a genuine format variant.

## Population Checks

A separate but related technique is the **population check**, which tests whether each field is populated or empty. This is implemented as a special mask that returns `1` if a field contains a value and `0` if it is null or empty. When aggregated, it produces a per-field population percentage.

Population checks are a basic hygiene measure but surprisingly revealing. A field that is documented as mandatory but shows 15% empty values indicates a data collection problem. A field that was previously 99.5% populated but has dropped to 80% suggests an upstream process change. A field that is 100% populated is either genuinely complete or has been backfilled with placeholders — and the mask profile of that field will tell you which.

When we built our reusable notebook for profiling data in Apache Spark, we included `POPCHECKS` as a standard mask alongside the ASCII high grain and low grain profilers, precisely because population analysis is so consistently useful as a first-pass check. The graphical output — a stacked bar chart showing populated versus missing values per field — is one of those visualisations that instantly tells you the shape of a dataset before you look at a single value.

## The Two-Pass Workflow

Combining population analysis with mask profiling gives us a general workflow for exploring any structured dataset:

1. Run population checks to understand which fields are populated and which are sparse.
2. Run low grain mask profiling to identify the structural families in each populated field.
3. Review the long tail of rare masks to identify anomalies and potential quality issues.
4. Drill into specific fields with high grain masking where precision matters (postcodes, phone numbers, dates, identifiers).
5. Document the dominant masks as the "expected" formats for each field.

This workflow takes minutes on a modestly sized dataset (up to a few hundred thousand rows) and scales to millions of rows with the CLI tool or billions with the Spark engine. The output — a per-field summary of structural patterns — is the foundation on which the rest of the DQOR process is built: masks as error codes, treatment functions, and the flat enhanced format that ties it all together.
