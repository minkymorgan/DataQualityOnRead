# Mask-Based Profiling

A mask, in the context of data profiling, is a transformation function applied to a string that generalises the value into a structural fingerprint. The transformation replaces every character with a symbol representing its character class, while preserving punctuation and whitespace. When a column of data is summarised by counting the frequency of each resulting mask — a process commonly called *data profiling* — it reveals the structural patterns hiding inside the data, quickly and without assumptions.

The basic translation is as follows:

- Uppercase letters (`A`–`Z`) are replaced with `A`
- Lowercase letters (`a`–`z`) are replaced with `a`
- Digits (`0`–`9`) are replaced with `9`
- Everything else — punctuation, spaces, symbols — is left unchanged

It seems like a very simple transformation at first glance. To see why it is useful, consider applying it to a column of data that is documented as containing domain names. We expect values like `nytimes.com`. Applying the mask, we get:

```
   232  aaaa.aaa
   195  aaaaaaaaaa.aaa
   186  aaaaaa.aaa
   182  aaaaaaaa.aaa
   168  aaaaaaa.aaa
   167  aaaaaaaaaaaa.aaa
   167  aaaaa.aaa
   153  aaaaaaaaaaaaa.aaa
```

Very quickly, the mask reduces thousands of unique domain names down to a short list of structural patterns — all of which look like domain names, confirming our expectation. But what about the long tail? The rare masks that appear only a handful of times?

```
     2  AAA Aa
     1  a.99a.a
     1  9a9a.a
```

There is a mask — `AAA Aa` — that does not contain a dot, which we would expect in any domain name. This immediately stands out as structurally different from the rest. When we use the mask to retrieve the original values, we find the text `BBC Monitoring` — not a domain name at all, but a general descriptor that someone has used in a field designed for domain names. In re-reading the GDELT documentation we discover that this is not an error but a known special case, meaning when we use this field we must handle it. Perhaps we include a correction rule to swap the string for the valid domain `www.monitor.bbc.co.uk`, which is the actual source.

A second example, from real UK Companies House data, shows what happens when a field contains data from the wrong column entirely. The `RegAddress.PostTown` field — the registered office town — produces dozens of masks at LU grain. The dominant patterns are all legitimate town names: `A` (single words like `READING`, 84.2%), `A A` (two words like `HEBDEN BRIDGE`, 6.3%), and several hyphenated or abbreviated forms. But in the long tail:

```
Mask        Count   Example
A9 9A          14   EH47 8PG
9 A A          32   150 HOLYWOOD ROAD
9-9 A A        10   1-7 KING STREET
9A A            1   2ND FLOOR
9               2   20037
```

Postcodes in the town field. Street addresses in the town field. A US ZIP code. A floor number. The masks expose column misalignment that no town-name validation rule would detect — because `EH47 8PG` is a perfectly valid string, just in the wrong column. The mask `A9 9A` in a town field is diagnostic: towns do not have that structure, but postcodes do. (For the complete field-by-field analysis of this dataset, see the Worked Example: Profiling UK Companies House Data appendix.)

The idea we are introducing here is that a mask can be used as a *key* to retrieve records of a particular structural type from a particular field. Before we explore that idea further (it leads directly to the concept of masks as error codes, covered in Chapter 7), it is worth understanding the mechanics of the mask itself in more detail.

## Why Masks Work

The power of mask-based profiling comes from a simple mathematical property: the mask function is a *many-to-one* mapping that dramatically reduces cardinality while preserving structural information. A column of ten million customer names might contain two million unique values, but after masking it might contain only a few hundred unique patterns. A column of phone numbers with a million unique values might collapse to a dozen structural formats.

This cardinality reduction is what makes manual inspection feasible. No human can review two million unique names, but anyone can scan a frequency table of two hundred masks and immediately identify the dominant patterns and the outliers. The mask strips away the *content* (the specific name, the specific number) and reveals the *shape* (the format, the structure, the encoding).

Consider a customer name column:

| Original Value | Mask |
|---------------|------|
| `John Smith` | `Aaaa Aaaaa` |
| `JOHN SMITH` | `AAAA AAAAA` |
| `john smith` | `aaaa aaaaa` |
| `O'Brien` | `A'Aaaaa` |
| `Jean-Pierre` | `Aaaa-Aaaaaa` |
| `12345` | `99999` |
| `N/A` | `A/A` |

From the masks alone, without looking at the values, we can see: most records are capitalised names (`Aaaa Aaaaa`), some are in all-caps or all-lowercase (normalisation candidates), some contain apostrophes or hyphens (legitimate but structurally distinct), one is numeric (almost certainly an error — a customer ID in a name field), and one is a placeholder. The mask gives us a *classification of structural types* in a single pass.

A worked example from the French lobbyist registry illustrates this vividly. The first name field (`dirigeants.prenom`) produces four masks at LU grain:

```
Mask        Count   Example
Aa            697   Carole
Aa-Aa          50   Marc-Antoine
Aa Aa          11   Marie Christine
Aa_a            1   Ro!and
```

The first three are expected: simple names, hyphenated compounds (common in French), and space-separated compounds. The fourth is the standout: `Aa_a` — one record where `Ro!and` contains an exclamation mark where the letter `l` should be. The intended name is `Roland`, but a data entry error has replaced a letter with adjacent punctuation. No schema would catch this — the field is a valid string. No length check would catch it — six characters is reasonable. But the mask catches it instantly because `!` is punctuation, not a letter, and the structural pattern is fundamentally different from every other value in the field. (For the full analysis, see the Worked Example: Profiling the French Lobbyist Registry appendix.)

## Prototyping on the Command Line

One of the virtues of mask-based profiling is that it can be prototyped with standard Unix tools in a single line:

```bash
cat data.csv | gawk -F"\t" '{print $4}' | \
  sed "s/[0-9]/9/g; s/[a-z]/a/g; s/[A-Z]/A/g" | \
  sort | uniq -c | sort -r -n | head -20
```

This extracts column 4 from a tab-delimited file, applies the A/a/9 mask using `sed`, sorts the results, counts unique masks, and displays the top 20 by frequency. It runs in seconds on files with millions of rows, and the output is immediately interpretable. We open-sourced a more fully-featured version of this profiler — called **bytefreq** (short for *byte frequencies*) — originally written in awk, and later rewritten in Rust. The awk version is available for readers who want to understand the mechanics; the Rust version is what you would use in production. Both are discussed in Chapter 10.

The ability to prototype the technique in a one-liner is important not because the one-liner is a production tool, but because it demonstrates that the underlying idea is genuinely simple. There is no machine learning, no complex configuration, no training data. It is a mechanical character-by-character translation followed by a frequency count. The power comes not from the complexity of the method but from the *interpretability of the output*.
