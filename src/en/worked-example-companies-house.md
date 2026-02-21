# Worked Example: Profiling UK Companies House Data

In this appendix we take the techniques described throughout the book and apply them end-to-end against a real, publicly available dataset: the UK Companies House BasicCompanyData file. The data is free, it is large enough to be interesting, and it contains exactly the kinds of quality issues that mask-based profiling was designed to surface. If you have read the preceding chapters and want to see the entire workflow in one place — from running the profiler to interpreting the output — this is the chapter for you.

## The Dataset

Companies House is the UK government register of limited companies, limited liability partnerships, and other corporate entities. It publishes a free bulk download of the register, updated monthly, at [download.companieshouse.gov.uk](http://download.companieshouse.gov.uk). The file we profile here is a 99,999-row extract from the BasicCompanyData snapshot dated February 2021. The file is pipe-delimited (a `.pip` file) and contains columns covering company number, registered address, company category, status, country of origin, incorporation date, accounts information, and SIC codes among others.

This is real public data, not a synthetic test set. Every count, every mask, and every example value shown below comes directly from the profiling output.

## Running the Profile

We run two passes of bytefreq against the file — one at high grain (HU) and one at low grain (LU). High grain preserves the exact shape of every character (uppercase letters become `A`, lowercase become `a`, digits become `9`, whitespace and punctuation are preserved literally). Low grain collapses consecutive runs of the same class into a single token, which is useful for seeing broader structural patterns.

```bash
cat BasicCompanyData.pip | bytefreq -g HU
cat BasicCompanyData.pip | bytefreq -g LU
```

The profiler examines all 99,999 rows and produces a frequency-ranked list of masks for each column. We focus on the top 25 masks per field, which is more than sufficient to identify the dominant patterns, the cliff point, and the exceptions that warrant investigation.

## Field-by-Field Analysis

### CompanyNumber

| Count | HU Mask | Example |
|------:|---------|---------|
| 87,730 | `99999999` | 12043882 |
| 12,144 | `AA999999` | SC578524 |
| 109 | `AA99999A` | IP13845R |
| 14 | `AA9999AA` | SP2487RS |
| 1 | `A9999999` | R0000099 |
| 1 | `AA999AAA` | SP004SAS |

The dominant pattern is an eight-digit numeric company number (87.7% of the population). The second pattern, a two-letter prefix followed by six digits, accounts for a further 12.1% — these are Scottish companies (SC), Northern Irish companies (NI), and other jurisdiction prefixes. Together the top two masks account for 99.9% of records.

Below the cliff point we find 109 records matching `AA99999A` (such as IP13845R — an Industrial and Provident Society number), 14 matching `AA9999AA`, and two singleton anomalies: `R0000099` and `SP004SAS`. The singleton `SP004SAS` is worth investigating as it does not conform to any standard Companies House numbering scheme and may indicate a data entry error.

**Recommended treatment:** Build an allow list of the three expected formats (`99999999`, `AA999999`, `AA99999A`) and optionally `AA9999AA` for Scottish Partnerships. Flag anything outside this list for manual review.

### RegAddress.PostCode

This field provides an excellent example of the cliff point concept introduced in Chapter 6. The full HU mask table is shown below:

| Count | HU Mask | Example |
|------:|---------|---------|
| 38,701 | `AA9 9AA ` | DY4 8RS |
| 35,691 | `AA99 9AA` | OX49 5QY |
| 7,900 | `A99 9AA ` | B49 5AB |
| 5,956 | `A9 9AA  ` | N1 6BY |
| 5,378 | `AA9A 9AA` | EC1Y 8JJ |
| 4,367 | *(empty)* | |
| 1,967 | `A9A 9AA ` | W1U 8LD |
| 7 | `AA999AA ` | SK104NY |
| 5 | `AA99AA  ` | CO92NU |
| 2 | `AA9 9AA.` | BR5 3RX. |
| 2 | `9999    ` | 8022 |
| 2 | `A9   9AA` | M2 2EE... |
| 2 | `99 999  ` | 19 904 |
| 1 | `A99A 9AA` | W14K 4QY |
| 1 | `AA99 9 AA` | SW18 4 UH |
| 1 | `AAAAA 9 ` | BLOCK 3 |
| 1 | `AA99999 ` | BB14006 |
| 1 | `AA9A 9 AA` | EC1V 1 NR |
| 1 | `AA9A9AA ` | EC1V2NX |
| 1 | `A_A9 9AA` | L;N9 6NE |
| 1 | `AA9     ` | SW1 |
| 1 | `AA99    ` | IP20 |
| 1 | `99999   ` | 94596 |
| 1 | `AA99 99AA` | LE11 11DX |
| 1 | `9A AAA  ` | 2L ONE |

The cliff point sits clearly between the mask `A9A 9AA` (1,967 records) and `AA999AA` (7 records). Above the cliff, we have the six standard UK postcode formats plus 4,367 empty values, accounting for 99,960 of the 99,999 rows. Below the cliff we find 39 records exhibiting a range of issues: missing spaces (`SK104NY`, `CO92NU`, `EC1V2NX`), trailing punctuation (`BR5 3RX.`), extra spaces (`SW18 4 UH`, `EC1V 1 NR`, `M2 2EE...`), partial postcodes (`SW1`, `IP20`), foreign postal codes (`8022`, `94596`, `19 904`), what appears to be an address fragment rather than a postcode (`BLOCK 3`, `2L ONE`), a typographical error with a semicolon in place of a letter (`L;N9 6NE`), and a duplicated district code (`LE11 11DX`).

The low grain profile confirms the picture. At LU grain, 88,252 records match the pattern `A9 9A` (the canonical UK postcode structure) and a further 7,347 match `A9A 9A` (the newer London-style format). Together these two LU masks account for 95.6% of the population.

**Recommended treatment:** The allow list should contain the six standard HU postcode formats. Below the cliff, apply a treatment function that strips trailing punctuation, normalises whitespace, and flags foreign or structurally invalid codes for manual remediation.

### RegAddress.PostTown

| Count | LU Mask | Example |
|------:|---------|---------|
| 84,153 | `A` | READING |
| 6,299 | `A A` | HEBDEN BRIDGE |
| 5,011 | *(empty)* | |
| 1,585 | `A A A` | STOCKTON ON TEES |
| 1,428 | `A-A-A` | STOCKTON-ON-TEES |
| 350 | `A. A` | ST. HELENS |
| 184 | `A_A A` | KING'S LYNN |
| 151 | `A, A` | MERSEYSIDE, ... |
| 78 | `A A, A` | BILLINGTON ROAD, ... |
| 62 | `A,` | LONDON, |
| 32 | `9 A A` | 150 HOLYWOOD ROAD |
| 14 | `A9 9A` | EH47 8PG |
| 10 | `9 A A A` | 5 GREENWICH VIEW ... |
| 10 | `A 9` | LEEDS 4 |

The top two LU masks — single-word towns (`A`) and two-word towns (`A A`) — account for over 90% of the population. The 5,011 empties are notable but not necessarily incorrect (some company types may not require a post town).

The interesting findings are below the cliff. The mask `A, A` (151 records) shows values like "MERSEYSIDE, ..." — these appear to contain county or region information appended to the town with a comma, suggesting data that has been concatenated from multiple fields or entered inconsistently. The mask `A,` (62 records) with the example "LONDON," shows trailing commas — a trivial but telling sign of upstream data concatenation issues.

More seriously, 14 records have the mask `A9 9A` in the PostTown field, with example `EH47 8PG`. These are postcodes sitting in the wrong column entirely. A further 32 records match `9 A A` (example: "150 HOLYWOOD ROAD") and 10 match `9 A A A` (example: "5 GREENWICH VIEW ...") — these are street addresses, not town names. This is a classic column-shift error where data from AddressLine1 or PostCode has bled into the PostTown field.

**Recommended treatment:** Flag records where the PostTown mask matches a postcode pattern (`A9 9A`) or begins with a digit for manual review. Strip trailing commas and extraneous punctuation. Where the field contains a comma-separated compound value, consider splitting and migrating the second part to the County field.

### RegAddress.County

| Count | LU Mask | Example |
|------:|---------|---------|
| 61,374 | *(empty)* | |
| 30,482 | `A` | HERTFORDSHIRE |
| 6,948 | `A A` | WEST MIDLANDS |
| 626 | `A A A` | ENGLAND AND WALES |
| 111 | `A. A` | CO. DURHAM |
| 104 | `A _ A` | TYNE & WEAR |
| 49 | `A.` | KENT. |
| 40 | `A A A A` | EAST RIDING OF ... |
| 35 | `A,` | WORCESTER, |
| 22 | `A, A` | HARROW, MIDDLESEX |
| 14 | `A 9` | DELAWARE 19801 |
| 11 | `A9 9A` | N3 2SB |
| 10 | `A-A-A` | STOKE-ON-TRENT |
| 9 | `9` | 100031 |
| 8 | `A _A_` | COUNTY (OPTIONAL) |
| 7 | `A.A` | S.GLAMORGAN |
| 7 | `A. A.` | CO. ANTRIM. |
| 7 | `A9` | WC1 |
| 6 | `A A 9` | NEW YORK 10286 |
| 5 | `A, A A` | ESSEX, GREATER ... |
| 5 | `A,A` | HARLOW,ESSEX |
| 3 | `A 9 A` | WY 82001 USA ... |

The first thing to note is that 61,374 records — 61.4% of the population — have an empty County field. This is not an error; many UK addresses do not require a county, and Royal Mail does not consider it a mandatory component of a postal address. The dominant non-empty pattern `A` (single word, 30,482 records) covers standard county names like HERTFORDSHIRE, and `A A` (6,948 records) covers two-word counties like WEST MIDLANDS. Together, the empty values and these two masks account for 98.8% of records.

Below the cliff, the exceptions tell a rich story. There are 49 records with a trailing period (`KENT.`), 35 with a trailing comma (`WORCESTER,`) — both indicative of upstream formatting artefacts. There are 22 records containing compound values with commas (`HARROW, MIDDLESEX`), suggesting a town and county have been concatenated into one field.

Then we find genuinely wrong-column data: 11 records contain what appear to be UK postcodes (`N3 2SB`), and 7 contain partial postcodes (`WC1`). There are 14 records matching `A 9` with the example "DELAWARE 19801" — a US state with a ZIP code. A further 6 records show "NEW YORK 10286" and 3 show "WY 82001 USA ..." — these are clearly US addresses stored in a UK company register, presumably for companies with overseas registered offices.

The value `COUNTY (OPTIONAL)` appears 8 times with the mask `A _A_`. This is almost certainly a placeholder or form hint text that was submitted as actual data — a reminder that data entry interfaces can themselves be a source of quality issues.

**Recommended treatment:** Strip trailing punctuation (periods, commas). Flag postcodes in the county field for cross-referencing with the PostCode column. Flag US state/ZIP combinations for review against the RegAddress.Country field. Investigate the "COUNTY (OPTIONAL)" records as possible test or placeholder data.

### RegAddress.Country

| Count | HU Mask | Example |
|------:|---------|---------|
| 37,510 | `AAAAAAA` | ENGLAND |
| 34,930 | *(empty)* | |
| 23,478 | `AAAAAA AAAAAAA` | UNITED KINGDOM |
| 2,303 | `AAAAAAAA` | SCOTLAND |
| 1,190 | `AAAAA` | WALES |
| 516 | `AAAAAAAA AAAAAAA` | NORTHERN IRELAND |
| 35 | `AAAAAA AAAAAA` | UNITED STATES |
| 8 | `AAAAAAAAA` | AUSTRALIA |
| 1 | `AAAAAAA _ AAAAA` | ENGLAND & WALES |

The field is 34.9% empty. Among non-empty values, the data exhibits inconsistent representation of the same concept: "ENGLAND" (37,510 records), "UNITED KINGDOM" (23,478 records), "SCOTLAND" (2,303), "WALES" (1,190), and "NORTHERN IRELAND" (516). Taken together, these five values represent the constituent nations and the overarching sovereign state, but they are not interchangeable — "ENGLAND" and "UNITED KINGDOM" mean different things. Whether this matters depends on the use case, but the inconsistency should at minimum be documented.

There is also one record with "ENGLAND & WALES" — a legal jurisdiction term rather than a country name.

**Recommended treatment:** If the downstream use case requires a single normalised country value, define an allow list mapping the constituent nations to a canonical form. Flag the 35% empties for enrichment from postcode lookup services where possible.

### CompanyCategory

| Count | HU Mask | Example |
|------:|---------|---------|
| 80,155 | `Aaaaaaa Aaaaaaa Aaaaaaa` | Private Limited Company |
| 6,203 | `AAA_AAA AA AAAA_AAA ...` | PRI/LTD BY GUAR... |
| 5,585 | `AAA_AAA_AAA ...` | PRI/LBG/NSC ... |
| 2,823 | `Aaaaaaaaaa Aaaaaaaaaaaa ...` | Charitable Incorporated... |
| 1,375 | `Aaaaaaaaa Aaaaaaaa Aaaaaaa` | Community Interest Company |
| 1,271 | `Aaaaaaa Aaaaaaaaaaa` | Limited Partnership |
| 1,174 | `Aaaaaaa Aaaaaaaaa Aaaaaaaaaaa` | Limited Liability Partnership |
| 455 | `Aaaaaaaa Aaaaaaaaaa ...` | Scottish Charitable... |
| 353 | `Aaaaaaaaaa Aaaaaaa` | Registered Society |
| 115 | `Aaaaaa Aaaaaaa Aaaaaaa` | Public Limited Company |
| 3 | `AAAA AAA AAAA. 99 ...` | PRIV LTD SECT. 30 ... |

This field contains a mix of full descriptive text and coded abbreviations. The majority value "Private Limited Company" (80.2%) uses title case with full words. But the second and third most common values — "PRI/LTD BY GUAR..." (6,203 records) and "PRI/LBG/NSC ..." (5,585 records) — use abbreviated, slash-delimited codes in uppercase. This is a clear case where two different encoding conventions coexist within the same column, likely reflecting changes to the source system over time.

The 3 records matching `AAAA AAA AAAA. 99 ...` with the example "PRIV LTD SECT. 30 ..." are fully uppercase and use a third abbreviation style, further evidence of inconsistent encoding.

**Recommended treatment:** Build a lookup table mapping all abbreviated forms to their full descriptive equivalents. Standardise on one convention (preferably the full text form used by the majority). This is a classification field and should contain a controlled vocabulary.

### CompanyStatus

| Count | HU Mask | Example |
|------:|---------|---------|
| 95,114 | `Aaaaaa` | Active |
| 3,277 | `Aaaaaa - Aaaaaaaa aa Aaaaaa aaa` | Active - Proposal to Strike off |
| 1,507 | `Aaaaaaaaaaa` | Liquidation |
| 61 | `Aa Aaaaaaaaaaaaaa` | In Administration |
| 18 | `Aaaaaaaaa Aaaaaaaaaaa` | Voluntary Arrangement |
| 12 | `Aaaa aaa Aaaaaaaa Aaaaaaa ...` | Live but Receiver Manager... |
| 5 | `Aa Aaaaaaaaaaaaaa_Aaaa...` | In Administration/Receivership |
| 5 | `AAAAAAAAAAAA` | RECEIVERSHIP |

The dominant values use title case ("Active", "Liquidation", "In Administration"). But 5 records show "RECEIVERSHIP" in full uppercase — the only value in the field that uses this casing convention. At LU grain these 5 records stand out clearly as mask `A` against the title-case patterns which produce `Aa` or `Aa Aa`.

**Recommended treatment:** Normalise "RECEIVERSHIP" to title case. This is a controlled vocabulary field and should use consistent casing throughout.

### CountryOfOrigin

| Count | HU Mask | Example |
|------:|---------|---------|
| 99,868 | `Aaaaaa Aaaaaaa` | United Kingdom |
| 41 | `AAAAAA AAAAAA` | UNITED STATES |
| 22 | `AAAAAA AAAAAAA` | VIRGIN ISLANDS |
| 12 | `AAAAA` | JAPAN |
| 10 | `AAAAAAA` | IRELAND |
| 9 | `AAAAAAAAA` | SINGAPORE |
| 7 | `AAAAAA` | JERSEY |
| 5 | `AAAA AA AAA` | ISLE OF MAN |
| 1 | *(empty)* | |
| 1 | `AAAA` | USSR |

This field is 99.87% "United Kingdom" in title case. Every other value is in uppercase: "UNITED STATES", "JAPAN", "IRELAND", "JERSEY", and so on. The casing inconsistency is immediately visible in the HU masks — the dominant value produces `Aaaaaa Aaaaaaa` (mixed case) while all others produce all-uppercase masks. This tells us that "United Kingdom" was likely stored as a default or auto-populated value, while all other countries were entered manually or sourced from a different lookup table.

There is 1 empty record and 1 record containing "USSR" — a country that ceased to exist in 1991, and also "WEST GERMANY" which dissolved in 1990. These are historical artefacts that persist in the register because the company record was created before those countries ceased to exist and was never updated.

**Recommended treatment:** Normalise casing to a single convention. Map historical country names (USSR, WEST GERMANY) to their modern equivalents if downstream systems require current ISO country codes.

### IncorporationDate

| Count | HU Mask | Example |
|------:|---------|---------|
| 99,947 | `99_99_9999` | 15/10/2019 |
| 52 | *(empty)* | |

This is one of the simplest fields to profile. 99,947 records contain a date in `DD/MM/YYYY` format, and 52 are empty. The LU grain confirms this: 99,947 records match `9_9_9` and 52 are blank.

The question is: how can 52 companies have no incorporation date? Every company registered at Companies House must have a date of incorporation. These records likely represent companies migrated from older systems (pre-digital registers), Royal Charter companies, or other entities where the incorporation date predates the structured data capture process. The data is not wrong in the sense of being corrupted — it is genuinely absent from the source, and that absence itself is meaningful metadata.

**Recommended treatment:** Flag the 52 empties for investigation. Do not default them to a placeholder date. Document the absence as a known data gap and, where possible, enrich from historical records.

### Accounts.AccountCategory

| Count | LU Mask | Example |
|------:|---------|---------|
| 30,246 | `A A A` | NO ACCOUNTS FILED |
| 24,534 | *(empty)* | |
| 23,859 | `A A A` | TOTAL EXEMPTION FULL |
| 13,310 | `A` | DORMANT |
| 2,713 | `A A` | UNAUDITED ABRIDGED |
| 2,640 | `A` | SMALL |
| 2,085 | `A` | FULL |
| 374 | `A A A` | TOTAL EXEMPTION SMALL |
| 151 | `A A A` | AUDIT EXEMPTION SUBSIDIARY |
| 40 | `A A A A` | ACCOUNTS TYPE NOT AVAILABLE |
| 38 | `A A` | AUDITED ABRIDGED |
| 6 | `A` | MEDIUM |
| 3 | `A A A` | FILING EXEMPTION SUBSIDIARY |

The field contains 24,534 empty values (24.5% of the population). The non-empty values are all uppercase category labels — "NO ACCOUNTS FILED" (30,246), "TOTAL EXEMPTION FULL" (23,859), "DORMANT" (13,310), and so on. Note that several different values share the same LU mask `A A A`, which illustrates why LU grain alone is not always sufficient — you sometimes need HU grain to distinguish between values that have the same structural shape but different content.

The 40 records categorised as "ACCOUNTS TYPE NOT AVAILABLE" are interesting. Unlike the 24,534 empties, these records have an explicit statement that the account type is unknown. The distinction between "empty" and "not available" is meaningful — one is absence of data, the other is presence of a deliberate classification.

**Recommended treatment:** Investigate whether the 24.5% empties correlate with specific company types (newly incorporated companies that have not yet filed, for example). Treat "ACCOUNTS TYPE NOT AVAILABLE" as a distinct category, not as equivalent to empty.

### SICCode.SicText_1

| Count | HU Mask | Example |
|------:|---------|---------|
| 6,562 | `Aaaa Aaaaaaaa` | None Supplied |
| 4,424 | `99999 - Aaaaa aaaa...` | 82990 - Other business support... |
| 3,824 | `99999 - Aaaaaaaaa aaa...` | 98000 - Residents property... |
| 3,458 | `99999 - Aaaaaa aaaa...` | 56302 - Public houses and bars |
| 3,110 | `99999 - Aaaaaaaaaa aaa...` | 70229 - Management consultancy... |
| 3,028 | `99999 - Aaaaa aaaa...` | 96090 - Other service activities... |
| 2,896 | `99999 - Aaaaaaa Aaaaaaa` | 99999 - Dormant Company... |

This field combines a numeric SIC code with its textual description in a single column, using the format `99999 - Description text`. The HU masks therefore vary primarily by the shape of the description text, not by the structure of the code itself. Each unique description produces a unique HU mask, meaning the top-25 list is effectively a frequency table of the most common SIC code descriptions.

The notable exception is "None Supplied" (6,562 records, 6.6%), which uses title case and has no numeric prefix. This is a placeholder value rather than a valid SIC code, and it stands out clearly in the mask output because its HU pattern (`Aaaa Aaaaaaaa`) contains no digits — it is the only common mask that lacks the leading `99999 -` structure.

Also of interest is the SIC code `99999 - Dormant Company` (2,896 records), which uses a special code number (99999) rather than a standard SIC classification. This code is specific to Companies House and does not appear in the official ONS SIC code list.

**Recommended treatment:** Split this field into two columns — a numeric SIC code and a separate description field — for any analytical use. Flag "None Supplied" records for enrichment where possible. Document the 99999 dormant company code as a Companies House-specific extension to the SIC standard.

## Summary of Findings

| Field | Issue | Records | Action |
|-------|-------|--------:|--------|
| CompanyNumber | Non-standard formats | 2 | Manual review |
| RegAddress.PostCode | Missing space | 12 | Auto-correct |
| RegAddress.PostCode | Trailing punctuation | 2 | Strip |
| RegAddress.PostCode | Foreign postal codes | 4 | Flag for review |
| RegAddress.PostCode | Wrong-column data | 3 | Investigate |
| RegAddress.PostCode | Empty | 4,367 | Enrich from address |
| RegAddress.PostTown | Postcodes in town field | 14 | Column-shift correction |
| RegAddress.PostTown | Street addresses in town field | 42 | Column-shift correction |
| RegAddress.PostTown | Trailing commas/punctuation | 62 | Strip |
| RegAddress.PostTown | Empty | 5,011 | Investigate by company type |
| RegAddress.County | Empty | 61,374 | Acceptable — document |
| RegAddress.County | Trailing punctuation | 84 | Strip |
| RegAddress.County | Postcodes in county field | 18 | Cross-reference |
| RegAddress.County | US state/ZIP data | 23 | Flag for review |
| RegAddress.County | Placeholder text | 8 | Remove |
| RegAddress.Country | Inconsistent country naming | 23,478 | Normalise with lookup |
| RegAddress.Country | Empty | 34,930 | Enrich from postcode |
| RegAddress.Country | Historical country names | 2 | Map to modern |
| CompanyCategory | Mixed encoding conventions | 11,791 | Map abbreviations to full text |
| CompanyStatus | Inconsistent casing | 5 | Normalise to title case |
| CountryOfOrigin | Mixed casing conventions | 131 | Normalise |
| CountryOfOrigin | Historical country names | 2 | Map to modern |
| IncorporationDate | Missing | 52 | Investigate — do not default |
| Accounts.AccountCategory | Empty | 24,534 | Investigate by company type |
| SICCode.SicText_1 | None Supplied | 6,562 | Enrich or flag |
| SICCode.SicText_1 | Combined code and description | 93,437 | Split into two fields |

## Lessons Learned

This worked example, drawn entirely from a single real-world dataset, demonstrates several principles that recur throughout data quality practice.

First, the cliff point is real and it is consistent. In field after field — PostCode, PostTown, County, CompanyCategory — we see the same pattern: a small number of masks covering the vast majority of the population, then a sharp drop to a long tail of exceptions. The cliff point is not a theoretical construct; it is a visible, measurable feature of real data, and it tells us exactly where to draw the line between expected patterns and items requiring investigation.

Second, wrong-column data is more common than most people expect. We found postcodes in the PostTown field, postcodes in the County field, street addresses in the PostTown field, US ZIP codes in the County field, and placeholder text where a county should be. These are not exotic edge cases — they appear in a well-maintained government register. In less carefully curated datasets they will be more prevalent still.

Third, controlled vocabulary fields are rarely as controlled as they should be. CompanyCategory mixes full descriptive text with coded abbreviations. CompanyStatus mixes title case with uppercase. CountryOfOrigin uses title case for the dominant value and uppercase for everything else. RegAddress.Country cannot decide between "ENGLAND" and "UNITED KINGDOM." These inconsistencies are invisible to traditional schema validation (the field accepts a string and all values are strings) but immediately visible to mask-based profiling.

Fourth, empty is not the same as absent, and absent is not the same as wrong. The 52 companies with no incorporation date are not errors — they are historical artefacts. The 24,534 empty account categories may be newly incorporated companies that have not yet filed. The 61,374 empty counties are legitimate because UK postal addresses do not require a county. Understanding *why* a field is empty is as important as knowing *that* it is empty, and the profiling output gives us the context to ask the right questions.

Finally, mask-based profiling scales. We profiled 99,999 rows across dozens of fields using two simple command-line invocations. The output is a frequency table — compact, sortable, and immediately interpretable. No rules needed to be written in advance, no schema needed to be defined, no expectations needed to be configured. The data told us what it contained, and the masks told us where to look. This is the core promise of Data Quality on Read: let the data speak first, then decide what to do about it.
