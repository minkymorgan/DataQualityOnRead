# Treatment Functions and the Quality Loop

Profiling tells you what is in the data. Masks as error codes tell you what is wrong. **Treatment functions** close the loop by defining what to do about it.

The key principle is that treatment is mask-driven. Each error mask, for a given column, maps to a specific remediation action. The mask is the lookup key, the column provides the context, and the treatment function provides the correction. This three-part mapping — (column, mask) → treatment — is the operational core of the DQOR framework.

## Common Treatments

The treatments themselves are usually straightforward. Most data quality problems, once identified, have obvious corrections.

**Format normalisation** handles data that is correct but inconsistently formatted. A customer name with the mask `AAAA AAAAA` (all uppercase) is structurally valid as a name but stylistically inconsistent with the dominant mask `Aaaa Aaaaa` (title case). The treatment is `title_case()`: transform `JOHN SMITH` to `John Smith`. Similarly, a name with the mask `aaaa aaaaa` (all lowercase) receives the same treatment. The original value is preserved in the `.raw` column; the normalised value is placed in a treatment column alongside it.

A real-world example from the French lobbyist registry illustrates. The country field (`pays`) contains `FRANCE` (375 records), `France` (22 records), and `france` (1 record) — three LU masks (`A`, `Aa`, `a`) for what is semantically a single value. The title-case treatment normalises all three to `France`. The role field shows the same pattern at a larger scale: `Vice-Président` and `Vice-président` coexist as `Aa-Aa` and `Aa-a` — identical meaning, different capitalisation after the hyphen. (See the Worked Example: Profiling the French Lobbyist Registry appendix.)

**Whitespace trimming** removes leading or trailing spaces that should not be present. A mask of `Aaaa Aaaaa ` (note the trailing space) is structurally almost identical to the expected `Aaaa Aaaaa`, and the treatment is simply `trim()`. These cases are common in data extracted from fixed-width file formats where field padding was not stripped during extraction.

In the UK Companies House data, the postcode field reveals several whitespace variants. The mask `A9 9 A` (2 records, e.g. `WR9 9 AY`) has an extra space in the inward code. The mask `A9 9A.` (2 records, e.g. `BR7 5HF.`) has trailing punctuation. And `A9A` (12 records, e.g. `GU478QN`) is a valid postcode with the required space missing entirely. Each mask triggers a specific treatment: normalise the internal spacing, strip the trailing dot, insert the missing space before the three-character inward code. The mask determines the treatment, and the treatment is deterministic — no ambiguity, no special cases, just a mechanical correction driven by the structural fingerprint. (See the Worked Example: Profiling UK Companies House Data appendix.)

**Placeholder replacement** converts sentinel values to proper nulls. Values with masks like `A/A` (`N/A`), `aaaa` (`null`, `none`), `---` (decorative dashes), or the empty string are all encoding the same semantic concept — "this field has no value" — using different textual representations. The treatment is to replace them with an actual null, ensuring that downstream null-handling logic works correctly.

**Quarantine** isolates records that are too broken to fix automatically. A value with the mask `99999` in a name column, or `aaaa://aaa.aaa.aaa` (a URL) in an address column, indicates data that is not just poorly formatted but fundamentally in the wrong field. These records are routed to a restricted quarantine area where administrators with appropriate access rights can examine the raw data, determine the root cause, and propose corrective measures. Quarantine is especially important for records where data quality failures indicate potential privacy issues — for example, free-text fields containing credit card numbers or unmasked personal identifiers.

The Companies House `RegAddress.PostTown` field provides a clear quarantine case. Among the 100,000 records, 14 have the mask `A9 9A` — postcodes like `EH47 8PG` appearing in the town name field. Another 32 have `9 A A` — street addresses like `150 HOLYWOOD ROAD`. And one record has `9A A`: the value `2ND FLOOR`. These are not formatting problems that can be corrected automatically. They represent data in the wrong column — column misalignment in the source system — and the only safe action is quarantine for manual review. The masks tell you not just that something is wrong, but what kind of wrong it is: `A9 9A` in a town field says 'this is a postcode', which is a fundamentally different problem from `A,` in a town field which says 'this is a town with trailing punctuation'. (See the Worked Example: Profiling UK Companies House Data appendix.)

## The Treatment Pipeline

A treatment pipeline for a single field follows a simple pattern:

1. Read the raw value.
2. Generate its mask.
3. Look up the treatment function for that (column, mask) combination.
4. Apply the treatment to produce a corrected value.
5. Re-mask the corrected value to verify that it now matches an expected mask.
6. If the re-masked value is acceptable, write the treatment alongside the raw value.
7. If the re-masked value still does not match an expected mask, escalate to manual review.

The **re-mask step** is important. It provides a built-in verification that the treatment function actually produced a valid result. If a title-case normalisation function is applied to an all-caps name but the result still does not match the expected mask (perhaps because the original value was not a name at all, despite being in the name column), the re-mask step catches the failure and prevents a bad correction from propagating.

## Properties of Good Treatment Functions

Good treatment functions share several properties:

**Idempotent**: applying the function twice produces the same result as applying it once. `title_case(title_case("JOHN SMITH"))` should return `John Smith`, not `John smith` or something worse. Idempotency ensures that treatment pipelines can be re-run without creating cascading distortions.

**Non-destructive**: the original value is always preserved alongside the treated value. The treatment function writes to a parallel column (the `.Rules` or treatment column in the flat enhanced format), never overwriting the `.raw` value. This ensures that treatments can be audited, reversed, and reprocessed if the treatment logic is later found to be incorrect.

**Auditable**: the mask that triggered the treatment is recorded alongside the treatment itself. The provenance chain is: raw value → mask → treatment function → treated value → re-mask verification. Every step is traceable.

## Data Quality Remediation Rules at Scale

In enterprise data platforms, treatment functions are not ad hoc scripts but managed assets. They are proposed by data quality analysts, agreed with data stewards and source system owners, tested, released through change management processes, and monitored in production. A remediation rules engine automates the application of these rules at scale, logging every treatment applied, and producing audit reports that demonstrate the value created by the remediation pipelines.

This level of process rigour is essential in environments where data remediation has compliance implications. Automated data remediation can only be applied where clear data quality checks have tagged the data appropriately, and where the remediation solutions have been agreed with stakeholders. The mask-based approach supports this by construction: the mask is the tag, the allow list/exclusion list is the check, and the treatment function is the agreed remediation.

## The Quality Loop

Over time, as treatment functions are applied and their results monitored, the long tail of error masks shrinks. Known errors are corrected automatically; new patterns are detected, investigated, and either added to the allow list (if they turn out to be legitimate) or assigned new treatment functions (if they represent a new class of error).

This creates a **continuous improvement loop**:

1. **Profile** — discover new masks in incoming data.
2. **Classify** — determine whether each mask is expected (allow list), an error (exclusion list), or unknown (investigate).
3. **Treat** — write or update treatment functions for error masks.
4. **Monitor** — track the effectiveness of treatments and watch for new patterns.
5. **Refine** — adjust allow lists, exclusion lists, and treatment functions based on operational experience.

Each iteration through this loop improves the quality of the downstream data products. The loop does not require a large upfront investment in rules definition — you start with whatever you can profile on day one, and build incrementally as you learn the data. This incremental approach is well suited to the reality of data quality work, where perfect knowledge of the data is never available at the start and understanding improves over time through operational experience.
