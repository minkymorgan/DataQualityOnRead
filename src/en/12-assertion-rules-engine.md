# The Assertion Rules Engine: Inside bytefreq

The preceding chapters described the DQOR framework conceptually — masks, population analysis, error codes, treatment functions, and the flat enhanced format. This chapter opens the bonnet. We will walk through the actual Rust code that implements assertion rules in bytefreq, show how the rules engine works, and explain how to add a new rule. If you are not a Rust programmer, do not worry — the patterns are straightforward and the logic reads more like pseudocode than systems programming. The important thing is the *design patterns*, not the language syntax.

## Architecture

The rules engine in bytefreq is deliberately simple. It consists of two files in the `src/rules/` directory:

- **`assertions.rs`** — a library of assertion functions, each of which examines a (field_name, raw, HU, LU) tuple and returns zero or more assertions about the value.
- **`enhancer.rs`** — a thin orchestration layer that calls `execute_assertions` and returns the results.

When bytefreq runs in enhanced mode (`-e` or `-E`), every value in the input is processed through a pipeline:

1. The raw value is read from the input (CSV column, JSON field, etc.).
2. The HU (high-grain Unicode) and LU (low-grain Unicode) masks are generated.
3. The triple `(raw, HU, LU)` is passed to the rules engine along with the field name.
4. The rules engine runs all applicable assertions and returns a JSON object.
5. The output is written in the flat enhanced format: `{ "raw": ..., "HU": ..., "LU": ..., "Rules": ... }`.

The processing is parallelised across columns using Rayon, so on a multi-core machine the assertion checks run concurrently for each field in a row:

```rust
fn process_tabular_line_as_json(
    processed_fields: &Vec<(String, String)>
) -> serde_json::Value {
    let json_line: HashMap<String, serde_json::Value> = processed_fields
        .par_iter()
        .map(|(column_name, value)| {
            let hu_masked_value = mask_value(value, "HU", column_name);
            let lu_masked_value = mask_value(value, "LU", column_name);

            let data = json!({
                "raw": value,
                "LU": lu_masked_value,
                "HU": hu_masked_value
            });

            let assertions = process_data(&column_name, &data);

            let enhanced_value = json!({
                "raw": value,
                "HU": hu_masked_value,
                "LU": lu_masked_value,
                "Rules": assertions
            });

            (column_name.clone(), enhanced_value)
        })
        .collect();

    serde_json::Value::Object(json_line.into_iter().collect())
}
```

The key thing to notice is that the assertion rules receive the mask as well as the raw value. This is the design pattern that makes the engine efficient: the mask acts as a fast structural filter, allowing rules to skip values that are structurally irrelevant without parsing or interpreting them.

## The Enhancer

The enhancer (`src/rules/enhancer.rs`) is intentionally minimal:

```rust
use crate::rules::assertions::execute_assertions;

pub fn process_data(
    field_name: &str,
    data: &serde_json::Value
) -> Option<serde_json::Value> {
    let lu = data["LU"].as_str().unwrap_or("");
    let hu = data["HU"].as_str().unwrap_or("");
    let raw = data["raw"].as_str().unwrap_or("");

    let assertions = execute_assertions(field_name, raw, lu, hu);

    if assertions.as_object().unwrap().is_empty() {
        None
    } else {
        Some(assertions)
    }
}
```

It extracts the triple from the JSON structure, calls `execute_assertions`, and returns `None` if no rules matched (keeping the output sparse — fields with no applicable rules produce no Rules column, which saves space in the flat enhanced output).

## The Assertions Library

The core of the engine is `execute_assertions` in `src/rules/assertions.rs`. This function takes the field name, raw value, LU mask, and HU mask, and builds up a JSON object of assertions:

```rust
pub fn execute_assertions(
    field_name: &str,
    raw: &str,
    lu: &str,
    hu: &str
) -> serde_json::Value {
    let mut assertions: serde_json::Map<String, serde_json::Value> =
        serde_json::Map::new();

    // Always compute string length
    assertions.insert(
        "string_length".to_string(),
        json!(string_length(raw))
    );

    // Postal code country detection — only if field name contains "post"
    if field_name.to_lowercase().contains("post") {
        let possible_countries = get_possible_countries(
            field_name, raw, hu, lu
        );
        if !possible_countries.is_empty() {
            assertions.insert(
                "poss_postal_country".to_string(),
                json!(possible_countries)
            );
        }
    }

    // Country name standardisation
    if field_name.to_lowercase().contains("country")
        && !lu.chars().any(|c| c.is_numeric())
    {
        if let Some((iso3, region_code)) = country_name_to_iso3(raw)
            .map(|iso3| (iso3.clone(), format!("{}-{}", iso3, raw)))
            .or_else(|| handle_country_name_variations(raw))
        {
            assertions.insert("std_country_iso3".to_string(), json!(iso3));
            assertions.insert("std_region_code".to_string(), json!(region_code));
        }
    }

    // Numeric detection
    if lu == "9" || lu == "9.9" {
        assertions.insert(
            "is_numeric".to_string(),
            json!(is_numeric(raw))
        );
    }

    // UK postcode validation
    if lu == "A9 9A" || hu == "A9A 9A" {
        assertions.insert(
            "is_uk_postcode".to_string(),
            json!(is_uk_postcode(raw))
        );
    }

    // Date parsing
    if lu == "9_9_9" {
        assertions.insert(
            "std_date".to_string(),
            json!(parse_date(raw))
        );
    }

    // Date of birth sensibility check
    if hu == "99_99_9999" && field_name.to_lowercase().contains("dob") {
        assertions.insert(
            "is_sensible_dob".to_string(),
            json!(is_sensible_dob(raw))
        );
    }

    serde_json::Value::Object(assertions)
}
```

There are several design patterns worth noting here.

## Pattern 1: Mask-Gated Rules

Most rules are gated by the LU or HU mask. The UK postcode check only fires when `lu == "A9 9A"` — meaning the value structurally looks like a postcode (letters, digits, space, digits, letters). The date parser only fires when `lu == "9_9_9"` — meaning the value has three groups of digits separated by a non-digit character. The numeric check only fires when `lu == "9"` or `lu == "9.9"`.

This is efficient. Rather than running every assertion against every value (which would be wasteful for a million-row file with dozens of columns), the mask pre-filters. A name column with mask `Aaaa Aaaaa` will skip the postcode check, the numeric check, and the date parser entirely. Only rules whose structural precondition matches the mask will execute.

This is the same principle introduced in Chapter 7 (Masks as Error Codes), but applied in reverse: instead of using masks to *detect* problems, we use them to *select* which enhancement rules are applicable.

## Pattern 2: Field-Name-Aware Rules

Some rules use the field name as additional context. The postal country detection only runs when the field name contains `"post"`. The country name standardisation only runs when the field name contains `"country"`. The date-of-birth sensibility check only runs when the field name contains `"dob"`.

This is a pragmatic heuristic. A value of `SW1A 1AA` in a field called `postcode` should be checked as a UK postcode. The same value in a field called `reference_code` probably should not. The field name provides domain context that the mask alone cannot.

The heuristic is deliberately loose — `contains("post")` will match `postcode`, `postal_code`, `home_postcode`, `post_code`, and even `post_office_box`. This is intentional: it is better to over-match and produce an assertion that the consumer can ignore, than to under-match and miss a useful suggestion.

## Pattern 3: Standardisation Suggestions

Several rules do not just detect a property but suggest a standardised form. The country name rule maps free-text country names to ISO 3166-1 alpha-3 codes:

```rust
fn country_name_to_iso3(value: &str) -> Option<String> {
    let name_to_iso3 = country(|c| (
        c.name.to_lowercase(),
        c.iso3
    ));
    name_to_iso3
        .get(&value.to_lowercase())
        .map(|s| s.to_string())
}
```

The function uses the `geonamescache` crate to look up country names against a known dictionary, returning the ISO3 code if a match is found. It also handles common variations that the standard dictionary misses — `"England"`, `"Scotland"`, `"Wales"`, and `"Northern Ireland"` are mapped to their ISO codes with region suffixes:

```rust
fn handle_country_name_variations(country_name: &str) -> Option<(String, String)> {
    match country_name.to_lowercase().as_str() {
        "england"          => Some(("GBR".to_string(), "GB-ENG".to_string())),
        "scotland"         => Some(("GBR".to_string(), "GB-SCT".to_string())),
        "northern ireland" => Some(("GBR".to_string(), "GB-NIR".to_string())),
        "wales" | "cymru"  => Some(("GBR".to_string(), "GB-WLS".to_string())),
        _ => None,
    }
}
```

The output in the Rules column would look like:

```json
{
  "std_country_iso3": "GBR",
  "std_region_code": "GBR-England"
}
```

This is a *suggestion*, not a correction. The raw value `"England"` is preserved in the `.raw` column. The consumer can choose to use the ISO3 code, or keep the original, or apply their own mapping. The engine surfaces the assertion; the consumer decides what to do with it.

## Pattern 4: Postal Code Country Detection

The `get_possible_countries` function is a particularly good example of mask-driven inference. It uses the HU mask of a postal code to determine which countries could have produced that format:

```rust
fn get_possible_countries(
    _column_name: &str, raw: &str, hu: &str, lu: &str
) -> Vec<String> {
    let mut possible_countries: Vec<String> = Vec::new();

    match hu {
        "9999" => {
            possible_countries.extend(vec![
                "AT", "BE", "BG", "CH", "CY", "CZ", "DK", "EE",
                "FI", "GR", "HU", "IE", "LT", "LU", "LV", "MT",
                "NL", "NO", "PL", "PT", "RO", "SE", "SI", "SK"
            ].into_iter().map(|s| s.to_string()));
        }
        "99999" => {
            possible_countries.extend(vec![
                "DE", "ES", "FR", "HR", "IT"
            ].into_iter().map(|s| s.to_string()));
        }
        "999-99" => {
            possible_countries.push("SE".to_string());
        }
        "AAA-9999" => {
            possible_countries.push("IE".to_string());
        }
        _ => {}
    }

    // Refine using value-level checks
    if lu == "9-9999" && raw.starts_with("1") {
        possible_countries.retain(|c| c == "DE");
    }

    // UK postal code patterns
    let uk_patterns = vec!["A9 9A", "A9A 9A", "A9A"];
    if uk_patterns.contains(&lu) {
        possible_countries.push("UK".to_string());
    }

    possible_countries
}
```

Notice the two-level logic. First, the HU mask narrows the field to a set of possible countries (a 4-digit postal code could be Austrian, Belgian, Swiss, etc.). Then, value-level checks refine the set further (a 4-digit code starting with `0` is likely Dutch; a 5-digit code starting with `9` is likely French). The result is a list of *possible* countries, not a definitive answer — again, a suggestion that the consumer can use to inform their own logic.

## Implementing a New Rule

Adding a new assertion rule to bytefreq involves three steps.

### Step 1: Write the Detection Function

Create a function in `assertions.rs` that takes a raw value (and optionally the masks or field name) and returns the assertion result. For example, a rule to detect email addresses:

```rust
pub fn is_email(value: &str) -> bool {
    let re = Regex::new(
        r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    ).unwrap();
    re.is_match(value)
}

pub fn extract_email_domain(value: &str) -> Option<String> {
    value.split('@').nth(1).map(|s| s.to_lowercase())
}
```

### Step 2: Wire It Into execute_assertions

Add a conditional block in the `execute_assertions` function, gated by the appropriate mask pattern:

```rust
// Email detection — LU mask "a@a.a" covers most email patterns
if lu.contains("@") && lu.contains(".") {
    assertions.insert(
        "is_email".to_string(),
        json!(is_email(raw))
    );
    if let Some(domain) = extract_email_domain(raw) {
        assertions.insert(
            "email_domain".to_string(),
            json!(domain)
        );
    }
}
```

The mask gate here is simple: if the LU mask contains both `@` and `.`, the value *might* be an email address (since those punctuation characters are preserved in the mask). The `is_email` function then performs the definitive check, and `extract_email_domain` provides a standardised extraction.

### Step 3: Build and Test

```bash
cargo build
echo 'name,email,postcode
John Smith,john@example.com,SW1A 1AA
Jane Doe,jane.doe@company.co.uk,EC2R 8AH' | cargo run -- -E
```

The output for the email column would include:

```json
{
  "email": {
    "raw": "john@example.com",
    "HU": "aaaa@aaaaaaa.aaa",
    "LU": "a@a.a",
    "Rules": {
      "string_length": 16,
      "is_email": true,
      "email_domain": "example.com"
    }
  }
}
```

### Design Guidelines for New Rules

When writing a new assertion rule, several principles from the existing codebase are worth following:

**Gate by mask first.** The mask check should be the outer conditional, because it is essentially free (a string comparison) and filters out the majority of values that cannot possibly match. Only values that pass the mask gate should incur the cost of the full assertion logic (regex matching, parsing, dictionary lookup, etc.).

**Use the field name as a hint, not a requirement.** Field-name matching (`field_name.contains("post")`) is useful for disambiguation but should not be the only gate. Some datasets have opaque field names (`col_7`, `field_12`), and the rule should still fire for structurally matching values even when the field name provides no context.

**Return suggestions, not corrections.** The assertion should describe what the value *is* or what it *could be*, not what it *should be changed to*. The consumer decides whether to act on the suggestion. This keeps the rules engine non-destructive and maintains the DQOR principle of preserving the raw value.

**Cache expensive lookups.** The country name lookup uses a `RwLock<HashMap>` cache to avoid repeated dictionary scans. Any rule that performs an expensive operation (network call, large dictionary lookup, complex regex compilation) should cache results for values it has seen before. The `lazy_static` pattern used for the country cache is a good template:

```rust
lazy_static! {
    pub static ref COUNTRY_NAME_TO_ISO3_CACHE:
        RwLock<HashMap<String, Option<String>>> =
            RwLock::new(HashMap::new());
}
```

**Keep rules independent.** Each rule should be self-contained. Rules should not depend on the output of other rules, and the order in which they execute should not matter. This allows the engine to run rules in parallel (which it does via Rayon) and makes it safe to add, remove, or modify rules without side effects.

## The Rules as a Living Library

The assertion rules in bytefreq are not a closed set. They are a starting point — a library of common patterns that cover postal codes, country names, dates, numeric values, and basic structural properties. As the tool encounters new types of data, new rules are added.

This is the same continuous improvement loop described in Chapter 8 (treatment functions): profile the data, discover new patterns, write rules to detect and characterise them, and add the rules to the library. Over time, the library grows to reflect the kinds of data that bytefreq's users actually encounter, making the flat enhanced output increasingly useful with each release.

The rules are also an invitation. Because the engine is open source and the pattern for adding a new rule is straightforward — write a function, gate it by mask, wire it into `execute_assertions` — users with domain-specific knowledge can contribute rules for their own data types. The mask-gated architecture means domain-specific rules coexist with the general-purpose ones without interference, and the flat enhanced format ensures that all assertions — general and domain-specific — are delivered to consumers in a consistent structure.

To make this concrete, here are sketches for three domain-specific rules that follow the same patterns described above.

### Example: NHS Number Validation (Healthcare)

An NHS number is a 10-digit identifier with a modulus 11 check digit. The mask gate is simple: `hu == "9999999999"` (exactly 10 digits). The validation function computes the weighted sum and checks the remainder:

```rust
// Gate: hu == "9999999999"
pub fn is_nhs_number(value: &str) -> bool {
    let digits: Vec<u32> = value.chars().filter_map(|c| c.to_digit(10)).collect();
    if digits.len() != 10 { return false; }
    let weighted_sum: u32 = digits[..9].iter()
        .enumerate()
        .map(|(i, &d)| d * (10 - i as u32))
        .sum();
    let remainder = weighted_sum % 11;
    let check = if remainder == 0 { 0 } else { 11 - remainder };
    check != 10 && check == digits[9]
}
```

The mask gate ensures this function never fires on phone numbers, postcodes, or other 10-digit values in columns that are not plausibly NHS numbers. A field-name hint (`field_name.contains("nhs")` or `field_name.contains("patient")`) could narrow it further.

### Example: IBAN Detection (Financial Services)

An IBAN starts with a two-letter country code, followed by two check digits, followed by a country-specific Basic Bank Account Number (BBAN). The HU mask for a GB IBAN looks like `AA99AAAA99999999999999` — 22 characters, letters then digits. The mask gate targets this family of patterns:

```rust
// Gate: hu starts with "AA99" and length matches known IBAN lengths
pub fn is_valid_iban(value: &str) -> bool {
    let clean: String = value.chars().filter(|c| !c.is_whitespace()).collect();
    if clean.len() < 15 || clean.len() > 34 { return false; }
    // Move first 4 chars to end, convert letters to digits (A=10..Z=35)
    let rearranged = format!("{}{}", &clean[4..], &clean[..4]);
    let numeric: String = rearranged.chars().map(|c| {
        if c.is_alphabetic() {
            format!("{}", c.to_ascii_uppercase() as u32 - 55)
        } else {
            c.to_string()
        }
    }).collect();
    // Modulus 97 check
    numeric.chars().fold(0u64, |acc, c| {
        (acc * 10 + c.to_digit(10).unwrap() as u64) % 97
    }) == 1
}
```

The output might include both validation and decomposition:

```json
{
  "is_iban": true,
  "iban_country": "GB",
  "iban_bban": "NWBK60161331926819"
}
```

### Example: Email Address Detection

The email rule shown in the "Implementing a New Rule" section above is another example of the pattern. The mask gate (`lu.contains("@") && lu.contains(".")`) is structural, the validation is semantic, and the extraction (`email_domain`) provides a useful standardisation suggestion. Together, these three examples — healthcare, financial services, and general-purpose — illustrate how the same mask-gate-then-validate pattern extends to any domain.
