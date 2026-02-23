# Worked Example: Profiling PubMed XML — International Biomedical Literature {.unnumbered}

This appendix is the third worked example in this book, and it introduces something new: XML. The previous examples profiled pipe-delimited CSV (Companies House) and nested JSON (JMA earthquakes). This one profiles PubMed article metadata — a 3.4 MB XML document containing 200 biomedical research articles with 1,696 international authors from six continents. The point is not just to show that bytefreq handles XML. It is to show that the same mask-based profiling technique applies regardless of serialisation format, and that XML — with its attributes, mixed content, and namespace-qualified elements — presents its own data quality challenges that profiling surfaces automatically.

PubMed is the US National Library of Medicine's database of biomedical literature. It contains over 36 million citations. The data is available as bulk XML downloads and through APIs, and it is used by researchers, pharmaceutical companies, systematic review teams, and health informatics systems worldwide. If you work with biomedical data, you will encounter PubMed XML. And if you ingest it without profiling it first, you will discover its quirks the hard way.

## The Dataset

The dataset is a PubMed XML export containing 200 recent articles, selected specifically for international author diversity. It contains authors with Chinese, Korean, Vietnamese, Indian, Arabic, Turkish, Finnish, Estonian, Slovenian, Polish, Spanish, Portuguese, French, Dutch, and Irish names — the full spectrum of Latin-script diacritics, multi-part surnames, and naming conventions that real-world biomedical data contains.

The XML follows the NLM PubMed DTD, a well-documented and mature schema that has been in use for decades. Each `<PubmedArticle>` element contains two main blocks: `<MedlineCitation>` (the bibliographic metadata — title, authors, journal, abstract, MeSH headings) and `<PubmedData>` (publication history, article identifiers, references). The author information is nested several levels deep: `PubmedArticleSet.PubmedArticle.MedlineCitation.Article.AuthorList.Author`, with child elements for `LastName`, `ForeName`, `Initials`, `Identifier` (ORCID), and `AffiliationInfo.Affiliation`.

## XML as a First-Class Format

This is the first XML example in the book, so it is worth pausing to explain how bytefreq handles XML natively.

Bytefreq uses SAX (Simple API for XML) streaming to parse XML documents. It does not load the entire document into memory — it reads the XML as a stream of events (element open, element close, text content, attribute), building dot-notation paths as it descends and ascending as elements close. This means it can profile multi-gigabyte XML files with constant memory usage, just as it streams JSON and tabular data.

The path convention for XML is straightforward:

- **Elements** become dot-separated path segments: `PubmedArticleSet.PubmedArticle.MedlineCitation.PMID`
- **Attributes** are prefixed with `@`: `MedlineCitation.@Status`, `ISSN.@IssnType`
- **Repeated elements** (arrays in JSON terms) are handled by the same array-collapsing logic used for JSON — all `<Author>` elements at the same level contribute values to the same field path

The result is identical in structure to what you get from flattened JSON: a set of dot-notation field paths, each with a population count and a distribution of mask patterns. The profiling commands are:

```bash
cat pubmed-international.xml | bytefreq --format xml --grain HU
cat pubmed-international.xml | bytefreq --format xml --grain LU
```

The `--format xml` flag activates the SAX parser. Everything else — grain selection, mask generation, report output — works exactly as it does for JSON and tabular data. One profiling technique, any serialisation format.

## Structure Discovery: What Does PubMed XML Contain?

The profiler discovers 126 unique field paths across the 200 articles. This is the structural inventory — the complete set of elements and attributes that appear anywhere in the dataset. Here are the key paths with their value counts (total values across all 200 articles):

```
Field Path                                                      Values
-----------------------------------------------------------------------
MedlineCitation.@Status                                            200
MedlineCitation.@Owner                                             200
MedlineCitation.PMID                                               200
MedlineCitation.PMID.@Version                                      200
MedlineCitation.Article.@PubModel                                  200
MedlineCitation.Article.Journal.ISSN                               200
MedlineCitation.Article.Journal.ISSN.@IssnType                     200
MedlineCitation.Article.Journal.JournalIssue.PubDate.Year          200
MedlineCitation.Article.Journal.JournalIssue.PubDate.Month         200
MedlineCitation.Article.Journal.JournalIssue.PubDate.Day           200
MedlineCitation.Article.Journal.Title                               200
MedlineCitation.Article.ArticleTitle                                200
MedlineCitation.Article.AuthorList.@CompleteYN                      200
MedlineCitation.Article.AuthorList.Author.@ValidYN               1,699
MedlineCitation.Article.AuthorList.Author.LastName               1,696
MedlineCitation.Article.AuthorList.Author.ForeName               1,695
MedlineCitation.Article.AuthorList.Author.Initials               1,695
MedlineCitation.Article.AuthorList.Author.Identifier               353
MedlineCitation.Article.AuthorList.Author.Identifier.@Source       353
MedlineCitation.Article.AuthorList.Author.AffiliationInfo.Affil  2,059
MedlineCitation.Article.AuthorList.Author.@EqualContrib             72
MedlineCitation.Article.AuthorList.Author.CollectiveName             3
MedlineCitation.Article.AuthorList.Author.Suffix                     1
MedlineCitation.Article.Abstract.AbstractText                      604
MedlineCitation.Article.Abstract.AbstractText.@Label               253
MedlineCitation.Article.Abstract.AbstractText.@NlmCategory         247
MedlineCitation.Article.ELocationID                                316
MedlineCitation.Article.GrantList.Grant.GrantID                    258
MedlineCitation.Article.GrantList.Grant.Agency                     258
MedlineCitation.KeywordList.Keyword                                793
MedlineCitation.MeshHeadingList.MeshHeading.DescriptorName         341
PubmedData.ArticleIdList.ArticleId                                 616
PubmedData.ReferenceList.Reference.Citation                      6,356
```

Several things jump out immediately.

**Author counts reveal the fan-out.** There are 200 articles but 1,696 author last names, 1,695 forenames, and 1,695 sets of initials. The one-name discrepancy (1,696 vs 1,695) is explained by the `@ValidYN` attribute count of 1,699 — three `Author` elements have a `CollectiveName` instead of `LastName`/`ForeName` (consortium or group authorships like "IMAGEN Consortium" or "SIREN study group"), and there is one author with a last name but no forename. The profiler surfaces these structural variants automatically: you do not need to know the PubMed DTD to discover that author representation is not uniform.

**Affiliations are sparse.** 2,059 affiliation values for 1,696 authors means some authors have multiple affiliations — but it also means some authors have none. In a hierarchical XML structure, the absence of an `<AffiliationInfo>` child element is invisible unless you count. If every author had exactly one affiliation, we would expect 1,696 values. The 2,059 count tells us that multi-affiliation authors are common (joint appointments, visiting positions), but it does not tell us how many authors have zero affiliations. That requires comparing the author count to the number of distinct authors with at least one affiliation — a second-order analysis that the population counts prompt us to investigate.

**ORCID coverage is low.** Only 353 of 1,696 authors (20.8%) have an `Identifier` element. Every one of those identifiers has `@Source` = "ORCID". Four out of five authors in this dataset have no persistent identifier — a significant data quality gap for anyone trying to disambiguate authors or link publications to researchers.

**Abstracts are structured.** The 604 `AbstractText` values for 200 articles mean most articles have structured abstracts with labelled sections (Background, Methods, Results, Conclusions). The 253 `@Label` attributes confirm this — roughly half the abstract sections carry explicit labels. The 247 `@NlmCategory` values are the NLM's normalised category assignments, slightly fewer than the labels because some labels do not map to standard categories.

**One Suffix in the entire dataset.** Exactly one author has a `Suffix` element, containing "Jr". This is not a data quality issue — suffixes are genuinely rare in international biomedical authorship — but the profiler surfaces it because a field that appears once in 1,696 records is structurally noteworthy.

## Field-by-Field Analysis

### Citation Status

`MedlineCitation.@Status`

```
Mask                        Count   Example
Aaaaaaaaa                     114   Publisher
AaaAaa-aaa-AAAAAAA             49   PubMed-not-MEDLINE
AAAAAAA                        35   MEDLINE
Aa-Aaaaaaa                      2   In-Process
```

Four structural variants in an attribute that acts as a processing status flag. The dominant value "Publisher" (57%) indicates records supplied by publishers but not yet indexed by NLM. "PubMed-not-MEDLINE" (24.5%) means the article is in PubMed but not indexed with MeSH headings. "MEDLINE" (17.5%) indicates full NLM processing. "In-Process" (1%) means NLM indexing is underway.

The masks reveal the naming convention immediately: these are not simple codes but human-readable compound strings with mixed case, hyphens, and an abbreviation block (`MEDLINE`, `AAAAAAA`). Any downstream system that branches on this attribute needs to handle all four variants — and the mask distribution tells you exactly how common each one is.

### ISSN

`Article.Journal.ISSN`

```
Mask        Count   Example
9999-9999     180   1756-5391
9999-999A      20   1476-928X
```

The classic ISSN format: four digits, a hyphen, then either four digits or three digits and a check character. The `X` check digit (representing the value 10) appears in 10% of ISSNs. This is well-known to anyone who works with serials data, but for a newcomer encountering ISSN for the first time, the mask immediately reveals the structural variant without requiring any domain knowledge.

### Publication Model

`Article.@PubModel`

```
Mask                           Count   Example
Aaaaa-Aaaaaaaaaa                 126   Print-Electronic
Aaaaaaaaaa-aAaaaaaaaaa            32   Electronic-eCollection
Aaaaaaaaaa                        23   Electronic
Aaaaa                             19   Print
```

Four publication models, and the masks capture the compound naming convention: "Print-Electronic" (63%) means the article appeared in both print and electronic form. Note `Electronic-eCollection` with its internal lowercase-uppercase transition (`eCollection`), which the mask correctly renders as `aAaaaaaaaaa`. The `eCollection` capitalisation convention — lowercase `e` prefix on a capitalised word — is a common pattern in publishing metadata.

### Author Last Names — The International Name Challenge

`AuthorList.Author.LastName` — High-Unicode (HU) grain

```
Mask                    Count   Example
Aaaaa                     267   Lewis
Aaaaaa                    237   Nadein
Aaaa                      196   Tian
Aaaaaaa                   193   Daniels
Aaaaaaaa                  171   Fambirai
Aaa                       145   Lin
Aaaaaaaaa                  95   Attygalle
Aa                         82   Wu
Aaaaaaaaaa                 49   Wawrzaszek
Aaaaaaaaaaa                37   Sprikkelman
Aaaaaaaaaaaa               11   Banaschewski
AaAaaaa                     7   McQuaid
Aaaaaaaaaaaaa               6   Charuthamrong
Aaaaaaa-Aaaaaaa             4   Pallqui-Camacho
Aaaaaa-Aaaaa                4   Storck-Tonon
Aaaaaa-Aaaaaaa              4   Coello-Peralta
A                           3   M
aa Aaaaaaaa                 3   de Oliveira
Aa Aaaaaaa                  3   Di Lucente
Aa-Aaaaaaa                  3   Al-Shalabi
AaAaaaaa                    3   McCallum
```

The top ten masks are simple single-word surnames of varying lengths — five to twelve characters — covering 1,383 of 1,696 authors (81.5%). These are structurally unambiguous: one capitalised word composed entirely of ASCII Latin letters. Names like "Tian" (Chinese), "Lin" (Chinese/Vietnamese), "Wu" (Chinese), and "Fambirai" (Zimbabwean) all share the same simple mask as "Lewis" (English) and "Daniels" (English). The mask does not distinguish language of origin — nor should it at this level. These names are structurally identical.

The remaining 18.5% is where it gets interesting:

**Celtic prefixes:** `AaAaaaa` (7 values) captures the `Mc`/`Mac` pattern — `McQuaid`, `McCallum`, `McNair`. The internal capitalisation creates a distinctive mask that separates these from simple surnames.

**Hispanic double-barrelled names:** Hyphenated masks like `Aaaaaaa-Aaaaaaa` (4 values, e.g. `Pallqui-Camacho`), `Aaaaaa-Aaaaaaa` (4 values, e.g. `Coello-Peralta`) represent the Latin American convention of paternal-maternal surname compounds. There are 61 hyphenated surnames in the LU view — roughly one in every 28 authors.

**Dutch/Portuguese particles:** `aa Aaaaaaaa` (3 values, `de Oliveira`), `aaa Aaaaaaa` (6 values in LU, `van der Deure`, `van Breugel`). Lowercase particles before the capitalised family name create multi-word masks with a distinctive lowercase-uppercase boundary. The profiler treats the space-separated components as distinct segments, making particle names instantly distinguishable from single-word names.

**Arabic prefixes:** `Aa-Aaaaaaa` (3 values, `Al-Shalabi`) and `Aa Aaaaa` (1 value, `Al Sharie`). The same Arabic prefix "Al" appears both hyphenated and space-separated — a genuine data quality finding. Are these variant representations of the same naming convention, or do they reflect different transliteration standards? The profiler does not answer that question, but it ensures the question gets asked.

**Single-letter surnames:** `A` (3 values, `M`, `K`). Three authors have a single-letter last name. These are almost certainly data quality issues — truncated names, initials entered in the wrong field, or authors from naming traditions where a single name is conventional but PubMed's schema forces it into the LastName field. The mask `A` (one uppercase letter) flags them unmistakably.

**The leading-hyphen anomaly:** In the LU view, one surname has the mask `-Aa` with the value `-Akotet`. A surname that begins with a hyphen is a data entry error — likely a compound name where the first component was accidentally deleted, leaving the hyphen orphaned. This is exactly the kind of micro-anomaly that mask profiling is designed to catch: one record in 1,696, structurally unique, and almost certainly wrong.

### XML Entity References in Names — A Format-Specific Finding

The most striking finding in the author name analysis is visible only because we are profiling XML rather than JSON or CSV. Look at these mask patterns from the HU grain:

```
Mask                        Count   Example
A__aa9_aa                       3   V&#xe4;hi
Aaaaa__aa9_a                    3   Bostr&#xf6;m
A__aa9_aaaaa                    2   M&#xe4;rtson
Aaaaaaa__aa9_aaa                2   Desrivi&#xe8;res
Aa__aa9_a                       1   Pe&#xf1;a
A__aa9_a__aa9_aaa               1   K&#xe4;h&#xf6;nen
__aa9_aaaa Aaaaaaa              1   &#xc7;elik Demirci
```

The `__aa9_` segments are XML numeric character references — `&#xe4;` is ä, `&#xf6;` is ö, `&#xf1;` is ñ, `&#xe8;` is è, `&#xc7;` is Ç. These are diacritical characters encoded as XML entities rather than as raw UTF-8 bytes. The bytefreq profiler is seeing the raw XML text, and since `&`, `#`, `x`, and `;` are punctuation/alphanumeric characters in ASCII, each entity reference produces a distinctive mask segment.

This is a critical data quality finding for XML processing. The same name — say, "Kähönen" (Finnish) — will have a different mask depending on whether the diacritics are stored as raw UTF-8 characters (producing `Aaaaaaaa`) or as XML entity references (producing `A__aa9_a__aa9_aaa`). The mask profiler reveals which encoding convention the data uses, and whether it is consistent.

In this dataset, names with diacritics consistently use XML numeric character references rather than raw UTF-8. This is a legitimate encoding choice — the PubMed DTD has historically preferred entity references for characters outside the ASCII range — but it has consequences for downstream processing. Any system that consumes this XML must resolve entity references before performing string operations like sorting, searching, or display. The mask profiler warns you about this before you write a single line of parsing code.

The LU (Low-grain Unicode) view collapses the entity references into more readable patterns:

```
Mask            Count   Example
Aa               1494   Gurgone
Aa-Aa              61   Dantur-Juri
Aa Aa              29   Diaz Montes
Aa_a9_a            19   Pe&#xf1;uela
AaAa               15   McBride
A_a9_a             11   M&#xe4;rtson
a Aa                8   von Mutius
a a Aa              6   van der Deure
Aa_a_a-Aa           4   Ram&#xed;rez-Angulo
A                   3   K
A_Aa                3   O'Grady
-Aa                 1   -Akotet
```

At LU grain, the entity references collapse to shorter patterns (`_a9_a` instead of `__aa9_a`) but remain visually distinct from pure alphabetic content. The 19 names matching `Aa_a9_a` all contain a single entity-encoded diacritic — Spanish ñ, French è, Swedish ö, Hungarian á. The 11 matching `A_a9_a` have the entity at the start of the name.

### Author First Names

`AuthorList.Author.ForeName` — LU grain

```
Mask            Count   Example
Aa               1076   Stephen
Aa A              180   Cornelis P
A                 146   L
Aa Aa              79   Ji Woong
A A                66   J A
Aa-Aa              53   Kim-Anh
Aa Aa Aa           17   Marcello Mihailenko Chaves
Aa A A             13   Michael J W
A Aa                9   J Guy
A A A               7   R S A
Aa_a9_a             7   Dearbh&#xe1;ile
```

The forename field reveals the full range of naming conventions:

**Full first names** (`Aa`, 1,076 values, 63.5%): The dominant pattern — a single capitalised word. This covers given names from every language represented in the dataset: "Stephen" (English), "Yong" (Chinese), "Priya" (Indian), "Ahmed" (Arabic), "Olga" (Russian).

**First name plus middle initial** (`Aa A`, 180 values, 10.6%): A common Western convention — "Cornelis P", "David A". The single uppercase letter after a space is clearly an initial.

**Initials only** (`A`, 146 values, 8.6%): A single letter. These are authors whose first name has been reduced to an initial. This is a data quality concern: it makes author disambiguation effectively impossible. One hundred and forty-six authors — nearly one in twelve — are represented by a single letter rather than a full given name.

**Double initials** (`A A`, 66 values, 3.9%): Two separate initials — "J A", "P M". These authors have neither first nor middle name recorded, only initials for both.

**Korean/Vietnamese two-part given names** (`Aa Aa`, 79 values, 4.7%): "Ji Woong", "Kim Anh" — given names from cultures where the given name is conventionally two words. The space-separated pattern is structurally identical to a Western "first name + middle name" pair, which creates ambiguity: is "Ji Woong" a two-part given name, or is "Ji" the first name and "Woong" a middle name? The mask cannot tell you — but it shows you the scale of the ambiguity.

**Hyphenated given names** (`Aa-Aa`, 53 values, 3.1%): "Kim-Anh" (Vietnamese), "Ann-Marie" (English/French). The hyphen preserves the two-part structure as a single token. Some Vietnamese names appear both hyphenated (Kim-Anh → `Aa-Aa`) and space-separated (Ji Woong → `Aa Aa`), revealing inconsistent handling of the same naming convention.

**Triple initials** (`A A A`, 7 values): "R S A" — three separate initials. These authors are even more opaque than the double-initial cases.

**Irish/Gaelic names** (`Aa_a9_a`, 7 values): "Dearbháile" — Irish given names with entity-encoded fadas (acute accents). The entity reference creates a distinctive mask segment, just as it did in the surname field.

### ORCID Identifiers

`AuthorList.Author.Identifier` (where `@Source` = "ORCID")

```
Mask        Count   Example
9-9-9-9       319   0000-0002-9384-6341
9-9-9-9A       34   0000-0001-9815-200X
```

ORCID identifiers follow the ISNI format: four groups of four digits separated by hyphens, with the last character optionally being `X` (a check digit representing 10, identical to the ISSN convention). The mask distribution is clean: 90.4% pure numeric, 9.6% with an X check digit. No structural anomalies, no formatting inconsistencies. This is what well-governed identifier data looks like under profiling.

### Affiliation Identifiers — Mixed Standards

`AuthorList.Author.AffiliationInfo.Identifier`

```
Mask                Count   Example
a_a.a_9a9a9            89   https://ror.org/03tqb8s11
a_a.a_9a9              63   https://ror.org/041akq887
9                      23   2281
9 9 9 9                22   0000 0000 9009 5680
a.9.9                  18   grid.411237.2
a.9.a                   5   grid.4800.c
```

This is one of the richest data quality findings in the entire profile. Affiliation identifiers use at least three different identifier schemes, mixed together in a single field:

- **ROR URLs** (152 values, 69%): Research Organization Registry identifiers as full URLs — `https://ror.org/03tqb8s11`. Two mask variants because the alphanumeric suffix varies in structure.
- **ISNI numbers** (22 values, 10%): International Standard Name Identifiers in space-separated four-digit groups — `0000 0000 9009 5680`.
- **GRID identifiers** (23 values, 10.5%): Global Research Identifier Database IDs — `grid.411237.2`, `grid.4800.c`.
- **Bare numeric IDs** (23 values, 10.5%): Plain numbers like `2281` with no prefix or structure — possibly Ringgold identifiers.

Four different identifier schemes in a single XML element. The `@Source` attribute for these identifiers is consistently "ROR" (222 values), which is incorrect — only 152 of 222 identifiers are actually ROR URLs. The GRID, ISNI, and numeric identifiers are mislabelled. This is a data quality error that the mask profiler catches by revealing structural diversity that a single `@Source` value claims does not exist.

### Affiliation Text

`AuthorList.Author.AffiliationInfo.Affiliation` — The affiliation field produces the most structurally diverse output in the entire dataset: over 1,200 distinct masks for 2,059 values. This is expected — affiliation strings are semi-structured free text combining institution names, department names, cities, countries, and postal codes in no consistent order. A few representative patterns from the LU grain:

```
Mask                                                    Count   Example
Aa Aa Aa Aa, Aa, Aa.                                      26   Central Public Health Laboratories, Kampala, Uganda.
Aa a Aa, Aa a Aa, Aa, A.                                  14   School of Geography, University of Leeds, Leeds, UK.
Aa Aa, Aa, Aa.                                             11   Makerere University, Kampala, Uganda.
Aa a Aa Aa, Aa Aa a Aa, Aa, Aa, Aa.                        8   Centre for Pathogen Genomics, The University of Melbourne, ...
```

The structural diversity is the finding. Affiliations are not standardised — they are free text entered by authors or publishers with varying conventions for ordering, punctuation, and abbreviation. Some end with a full stop, some do not. Some include postal codes, some do not. Country names appear variously as "UK", "United Kingdom", "U.K.", "China", "P.R. China". The mask profiler confirms what anyone who has worked with bibliographic data already knows: affiliation strings are the messiest field in any publication database. But it also quantifies the mess — 1,200+ structural variants for 2,059 values means almost no two affiliations have the same structure.

### Publication Date — Optional Components

The profiler reveals that publication date components have different population levels:

```
Field Path                              Values
PubDate.Year                              200   (100%)
PubDate.Month                             200   (100%)
PubDate.Day                               200   (100%)
PubDate.Season                              2   (1%)
```

Year and Month are always present. Day is present for all 200 articles in this sample. But Season appears in 2 articles — a PubMed convention for journals that publish quarterly rather than on specific dates. The masks confirm the expected formats:

```
PubDate.Year:   9999  (200 values, e.g. "2026")
PubDate.Month:  Aaa   (200 values, e.g. "Feb")
PubDate.Day:    99    (200 values, e.g. "22")
PubDate.Season: Aa-Aa   (2 values, e.g. "Jan-Mar")
```

Month is a three-letter abbreviation, not a number. Day is a zero-padded two-digit number. Season is a hyphenated month range. Any date-parsing logic needs to handle all three conventions — and the presence of Season means you cannot simply concatenate Year + Month + Day for every record.

### Abstract Structure Labels

`Abstract.AbstractText.@Label`

```
Mask            Count   Example
AAAAAAA            50   METHODS
AAAAAAAAAA         43   BACKGROUND
AAAA               34   AIMS
AAAAAAA            33   RESULTS
```

All-uppercase labels — a consistent convention. But the `@NlmCategory` attribute (247 values vs 253 labels) shows that 6 labels lack an NLM category mapping. These are likely non-standard section labels that do not fit NLM's controlled vocabulary.

## Summary of Findings

Issues and observations discovered through mask-based profiling of 200 PubMed articles (1,696 authors):

**Author name diversity:**
- 45+ distinct mask patterns for last names — single-word ASCII names dominate (81.5%) but hyphenated (3.6%), multi-part (1.7%), and particle-prefixed names (1.1%) are significant minorities
- 3 single-letter surnames (`M`, `K`) → **Investigate:** likely data entry errors or mono-name authors forced into a two-field schema
- 1 leading-hyphen surname (`-Akotet`) → **Flag:** data entry error, missing first component of compound name
- 146 single-initial forenames (8.6%) → **Flag:** significant loss of identity information

**XML entity encoding:**
- Diacritical characters consistently encoded as XML numeric character references (`&#xe4;` rather than raw `ä`) → **Document:** downstream systems must resolve entities before string operations
- Entity-encoded names produce distinctive mask patterns that cleanly separate them from ASCII-only names
- Affects ~19 surnames and ~7 forenames in this sample — Finnish, Swedish, French, Spanish, Polish, Slovenian, Turkish, and Irish names

**Identifier data quality:**
- ORCID coverage: 20.8% of authors (353 of 1,696) → **Flag:** low coverage limits author disambiguation
- Affiliation identifiers: 4 different schemes (ROR, GRID, ISNI, numeric) mixed in a single field, all mislabelled as `@Source="ROR"` → **Flag:** metadata quality error
- ORCID format: clean, two structural variants (numeric and X-check), no anomalies

**Structural sparsity:**
- CollectiveName (3 records): group/consortium authorships that lack LastName/ForeName → **Handle:** different code path required
- Suffix (1 record): "Jr" — rare but must be accommodated
- EqualContrib (72 authors): annotation for equal contribution, present on ~4% of authors
- PubDate.Season (2 records): quarterly publication dates in a different format from Month+Day

**Affiliation strings:**
- 1,200+ structural variants for 2,059 values → **Accept:** free-text field, not amenable to structural standardisation
- Missing affiliations: some authors have zero affiliation elements → **Investigate:** count authors with no AffiliationInfo child

## Lessons Learned

**1. XML is just another serialisation format.** The SAX streaming parser flattens XML into dot-notation paths exactly as the JSON parser flattens nested objects. Attributes become `@`-prefixed fields. Repeated elements become multiple values at the same path. The profiling output is structurally identical to what you would get from the same data encoded in JSON. If you know how to read a bytefreq profile of JSON, you know how to read one of XML.

**2. Entity references are a format-specific data quality concern.** JSON escapes non-ASCII characters with `\uXXXX` sequences. XML uses numeric character references (`&#xNN;`) or named entities (`&amp;`). In both cases, the profiler sees the encoded form, not the resolved character — and the mask reveals the encoding. This is a feature, not a limitation: you need to know whether your data contains raw UTF-8 or entity-encoded characters before you can process it correctly. The mask profiler tells you which you have, and whether the encoding is consistent.

**3. Population analysis across nested elements requires care.** In flat tabular data, "field X has 180 values out of 200 rows" is unambiguous. In XML with repeated elements, "AuthorList.Author.Identifier has 353 values" must be interpreted against the total author count (1,696), not the article count (200). The profiler gives you value counts per path; you must bring the structural context — the knowledge that Author is a repeating element within each article — to calculate meaningful percentages.

**4. International names break simple assumptions.** Any system that assumes a last name is a single ASCII word will fail on 18.5% of the authors in this dataset. Hyphenated names, particle prefixes (`de`, `van der`, `Al-`), Celtic prefixes (`Mc`, `Mac`), diacritical characters, and multi-word surnames are not edge cases — they are a structural feature of international biomedical authorship. The mask profiler quantifies their prevalence and classifies them by structural type, providing the specification for a name-handling system that actually works.

**5. Mixed identifier schemes in a single field are discoverable through masks.** The affiliation identifier field contains ROR URLs, GRID IDs, ISNI numbers, and bare numeric codes — four structurally distinct identifier schemes — all tagged with `@Source="ROR"`. Without mask profiling, you would discover this only when your ROR lookup fails for 30% of the identifiers. With profiling, the four structural patterns are visible before you write any processing code.

**6. The same technique, three formats, three languages.** This book has now profiled pipe-delimited CSV from a UK company register (English), nested JSON from a Japanese earthquake API (Japanese and English), and XML from a US biomedical literature database (international names in Latin script with diacritics). The masking technique, the grain levels, the field population analysis, and the interpretation approach are identical across all three. The data changes. The method does not.
