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

## Finding the Cliff Point

The metrics above — coverage, mask cardinality, rare mask frequency — describe the shape of the distribution, but they do not tell you where to draw the line between "normal" and "investigate." The **cliff point** does.

Take the sorted mask frequency table and calculate one additional column: the **percentage of previous mask**. For each mask in the list, divide its count by the count of the mask immediately above it. The first mask has no predecessor, so start with the second.

Returning to our phone number example:

```
Mask                    Count     % of Previous
99999 999999          812,000         —
+99 9999 999999        95,000       11.7%
9999 999 9999          42,000       44.2%
(999) 999-9999         31,000       73.8%
aaaa                   12,000       38.7%
99999999999             4,200       35.0%
Aaaa aaa Aaaa           2,100       50.0%
(other)                 1,700       81.0%
```

Walking down the list, look at how the percentage-of-previous behaves. From position two onwards, the ratios are relatively stable — each mask is some reasonable fraction of the one above it, reflecting the gradual decline you would expect in a power law distribution. But in many real-world columns, there is a point where this ratio drops sharply. The count might go from 12,000 to 400 — a percentage-of-previous of 3.3% — where the preceding steps were in the 30-70% range.

That sharp drop is the **cliff point**. Everything above it is part of the expected population — patterns that are either correct or wrong in ways you have already accounted for. Everything below it is the exception zone: masks so rare relative to the population above them that they warrant individual inspection.

This is **management by exception** applied to data quality. Rather than reviewing every mask in a column, the cliff point tells you where to focus your attention. Above the cliff: normal operations. Below the cliff: the review queue.

The masks below the cliff point become a structured work list. For each one, the question is the same: does this pattern represent a new assertion rule that the profiler should learn, or a treatment function that downstream consumers need? A mask like `99-99-9999` appearing twelve times in a column of `9999-99-99` dates might indicate an American-format date that needs a treatment function to reorder the components. A mask like `AAAA` appearing three times might be the string `NULL` written literally, needing a rule to flag it as a placeholder. Each exception either produces a new rule, a new treatment, or a documented decision to accept the anomaly — and the cliff point is what surfaced it for review in the first place.

### A Real Example: UK Postcodes in Companies House Data

To see the cliff point in practice, consider a real profiling run against 100,000 company records from the UK Companies House public dataset. The `RegAddress.PostCode` field — the registered office postcode — produces the following HU mask frequency table:

```
Mask              Count      %       % of Previous
AA9 9AA          38,701   38.4%          —
AA99 9AA         35,691   35.4%        92.2%
A99 9AA           7,900    7.8%        22.1%
A9 9AA            5,956    5.9%        75.4%
AA9A 9AA          5,378    5.3%        90.3%
(empty)           4,367    4.3%        81.2%
A9A 9AA           1,967    2.0%        45.0%
AA999AA               7    0.0%         0.4%    ← cliff point
AA99AA                5    0.0%        71.4%
99 999                2    0.0%        40.0%
9999                  2    0.0%       100.0%
A9   9AA              2    0.0%       100.0%
AA9 9AA.              2    0.0%       100.0%
AA99 9 AA             1    0.0%        50.0%
A99A 9AA              1    0.0%       100.0%
AAAAA 9               1    0.0%       100.0%
...and 14 more singletons
```

The first seven rows — the five standard UK postcode formats (`AA9 9AA`, `AA99 9AA`, `A99 9AA`, `A9 9AA`, `AA9A 9AA`), empty values, and the sixth format (`A9A 9AA`) — account for 99.96% of all records. The percentage-of-previous ratios in this zone are all between 22% and 92%, reflecting the natural variation in how common each postcode format is.

Then between `A9A 9AA` (1,967 records) and `AA999AA` (7 records), the count drops from nearly two thousand to single digits. The percentage-of-previous plummets to **0.4%**. That is the cliff.

Below the cliff, every mask is a data quality issue worth inspecting:

- `AA999AA` and `AA99AA` — valid formats with the space missing (`GU478QN`, `CH71ES`). Treatment: insert the space.
- `99 999` — a numeric value (`20 052`), clearly not a UK postcode. Likely a foreign postal code or data in the wrong field.
- `A9   9AA` — extra spaces (`M2 2EE...`), with trailing dots. Treatment: normalise whitespace, strip trailing punctuation.
- `AA9 9AA.` — trailing full stop (`BR7 5HF.`). Treatment: strip punctuation.
- `AA99 9 AA` — extra space in the outward code (`SW18 4 UH`). Treatment: normalise to standard format.
- `AAAAA 9` — not a postcode at all (`BLOCK 3`). An address fragment in the wrong field.
- `A_A9 9AA` — contains a semicolon (`L;N9 6NE`). Data entry error; likely `LN9 6NE`.
- `9A AAA` — inverted format (`2L ONE`). Not a postcode.

Each exception below the cliff either produces a treatment function (strip the trailing dot, normalise spacing, insert the missing space) or a flag for manual review (the numeric values, the `BLOCK 3`, the inverted formats). The cliff point surfaced all of them mechanically, without writing a single postcode-specific validation rule.

In practice, the cliff point is not always a single dramatic drop. Some columns have a gradual slope with no obvious cliff — these are columns with genuine structural diversity (free-text fields, for example) where management by exception is less useful. Others have a razor-sharp cliff after the second or third mask, where 99% of the data conforms to two or three formats and everything else is noise. The clarity of the cliff point is itself diagnostic: a sharp cliff means the column has strong structural conventions; a gentle slope means it does not.

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
