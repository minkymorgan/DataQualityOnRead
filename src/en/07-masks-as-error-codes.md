# Masks as Error Codes

The idea introduced in the profiling chapter — that a mask can be used as a key to retrieve records of a particular structural type — leads to what is perhaps the most important insight in the entire DQOR framework: **every mask is an implicit data quality error code**.

If you know what masks are "correct" for a column, then every other mask is an error. And unlike a generic boolean flag ("valid" or "invalid"), the mask itself tells you *what kind* of error it represents. The mask `99999` appearing in a name column does not just say "this is wrong" — it says "this is a numeric value where text was expected." The mask `A/A` does not just say "this fails validation" — it says "this is a two-character abbreviation with a slash, probably a placeholder like N/A." The mask is the diagnosis.

This thinking leads to the following conclusion: we can create a general framework around mask-based profiling for doing data quality control and remediation *as we read data within our data reading pipeline*. This has some advantageous solution properties that are worth setting out explicitly.

## Allow Lists and Exclusion Lists

The simplest way to operationalise masks as error codes is through allow lists and exclusion lists.

An **allow list** defines the acceptable masks for a column. Any value whose mask does not appear in the allow list is flagged as an anomaly. For a UK postcode column, the allow list might contain:

```
A9 9AA
A99 9AA
A9A 9AA
AA9 9AA
AA99 9AA
AA9A 9AA
```

These six masks cover all valid UK postcode formats. Any value that produces a different mask — `aaaa` (lowercase text), `99999` (numeric), `A/A` (placeholder), or an empty string — is automatically flagged, and the mask tells you exactly what structural form the offending value takes.

An **exclusion list** takes the opposite approach: it defines masks that are known to be problematic, and flags any value that matches. This is useful when the set of valid formats is large or open-ended (as with free-text name fields), but certain structural patterns are reliably indicative of errors:

```
9999           → numeric value in a text field
               → empty string (zero-length value)
a              → single lowercase character
aaaa://aaa.aaa → URL in a name field
```

In practice, allow lists are more useful for format-controlled fields (postcodes, phone numbers, dates, identifiers) where the set of valid patterns is finite and known. Exclusion lists are more useful for free-text fields where the valid patterns are diverse but certain structural types are reliably wrong.

## Building Quality Gates

The combination of population analysis and mask-based error codes creates a natural quality gate for incoming data:

1. **Profile the column** using mask-based profiling at the appropriate grain level.
2. **Compare each mask against the allow list** (or exclusion list) for that column.
3. **Check population thresholds** — is the proportion of "good" masks above the minimum acceptable level? Has a previously rare "bad" mask suddenly increased in frequency?
4. **Route errors by mask** — different masks may require different handling. A placeholder (`A/A`) might be replaced with a null. An all-caps name (`AAAA AAAAA`) might be normalised to title case. A numeric value in a name field (`99999`) might be quarantined for manual review.

The quality gate can run automatically on every new batch of data, providing a continuous structural health check. When the profile of incoming data drifts — a new mask appears that was not seen before, or the population of a known-bad mask increases — the gate flags it for investigation.

This approach maps directly to the Data Quality Controls capability described in enterprise data operating models, where dataset registration, profiling for outliers, column-level validation, alerts and notifications, bad data quarantine, and DQ remediation rules are all core components. Mask-based profiling provides a single mechanism that addresses all of these capabilities, because the mask itself serves as the registration key, the outlier detector, the validation check, the alert trigger, the quarantine criterion, and the remediation lookup key — all from one pass over the data.

## Masks as Provenance

There is a secondary benefit to treating masks as error codes that is easy to overlook: they provide provenance for quality decisions. When a downstream consumer asks "why was this record flagged?" or "why was this value changed?", the mask provides a clear, reproducible answer. The record was flagged because its mask was `99999` and the allow list for the name column does not include numeric masks. The value was changed because its mask was `AAAA AAAAA` and the treatment function for that mask is title-case normalisation.

This audit trail is built into the mechanism by construction. No additional logging or documentation is required — the mask is both the detection method and the explanation. In regulated environments where data lineage and transformation justification are compliance requirements, this property is particularly valuable.

## From Detection to Treatment

The logical next step, once masks have been classified as "good" or "bad" for a given column, is to define what happens to the records that fall into each category. That is the subject of the next chapter: treatment functions and the data quality loop.
