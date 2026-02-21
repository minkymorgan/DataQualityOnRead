# Worked Example: Profiling UK Companies House Data {.unnumbered}

This appendix is a complete worked example. We take a real dataset — 99,999 company registration records from UK Companies House — and profile it end to end using bytefreq's low-grain Unicode (LU) masking. For each field, we show the actual mask frequency table, identify the cliff point where applicable, and catalogue every data quality issue we find. The result is a concrete illustration of the techniques described in the preceding chapters, applied to real government data with real problems.

## The Dataset

Companies House publishes a free monthly snapshot of every company registered in England and Wales, Scotland, and Northern Ireland. The **BasicCompanyData** file is a pipe-delimited extract containing company name, registered address, incorporation date, SIC codes, company status, and related metadata. It is freely available from [download.companieshouse.gov.uk](http://download.companieshouse.gov.uk/).

The extract used here is `BasicCompanyData-2021-02-01-part6_6_100k.pip` — 99,999 records from the February 2021 release. It contains 55 columns, ranging from well-structured identifiers (company number) to free-text fields (company name, address lines) to date fields, categorical codes, and URLs. It is exactly the kind of messy, real-world dataset that DQOR techniques are designed for.

## Running the Profile

The profile was generated with a single command:

```bash
cat BasicCompanyData-2021-02-01-part6_6_100k.pip | bytefreq -g LU
```

We use LU (Low-grain Unicode) masking as the discovery grain — it collapses consecutive characters of the same class, producing a compact set of structural patterns for each column. This is the recommended starting point for any new dataset. Where precision matters, you can drill into specific fields with HU (High-grain Unicode) masking afterwards.

## Field-by-Field Analysis

### Company Number

```
Mask     Count      %
9       87,730   87.7%
A9      12,145   12.1%
A9A        124    0.1%
```

Three masks, no cliff point needed — with only three patterns, every one is worth understanding.

The dominant format `9` (87.7%) represents standard company numbers — eight numeric digits like `12432873`. The `A9` pattern (12.1%) covers companies with letter prefixes: `GE000152` (German registered), `SC` (Scottish), `NI` (Northern Ireland), `OC` (overseas companies), and similar jurisdiction indicators. The rare `A9A` pattern (0.1%, 124 records) covers industrial and provident societies with a trailing letter: `IP28746R`.

**Issues found:** None. This is a well-structured identifier with consistent formatting. The three patterns are all legitimate and well-documented. A good assertion rule would validate that the prefix letters match known jurisdiction codes.

### Registered Address: Postcode

```
Mask          Count      %       % of Prev
A9 9A        88,252   88.3%          —
A9A 9A        7,347    7.3%        8.3%
(empty)       4,367    4.4%       59.4%
A9A              12    0.0%        0.3%    ← cliff point
A9                3    0.0%       25.0%
9                 3    0.0%      100.0%
9 9               3    0.0%      100.0%
A9 9A.            2    0.0%       66.7%
A9 9 A            2    0.0%      100.0%
A9 A              2    0.0%      100.0%
A9A9A             1    0.0%       50.0%
A_A9 9A           1    0.0%      100.0%
A 9               1    0.0%      100.0%
A 9A              1    0.0%      100.0%
9A A              1    0.0%      100.0%
A9A 9 A           1    0.0%      100.0%
```

This field is analysed in detail in Chapter 6 using the HU (high-grain) profile, which separates the five standard UK postcode formats. At LU grain, those five formats collapse into two masks: `A9 9A` (the standard pattern) and `A9A 9A` (formats where the outward code ends in a letter, like `W1T 6AD` or `EC1V 2NX`).

The cliff drops from 7,347 to 12 — a percentage-of-previous of **0.3%**. Everything below is a data quality issue:

- `A9A` (12 records, e.g. `GU478QN`) — valid postcodes with the space missing. **Treatment:** insert space before the inward code.
- `A9 9A.` (2 records, e.g. `BR7 5HF.`) — trailing full stop. **Treatment:** strip trailing punctuation.
- `A9 9 A` (2 records, e.g. `WR9 9 AY`) — extra space in the inward code. **Treatment:** normalise whitespace.
- `A_A9 9A` (1 record: `L;N9 6NE`) — semicolon in the postcode, likely a typo for `LN9 6NE`. **Treatment:** character substitution rule.
- `A 9` (1 record: `BLOCK 3`) — not a postcode at all. Address fragment in the wrong field.
- `9A A` (1 record: `2L ONE`) — not a postcode. Investigate source record.
- `9` and `9 9` (3 each, e.g. `0255`, `19 904`) — numeric values, likely foreign postal codes or phone number fragments.

### Registered Address: Post Town

```
Mask             Count      %
A               84,153   84.2%
A A              6,299    6.3%
(empty)          5,011    5.0%
A A A            1,585    1.6%
A-A-A            1,428    1.4%
A. A               350    0.4%
A_A A              184    0.2%
A A. A             179    0.2%
A, A               151    0.2%
A A A A             79    0.1%
A A, A              78    0.1%
A,                  62    0.1%
A-A-A-A             60    0.1%
...and 86 more masks
```

The top five masks are all legitimate town name patterns: single words (`READING`), two words (`HEBDEN BRIDGE`), three words (`STOCKTON ON TEES`), hyphenated forms (`STOCKTON-ON-TEES`), and abbreviated forms (`ST. HELENS`). Together they cover 98.5% of records.

Below the cliff, things get interesting:

- `A, A` (151 records, e.g. `MERSEYSIDE,...`) — town with trailing county or region, comma-separated. The town field is being used to store town-plus-county.
- `A,` (62 records, e.g. `LONDON,`) — trailing comma. **Treatment:** strip trailing punctuation.
- `9 A A` (32 records, e.g. `150 HOLYWOOD ROAD`) — a street address, not a town. Data in the wrong field entirely.
- `A9 9A` (14 records, e.g. `EH47 8PG`) — a **postcode** in the town field. Classic column misalignment.
- `9-9 A A` (10 records, e.g. `1-7 KING STREET`) — street addresses in the town field.
- `A 9` (10 records, e.g. `LEEDS 4`) — historic postal district format. Legitimate but archaic.
- `A9A 9A` (3 records, e.g. `W1K 5SL`) — another postcode in the town field.
- `9` (2 records, e.g. `20037`) — a US ZIP code in the town field.

**Key finding:** At least 59 records have postcodes or street addresses in the town field, indicating systematic column misalignment in a subset of the source data.

### Registered Address: County

```
Mask             Count      %
(empty)         61,374   61.4%
A               30,482   30.5%
A A              6,948    6.9%
A A A              626    0.6%
A. A               111    0.1%
A _ A              104    0.1%
A.                  49    0.0%
A A A A             40    0.0%
A,                  35    0.0%
A-A                 33    0.0%
A, A                22    0.0%
A 9                 14    0.0%
A9 9A               11    0.0%
A-A-A               10    0.0%
9                    9    0.0%
A _A_                8    0.0%
...and 63 more masks
```

The county field is 61.4% empty — expected, since counties are increasingly optional in UK addresses. The legitimate patterns (`A`, `A A`, `A A A`) cover 97.8% of populated values.

Below the cliff, a catalogue of problems:

- `A.` (49 records, e.g. `KENT.`) — trailing full stop on county names. **Treatment:** strip trailing punctuation.
- `A,` (35 records, e.g. `WORCESTER,`) — trailing comma. **Treatment:** strip trailing punctuation.
- `A 9` (14 records, e.g. `DELAWARE 19801`) — US state with ZIP code. Foreign address data in the county field.
- `A9 9A` (11 records, e.g. `N3 2SB`) — UK postcodes in the county field. Column misalignment again.
- `9` (9 records, e.g. `100031`) — pure numeric. Likely foreign postal codes.
- `A _A_` (8 records, e.g. `COUNTY (OPTIONAL)`) — placeholder text left by a web form. The literal string "COUNTY (OPTIONAL)" was submitted as the county value.
- `A A 9` (6 records, e.g. `NEW YORK 10286`) — US city with ZIP code.
- `-` (3 records) and `- -` (1 record) — dash placeholders.
- `A. A9 9A` (1 record, e.g. `WILTSHIRE. SN14...`) — county with postcode appended.
- `-A-` (1 record: `--SELECT--`) — web form dropdown placeholder that was submitted as data.
- `A9A 9A` (1 record: `LONDONWC1X 8JX`) — an entire postcode, concatenated with the city name.

**Key finding:** The county field is a dumping ground. Web form placeholders (`COUNTY (OPTIONAL)`, `--SELECT--`), foreign addresses, postcodes, and trailing punctuation all appear. This single field demonstrates why profiling by masks is more effective than regex validation — the variety of failure modes is too diverse for any reasonable set of hand-written rules to catch.

### Registered Address: Country

```
Mask          Count      %
A            41,019   41.0%
(empty)      34,930   34.9%
A A          24,039   24.0%
A A A             5    0.0%
A A, A            5    0.0%
A _ A             1    0.0%
```

Three legitimate patterns that together account for 99.97% of records. But there is a consistency problem: `A` (41,019) covers single-word countries like `ENGLAND`, `SCOTLAND`, `WALES`, while `A A` (24,039) covers `UNITED KINGDOM`. These are the same country expressed differently — some records say `ENGLAND`, others say `UNITED KINGDOM`, and 34.9% say nothing at all.

Below the cliff:

- `A A A` (5 records, e.g. `ISLE OF MAN`) — legitimate, just rare.
- `A A, A` (5 records, e.g. `VIRGIN ISLANDS,...`) — legitimate but includes comma formatting.
- `A _ A` (1 record: `ENGLAND & WALES`) — a jurisdiction description, not a country name.

**Key finding:** The real issue here is not the exceptions — it is the inconsistency between `ENGLAND` and `UNITED KINGDOM` as country values. A treatment function should normalise these to a single canonical form (e.g. ISO 3166 country code `GB`).

### Company Category

```
Mask                                          Count      %
Aa Aa Aa                                     85,872   85.9%
A_A A A_A _Aa, a a a, a a a_                 6,203    6.2%
A_A_A _Aa, Aa a a, a a a, a a _Aa_ a_        5,585    5.6%
Aa Aa                                         1,631    1.6%
Aa Aa Aa Aa                                     455    0.5%
Aa a a                                          137    0.1%
Aa Aa a Aa Aa                                    89    0.1%
...and 5 more masks
```

Two formatting conventions exist side by side: human-readable (`Private Limited Company`, 85.9%) and coded abbreviations (`PRI/LTD BY...`, 6.2%; `PRI/LBG/NSC...`, 5.6%). The coded forms use slashes, parentheses, and abbreviations — a completely different format from the title case descriptions.

**Key finding:** This field has two distinct encoding schemes coexisting. A treatment function should either expand the abbreviations to full text or code the full text to abbreviations, depending on the consumer's needs. The profiler has discovered what no schema definition would tell you: the field is not consistently formatted.

### Company Status

```
Mask                           Count      %
Aa                            96,621   96.6%
Aa - Aa a Aa a                 3,277    3.3%
Aa Aa                             79    0.1%
Aa a Aa Aa a a a a a              12    0.0%
Aa Aa_Aa Aa                        5    0.0%
A                                  5    0.0%
```

96.6% of companies are `Active`. The `A` mask (5 records: `RECEIVERSHIP`) is the only ALL-CAPS value in a field that otherwise uses title case. This is a minor casing inconsistency — but it is the kind of thing that breaks a `CASE WHEN` statement or a join on status values.

**Treatment:** Normalise casing to title case.

### Country of Origin

```
Mask          Count      %
Aa Aa        99,868   99.9%
A A              78    0.1%
A                45    0.0%
A A A             6    0.0%
A A, A            1    0.0%
(empty)           1    0.0%
```

99.87% of records show `United Kingdom` in title case. The remaining 131 records use ALL-CAPS (`SOUTH KOREA`, `AUSTRALIA`, `UNITED ARAB...`). This is the same field in the same dataset using two different casing conventions — title case for UK records, all-caps for foreign origins.

One record is completely empty — a company with no country of origin recorded.

**Treatment:** Normalise casing. Consider mapping to ISO 3166 country codes for consistency.

### Incorporation Date

```
Mask      Count      %
9_9_9    99,947   99.9%
(empty)      52    0.1%
```

99.95% of records have a date in `DD/MM/YYYY` format (which LU collapses to `9_9_9`). But 52 companies have **no incorporation date**. How does a registered company not have an incorporation date? These are likely very old companies (pre-dating digital records) or special entity types where the concept does not apply. Worth investigating but not necessarily an error.

**Action:** Flag for review. These 52 records are genuine edge cases in the domain, not data entry errors.

### Accounts Category

```
Mask          Count      %
A A A        54,633   54.6%
(empty)      24,534   24.5%
A            18,041   18.0%
A A           2,751    2.8%
A A A A          40    0.0%
```

The dominant value is `NO ACCOUNTS FILED` (54.6%), followed by empty (24.5%) and single-word categories like `GROUP`, `DORMANT`, `MICRO-ENTITY` (18.0%), then two-word categories like `UNAUDITED ABRIDGED` (2.8%). The 40 records matching `A A A A` are `ACCOUNTS TYPE NOT AVAILABLE`.

No data quality issues here — the patterns are all legitimate. But the 24.5% empty rate is worth noting: nearly a quarter of companies have no accounts category recorded. This could indicate recently incorporated companies that have not yet filed.

### SIC Code

```
Mask                                  Count      %
9 - Aa a a a                        17,112   17.1%
9 - Aa a a                          11,233   11.2%
9 - Aa a                             8,558    8.6%
9 - Aa a a a a a.a.a.                7,068    7.1%
9 - Aa a a a a                       6,959    7.0%
Aa Aa                                 6,562    6.6%
9 - Aa a a a a a a                    5,875    5.9%
...and 146 more masks (153 total)
```

The SIC code field combines a 5-digit code with a human-readable description: `59111 - Motion picture production activities`. The LU masks vary because the descriptions vary in word count, punctuation, and casing. There are 153 unique masks — high cardinality driven by the diversity of SIC code descriptions.

The outlier is `Aa Aa` (6,562 records): `None Supplied`. These are companies that registered without providing a SIC code. The mask tells us immediately that this value is structurally different from every other entry — it has no leading numeric code and no dash separator. A simple assertion rule could flag it: if the SIC code does not start with digits, it is not a valid code.

**Key finding:** The SIC code field is a composite field — a code and a description packed into a single column. The profiler cannot separate these without domain logic, but it can tell you that the structure is consistent across 93.4% of records and that `None Supplied` is the primary exception.

## Summary of Findings

Issues discovered through mask-based profiling of 99,999 Companies House records:

**Postcodes:**
- Missing spaces in valid postcodes (12 records) → **Treatment:** insert space
- Trailing punctuation (2 records) → **Treatment:** strip trailing characters
- Extra whitespace (2 records) → **Treatment:** normalise whitespace
- Typos/special characters (1 record: semicolon) → **Treatment:** character substitution
- Non-postcode data in postcode field (5 records) → **Flag** for review

**Post Town:**
- Postcodes in town field (17+ records) → **Flag:** column misalignment
- Street addresses in town field (42+ records) → **Flag:** column misalignment
- Trailing commas and punctuation (62+ records) → **Treatment:** strip trailing punctuation

**County:**
- Trailing punctuation (84 records) → **Treatment:** strip trailing characters
- Postcodes in county field (11 records) → **Flag:** column misalignment
- Foreign address data (20+ records) → **Flag:** non-UK addresses
- Web form placeholders: `COUNTY (OPTIONAL)`, `--SELECT--` (9 records) → **Treatment:** replace with empty
- Dash placeholders (4 records) → **Treatment:** replace with empty

**Country:**
- Inconsistent representation: `ENGLAND` vs `UNITED KINGDOM` vs empty → **Treatment:** normalise to ISO country code
- 34.9% empty → **Accept** (empty is valid for this field)

**Company Category:**
- Two encoding schemes (human-readable vs coded abbreviations) → **Treatment:** normalise to single format

**Company Status:**
- Inconsistent casing: `RECEIVERSHIP` vs `Active` → **Treatment:** normalise to title case

**Country of Origin:**
- Inconsistent casing: `United Kingdom` (title case) vs `SOUTH KOREA` (all-caps) → **Treatment:** normalise casing

**Incorporation Date:**
- 52 records with no date → **Flag** for investigation (likely pre-digital or special entity types)

**SIC Code:**
- 6,562 records with `None Supplied` instead of a code → **Assertion rule:** SIC code must start with digits

## Lessons Learned

**1. Government data is not clean data.** This is an official register maintained by a statutory body. It is well-structured by the standards of real-world data, and it still contains web form placeholders (`--SELECT--`, `COUNTY (OPTIONAL)`), column misalignment (postcodes in the town and county fields), inconsistent casing, trailing punctuation, and foreign address fragments. If Companies House data has these issues, every dataset you receive will have them.

**2. Mask profiling finds issues that schemas cannot.** A schema tells you the postcode field is a string. Mask profiling tells you that 16 of the 99,999 records have structural anomalies — and shows you exactly what each one looks like. The postcode field has a single dominant pattern covering 88.3% of records, and every deviation from it is immediately visible in the mask frequency table.

**3. The cliff point works.** In every field with more than a handful of masks, the frequency distribution showed a clear separation between expected patterns and exceptions. The postcode cliff (7,347 → 12), the county cliff (104 → 49), the post town cliff (151 → 79) — each one cleanly separates the normal from the exceptional.

**4. Column misalignment is a real and common problem.** Postcodes appearing in the town field, street addresses appearing in the town field, postcodes appearing in the county field — these are not random errors. They indicate systematic problems in how data was entered, migrated, or mapped between systems. Mask profiling detects them instantly because the structural pattern of a postcode (`A9 9A`) is unmistakable when it appears in a field full of alphabetic town names (`A`).

**5. One profiling run, twenty minutes, real insight.** The entire analysis in this appendix was generated from a single `bytefreq` command that took seconds to run. The interpretation took longer, but the profiler did all the heavy lifting: it found the patterns, counted them, sorted them by frequency, and provided examples. Every issue catalogued above was visible in the raw output without writing a single validation rule.
