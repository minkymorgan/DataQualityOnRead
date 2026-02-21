# Grain, Scripts, and Character Classes

The basic A/a/9 mask described in the previous chapter works well for ASCII data and covers the majority of use cases in structured data profiling. But real-world data — particularly data sourced from open data portals, international organisations, and multilingual systems — contains characters that the simple ASCII mask cannot adequately describe. Accented characters, CJK ideographs, Arabic script, Devanagari, Cyrillic, Thai, Ethiopic, and increasingly emoji all appear in production datasets, and a profiler that treats them all as "other" is losing information.

This chapter introduces two extensions to the basic mask: **grain levels**, which control the resolution of the mask, and **Unicode-aware character class translation**, which extends masking across the full range of human writing systems.

## High Grain and Low Grain

A high grain mask preserves the exact length and position of every character in the original value. Every character maps individually, so `John Smith` becomes `Aaaa Aaaaa` and `Jane Doe` becomes `Aaaa Aaa`. These are two different masks, because the strings have different lengths.

A low grain mask collapses consecutive runs of the same character class into a single symbol. Under low grain masking, `John Smith` becomes `Aa Aa`, and `Jane Doe` also becomes `Aa Aa`. The two values now share the same mask, because at the low grain level they have the same structure: a capitalised word followed by a space followed by another capitalised word.

The distinction matters because the two grain levels serve different purposes.

**Low grain** is the tool for discovery. When you first encounter an unfamiliar dataset and want to understand the structural families present in a column, low grain masking collapses millions of unique values into a handful of patterns. A name column that produces thousands of unique high grain masks (varying by name length) might produce only four or five low grain masks: `Aa Aa` (first name, last name), `Aa A. Aa` (with middle initial), `Aa` (single name), `9` (numeric — investigate), and `A/A` (placeholder). This immediate simplification makes the data comprehensible at a glance.

The effect is dramatic with non-Latin scripts. When profiling Japanese earthquake data from JMA, the hypocenter name field — containing kanji place names of varying length and composition — collapses entirely to a single mask at LU grain:

```
Mask    Count   Example
a          78   福島県会津
a_a         1   (compound name with punctuation)
```

78 of 79 values produce the same mask: `a`. Every CJK ideograph is classified as a lowercase letter (Unicode category Lo), and low grain collapses consecutive characters of the same class. A four-character name and an eight-character name are structurally identical at this grain. That one exception — `a_a`, a name containing a punctuation separator — stands out immediately. At HU grain, these 78 records would produce dozens of distinct masks varying by character count. At LU grain, you see the structural family at a glance. (See the Worked Example: Profiling JMA Earthquake Data appendix for the full analysis.)

**High grain** is the tool for precision. Once you have identified the structural families using low grain, you can drill into a specific family with high grain masking to see the exact formats. For a postcode column, low grain might tell you that most values match `AA9 9AA` (low grain: `A9 9A`). High grain will tell you that you have `AA99 9AA`, `A99 9AA`, `A9 9AA`, `AA9 9AA`, and `AA9A 9AA` — the five standard UK postcode formats — each with its own frequency, allowing you to verify completeness and detect anomalies.

A subtler example of when HU grain is needed comes from the French lobbyist registry. The title field (`dirigeants.civilite`) contains `M` (Monsieur) and `MME` (Madame). At LU grain, both collapse to `A` — a single mask covering all 760 values, suggesting perfect uniformity. At HU grain, `M` produces `A` and `MME` produces `AAA`, cleanly separating the two populations. The LU profile tells you the field is consistently alphabetic. The HU profile tells you there are exactly two formats and what they are. The choice of grain determines the question you are answering. (See the Worked Example: Profiling the French Lobbyist Registry appendix.)

The typical workflow is a two-pass approach: start with low grain to survey the landscape, then switch to high grain to examine specific areas of interest. This mirrors how experienced data engineers actually work — broad scan first, targeted investigation second — and the two grain levels formalise that workflow into the tool.

## Unicode Character Classes

The original bytefreq implementation, written in awk and designed for ASCII data, mapped characters byte-by-byte. Each byte (0–255) was assigned a character class based on its position in the ASCII table, and the mapping was deterministic regardless of the encoding of the input. This had the pragmatic advantage of working consistently on any input — including binary data and files with mixed or unknown encodings — because it made no assumptions about what the bytes represented. It was, deliberately, a byte-level tool.

As the world has moved to Unicode, the byte-level approach needed extending. Modern datasets contain text in dozens of scripts, and a useful profiler needs to handle them without requiring language-specific configuration. The current implementations — both the Rust-based bytefreq CLI and the WebAssembly-based DataRadar browser tool — support Unicode-aware masking at two levels, which we call **HU** (High Unicode) and **LU** (Low Unicode), extending the high/low grain concept into the Unicode space.

Under Unicode-aware masking, the character class translation uses the Unicode General Category to determine how each character is mapped:

- **Lu** (Letter, uppercase) → `A`
- **Ll** (Letter, lowercase) → `a`
- **Lt** (Letter, titlecase) → `A`
- **Lo** (Letter, other — CJK ideographs, Arabic, Thai, etc.) → `a`
- **Nd** (Number, decimal digit) → `9`
- **Punctuation categories** (Pc, Pd, Pe, Pf, Pi, Po, Ps) → kept as-is
- **Symbol categories** (Sc, Sk, Sm, So) → kept as-is
- **Separator categories** (Zs, Zl, Zp) → kept as-is

This means that a Chinese place name like 北京饭店 (Beijing Hotel) produces a mask of `aaaa` (four Lo characters, each mapped to `a`), an Arabic address produces `a a a` preserving the spaces between words, and an Icelandic name like Jökulsárlón produces `Aaaaaaaaaa` — preserving the capitalisation structure even though the accented characters are outside the basic ASCII range.

The practical benefit is that profiling works across scripts without configuration. When profiling a global places dataset containing names in Chinese, Thai, Arabic, Cyrillic, Devanagari, Ethiopic, and Latin scripts, the profiler does not need to be told which languages to expect. It uses the Unicode category of each character to generate masks that preserve structure, and the frequency analysis surfaces the dominant patterns regardless of script.

## Script Detection

In addition to mask generation, both DataRadar and bytefreq perform automatic script detection per field, reporting the dominant scripts found in each column. This is implemented by examining the Unicode script property of each character and aggregating across all values in the field.

Script detection serves two purposes. First, it flags potential encoding issues: a column that is expected to contain Latin-script names but reports a significant minority of Cyrillic characters may have an encoding corruption (Cyrillic and Latin share visual forms for several characters, and mojibake — text decoded with the wrong character set — often manifests as unexpected script mixing). Second, it informs downstream processing: a column containing mixed Latin and Arabic text may need bidirectional text handling, which is worth knowing before it breaks a downstream rendering system.

## Character Profiling

Character Profiling — CP mode — is a complementary technique to mask profiling. Where mask profiling translates each character to its class (A, a, 9) and counts the frequency of the resulting masks, CP mode counts the actual characters — the literal Unicode code points — present in a field. The question it answers is different: not "what structures exist in this data?" but "what characters actually appear in this data?"

This distinction is particularly revealing for non-Latin scripts. When profiling Japanese earthquake data from JMA (the Japan Meteorological Agency), CP mode revealed the presence of full-width digits (０, １, ２, ３ and so on) alongside standard ASCII digits (0, 1, 2, 3). At LU grain, both full-width and ASCII digits map to `9`, so mask profiling alone cannot distinguish them — the masks are identical. CP mode surfaces the actual character inventory, making the mixing of digit forms immediately visible.

CP mode is equally powerful for detecting encoding anomalies. Consider a field that should contain French accented characters — é, è, ê, ç, à — but whose character inventory also includes Â, Ã, or the sequence Â©. Those are the telltale signatures of mojibake: UTF-8 byte sequences that have been decoded as Latin-1 (or Windows-1252). The multi-byte UTF-8 encoding of é (0xC3 0xA9) becomes Ã© when misinterpreted as two single-byte Latin-1 characters. The character inventory is the diagnostic — you do not need to write encoding-specific validation rules, because the wrong characters simply show up in the profile.

The practical workflow is straightforward: run mask profiling first to understand the structural patterns in your data, then run CP mode on fields where the character inventory matters. Names, addresses, free-text descriptions, any field where you suspect encoding issues or script mixing — these are the candidates. Mask profiling tells you the shape; CP mode tells you the alphabet.

CP mode output is itself a frequency table — character, count, percentage — ordered by frequency. Like mask profiles, it can be stored as a fact table and monitored over time. If a field that historically contained only Latin characters suddenly shows Cyrillic or CJK code points, that is a data quality event worth investigating. The character inventory becomes a baseline, and deviations from it become signals.

## Casing as a Data Quality Signal

The distinction between HU and LU grain is not just about collapsing length — it reveals casing inconsistency. At HU grain, `France`, `FRANCE`, `france`, and `FRance` produce four different masks: `Aaaaaa`, `AAAAAA`, `aaaaaa`, `AAaaaa`. At LU grain, the first three collapse to `Aa`, `A`, and `a` respectively — still distinct, still diagnostic. The fourth, `FRance`, collapses to `Aa` at LU grain, merging with the title-case form. But the point is that casing variation survives the grain reduction. LU grain does not erase it.

A real example: profiling the country field in the French lobbyist registry (HATVP — the Haute Autorité pour la transparence de la vie publique) revealed four distinct casings of the word "France." There was `France` (title case, the expected form), `FRANCE` (all caps), `france` (all lower), and at least one mixed-case variant. Each produced a different mask. The masks surfaced this inconsistency without any casing-specific validation rules — no regex, no lookup table, no rule that says "this field must be title case." The frequency distribution of masks simply showed that what should be a single pattern was in fact four, indicating data entry from different sources or systems with different conventions.

This generalises to any field where casing should be consistent: country names, status codes, category labels, department names, currency codes. If you profile such a field at LU grain and find multiple distinct masks for what should be a single-format value, you have a casing quality signal. The mask distribution is doing the validation for you. You do not need to define the expected casing in advance — the data tells you, through its masks, whether casing is consistent or not. And because the masks are stored as fact tables, you can track whether casing consistency improves or degrades over time, across loads, across source systems.

## The Byte Frequency Approach

It is worth noting that the original byte-level approach — profiling the actual byte values present in a file, without interpreting them as characters — remains useful for a specific class of problem: file inspection. When you receive a file and need to determine its encoding, delimiters, and line endings, byte frequency analysis will tell you what byte values are present and at what frequencies. A UTF-8 file will show characteristic byte patterns (leading bytes in the `0xC0`–`0xF4` range followed by continuation bytes in the `0x80`–`0xBF` range). A Latin-1 file will show bytes in the `0x80`–`0xFF` range that are not valid UTF-8 sequences. A file with mixed line endings will show both `0x0A` (Unix) and `0x0D 0x0A` (Windows).

This forensic byte-level analysis is how bytefreq got its name. While the higher-level character class masking is the tool most users will reach for day-to-day, the byte frequency mode remains available for the cases where you need to understand what is in the file before you can even begin to interpret its contents.
