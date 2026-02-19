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

## Prototyping on the Command Line

One of the virtues of mask-based profiling is that it can be prototyped with standard Unix tools in a single line:

```bash
cat data.csv | gawk -F"\t" '{print $4}' | \
  sed "s/[0-9]/9/g; s/[a-z]/a/g; s/[A-Z]/A/g" | \
  sort | uniq -c | sort -r -n | head -20
```

This extracts column 4 from a tab-delimited file, applies the A/a/9 mask using `sed`, sorts the results, counts unique masks, and displays the top 20 by frequency. It runs in seconds on files with millions of rows, and the output is immediately interpretable. We open-sourced a more fully-featured version of this profiler — called **bytefreq** (short for *byte frequencies*) — originally written in awk, and later rewritten in Rust. The awk version is available for readers who want to understand the mechanics; the Rust version is what you would use in production. Both are discussed in Chapter 10.

The ability to prototype the technique in a one-liner is important not because the one-liner is a production tool, but because it demonstrates that the underlying idea is genuinely simple. There is no machine learning, no complex configuration, no training data. It is a mechanical character-by-character translation followed by a frequency count. The power comes not from the complexity of the method but from the *interpretability of the output*.
