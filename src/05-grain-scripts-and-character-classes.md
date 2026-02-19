# Grain, Scripts, and Character Classes

The basic A/a/9 mask described in the previous chapter works well for ASCII data and covers the majority of use cases in structured data profiling. But real-world data — particularly data sourced from open data portals, international organisations, and multilingual systems — contains characters that the simple ASCII mask cannot adequately describe. Accented characters, CJK ideographs, Arabic script, Devanagari, Cyrillic, Thai, Ethiopic, and increasingly emoji all appear in production datasets, and a profiler that treats them all as "other" is losing information.

This chapter introduces two extensions to the basic mask: **grain levels**, which control the resolution of the mask, and **Unicode-aware character class translation**, which extends masking across the full range of human writing systems.

## High Grain and Low Grain

A high grain mask preserves the exact length and position of every character in the original value. Every character maps individually, so `John Smith` becomes `Aaaa Aaaaa` and `Jane Doe` becomes `Aaaa Aaa`. These are two different masks, because the strings have different lengths.

A low grain mask collapses consecutive runs of the same character class into a single symbol. Under low grain masking, `John Smith` becomes `Aa Aa`, and `Jane Doe` also becomes `Aa Aa`. The two values now share the same mask, because at the low grain level they have the same structure: a capitalised word followed by a space followed by another capitalised word.

The distinction matters because the two grain levels serve different purposes.

**Low grain** is the tool for discovery. When you first encounter an unfamiliar dataset and want to understand the structural families present in a column, low grain masking collapses millions of unique values into a handful of patterns. A name column that produces thousands of unique high grain masks (varying by name length) might produce only four or five low grain masks: `Aa Aa` (first name, last name), `Aa A. Aa` (with middle initial), `Aa` (single name), `9` (numeric — investigate), and `A/A` (placeholder). This immediate simplification makes the data comprehensible at a glance.

**High grain** is the tool for precision. Once you have identified the structural families using low grain, you can drill into a specific family with high grain masking to see the exact formats. For a postcode column, low grain might tell you that most values match `AA9 9AA` (low grain: `A9 9A`). High grain will tell you that you have `AA99 9AA`, `A99 9AA`, `A9 9AA`, `AA9 9AA`, and `AA9A 9AA` — the five standard UK postcode formats — each with its own frequency, allowing you to verify completeness and detect anomalies.

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

This means that a Chinese business name like `天安門広場` produces a mask of `aaaaa` (five Lo characters, each mapped to `a`), an Arabic address produces `a a a` preserving the spaces between words, and an Icelandic name like `Jökulsárlón` produces `Aaaaaaaaaa` — preserving the capitalisation structure even though the accented characters are outside the basic ASCII range.

The practical benefit is that profiling works across scripts without configuration. When profiling a global places dataset containing names in Chinese, Thai, Arabic, Cyrillic, Devanagari, Ethiopic, and Latin scripts, the profiler does not need to be told which languages to expect. It uses the Unicode category of each character to generate masks that preserve structure, and the frequency analysis surfaces the dominant patterns regardless of script.

## Script Detection

In addition to mask generation, both DataRadar and bytefreq perform automatic script detection per field, reporting the dominant scripts found in each column. This is implemented by examining the Unicode script property of each character and aggregating across all values in the field.

Script detection serves two purposes. First, it flags potential encoding issues: a column that is expected to contain Latin-script names but reports a significant minority of Cyrillic characters may have an encoding corruption (Cyrillic and Latin share visual forms for several characters, and mojibake — text decoded with the wrong character set — often manifests as unexpected script mixing). Second, it informs downstream processing: a column containing mixed Latin and Arabic text may need bidirectional text handling, which is worth knowing before it breaks a downstream rendering system.

## The Byte Frequency Approach

It is worth noting that the original byte-level approach — profiling the actual byte values present in a file, without interpreting them as characters — remains useful for a specific class of problem: file inspection. When you receive a file and need to determine its encoding, delimiters, and line endings, byte frequency analysis will tell you what byte values are present and at what frequencies. A UTF-8 file will show characteristic byte patterns (leading bytes in the `0xC0`–`0xF4` range followed by continuation bytes in the `0x80`–`0xBF` range). A Latin-1 file will show bytes in the `0x80`–`0xFF` range that are not valid UTF-8 sequences. A file with mixed line endings will show both `0x0A` (Unix) and `0x0D 0x0A` (Windows).

This forensic byte-level analysis is how bytefreq got its name. While the higher-level character class masking is the tool most users will reach for day-to-day, the byte frequency mode remains available for the cases where you need to understand what is in the file before you can even begin to interpret its contents.
