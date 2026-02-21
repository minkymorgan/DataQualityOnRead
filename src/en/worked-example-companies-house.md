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

## Structure Discovery: Column Population Analysis

Before examining mask patterns, we count non-null values per column. For a tabular dataset this is the equivalent of the field path population analysis we perform on nested JSON — it tells us the shape of the data before we look at what is in it. In a pipe-delimited file with 55 columns, many of those columns will be sparsely populated, and knowing which ones are empty (and how empty) is the first step in understanding the dataset.

```
Column                                        Non-Null  % Populated
----------------------------------------------------------------------
CompanyName                                      99,999     100.0%
CompanyNumber                                    99,999     100.0%
CompanyCategory                                  99,999     100.0%
CompanyStatus                                    99,999     100.0%
CountryOfOrigin                                  99,998     100.0%
Mortgages.NumMortCharges                         99,999     100.0%
Mortgages.NumMortOutstanding                     99,999     100.0%
Mortgages.NumMortPartSatisfied                   99,999     100.0%
Mortgages.NumMortSatisfied                       99,999     100.0%
SICCode.SicText_1                                99,999     100.0%
LimitedPartnerships.NumGenPartners               99,999     100.0%
LimitedPartnerships.NumLimPartners               99,999     100.0%
URI                                              99,999     100.0%
IncorporationDate                                99,947      99.9%
ConfStmtNextDueDate                              96,331      96.3%
RegAddress.AddressLine1                          96,168      96.2%
RegAddress.PostCode                              95,632      95.6%
RegAddress.PostTown                              94,988      95.0%
Accounts.AccountRefDay                           94,821      94.8%
Accounts.AccountRefMonth                         94,821      94.8%
Returns.NextDueDate                              94,672      94.7%
Accounts.NextDueDate                             94,610      94.6%
ConfStmtLastMadeUpDate                           77,078      77.1%
Accounts.AccountCategory                         75,465      75.5%
Accounts.LastMadeUpDate                          69,539      69.5%
RegAddress.Country                               65,069      65.1%
RegAddress.AddressLine2                          63,688      63.7%
Returns.LastMadeUpDate                           45,896      45.9%
RegAddress.County                                38,625      38.6%
SICCode.SicText_2                                12,406      12.4%
PreviousName_1.CONDATE                           11,469      11.5%
PreviousName_1.CompanyName                       11,469      11.5%
SICCode.SicText_3                                 4,747       4.7%
SICCode.SicText_4                                 2,040       2.0%
PreviousName_2.CONDATE                            1,888       1.9%
PreviousName_2.CompanyName                        1,888       1.9%
RegAddress.CareOf                                 1,699       1.7%
PreviousName_3.CONDATE                              379       0.4%
PreviousName_3.CompanyName                          379       0.4%
RegAddress.POBox                                    258       0.3%
PreviousName_4.CONDATE                               69       0.1%
PreviousName_4.CompanyName                           69       0.1%
PreviousName_5.CONDATE                               25       0.0%
PreviousName_5.CompanyName                           25       0.0%
PreviousName_6.CONDATE                                6       0.0%
PreviousName_6.CompanyName                            6       0.0%
PreviousName_7.CONDATE                                2       0.0%
PreviousName_7.CompanyName                            2       0.0%
PreviousName_8.CONDATE                                0       0.0%
PreviousName_8.CompanyName                            0       0.0%
PreviousName_9.CONDATE                                0       0.0%
PreviousName_9.CompanyName                            0       0.0%
PreviousName_10.CONDATE                               0       0.0%
PreviousName_10.CompanyName                           0       0.0%
DissolutionDate                                       0       0.0%
```

The core identity fields — CompanyName, CompanyNumber, CompanyCategory, CompanyStatus, CountryOfOrigin — are 100% populated, or 99.998% in the case of CountryOfOrigin, which has exactly one empty record out of 99,999. These are the registration fundamentals, the columns that define what a company is before we know anything else about it. The four Mortgages columns and two LimitedPartnerships columns are also 100% populated, though as we will see in the field-by-field analysis, "populated" does not mean "informative" — most of these contain zeros. A column that is universally present but universally zero is telling us something about the schema rather than about the companies.

The address block reveals a clear hierarchy of completeness. AddressLine1 (96.2%) and PostCode (95.6%) are near-universal, PostTown follows at 95.0%, then Country drops to 65.1%, AddressLine2 to 63.7%, and County falls to just 38.6%. County is the most sparsely populated address field, which we will confirm in the field-by-field analysis — but the population table already tells us that more than 60% of companies have no county recorded. This is not a data quality issue in the traditional sense; counties are increasingly optional in UK postal addresses and many companies simply do not provide one. The distinction matters: a field that is empty because the information was never required is fundamentally different from a field that is empty because something went wrong.

The SIC code columns tell a story of diminishing specificity. SicText_1 is 100% populated (though 6,562 of those values are "None Supplied", which we will return to later), SicText_2 drops to 12.4%, SicText_3 to 4.7%, and SicText_4 to just 2.0%. Most companies declare a single industry classification. The 12.4% with a second SIC code are companies operating across multiple sectors — a recruitment agency that also provides training, for example. By the fourth code, only 2,040 companies remain, and these tend to be diversified conglomerates or holding companies with genuinely distinct lines of business.

The PreviousName columns are the tabular equivalent of a ragged nested array. The schema allocates 10 slots (PreviousName_1 through PreviousName_10), but population drops exponentially: 11.5% of companies have changed name at least once, 1.9% at least twice, 0.4% three times, and by PreviousName_7 we are down to 2 companies. PreviousName_8 through PreviousName_10 are completely empty — no company in this extract has changed its name eight or more times. This is a classic schema design problem: pre-allocating fixed columns for a variable-length list. In nested JSON, this would be a single array of arbitrary length. In a flat file, it wastes 6 entirely empty column pairs and forces a hard limit of 10 name changes. The population analysis makes the waste visible at a glance.

DissolutionDate is 0% populated across all 99,999 records, and this single observation tells us something important about the extract itself: this file contains only active companies. Dissolved companies would have a dissolution date. The column exists in the schema but is structurally empty in this particular data slice. This is the kind of insight that saves hours of investigation — you do not need to wonder whether dissolved companies are included, or build filters to exclude them. The population analysis answers that question before you read a single value.

The accounts and returns fields show two tiers of completeness that reveal something about the lifecycle of a company. The "next due" dates (AccountRefDay, AccountRefMonth, NextDueDate, Returns.NextDueDate) cluster around 94–95% — these are forward-looking obligations that exist for almost every active company. But the "last made up" dates tell a different story: Accounts.LastMadeUpDate is 69.5% and Returns.LastMadeUpDate drops to just 45.9%. The gap between "when you must file" and "when you last filed" reveals that roughly 30% of companies have never filed accounts and 54% have never filed a return. These are most likely recently incorporated companies that have not yet reached their first filing deadline — they have obligations but no history of meeting them yet.

## Field-by-Field Analysis

### Company Number

```
Mask     Count      %       Example
9       87,730   87.7%      12432873
A9      12,145   12.1%      GE000152
A9A        124    0.1%      IP28746R
```

Three masks, no cliff point needed — with only three patterns, every one is worth understanding.

The dominant format `9` (87.7%) represents standard company numbers — eight numeric digits like `12432873`. The `A9` pattern (12.1%) covers companies with letter prefixes: `GE000152` (German registered), `SC` (Scottish), `NI` (Northern Ireland), `OC` (overseas companies), and similar jurisdiction indicators. The rare `A9A` pattern (0.1%, 124 records) covers industrial and provident societies with a trailing letter, such as `IP28746R`.

**Issues found:** None. This is a well-structured identifier with consistent formatting. The three patterns are all legitimate and well-documented. A good assertion rule would validate that the prefix letters match known jurisdiction codes.

### Registered Address: Postcode

```
Mask              Count      %       % of Prev   Example
A9 9A            88,252   88.3%          —        L23 0RG
A9A 9A            7,347    7.3%        8.3%       W1W 7LT
(empty)           4,367    4.4%       59.4%
A9A                  12    0.0%        0.3%       GU478QN          ← cliff point
A9                    3    0.0%       25.0%       BB14006
9                     3    0.0%      100.0%       0255
9 9                   3    0.0%      100.0%       19 904
A9 9A.                2    0.0%       66.7%       BR7 5HF.
A9 9 A                2    0.0%      100.0%       WR9 9 AY
A9 A                  2    0.0%      100.0%       BA14 HHD
A9A9A                 1    0.0%       50.0%       EC1V2NX
A_A9 9A               1    0.0%      100.0%       L;N9 6NE
A 9                   1    0.0%      100.0%       BLOCK 3
A 9A                  1    0.0%      100.0%       CRO 9XP
9A A                  1    0.0%      100.0%       2L ONE
A9A 9 A               1    0.0%      100.0%       EC1V 1 NR
```

This field is analysed in detail in Chapter 6 using the HU (high-grain) profile, which separates the five standard UK postcode formats. At LU grain, those five formats collapse into two masks: `A9 9A` (the standard pattern, e.g. `L23 0RG`) and `A9A 9A` (formats where the outward code ends in a letter, like `W1W 7LT`).

The cliff drops from 7,347 to 12 — a percentage-of-previous of **0.3%**. Everything below is a data quality issue:

- `A9A` (12 records, e.g. `GU478QN`) — valid postcodes with the space missing. **Treatment:** insert space before the inward code.
- `A9 9A.` (2 records, e.g. `BR7 5HF.`) — trailing full stop. **Treatment:** strip trailing punctuation.
- `A9 9 A` (2 records, e.g. `WR9 9 AY`) — extra space in the inward code. **Treatment:** normalise whitespace.
- `A9A9A` (1 record: `EC1V2NX`) — a valid postcode with all spaces removed. **Treatment:** insert space before the inward code.
- `A_A9 9A` (1 record: `L;N9 6NE`) — semicolon in the postcode, likely a typo for `LN9 6NE`. **Treatment:** character substitution rule.
- `A 9` (1 record: `BLOCK 3`) — not a postcode at all. Address fragment in the wrong field.
- `A 9A` (1 record: `CRO 9XP`) — likely a miskeyed `CR0 9XP` where the digit zero was typed as the letter O. **Treatment:** character substitution.
- `9A A` (1 record: `2L ONE`) — not a postcode. Investigate source record.
- `9` and `9 9` (3 each, e.g. `0255`, `19 904`) — numeric values, likely foreign postal codes or phone number fragments.

### Registered Address: Post Town

```
Mask              Count      %       Example
A                84,153   84.2%      READING
A A               6,299    6.3%      HEBDEN BRIDGE
(empty)           5,011    5.0%
A A A             1,585    1.6%      STOCKTON ON TEES
A-A-A             1,428    1.4%      STOCKTON-ON-TEES
A. A                350    0.4%      ST. HELENS
A_A A               184    0.2%      KING'S LYNN
A A. A              179    0.2%      OTTERY ST. MARY
A, A                151    0.2%      MERSEYSIDE,...
A A A A              79    0.1%      HARROW ON THE...
A A, A               78    0.1%      BILLINGTON ROAD,...
A,                   62    0.1%      LONDON,
A-A-A-A              60    0.1%      ASHBY-DE-LA-ZOUCH
A-A                  44    0.0%      (various)
A. A-A-A             43    0.0%      ST. (various)
9 A A                32    0.0%      150 HOLYWOOD ROAD
A _ A                26    0.0%      BRIGHTON & HOVE
A9 9A                14    0.0%      EH47 8PG
9-9 A A              10    0.0%      1-7 KING STREET
A 9                  10    0.0%      LEEDS 4
A9A 9A                3    0.0%      W1K 5SL
9                     2    0.0%      20037
A 9-9                 1    0.0%      CT 0633-4409
9A A                  1    0.0%      2ND FLOOR
```

...and 75 more masks.

The top five masks are all legitimate town name patterns: single words (`READING`), two words (`HEBDEN BRIDGE`), three words (`STOCKTON ON TEES`), hyphenated forms (`STOCKTON-ON-TEES`), and abbreviated forms (`ST. HELENS`). Together they cover 98.5% of records.

Below the cliff, things get interesting:

- `A, A` (151 records, e.g. `MERSEYSIDE,...`) — town with trailing county or region, comma-separated. The town field is being used to store town-plus-county.
- `A,` (62 records, e.g. `LONDON,`) — trailing comma, as if the value was split from a comma-separated address string but the comma came along for the ride. **Treatment:** strip trailing punctuation.
- `9 A A` (32 records, e.g. `150 HOLYWOOD ROAD`) — a street address, not a town. Data in the wrong field entirely.
- `A9 9A` (14 records, e.g. `EH47 8PG`) — a **postcode** in the town field. Classic column misalignment.
- `9-9 A A` (10 records, e.g. `1-7 KING STREET`) — street addresses in the town field.
- `A 9` (10 records, e.g. `LEEDS 4`) — historic postal district format. Legitimate but archaic.
- `A9A 9A` (3 records, e.g. `W1K 5SL`) — another postcode in the town field.
- `9` (2 records, e.g. `20037`) — a US ZIP code in the town field.
- `9A A` (1 record: `2ND FLOOR`) — a floor number. Not a town by any definition.

**Key finding:** At least 59 records have postcodes or street addresses in the town field, indicating systematic column misalignment in a subset of the source data.

### Registered Address: County

```
Mask              Count      %       Example
(empty)          61,374   61.4%
A                30,482   30.5%      HERTFORDSHIRE
A A               6,948    6.9%      WEST MIDLANDS
A A A               626    0.6%      ENGLAND AND WALES
A. A                111    0.1%      CO. DURHAM
A _ A               104    0.1%      TYNE & WEAR
A.                   49    0.0%      KENT.
A A A A              40    0.0%      EAST RIDING OF...
A,                   35    0.0%      WORCESTER,
A-A                  33    0.0%      INVERNESS-SHIRE
A, A                 22    0.0%      HARROW, MIDDLESEX
A 9                  14    0.0%      DELAWARE 19801
A9 9A                11    0.0%      N3 2SB
A-A-A                10    0.0%      STOKE-ON-TRENT
9                     9    0.0%      100031
A _A_                 8    0.0%      COUNTY (OPTIONAL)
A.A                   7    0.0%      S.GLAMORGAN
A. A.                 7    0.0%      CO. ANTRIM.
A9                    7    0.0%      WC1
A A 9                 6    0.0%      NEW YORK 10286
-                     3    0.0%      -
A 9 A                 3    0.0%      WY 82001 USA
A.A.A.                3    0.0%      R.C.T.
A 9-9                 3    0.0%      TOKYO 100-8051
A. A9 9A              2    0.0%      WILTSHIRE. SN14...
A9 9A.                2    0.0%      DN1 2HD.
A.A.                  2    0.0%      U.K.
A A.                  2    0.0%      WEST YORKS.
-A-                   1    0.0%      --SELECT--
.                     1    0.0%      .
A9A 9A                1    0.0%      LONDONWC1X 8JX
- -                   1    0.0%      - -
A. A9A                1    0.0%      CAMBS. PE189QX
A.A.A9 9A             1    0.0%      N.WALES.LL15 1LG
A - A                 1    0.0%      ENGLAND - UK
_A A, A A A_          1    0.0%      [OUTSIDE US, ENTER COUNTY HERE]
```

The county field is 61.4% empty — expected, since counties are increasingly optional in UK addresses. The legitimate patterns (`A`, `A A`, `A A A`) cover 97.8% of populated values.

Below the cliff, a catalogue of problems:

- `A.` (49 records, e.g. `KENT.`) — trailing full stop on county names. **Treatment:** strip trailing punctuation.
- `A,` (35 records, e.g. `WORCESTER,`) — trailing comma. **Treatment:** strip trailing punctuation.
- `A 9` (14 records, e.g. `DELAWARE 19801`) — US state with ZIP code. Foreign address data in the county field.
- `A9 9A` (11 records, e.g. `N3 2SB`) — UK postcodes in the county field. Column misalignment again.
- `9` (9 records, e.g. `100031`) — pure numeric. Likely foreign postal codes.
- `A _A_` (8 records: `COUNTY (OPTIONAL)`) — placeholder text left by a web form. The literal string "COUNTY (OPTIONAL)" was submitted as the county value.
- `A A 9` (6 records, e.g. `NEW YORK 10286`) — US city with ZIP code.
- `A 9-9` (3 records, e.g. `TOKYO 100-8051`) — Japanese address data. This is not a UK county.
- `-` (3 records) and `- -` (1 record) — dash placeholders, the universal "I had to put something in this field."
- `A. A9 9A` (2 records, e.g. `WILTSHIRE. SN14...`) — county with postcode appended.
- `A9 9A.` (2 records, e.g. `DN1 2HD.`) — a postcode with a trailing full stop, in the county field.
- `-A-` (1 record: `--SELECT--`) — a web form dropdown placeholder that was submitted as data. Someone's browser rendered a `<select>` element, they left it on the default option, and the literal text `--SELECT--` was persisted to the database.
- `A9A 9A` (1 record: `LONDONWC1X 8JX`) — an entire postcode, concatenated with the city name, stuffed into the county field.
- `A. A9A` (1 record: `CAMBS. PE189QX`) — an abbreviated county with a postcode jammed onto the end.
- `A.A.A9 9A` (1 record: `N.WALES.LL15 1LG`) — abbreviated region with an unseparated postcode.
- `_A A, A A A_` (1 record: `[OUTSIDE US, ENTER COUNTY HERE]`) — instructional placeholder text from a web form, complete with square brackets, submitted as the actual county value.

**Key finding:** The county field is a dumping ground. Web form placeholders (`COUNTY (OPTIONAL)`, `--SELECT--`, `[OUTSIDE US, ENTER COUNTY HERE]`), foreign addresses (`DELAWARE 19801`, `NEW YORK 10286`, `TOKYO 100-8051`), postcodes, and trailing punctuation all appear. This single field demonstrates why profiling by masks is more effective than regex validation — the variety of failure modes is too diverse for any reasonable set of hand-written rules to catch.

### Registered Address: Country

```
Mask              Count      %       Example
A                41,019   41.0%      ENGLAND
(empty)          34,930   34.9%
A A              24,039   24.0%      UNITED KINGDOM
A A A                 5    0.0%      ISLE OF MAN
A A, A                5    0.0%      VIRGIN ISLANDS,...
A _ A                 1    0.0%      ENGLAND & WALES
```

Three legitimate patterns that together account for 99.97% of records. But there is a consistency problem: `A` (41,019) covers single-word countries like `ENGLAND`, `SCOTLAND`, `WALES`, while `A A` (24,039) covers `UNITED KINGDOM`. These are the same country expressed differently — some records say `ENGLAND`, others say `UNITED KINGDOM`, and 34.9% say nothing at all.

Below the cliff:

- `A A A` (5 records, e.g. `ISLE OF MAN`) — legitimate, just rare.
- `A A, A` (5 records, e.g. `VIRGIN ISLANDS,...`) — legitimate but includes comma formatting.
- `A _ A` (1 record: `ENGLAND & WALES`) — a jurisdiction description, not a country name. This is what someone writes when they are not sure which constituent nation to pick.

**Key finding:** The real issue here is not the exceptions — it is the inconsistency between `ENGLAND` and `UNITED KINGDOM` as country values. A treatment function should normalise these to a single canonical form (such as ISO 3166 country code `GB`).

### Company Category

```
Mask                                               Count      %       Example
Aa Aa Aa                                          85,872   85.9%      Private Limited Company
A_A A A_A _Aa, a a a, a a a_                       6,203    6.2%      PRI/LTD BY GUAR/NSC (Private, limited by guarantee, no share capital)
A_A_A _Aa, Aa a a, a a a, a a _Aa_ a_              5,585    5.6%      PRI/LBG/NSC (Private, Limited by guarantee, no share capital, use of 'Limited' exemption)
Aa Aa                                               1,631    1.6%      Limited Partnership
Aa Aa Aa Aa                                           455    0.5%      Scottish Limited Partnership
Aa a a                                                137    0.1%      Other company type
Aa Aa a Aa Aa                                          89    0.1%      Investment Company with Variable Capital
A A A. 9 _Aa a a, a 9 a a Aa Aa_                       3    0.0%      PRIV LTD SECT. 30 (Private limited company, section 30 of the Companies Act)
```

Two formatting conventions exist side by side: human-readable title case (`Private Limited Company`, 85.9%) and coded abbreviations with parenthetical expansions (`PRI/LTD BY GUAR/NSC (Private, limited by guarantee, no share capital)`, 6.2%; `PRI/LBG/NSC (Private, Limited by guarantee, no share capital, use of 'Limited' exemption)`, 5.6%). The coded forms use slashes, parentheses, and abbreviations — a completely different format from the title case descriptions.

The 3-record `PRIV LTD SECT. 30` mask is a third variation: all-caps abbreviation with a section number reference and a parenthetical expansion. Three encoding schemes in a single column.

**Key finding:** This field has multiple distinct encoding schemes coexisting. A treatment function should either expand the abbreviations to full text or code the full text to abbreviations, depending on the consumer's needs. The profiler has discovered what no schema definition would tell you: the field is not consistently formatted.

### Company Status

```
Mask                                Count      %       Example
Aa                                 96,621   96.6%      Active
Aa - Aa a Aa a                      3,277    3.3%      Active - Proposal to Strike off
Aa Aa                                  79    0.1%      Voluntary Arrangement
Aa a Aa Aa a a a a a                   12    0.0%      Live but Receiver Manager on at least one charge
Aa Aa_Aa Aa                             5    0.0%      In Administration/Administrative Receiver
A                                       5    0.0%      RECEIVERSHIP
```

96.6% of companies are `Active`. The `A` mask (5 records: `RECEIVERSHIP`) is the only ALL-CAPS value in a field that otherwise uses title case. This is a minor casing inconsistency — but it is the kind of thing that breaks a `CASE WHEN` statement or a join on status values. A downstream query looking for `WHERE status = 'Receivership'` will silently miss these five records.

**Treatment:** Normalise casing to title case.

### Country of Origin

```
Mask              Count      %       Example
Aa Aa            99,868   99.9%      United Kingdom
A A                  78    0.1%      SOUTH KOREA
A                    45    0.0%      AUSTRALIA
A A A                 6    0.0%      UNITED ARAB EMIRATES
A A, A                1    0.0%      VIRGIN ISLANDS, BRITISH
(empty)               1    0.0%
```

99.87% of records show `United Kingdom` in title case. The remaining 131 records use ALL-CAPS (`SOUTH KOREA`, `AUSTRALIA`, `UNITED ARAB EMIRATES`). This is the same field in the same dataset using two different casing conventions — title case for UK records, all-caps for foreign origins.

One record is completely empty — a company with no country of origin recorded.

**Treatment:** Normalise casing. Consider mapping to ISO 3166 country codes for consistency.

### Incorporation Date

```
Mask              Count      %       Example
9_9_9            99,947   99.9%      07/12/2016
(empty)              52    0.1%
```

99.95% of records have a date in `DD/MM/YYYY` format (which LU collapses to `9_9_9`, as in `07/12/2016`). But 52 companies have **no incorporation date**. How does a registered company not have an incorporation date? These are likely very old companies (pre-dating digital records) or special entity types where the concept does not apply. Worth investigating but not necessarily an error.

**Action:** Flag for review. These 52 records are genuine edge cases in the domain, not data entry errors.

### Accounts Category

```
Mask              Count      %       Example
A A A            54,633   54.6%      NO ACCOUNTS FILED
(empty)          24,534   24.5%
A                18,041   18.0%      GROUP
A A               2,751    2.8%      UNAUDITED ABRIDGED
A A A A              40    0.0%      ACCOUNTS TYPE NOT AVAILABLE
```

The dominant value is `NO ACCOUNTS FILED` (54.6%), followed by empty (24.5%) and single-word categories like `GROUP` (18.0%), then two-word categories like `UNAUDITED ABRIDGED` (2.8%). The 40 records matching `A A A A` are literally `ACCOUNTS TYPE NOT AVAILABLE` — a system-generated placeholder rather than a real category.

No structural data quality issues here — the patterns are all legitimate. But the 24.5% empty rate is worth noting: nearly a quarter of companies have no accounts category recorded. This could indicate recently incorporated companies that have not yet filed.

### SIC Code

```
Mask                                  Count      %       Example
9 - Aa a a a                        17,112   17.1%      59111 - Motion picture production activities
9 - Aa a a                          11,233   11.2%      93199 - Other sports activities
9 - Aa a                             8,558    8.6%      55900 - Other accommodation
9 - Aa a a a a a.a.a.                7,068    7.1%      94990 - Activities of other membership organisations n.e.c.
9 - Aa a a a a                       6,959    7.0%      46450 - Wholesale of perfume and cosmetics
Aa Aa                                 6,562    6.6%      None Supplied
9 - Aa a a a a a a                    5,875    5.9%      70229 - Management consultancy activities (other than financial management)
9 - Aa a a a a a a a a a              3,935    3.9%      68320 - Management of real estate on a fee or contract basis
9 - Aa a a a.a.a.                     3,064    3.1%      96090 - Other personal service activities n.e.c.
9 - Aa Aa                             2,896    2.9%      99999 - Dormant Company
```

...and 143 more masks (153 total).

The SIC code field combines a 5-digit code with a human-readable description: `59111 - Motion picture production activities`. The LU masks vary because the descriptions vary in word count, punctuation, and casing. There are 153 unique masks — high cardinality driven by the diversity of SIC code descriptions.

The outlier is `Aa Aa` (6,562 records): `None Supplied`. These are companies that registered without providing a SIC code. The mask tells us immediately that this value is structurally different from every other entry — it has no leading numeric code and no dash separator. A simple assertion rule could flag it: if the SIC code does not start with digits, it is not a valid code.

**Key finding:** The SIC code field is a composite field — a code and a description packed into a single column. The profiler cannot separate these without domain logic, but it can tell you that the structure is consistent across 93.4% of records and that `None Supplied` is the primary exception.

## Summary of Findings

Issues discovered through mask-based profiling of 99,999 Companies House records:

**Postcodes:**
- Missing spaces in valid postcodes (12 records, e.g. `GU478QN`) → **Treatment:** insert space
- Trailing punctuation (2 records, e.g. `BR7 5HF.`) → **Treatment:** strip trailing characters
- Extra whitespace (2 records, e.g. `WR9 9 AY`) → **Treatment:** normalise whitespace
- Typos/special characters (1 record: `L;N9 6NE` with semicolon) → **Treatment:** character substitution
- Non-postcode data in postcode field (5 records, e.g. `BLOCK 3`, `2L ONE`) → **Flag** for review

**Post Town:**
- Postcodes in town field (17+ records, e.g. `EH47 8PG`, `W1K 5SL`) → **Flag:** column misalignment
- Street addresses in town field (42+ records, e.g. `150 HOLYWOOD ROAD`, `1-7 KING STREET`) → **Flag:** column misalignment
- Trailing commas and punctuation (62+ records, e.g. `LONDON,`) → **Treatment:** strip trailing punctuation
- Non-address data (1 record: `2ND FLOOR`) → **Flag** for review

**County:**
- Trailing punctuation (84 records, e.g. `KENT.`, `WORCESTER,`) → **Treatment:** strip trailing characters
- Postcodes in county field (11 records, e.g. `N3 2SB`) → **Flag:** column misalignment
- Foreign address data (20+ records, e.g. `DELAWARE 19801`, `NEW YORK 10286`, `TOKYO 100-8051`) → **Flag:** non-UK addresses
- Web form placeholders: `COUNTY (OPTIONAL)`, `--SELECT--`, `[OUTSIDE US, ENTER COUNTY HERE]` (10 records) → **Treatment:** replace with empty
- Dash placeholders (4 records) → **Treatment:** replace with empty

**Country:**
- Inconsistent representation: `ENGLAND` vs `UNITED KINGDOM` vs empty → **Treatment:** normalise to ISO country code
- 34.9% empty → **Accept** (empty is valid for this field)

**Company Category:**
- Multiple encoding schemes (human-readable `Private Limited Company` vs coded `PRI/LTD BY GUAR/NSC` vs `PRIV LTD SECT. 30`) → **Treatment:** normalise to single format

**Company Status:**
- Inconsistent casing: `RECEIVERSHIP` vs `Active` → **Treatment:** normalise to title case

**Country of Origin:**
- Inconsistent casing: `United Kingdom` (title case) vs `SOUTH KOREA` (all-caps) → **Treatment:** normalise casing

**Incorporation Date:**
- 52 records with no date → **Flag** for investigation (likely pre-digital or special entity types)

**SIC Code:**
- 6,562 records with `None Supplied` instead of a code → **Assertion rule:** SIC code must start with digits

## Lessons Learned

**1. Government data is not clean data.** This is an official register maintained by a statutory body. It is well-structured by the standards of real-world data, and it still contains web form placeholders (`--SELECT--`, `COUNTY (OPTIONAL)`, `[OUTSIDE US, ENTER COUNTY HERE]`), column misalignment (postcodes in the town and county fields), inconsistent casing, trailing punctuation, and foreign address fragments. If Companies House data has these issues, every dataset you receive will have them.

**2. Mask profiling finds issues that schemas cannot.** A schema tells you the postcode field is a string. Mask profiling tells you that 16 of the 99,999 records have structural anomalies — and shows you exactly what each one looks like. The postcode field has a single dominant pattern covering 88.3% of records, and every deviation from it is immediately visible in the mask frequency table.

**3. The cliff point works.** In every field with more than a handful of masks, the frequency distribution showed a clear separation between expected patterns and exceptions. The postcode cliff (7,347 → 12), the county cliff (104 → 49), the post town cliff (151 → 79) — each one cleanly separates the normal from the exceptional.

**4. Column misalignment is a real and common problem.** Postcodes appearing in the town field, street addresses appearing in the town field, postcodes appearing in the county field — these are not random errors. They indicate systematic problems in how data was entered, migrated, or mapped between systems. Mask profiling detects them instantly because the structural pattern of a postcode (`A9 9A`) is unmistakable when it appears in a field full of alphabetic town names (`A`).

**5. Real examples make the conversation possible.** Every mask in the frequency table maps to a real value. When you can point to `--SELECT--` in the county field, or `150 HOLYWOOD ROAD` in the post town field, or `TOKYO 100-8051` as a UK county, the conversation with data owners moves from abstract ("there are quality issues") to concrete ("here are the specific records, here is what happened, here is how we fix it"). The examples are the evidence. Without them, you have statistics. With them, you have a story.

**6. One profiling run, twenty minutes, real insight.** The entire analysis in this appendix was generated from a single `bytefreq` command that took seconds to run. The interpretation took longer, but the profiler did all the heavy lifting: it found the patterns, counted them, sorted them by frequency, and provided examples. Every issue catalogued above was visible in the raw output without writing a single validation rule.
