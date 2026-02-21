# Worked Example: Profiling Japan Meteorological Agency Earthquake Data {.unnumbered}

This appendix is a second worked example, and it is deliberately different from the Companies House analysis that precedes it. Where that dataset was flat, tabular, and English, this one is deeply nested JSON, bilingual (Japanese and English), and sourced from a government agency on the other side of the world. The point is simple: mask-based profiling works on any data, in any language, from any structure, once you flatten it. The techniques described in this book are not limited to pipe-delimited CSV files from the UK — they apply universally, and this example proves it.

## The Dataset

The Japan Meteorological Agency (JMA) publishes open earthquake data through a public API. An index of recent seismic events is available at [https://www.jma.go.jp/bosai/quake/data/list.json](https://www.jma.go.jp/bosai/quake/data/list.json), and each event links to a detailed JSON document containing the earthquake's hypocenter location, magnitude, maximum intensity, and — crucially — a full breakdown of seismic intensity observations at every reporting station across the affected region.

The dataset used here comprises 80 earthquake events containing 2,433 individual seismic station observations. The data is freely available, requires no authentication, and is published in both Japanese (the `Name` field at every level) and English (the `enName` field). It is exactly the kind of rich, nested, non-English dataset that traditional profiling tools struggle with.

## Flattening Nested JSON for Profiling

The raw JSON has six or more levels of nesting. A single earthquake event contains a `Body.Intensity.Observation` object, which contains an array of `Pref` (prefecture) objects, each of which contains an array of `Area` objects, each of which contains an array of `City` objects, each of which contains an array of `IntensityStation` objects with fields like `Name`, `enName`, `Int` (intensity), `Lat`, `Lon`, and `Prm` (whether the station is official). The path from the root to a station's latitude looks like this:

```
Body.Intensity.Observation.Pref[0].Area[0].City[0].IntensityStation[0].Lat
```

To profile this with bytefreq, we need to flatten it — to turn every leaf value in the nested structure into a key-value pair where the key is the full dot-path and the value is the leaf content. This is the flat enhanced format described in Chapter 9, and it handles nested data naturally because each record is simply a bag of key-value pairs rather than a fixed set of columns.

The flattening produces a striking result: 80 earthquake records generate 6,551 unique flattened key paths. This happens because different earthquakes affect different numbers of prefectures, areas, cities, and stations. One earthquake might trigger observations at 3 stations in 1 prefecture; another might light up 200 stations across 8 prefectures. When we preserve array indices in the key paths (e.g. `Pref[0].Area[0].City[0]` vs `Pref[0].Area[0].City[1]`), each unique combination of indices produces a unique key. This is the "ragged row" problem — and the flat enhanced format handles it without any special treatment, because there is no requirement that every record have the same set of keys.

When we collapse array indices (treating all `Pref[]` entries as equivalent, all `Area[]` entries as equivalent, and so on), the 6,551 unique paths reduce to 81 unique field paths. But these 81 fields have varying numbers of values: `Body.Earthquake.Hypocenter.Area.Name` has 80 values (one per earthquake), `Body.Intensity.Observation.Pref.Name` has 157 values (some earthquakes affect multiple prefectures), `Body.Intensity.Observation.Pref.Area.City.Name` has 1,546 values, and `Body.Intensity.Observation.Pref.Area.City.IntensityStation.Name` has 2,433 values at the deepest level. The deeper you go in the hierarchy, the more values you get — a one-to-many fan-out at every level of nesting.

## Structure Discovery: Field Population Analysis

Before examining individual field values, we profile the field paths themselves. For each dot-notation path (with array indices collapsed), we count how many of the 80 earthquake records contain that path and express it as a percentage. This is the structural discovery step — it tells us the shape of the data before we look at what is in it.

```
Field Path                                                            Count  % Populated
-----------------------------------------------------------------------------------------
Control.DateTime                                                         80     100.0%
Control.EditorialOffice                                                  80     100.0%
Control.PublishingOffice                                                 80     100.0%
Control.Status                                                           80     100.0%
Control.Title                                                            80     100.0%
Head.EventID                                                             80     100.0%
Head.InfoKind                                                            80     100.0%
Head.InfoKindVersion                                                     80     100.0%
Head.InfoType                                                            80     100.0%
Head.ReportDateTime                                                      80     100.0%
Head.Serial                                                              80     100.0%
Head.TargetDateTime                                                      80     100.0%
Head.Title                                                               80     100.0%
Head.enTitle                                                             80     100.0%
Head.Headline.Text                                                       80     100.0%
Head.Headline.Information.Item.Kind.Name                                  8      10.0%
Head.Headline.Information.Item.Areas.Area.Code                            8      10.0%
Head.Headline.Information.Item.Areas.Area.Name                            8      10.0%
Body.Earthquake.ArrivalTime                                              80     100.0%
Body.Earthquake.Magnitude                                                80     100.0%
Body.Earthquake.OriginTime                                               80     100.0%
Body.Earthquake.Hypocenter.Area.Code                                     80     100.0%
Body.Earthquake.Hypocenter.Area.Coordinate                               80     100.0%
Body.Earthquake.Hypocenter.Area.Name                                     80     100.0%
Body.Earthquake.Hypocenter.Area.enName                                   80     100.0%
Body.Comments.ForecastComment.Code                                       80     100.0%
Body.Comments.ForecastComment.Text                                       80     100.0%
Body.Comments.ForecastComment.enText                                     80     100.0%
Body.Comments.VarComment.Code                                            75      93.8%
Body.Comments.VarComment.Text                                            75      93.8%
Body.Comments.VarComment.enText                                          75      93.8%
Body.Intensity.Observation.MaxInt                                        80     100.0%
Body.Intensity.Observation.Pref.Code                                     80     100.0%
Body.Intensity.Observation.Pref.MaxInt                                   80     100.0%
Body.Intensity.Observation.Pref.Name                                     80     100.0%
Body.Intensity.Observation.Pref.enName                                   80     100.0%
Body.Intensity.Observation.Pref.Area.Code                                80     100.0%
Body.Intensity.Observation.Pref.Area.MaxInt                              80     100.0%
Body.Intensity.Observation.Pref.Area.Name                                80     100.0%
Body.Intensity.Observation.Pref.Area.enName                              80     100.0%
Body.Intensity.Observation.Pref.Area.Revise                               1       1.2%
Body.Intensity.Observation.Pref.Area.City.Code                           80     100.0%
Body.Intensity.Observation.Pref.Area.City.MaxInt                         80     100.0%
Body.Intensity.Observation.Pref.Area.City.Name                           80     100.0%
Body.Intensity.Observation.Pref.Area.City.enName                         80     100.0%
Body.Intensity.Observation.Pref.Area.City.Revise                          1       1.2%
Body.Intensity.Observation.Pref.Area.City.IntensityStation.Code          80     100.0%
Body.Intensity.Observation.Pref.Area.City.IntensityStation.Int           80     100.0%
Body.Intensity.Observation.Pref.Area.City.IntensityStation.Name          80     100.0%
Body.Intensity.Observation.Pref.Area.City.IntensityStation.enName        80     100.0%
Body.Intensity.Observation.Pref.Area.City.IntensityStation.Revise         1       1.2%
Body.Intensity.Observation.Pref.Area.City.IntensityStation.latlon.lat    80     100.0%
Body.Intensity.Observation.Pref.Area.City.IntensityStation.latlon.lon    80     100.0%
```

The core earthquake structure — Control, Head, Body.Earthquake, Body.Intensity — is 100% populated across all 80 records. This is the spine of the data, the set of fields that every earthquake report shares regardless of magnitude or location. When we see 100% population at this scale, it tells us the schema is well-enforced for the core reporting obligation, which is exactly what we would expect from a national meteorological agency publishing structured seismic data.

`Body.Comments.VarComment.*` drops to 93.8% — five earthquakes had no variable commentary. This is not a data quality issue; some events are too minor or too routine to warrant additional commentary. But the profiler flags it, and that is the point: the absence of a field in nested data is itself information. In a flat schema, these five records would have null values in the VarComment columns. In nested JSON, the key simply does not exist. The field population analysis treats both representations the same way, which is one of the advantages of profiling the flattened form.

`Head.Headline.Information.*` appears in only 10% of records (8 earthquakes). This block contains detailed area-level intensity information in the headline — it is only populated for significant earthquakes where multiple areas experienced notable shaking. The other 90% of records have a simple text headline without the structured breakdown. This is a common pattern in operational data: optional sub-structures that are conditionally populated based on the severity or complexity of the event. The population percentage tells you immediately how common or rare the condition is.

The `Revise` field appears at three levels (Area, City, IntensityStation) but only in 1.2% of records — exactly one earthquake. This is a revision flag indicating that intensity observations were updated after initial publication. It is a rare operational flag that you would never discover by reading the API documentation, but the field population analysis surfaces it immediately. In a flat schema, this field would be a column that is 98.8% null. In nested JSON, it simply does not appear in most records. The profiler treats both the same way.

## Field-by-Field Analysis

The profile was generated using bytefreq in LU (Low-grain Unicode) mode, the same starting grain used for the Companies House example.

### Hypocenter Name (Japanese)

```
Mask    Count   Example
a          78   福島県会津
a_a         1   (compound name with punctuation separator)
```

Every Japanese place name — regardless of length, kanji composition, or regional variation — collapses to a single `a` mask. This is a direct consequence of the LU character class rules: all CJK ideographs (kanji), hiragana, and katakana characters are classified as alphabetic, and the low-grain mode collapses consecutive characters of the same class. A four-character name like `福島県沖` and an eight-character name like `茨城県南部` both produce `a`.

This is correct behaviour. At low grain, we are asking "what is the structural shape of this field?" and the answer is: it is consistently alphabetic text with one exception that contains punctuation. The single `a_a` record has some kind of separator character (a middle dot or similar punctuation) within the name, making it structurally different from the other 78 records. That is worth investigating — but the overwhelming consistency of the field is the main finding.

For CJK text, if you need to distinguish between names of different lengths, you would switch to HU (High-grain Unicode) mode, which preserves character counts. But for discovery profiling, the LU result tells us exactly what we need to know: this field is structurally uniform.

### Hypocenter Name (English)

```
Mask                                Count   Example
Aa Aa Aa                               18   Southern Ibaraki Prefecture
Aa a a Aa a Aa Aa                      12   Off the east Coast of Aomori Prefecture
Aa a Aa a Aa Aa                        10   Off the Coast of Ibaraki Prefecture
Aa Aa a Aa Aa                           8   Northern Inland Bay of Suruga
Aa Aa Aa, Aa                            7   Northern Nemuro District, Hokkaido
Aa, Aa Aa                               5   Chuetsu, Niigata Prefecture
Aa a a Aa a Aa                          4   Off the east Coast of Chiba
Aa Aa                                   3   Hyuganada Sea
Aa a Aa a Aa                            3   Off the Coast of Miyagi
Aa Aa a Aa-Aa Aa                        2   Adjacent Sea of Yonagunijima Island
Aa Aa a Aa Aa Aa                        2   Adjacent Sea of Tanegashima Island
Aa a a Aa a Aa-Aa Aa                    2   Off the northeast Coast of Miyako-jima Island
Aa a a Aa Aa, Aa                        1   Central and Southern Aichi Prefecture
Aa Aa _ Aa Aa Aa, Aa Aa                 1   Eastern Region · Off the Coast of Hokkaido
Aa Aa, Aa Aa                            1   Northern Tsugaru, Aomori Prefecture
```

The English names are far more structurally diverse than the Japanese names — 15 distinct masks for 80 values. This is because English uses spaces between words (each space creates a boundary in the mask) and distinguishes between uppercase and lowercase (the `Aa` vs `a` distinction captures title case vs lowercase words like "the", "of", "and").

The masks reveal a naming convention: locations use title case for significant words (`Southern`, `Ibaraki`, `Prefecture`) and lowercase for articles and prepositions (`the`, `of`, `a`). This is consistent across the dataset and explains why `Aa a a Aa a Aa Aa` (12 records, "Off the east Coast of Aomori Prefecture") and `Aa a Aa a Aa Aa` (10 records, "Off the Coast of Ibaraki Prefecture") are separate masks — the former has one extra lowercase word.

The `Aa Aa _ Aa Aa Aa, Aa Aa` mask (1 record) is interesting: the `_` in the mask indicates a punctuation character that is neither a letter, digit, nor space. The example value is `Eastern Region · Off the Coast of Hokkaido` — a middle dot (·) used as a separator. This is the only record that uses this compound naming format, making it a structural outlier.

The hyphens in masks like `Aa-Aa Aa` (e.g. `Yonagunijima Island`) reflect the romanisation conventions for Japanese place names, where compound words are sometimes hyphenated (`Miyako-jima`). The profiler treats hyphens as punctuation, which correctly separates them from the alphabetic text.

### Coordinate

```
Mask            Count   Example
_9.9_9.9-9_        72   +36.6+140.6-10000/
_9.9_9.9_9_         7   +45.0+142.2+0/
```

Two structural variants in a field of 80 values, and the masks make the difference immediately visible. The dominant format `_9.9_9.9-9_` (72 records) encodes latitude, longitude, and depth as `+lat+lon-depth/`, where the depth is negative (below sea level, as expected for earthquake hypocenters). The second format `_9.9_9.9_9_` (7 records) has a positive or zero third component — `+45.0+142.2+0/` — meaning the depth is zero or the value represents an elevation rather than a depth.

This is a JMA-specific coordinate encoding. A schema would describe this field as a string. A regex validator might check for numeric content. But the mask profiler instantly reveals that there are two structural variants, and the difference is the sign character before the third numeric component: `-` in 72 records, `+` in 7 records. An analyst seeing this for the first time would immediately ask: why do 7 earthquakes have a positive depth value? Are these shallow surface events? Is zero depth a default? The mask does not answer these questions, but it makes sure they get asked.

### Magnitude

```
Mask    Count   Example
9.9        80   3.6
```

Perfectly consistent. Every magnitude is a decimal number, collapsed to `9.9` by the low-grain mask. No exceptions, no missing values, no structural anomalies. This is what a well-controlled numeric field looks like under profiling.

### Maximum Intensity

```
Mask    Count   Example
9          80   1
```

Single digit, perfectly consistent across all 80 records. The JMA seismic intensity scale runs from 0 to 7 (with sub-levels like 5-lower and 5-upper, though those would have different masks if present). In this dataset, all maximum intensities are single-digit values.

### Prefecture Name (Japanese)

```
Mask    Count   Example
a         157   沖縄県
```

All 157 prefecture name values collapse to `a` — the same pattern we saw with the hypocenter names. Japanese prefecture names are composed entirely of kanji characters, and the LU mask treats them all identically. The count of 157 (versus 80 earthquakes) tells us that earthquakes routinely affect multiple prefectures — on average, about two prefectures per event, though the distribution is certainly skewed.

### City Name (Japanese)

```
Mask    Count   Example
a       1,545   錦江町
```

Again, near-total uniformity: 1,545 of 1,546 city names collapse to `a`. The one exception (not shown in this summary) likely contains a non-kanji character — a numeral, a Latin letter, or an unusual punctuation mark in the city name. At this level of consistency, a single exception in 1,546 values is exactly the kind of outlier the profiler is designed to surface.

### Station Name (Japanese)

```
Mask    Count   Example
a_      2,002   (station name with ＊ suffix)
a         413   (plain station name)
a9a_       12   (station name with digits and ＊ suffix)
a9a         6   (station name with digits, no ＊ suffix)
```

This is where the profiling gets genuinely interesting. The `a_` mask (2,002 of 2,433 values, 82.3%) indicates station names that end with a punctuation character. That character is ＊ — a full-width asterisk — and it is not decoration. In JMA data, the ＊ suffix marks stations that are not part of the official seismic network; they are supplementary observation points operated by local governments or other agencies. The `a` mask (413 values, 17.0%) represents official stations without the suffix.

The mask has discovered a structural encoding convention that carries semantic meaning. A schema would describe this field as a string. A data dictionary might (or might not) mention the ＊ convention. But the profiler finds it automatically, because the full-width asterisk is a punctuation character and the mask faithfully records its presence.

The `a9a_` and `a9a` masks (12 and 6 values respectively) indicate station names that contain digits — likely stations identified by number within a municipality, such as "第２観測点" (Observation Point 2). The digit creates a break in the alphabetic run, producing a three-segment mask instead of a single `a`.

### Station Name (English)

```
Mask                    Count   Example
Aa-a Aa_                1,225   Omitama-shi Koshin*
Aa Aa-a Aa_               331   Kawasaki Miyamae-ku Miyamae*
Aa-a Aa                    272   Yoron-cho Mugiya
Aa-a Aa-a_                 213   Hitachinaka-shi Ajigaura*
Aa Aa-a Aa-a_               93   Saitama Chuo-ku Sakuragi*
Aa-a-a Aa_                  74   Shin-hidaka-cho Mitsuishi*
Aa-a Aa-a                   54   Mishima-shi Shimokiyomizu
Aa Aa-a Aa                  43   Saitama Urawa-ku Tokiwa
Aa Aa_                      24   Neba Murayakuba*
Aa-a Aa-a Aa_               19   Tochigi-shi Nishikata-cho*
Aa-a-a Aa-a                 13   Shin-hidaka-cho Shizunai
Aa-a-a Aa-a_                13   Shin-hidaka-cho Shizunai*
Aa Aa-a Aa-a                11   Kawasaki Tama-ku Ishida
Aa-a-a                       7   (compound hyphenated name)
Aa-a Aa-a-a_                 7   Nikko-shi Arasawa-cho*
Aa-a-a Aa Aa_                4   Mo-oka-shi Shimokawaji*
Aa-a Aa Aa                   3   Mutsu-shi Wakinosawa Muraichi
Aa-a a-Aa_                   3   Kamagaya-shi c-Kamagaya*
Aa-a a_                      3   Kazo-shi c-Kazo*
Aa-a AaAa_                   2   Sammu-shi c-Sanbu*
```

The English station names produce 20 or more distinct masks for 2,433 values, and the mask distribution tells a rich story about Japanese geographic naming conventions in romanised form.

The dominant pattern `Aa-a Aa_` (1,225 values, 50.3%) represents the standard format: a municipality name with a hyphenated suffix (`-shi`, `-cho`, `-machi`, `-mura` indicating city, town, or village), followed by a district or station name, followed by the `*` marker for unofficial stations. The hyphen is structural — it separates the municipality type suffix from the name, and the mask faithfully captures it.

The `Aa Aa-a Aa_` pattern (331 values) adds an extra component: a prefecture or city name before the hyphenated municipality, as in `Kawasaki Miyamae-ku Miyamae*` where `Kawasaki` is the city and `Miyamae-ku` is the ward.

Two masks deserve special attention. The `Aa-a a-Aa_` pattern (3 values, e.g. `Kamagaya-shi c-Kamagaya*`) contains a lowercase single letter `a` followed by a hyphen and a capitalised name. The `c-Kamagaya` component suggests a coded prefix — perhaps a sub-station identifier. Similarly, `Aa-a AaAa_` (2 values, e.g. `Sammu-shi c-Sanbu*`) shows a run of mixed case with no space between components. These are minor inconsistencies in the romanisation scheme, and the profiler surfaces them without any prior knowledge of Japanese naming conventions.

The `_` at the end of many masks corresponds to the asterisk (`*`) in the English names — the same unofficial station marker we saw as ＊ in the Japanese names, but here rendered as a standard ASCII asterisk rather than the full-width variant. The bilingual data reveals an encoding inconsistency: Japanese names use ＊ (U+FF0A, full-width asterisk) while English names use * (U+002A, standard asterisk). Both carry the same meaning, but they are different characters.

### Station Intensity

```
Mask    Count   Example
9       2,433   1
```

Perfectly consistent across all 2,433 station observations. Every intensity value is a single digit.

### Station Latitude

```
Mask    Count   Example
9.9     2,433   36.26
```

Every latitude value is a decimal number, collapsed to `9.9` by the low-grain mask. No missing values, no formatting inconsistencies, no structural anomalies across 2,433 observations.

### Station Longitude

```
Mask    Count   Example
9.9     2,433   139.58
```

Same as latitude — perfectly consistent decimal numbers across all 2,433 values.

### Headline Text (Japanese)

```
Mask        Count   Example
9a9a9a_a_      80   ２１日１３時０３分ころ、地震がありました。
```

A single mask covers all 80 values, and it is one of the most revealing results in the entire profile. The mask `9a9a9a_a_` tells us that the headline text alternates between digits and alphabetic characters, with punctuation at certain positions. The example makes it clear: `２１日１３時０３分ころ、地震がありました。` translates roughly to "An earthquake occurred at approximately 13:03 on the 21st."

The digits in the mask are Japanese full-width numerals — `２１` rather than `21`, `１３` rather than `13`. These are Unicode characters in the Fullwidth Forms block (U+FF10 through U+FF19), and they are classified as digits by the Unicode standard. The bytefreq profiler, because it uses Unicode character class rules, correctly identifies them as digits and masks them as `9`. This is a validation of the Unicode-aware approach: a byte-level profiler working with ASCII assumptions would either fail on this text entirely or misclassify the full-width digits as alphabetic or unknown characters.

The alphabetic runs in the mask correspond to kanji and hiragana: `日` (day), `時` (hour), `分` (minute), `ころ` (approximately), `地震がありました` (an earthquake occurred). The punctuation marks `、` (Japanese comma) and `。` (Japanese full stop) produce the `_` segments.

The remarkable thing is the total consistency: all 80 headlines follow the same structural template. This is clearly a machine-generated string — a template like "{day}日{hour}時{minute}分ころ、地震がありました。" filled in with the event's date and time. The profiler confirms what we might suspect: this field is auto-generated, not human-authored, and its structure is completely predictable.

## Summary of Findings

Issues and observations discovered through mask-based profiling of 80 JMA earthquake events (2,433 station observations):

**Coordinate encoding:**
- Two structural variants: negative depth (72 records) vs positive/zero depth (7 records) → **Investigate:** are zero-depth events genuinely surface-level, or is zero a default value?

**Station names (Japanese):**
- ＊ (full-width asterisk) suffix on 82.3% of stations marks unofficial observation points → **Document:** this is a semantic encoding convention, not an error
- 18 stations contain digits in their names → **Accept:** legitimate naming convention for numbered observation points

**Station names (English):**
- Asterisk marker uses ASCII `*` (U+002A) while Japanese names use ＊ (U+FF0A) → **Flag:** encoding inconsistency between language variants
- Lowercase prefixed components (`c-Kamagaya`, `c-Sanbu`) in some station names → **Investigate:** what does the `c-` prefix signify?
- 20+ distinct masks for station names → **Accept:** structural diversity driven by legitimate variation in Japanese geographic naming conventions

**Hypocenter names (English):**
- One compound name using middle dot separator (`Eastern Region · Off the Coast of Hokkaido`) → **Flag:** unique formatting, may cause parsing issues if the middle dot is used as a delimiter elsewhere

**CJK text fields:**
- All Japanese text fields collapse to `a` at low grain → **Expected:** this is correct LU behaviour for CJK text, not a limitation. Use HU grain if length differentiation is needed.

**Headline text:**
- Full-width numerals (２１ instead of 21) correctly identified as digits by Unicode-aware masking → **Validated:** the profiler handles mixed-script text correctly

**Structural consistency:**
- Magnitude, maximum intensity, station intensity, station latitude, and station longitude are all perfectly consistent — single masks with zero exceptions across their respective populations → **No action required**

## Lessons Learned

**1. CJK characters and mask granularity.** At LU grain, all Japanese text — whether it is a two-character prefecture suffix or a twelve-character station name — collapses to a single `a`. This is not a limitation; it is the correct behaviour for a structural discovery tool. The question at low grain is "what kind of data is this?" and the answer for Japanese text is consistently "alphabetic." If you need to distinguish between short and long Japanese strings, switch to HU grain, which preserves character counts. But for finding structural anomalies — the ＊ suffix, the embedded digits, the punctuation separators — LU grain is exactly right, because those characters break the alphabetic run and create visible mask segments.

**2. Nested data works with the same techniques.** Six levels of JSON nesting, arrays within arrays within arrays, one-to-many fan-outs at every level — and the profiler does not care. Once flattened to key-value pairs, every leaf value is just a string to be masked. The flat enhanced format described in Chapter 9 was designed for exactly this kind of data: variable-width records where different rows have different numbers of fields. The 6,551 unique key paths from 80 records would be a nightmare in a traditional columnar profiler that expects a fixed schema. In the flat format, they are just 6,551 key-value pairs, each profiled independently.

**3. Bilingual data reveals encoding conventions.** The same semantic marker — "this is an unofficial station" — is encoded as ＊ (U+FF0A, full-width asterisk) in Japanese text and * (U+002A, standard ASCII asterisk) in English text. The profiler surfaces this automatically because the two characters belong to different Unicode blocks and produce different mask behaviours. A human reviewer looking at the English data alone might never notice the asterisk convention; looking at both languages through the profiler, the convention is unmistakable and the encoding inconsistency is immediately apparent.

**4. Structural conventions that are invisible to schemas are visible to masks.** The ＊ suffix on station names is not described in any JSON schema. It is not a separate field. It is not flagged by a key name or an attribute. It is a character appended to the end of a string value, carrying semantic meaning through convention alone. A schema validator would pass it without comment. A mask profiler flags it instantly — because it changes the structural pattern of the value from `a` to `a_`. This is precisely the kind of embedded, undocumented encoding convention that DQOR techniques are designed to detect.

**5. The ragged row problem is real, and the flat enhanced format handles it.** Eighty earthquake records produce 6,551 unique key paths because the array depths vary from record to record. In a traditional tabular format, you would have to either (a) create columns for the maximum possible number of stations, prefectures, areas, and cities — most of which would be empty in most records — or (b) normalise the data into multiple related tables before profiling. The flat enhanced format avoids both of these: each record is a bag of key-value pairs with no requirement for structural uniformity across records. This is not a theoretical advantage; with real nested data, it is the difference between profiling the data as-is and spending days on schema design before profiling can begin.

**6. One profiling technique, any data source.** The Companies House example in the preceding appendix profiles pipe-delimited CSV from a UK government register. This example profiles nested JSON from a Japanese government API. The data could not be more different in structure, language, encoding, or domain. The profiling technique is identical. Flatten, mask, count, sort, interpret. The masks change, the character classes change, the domain knowledge required for interpretation changes — but the method does not. That universality is the core claim of this book, and these two worked examples are the evidence.
