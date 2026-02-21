# Worked Example: Profiling the French Lobbyist Registry (HATVP) {.unnumbered}

This appendix profiles a real French government transparency dataset — the lobbyist registry maintained by the Haute Autorité pour la transparence de la vie publique (HATVP). Where the Companies House example demonstrated mask-based profiling on tabular CSV data and the JMA earthquake example tackled nested JSON with mixed scripts, this dataset brings a different set of challenges: deeply nested JSON with French-language text, accented characters, text-encoded numeric ranges masquerading as quantitative fields, and casing inconsistencies rooted in French administrative conventions. The result is a worked example that shows how bytefreq profiling surfaces issues that neither schemas nor simple validation rules would catch.

## The Dataset

The HATVP publishes a consolidated JSON file of all organisations registered in the French lobbyist registry, updated nightly and freely available under the Licence Ouverte (Etalab) — France's standard open data licence. The file is available at [hatvp.fr/agora/opendata/agora_repertoire_opendata.json](https://www.hatvp.fr/agora/opendata/agora_repertoire_opendata.json) and weighs in at approximately 116MB.

Each record represents a registered lobbying organisation and contains its denomination, address, national identifier, directors, collaborators, clients, sector classifications, multi-year exercise declarations with nested activity reports, expenditure bands, revenue bands, and contact information. The nesting is substantial: a single organisation record can contain arrays of directors (each with name, title, and role), arrays of collaborators, arrays of clients, and multiple annual exercise declarations each containing their own nested activity structures.

For this example we sampled 405 records from the full file. After flattening the nested JSON (collapsing array indices so that `dirigeants[0].nom` and `dirigeants[1].nom` both become `dirigeants.nom`), these 405 records produced 81 unique field paths — a reflection of the structural depth of the data. Key paths and their value counts illustrate the one-to-many relationships: `denomination` yields 405 values (one per organisation), `dirigeants.nom` yields 760 (multiple directors per organisation), `collaborateurs.nom` yields 946, `clients.denomination` yields 1,130, and `activites.listSecteursActivites.label` yields 2,119 sector tags spread across the sample.

## Running the Profile

Because this is nested JSON rather than flat tabular data, we use the same flatten-then-profile approach described in the JMA earthquake example. The JSON is first flattened into field-path/value pairs, collapsing array indices, and then profiled using bytefreq in LU (Low-grain Unicode) mode. The flattening preserves the hierarchical field names — `exercices.publicationCourante.montantDepense` rather than a generic column number — which makes the profile output immediately readable without needing to cross-reference a schema.

The LU grain is the right starting point here. It collapses consecutive characters of the same class (uppercase, lowercase, digit, punctuation) into single representative characters, giving us a compact set of structural masks for each field. Where we need finer discrimination — as we will see with the `dirigeants.civilite` field — we can drill into HU (High-grain Unicode) mode for specific fields.

## Field-by-Field Analysis

### Organisation Name (denomination)

```
Mask              Count   Example
A A                  65   OTRE GIRONDE
A                    62   DOMISERVE
A A A                55   REUSABLE PACKAGING EUROPE
A A A A              31   BNP PARIBAS PERSONAL FINANCE
A A A A A A          24   OTRE DES PAYS DE LA LOIRE
A A A A A            23   UNION DES ENTREPRISES CORSES
A A A A A A A        12   NESTLE EXCELLENCE SAS PRODUITS PETI
A_A A                 3   MCDONALD'S FRANCE
A _                   2   TUKAZZA !
A 9                   2   FNSEA 17
```

The dominant masks are exactly what we would expect for organisation names in uppercase: one to seven words separated by spaces, all collapsing to `A` tokens. The interesting patterns are at the bottom. `A_A A` (3 records, e.g. `MCDONALD'S FRANCE`) — the apostrophe is a punctuation character, creating a distinct structural mask. `A _` (2 records, e.g. `TUKAZZA !`) — an exclamation mark, which bytefreq maps to the punctuation class. And `A 9` (2 records, e.g. `FNSEA 17`) — a numeric suffix, likely a regional chapter number.

None of these are errors per se — they are legitimate organisation names. But the masks tell us immediately that any downstream process relying on "organisation names are alphabetic words separated by spaces" will need to account for apostrophes, punctuation marks, and trailing numbers. The mask frequency table is the specification that the data never came with.

### Address (adresse)

```
Mask              Count   Example
9 A A A              76   169 RUE D'ANJOU
9 A A                50   60 BOULEVARD VOLTAIRE
A A                  30   ZONE INDUSTRIELLE
A                    29   AMYNOS
A A A                27   ASSOCIATION DES CONSOMMATEURS
9 A A A A            21   49 RUE EVARISTE GALOIS
9 A                  17   75 BDVOLTAIRE
A A A A              17   CITE DE L INDUSTRIE
A 9                  13   CS 70044
9 a Aa                7   79 rue Perrier
9 a Aa Aa             6   2 avenue Tony Garnier
A 9 A A A             2   BP 123 CHERBOURG EN COTENTIN
```

306 of 405 records have an address; 99 are empty (a 24.4% null rate). The dominant patterns start with a street number followed by uppercase street names (`9 A A A`: `169 RUE D'ANJOU`), which is the standard French address format. But several things stand out.

First, mixed casing. The majority of addresses are in uppercase (`169 RUE D'ANJOU`, `60 BOULEVARD VOLTAIRE`), which is the traditional French postal convention for addresses. But 13 records use title case or mixed case (`79 rue Perrier`, `2 avenue Tony Garnier`). The masks `9 a Aa` and `9 a Aa Aa` are structurally different from `9 A A` precisely because of this casing inconsistency — the profiler is separating records that a human might gloss over as "same thing, different capitalisation."

Second, non-address content. The masks `A` (29 records, e.g. `AMYNOS`) and `A A A` (27 records, e.g. `ASSOCIATION DES CONSOMMATEURS`) contain organisation names rather than street addresses. The address field is being used to store building names or organisation references.

Third, postal box codes. `A 9` (13 records, e.g. `CS 70044`) represents CEDEX sorting codes — a French postal routing system. `A 9 A A A` (2 records, e.g. `BP 123 CHERBOURG EN COTENTIN`) combines a boîte postale (PO box) number with a city name, packing two logical fields into one.

### Postal Code (codePostal)

```
Mask        Count   Example
9             401   75019
 9              2   1000
A9A9A           1   EC1R4QB
```

Three masks, and each tells a different story. The dominant `9` (401 records, 99.0%) represents standard five-digit French postal codes like `75019`. Clean, consistent, no issues.

The ` 9` mask (2 records, e.g. `1000`) has a leading space — note the space before the `9` in the mask. These are four-digit codes with space padding, likely Belgian postcodes (Belgium uses four-digit postal codes). Two Belgian organisations registered in the French lobbyist registry, and the source system padded their codes with a leading space rather than handling the shorter format.

And then there is `A9A9A` (1 record: `EC1R4QB`). That is a UK postcode — an alphanumeric format that is structurally unmistakable in a field of French five-digit codes. A British organisation registered in the French lobbyist registry, and the postal code field accepted whatever was submitted. The mask catches it instantly because the structural pattern is completely unlike the surrounding data.

### City (ville)

```
Mask              Count   Example
A                   211   BEAUNE
A 9                  52   PARIS 16
A A                  29   NANTERRE CEDEX
A-A                  24   LAMBALLE-ARMOR
Aa                   21   Paris
A-A-A                15   (various hyphenated)
A A A                10   LE BOURGET CEDEX
A A 9                10   PARIS CEDEX 07
Aa-a-Aa               3   Neuilly-sur-Seine
Aa a Aa               2   Neuilly sur Seine
A 9A                   2   LYON 3EME
a                      1   avignon
A - A A               1   COURBEVOIE - LA DEFENSE
A A_ A                1   VILLEBON S/ YVETTE
A A Aa 9              1   LE MANS Cedex 2
```

This field is a catalogue of French address conventions and casing inconsistency, all visible through the masks.

Casing: `A` (211 records, `BEAUNE`) is uppercase. `Aa` (21 records, `Paris`) is title case. `a` (1 record, `avignon`) is entirely lowercase. Three different casing conventions for the same type of data, in the same field, in the same dataset.

CEDEX variations: `A A` (29 records, `NANTERRE CEDEX`), `A A A` (10 records, `LE BOURGET CEDEX`), `A A 9` (10 records, `PARIS CEDEX 07`), `A A Aa 9` (1 record, `LE MANS Cedex 2`). The postal routing suffix CEDEX appears in uppercase (`CEDEX`) and in title case (`Cedex`) — and the numeric arrondissement that follows it is sometimes present, sometimes not.

Hyphenation: `A-A` (24 records, `LAMBALLE-ARMOR`) and `A-A-A` (15 records) are hyphenated town names in uppercase. `Aa-a-Aa` (3 records, `Neuilly-sur-Seine`) is hyphenated in title case. `Aa a Aa` (2 records, `Neuilly sur Seine`) is the same town name without hyphens. The profiler reveals that `Neuilly-sur-Seine` and `Neuilly sur Seine` coexist in the data — same place, different punctuation, different masks.

And then the distinctly French conventions: `A A_ A` (1 record, `VILLEBON S/ YVETTE`) uses `S/` as an abbreviation for "sur" (on/upon), a convention specific to French administrative addressing. `A 9A` (2 records, `LYON 3EME`) uses the arrondissement suffix `3EME` (3rd) — the ordinal marker `EME` being the French equivalent of English "rd" or "th."

### Country (pays)

```
Mask        Count   Example
A             375   FRANCE
Aa             22   France
A-A             1   ROYAUME-UNI
a               1   france
```

Four masks, essentially two country values. `FRANCE` appears in three casing variants: uppercase (375), title case (22), and lowercase (1). The fourth mask, `A-A`, is `ROYAUME-UNI` — the French name for the United Kingdom, hyphenated as is standard in French. This is the same British organisation whose UK postcode we found in the `codePostal` field.

The real issue here is not the lone UK record — it is the casing inconsistency. 375 records say `FRANCE`, 22 say `France`, 1 says `france`. These are not three different countries. A downstream join or group-by on this field will produce three separate buckets for the same value unless casing is normalised first. The profiler makes this immediately obvious because each casing variant produces a different mask.

### Organisation Category (categorieOrganisation.label)

```
Mask                                                          Count   Example
Aa a a a _a a a a_a a a a a_                                    128   Société commerciale et civile (autre que cabinet d'avocats et société de conseil)
Aa                                                               89   Association
Aa a                                                             83   Fédération professionnelle
Aa a a a                                                         58   Organisation non gouvernementale
Aa a a                                                           40   Cabinet de conseil
Aa a a _a a_                                                      2   Groupe de recherche (think tank)
Aa a a a a a a a                                                  2   Établissement public ou organisme consultatif
```

French category labels with accented characters (`Société`, `Fédération`, `Établissement`), apostrophes (`d'avocats`), and parenthetical qualifiers (`(autre que cabinet d'avocats et société de conseil)`, `(think tank)`). This is a controlled vocabulary — seven distinct values with consistent formatting. The masks here are doing their job: confirming that the reference data is clean and internally consistent.

Note that LU mode treats accented characters (é, è, ê) the same as their unaccented counterparts — they are all lowercase letters, collapsing to `a`. This is the correct behaviour for structural profiling: we care about the shape of the data, not the specific diacritics.

### Directors: Title (dirigeants.civilite)

```
Mask    Count   Example
A         760   M
```

A single mask: `A`. Every value collapses to uppercase alpha. But this field contains two distinct values — `M` (Monsieur) and `MME` (Madame) — which LU mode cannot distinguish because both are uppercase alphabetic strings. The mask `A` covers both a one-character and a three-character value.

This is a case where you would drill into HU (High-grain Unicode) mode, which preserves character count, to separate `M` from `MME` and get the gender distribution. At LU grain, the field looks perfectly uniform. At HU grain, the two populations would separate cleanly. It is a useful reminder that profiling grain is a choice, and the right grain depends on the question you are asking.

### Directors: Surname (dirigeants.nom)

```
Mask        Count   Example
A             684   DENIZOT
A A            43   LE LETTY
A-A            22   VESQUE-JEANCARD
A_A             4   N'GOADMY
A A A           3   DUBARRY DE LASSALLE
A A A A         2   VAN LIDTH DE JEUDE
A A_A           1   TEYSSIER D'ORFEUIL
```

French surname patterns, each structurally distinct and all legitimate. Single surnames (`A`, 684 records) dominate. Compound surnames with particles appear in several forms: space-separated (`A A`: `LE LETTY`, `A A A`: `DUBARRY DE LASSALLE`, `A A A A`: `VAN LIDTH DE JEUDE`), hyphenated (`A-A`: `VESQUE-JEANCARD`), and apostrophe-linked (`A_A`: `N'GOADMY`, `A A_A`: `TEYSSIER D'ORFEUIL`).

The apostrophe in French surnames (as in `D'ORFEUIL`, `N'GOADMY`) is structurally significant — it creates a different mask from a space-separated particle. Any normalisation logic that strips apostrophes or treats them as word boundaries will mangle these names. The mask frequency table is essentially a specification for a surname parser: here are the seven structural patterns you need to handle.

### Directors: First Name (dirigeants.prenom)

```
Mask        Count   Example
Aa            697   Carole
Aa-Aa          50   Marc-Antoine
Aa Aa          11   Marie Christine
Aa_a            1   Ro!and
```

The first three masks are expected: simple first names in title case (`Aa`, 697 records), hyphenated compound first names (`Aa-Aa`, 50 records — a very common French pattern, as in `Marc-Antoine`, `Jean-Pierre`), and space-separated compound first names (`Aa Aa`, 11 records — `Marie Christine`, where the hyphen was omitted).

The fourth mask is the standout of the entire dataset. `Aa_a` (1 record: `Ro!and`). An exclamation mark where the letter `l` should be. The intended name is `Roland`, but a data entry error — likely a mis-hit on an adjacent key — has replaced the lowercase `l` with `!`. The mask catches it instantly because `!` is a punctuation character, not a letter, so the structural pattern `Aa_a` (letter-class, letter-class, punctuation-class, letter-class) is fundamentally different from the expected `Aa` (letter-class, letter-class). One character wrong, and the mask is completely different.

This single record is worth the entire profiling exercise as a demonstration. No schema would catch it — the field is a valid string. No length check would catch it — `Ro!and` is six characters, perfectly reasonable for a first name. No lookup table would catch it unless you had an exhaustive dictionary of every possible French first name. But the structural profile catches it immediately, because the shape of the data is wrong. That is the core proposition of mask-based profiling, illustrated in a single record.

### Directors: Role (dirigeants.fonction)

```
Mask                        Count   Example
Aa                            278   Secrétaire
Aa Aa                          92   Directeur Général
Aa a                           74   Directeur général
A                              44   PRESIDENT
A A                            29   DIRECTEUR GENERAL
Aa a Aa                        20   Président du Conseil
Aa-Aa                          20   Vice-Président
Aa a a                         19   Directeur exécutif
Aa Aa Aa                       18   Directeur Général Adjoint
Aa-a                           10   Vice-président
a                               6   président
Aa-Aa Aa                        6   Vice-Président Exécutif
A-A                             4   CO-PRÉSIDENT
4a Aa-Aa                        4   2ème Vice-Président
```

Three casing conventions coexist in a single field. Title case with all words capitalised (`Directeur Général`, mask `Aa Aa`, 92 records). Title case with French grammatical casing where articles and prepositions are lowercase (`Directeur général`, mask `Aa a`, 74 records). And all-caps (`PRESIDENT`, mask `A`, 44 records; `DIRECTEUR GENERAL`, mask `A A`, 29 records).

The mask pair `Aa-Aa` (20 records, `Vice-Président`) versus `Aa-a` (10 records, `Vice-président`) is particularly revealing: the same role, with the only difference being whether the second element after the hyphen is capitalised. The profiler separates them because `Aa-Aa` and `Aa-a` are structurally different — and this tells us that different data entry operators or different source systems applied different capitalisation rules.

The `4a` mask (4 records, `2ème Vice-Président`) captures the French ordinal suffix `ème` (equivalent to English "nd" or "th"), preceded by a digit. And the `a` mask (6 records, `président`) reveals entries in all lowercase — no initial capital at all.

A treatment function for this field would need to normalise casing (choosing one convention), handle hyphenated roles, and decide what to do with ordinal prefixes. The mask frequency table tells you exactly what rules to write.

### Email (emailDeContact)

```
Mask              Count   Example
a_a.a                66   contact@cdcf.com
a.a_a.a              23   jean.dupont@example.fr
a_a-a.a              23   contact@france-industrie.org
a_a.a.a               8   info@cabinet.avocat.fr
a_a9.a                6   contact@euro4t.fr
a-9_a.a               1   udtr-12@otre.fr
```

169 of 405 records have an email address; 236 are empty (58.3% null rate). The masks show the structural variation in email formats. In bytefreq output, the `@` symbol maps to the punctuation class and then collapses with adjacent punctuation or appears as `_` depending on surrounding characters. The dominant pattern `a_a.a` (66 records) represents the simplest form: `local@domain.tld`.

Variations include dots in the local part (`a.a_a.a`: `jean.dupont@example.fr`), hyphens in the domain (`a_a-a.a`: `contact@france-industrie.org`), multi-level domains (`a_a.a.a`: `info@cabinet.avocat.fr`), numbers in the domain (`a_a9.a`: `contact@euro4t.fr`), and numbers with hyphens in the local part (`a-9_a.a`: `udtr-12@otre.fr`).

No structural errors here — the patterns all represent valid email formats. The 58.3% null rate is the main finding: more than half of registered lobbying organisations have not provided a contact email.

### Expenditure (exercices.publicationCourante.montantDepense)

```
Mask                                  Count   Example
_ _ 9 9 a a _ 9 9 a                    580   >= 75 000 euros et < 100 000 euros
_ 9 9 a                                455   < 10 000 euros
_ _ 9 9 9 a a _ 9 9 9 a                  8   >= 3 250 000 euros et < 5 000 000 euros
_ _ 9 9 a a _ 9 9 9 a                    2   >= 900 000 euros et < 1 000 000 euros
_ _ 9 9 9 a                              1   >= 10 000 000 euros
```

This is one of the most instructive fields in the entire dataset. The expenditure column does not contain numbers. It contains French-language text descriptions of expenditure bands: `>= 75 000 euros et < 100 000 euros` — "greater than or equal to 75,000 euros and less than 100,000 euros."

A schema will tell you this field is a string. A null check will tell you it is populated. A length check will tell you nothing useful. But the mask tells you immediately that this is not a numeric field — the presence of `a` (lowercase alpha) characters in the mask means there are words mixed in with the numbers. You cannot sum this column, you cannot compute averages, you cannot do arithmetic of any kind without first parsing the range text.

The formatting follows French conventions: spaces as thousand separators (`75 000`, not `75,000`), `euros` as the currency word (not a symbol), and `et` (French for "and") as the conjunction between the lower and upper bounds. The five masks represent five expenditure bands, from `< 10 000 euros` to `>= 10 000 000 euros`.

This pattern — encoding quantitative information as text ranges — is not uncommon in government datasets where the exact figure is considered sensitive but the band is public. The profiler reveals it immediately because the structural pattern of a text range is fundamentally different from the structural pattern of a number. A column of actual euro amounts would produce masks like `9` or `9.9` — not `_ _ 9 9 a a _ 9 9 a`.

### Revenue Band (exercices.publicationCourante.chiffreAffaire)

```
Mask                          Count   Example
_ _ 9 9 9 a                    225   >= 1 000 000 euros
_ 9 9 a                        101   < 100 000 euros
_ _ 9 9 a a _ 9 9 a             65   >= 100 000 euros et < 500 000 euros
_ _ 9 9 a a _ 9 9 9 a           41   >= 500 000 euros et < 1 000 000 euros
```

The same text-range pattern as expenditure. Four revenue bands rather than five, with the top band open-ended (`>= 1 000 000 euros`). The same French formatting conventions apply: space thousands, text currency, `et` conjunction.

The consistency between this field and `montantDepense` suggests a systematic encoding choice by the HATVP, not a one-off formatting quirk. Both financial fields use the same text-range approach, and both would need the same parsing treatment to extract usable numeric bounds.

### Employee Count (exercices.publicationCourante.nombreSalaries)

```
Mask    Count   Example
9.9     1,046   1.0
```

A single mask: `9.9`. Every value is a number with a decimal point and trailing zero — `1.0`, `25.0`, `350.0`. These are integers that have been serialised as floating-point numbers by the JSON encoder. The source system stores employee count as an integer, but somewhere in the serialisation pipeline the values were converted to floats, and the JSON output faithfully records `1.0` instead of `1`.

This is a common issue with JSON data produced by systems that use loosely-typed numeric handling (Python's `json.dumps` with certain configurations, for example, or Java serialisers that map `Number` objects to `double`). The profiler catches it because the `.0` suffix creates a structural pattern (`9.9`) that is different from what we would expect for integer counts (`9`).

The treatment is straightforward: parse as float, cast to integer, validate that the decimal portion is always `.0`. But you need to know the issue exists before you can treat it, and the mask tells you on the first profiling run.

### Website (lienSiteWeb)

```
Mask              Count   Example
a_a.a.a_             80   https://www.example.com/fr
a_a.a.a              51   https://www.example.com
a_a.a_               26   https://lfde.com/
a_a.a-a.a_           23   https://www.france-industrie.org/
a_a.a                12   https://lfde.com
a_a-a.a_             12   http://france-biotech.fr/
a_a9.a_               6   http://cci47.fr/
```

304 of 405 records have a website; 101 are empty. The masks capture several URL structure variations: with and without `www` prefix, with and without trailing slash, `http` versus `https`, hyphens in domain names, numbers in domain names, and path suffixes (e.g. `/fr` for French-language landing pages).

The `a_a-a.a_` mask (12 records) represents `http://` (without TLS) — these organisations have not migrated to HTTPS. Not a data quality issue per se, but the mask separates them cleanly, which could feed a notification to affected organisations.

### Dates (exercices.publicationCourante.dateDebut)

```
Mask    Count   Example
9-9-9   1,953   01-04-2025
```

1,953 of 1,954 values share the same mask: `9-9-9`, representing the DD-MM-YYYY format with dashes. One value is presumably empty or structurally different — a single anomaly in nearly two thousand records. This is a well-controlled field with consistent formatting. The dash separator (rather than slash or dot) is the dominant French date convention in administrative systems.

### National Identifier (identifiantNational)

```
Mask    Count   Example
9         371   834715807
A9         33   H810503325
```

Two masks, two distinct identifier systems. `9` (371 records) represents SIREN numbers — the nine-digit identifiers assigned to French commercial entities by INSEE (the national statistics office). `A9` (33 records) represents RNA numbers — identifiers from the Répertoire National des Associations, France's national register of non-profit associations. RNA numbers have a letter prefix (typically `W`) followed by digits.

The mask separates commercial entities from non-profits instantly, without needing a lookup table or any domain knowledge beyond what the structural pattern reveals. A single character at the start of the identifier encodes the entity type, and the profiler surfaces it automatically.

## Summary of Findings

Issues discovered through mask-based profiling of 405 HATVP lobbyist registry records:

**Text-encoded numeric ranges:**
- `montantDepense` (expenditure) and `chiffreAffaire` (revenue) store French-language band descriptions, not numbers → **Treatment:** parse range text to extract numeric bounds
- Euro formatting uses French conventions: space thousands (`75 000`), text currency (`euros`), French conjunction (`et`) → any parser must handle these

**Data entry errors:**
- `Ro!and` in `dirigeants.prenom` — exclamation mark substituted for lowercase `l` → **Treatment:** manual correction to `Roland`

**Casing inconsistency:**
- `pays`: three casings of `FRANCE` / `France` / `france` → **Treatment:** normalise to single form
- `ville`: uppercase (`BEAUNE`), title case (`Paris`), lowercase (`avignon`) → **Treatment:** normalise casing
- `dirigeants.fonction`: title case (`Directeur Général`), French grammatical case (`Directeur général`), all-caps (`PRESIDENT`), lowercase (`président`) → **Treatment:** normalise casing
- `adresse`: mixed uppercase and title case (`RUE D'ANJOU` vs `rue Perrier`) → **Treatment:** normalise casing

**Float serialisation of integers:**
- `nombreSalaries`: all values have `.0` suffix (`1.0`, `25.0`) → **Treatment:** cast to integer after validation

**Foreign data in domestic fields:**
- `codePostal`: one UK postcode (`EC1R4QB`) and two likely Belgian codes with leading spaces → **Flag:** legitimate foreign registrations, but may need special handling
- `pays`: one `ROYAUME-UNI` (United Kingdom) record → **Accept:** legitimate

**French address conventions:**
- CEDEX postal routing suffixes in multiple forms (`NANTERRE CEDEX`, `PARIS CEDEX 07`, `LE MANS Cedex 2`)
- `S/` abbreviation for "sur" (`VILLEBON S/ YVETTE`)
- Hyphenated vs unhyphenated town names (`Neuilly-sur-Seine` vs `Neuilly sur Seine`)
- Arrondissement suffixes (`PARIS 16`, `LYON 3EME`)

**High null rates:**
- `emailDeContact`: 58.3% empty
- `adresse`: 24.4% empty

**Structural consistency (no issues):**
- `dateDebut`: near-perfect DD-MM-YYYY consistency (1,953 of 1,954 values)
- `identifiantNational`: clean separation of SIREN (numeric) and RNA (alphanumeric) identifiers
- `categorieOrganisation.label`: consistent controlled vocabulary

## Lessons Learned

**1. Text-encoded numeric ranges are invisible to schemas but obvious to masks.** The expenditure and revenue fields store French-language band descriptions — `>= 75 000 euros et < 100 000 euros` — that look like strings to any schema validator and pass every null or length check. But the mask `_ _ 9 9 a a _ 9 9 a` immediately reveals the presence of alphabetic characters mixed with digits, signalling that this is not a straightforward numeric field. Any team ingesting this data and attempting arithmetic on these columns would discover the problem only at query time, possibly after building dashboards on meaningless aggregations. The profiler surfaces it in the first pass.

**2. One character substitution, caught by structural profiling.** `Ro!and` — a single exclamation mark where an `l` should be — produces the mask `Aa_a`, which is structurally different from every other first name in the dataset (all of which match `Aa`, `Aa-Aa`, or `Aa Aa`). No schema, no length check, no regex for "valid name characters" would catch this unless you explicitly excluded exclamation marks from names — and who thinks to do that? The mask catches it because the structural signature of the error is different from the structural signature of correct data. This is the essence of mask-based profiling: you do not need to know what errors to look for. You look at the structure, and the errors announce themselves.

**3. Casing inconsistency is pervasive in French administrative data.** The dataset contains uppercase (`FRANCE`, `BEAUNE`, `PRESIDENT`), title case (`France`, `Paris`, `Directeur Général`), French grammatical case (`Directeur général`, where only the first word is capitalised), and lowercase (`france`, `avignon`, `président`). These are not random — they reflect different data entry conventions, different source systems, and different interpretations of French typographic rules. The profiler separates them all because each casing pattern produces a different mask, turning an invisible consistency problem into a visible, countable one.

**4. Float serialisation of integers is a silent data type issue.** The `nombreSalaries` field contains values like `1.0` and `25.0` — integers that were serialised as floating-point numbers somewhere in the data pipeline. The JSON format does not distinguish between integer and float types in a way that survives most serialisation round-trips, so this kind of silent type promotion is common. The mask `9.9` (with a decimal point) is different from `9` (without), and that difference is the signal. Left undetected, these values might cause type errors in strongly-typed systems or produce unexpected results in aggregation queries that treat `1.0` as a float rather than an integer.

**5. A UK postcode in a French dataset is not an error — it is a fact.** `EC1R4QB` in the `codePostal` field is a legitimate British postal code belonging to a UK organisation registered in the French lobbyist registry. The mask `A9A9A` is unmistakable against a background of five-digit numeric French codes. The profiler does not tell you whether this is right or wrong — it tells you that it is structurally different, and gives you the example so you can decide. In this case the decision is clear: the data is correct, and the system needs to accommodate foreign postal code formats.

**6. French address conventions create legitimate structural diversity.** CEDEX postal routing suffixes, the `S/` abbreviation for "sur", hyphenated commune names, arrondissement numbers, and space-separated thousands in currency amounts are all standard French conventions. They are not errors, but they create structural variation that any downstream consumer needs to understand. The mask frequency table is an inventory of these conventions — a specification extracted from the data itself, rather than imposed by a schema that someone wrote based on what they thought the data looked like.
