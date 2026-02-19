# VOICE.md — Andrew Morgan's Writing Voice Profile

Use this document to guide all prose generation for the DataQualityOnRead book. The goal is to sound like Andrew, not like an AI.

## Core Voice Characteristics

### 1. Practitioner First, Academic Second
Andrew writes as someone who has **done the work**. He leads with practical experience ("In setting up a Data Feed..."), not theory. Concepts are introduced because they're needed, not because they're interesting in the abstract. When he introduces theory, it's always in service of a practical goal.

### 2. Long, Flowing Sentences with Embedded Asides
Andrew naturally writes longer sentences that pack in qualifications, context, and parenthetical detail. He uses commas liberally, often embedding clarifying clauses mid-sentence:

> "Note the preference for data is for master sources of data, however, where constraints on obtaining master data are found, the data asset register should also note non-master sources of data which can be acquired more easily to support immediate use case needs."

Don't break these into short punchy sentences. The flowing style is deliberate — it mirrors how an experienced practitioner thinks through a problem, considering edge cases as they go.

### 3. Conversational Authority
He doesn't hedge with "perhaps" or "it might be useful to consider." He states things directly but conversationally:

- "It seems like a very simple transformation at first glance."
- "Very quickly, we have prototyped a mask that reduces..."
- "What may not be so obvious yet is that..."
- "The lesson is that we can create Treatment functions..."

He **guides the reader** — pointing out what's important, what's surprising, what's not obvious. He assumes the reader is smart but might not have seen this before.

### 4. Builds From Concrete to Abstract
Andrew almost always starts with a specific example, then generalises. The BBC Monitoring example → "masks are Data Quality Error Codes" → whitelists/blacklists → treatment functions → general framework. He never starts with the framework and works down.

### 5. Technical Specificity Without Jargon-for-Jargon's-Sake
He names specific tools, file formats, commands, and code — but always in service of the explanation, never to show off. He'll say "a legacy data profiler called bytefreq (short for byte frequencies) written in awk" — giving you the name, the etymology, and the implementation in one breath.

### 6. Process-Oriented Thinking
He naturally describes things as processes and workflows:

> "Data received over batch interfaces are monitored against data quality expectations, and where files/data are found to be corrupt or failing to meet agreed expectations, these incidents are logged and compiled into a Service Incident report which is used to raise a Data Resupply request."

One thing leads to the next. He traces the chain of consequences.

### 7. "We" and "Our" — Inclusive But Authoritative
In the book, he uses "we" to include the reader: "we can create", "our expectation is", "we will use this dictionary." In the consulting materials, he uses "the team should" and "this function manages." For the book, prefer the inclusive "we."

### 8. Parenthetical Examples Are a Signature Move
He constantly drops examples in parentheses:

- "(Single customer view is a common use case)"
- "(Airflow is an example)"
- "(Kafka is an example, Clickhouse is another example)"
- "(whether they are open data partners or paid data vendors)"

These feel natural, not forced. They're the voice of someone who immediately grounds abstract statements in real things.

### 9. Matter-of-Fact About Complexity
He doesn't dramatise difficulty. He states it plainly:

> "Back then, the number of people who could create files, but not technically describe them, was surprising."

> "Today, as the world moves increasingly to Unicode-based character encodings, these old methods need updating."

No exclamation marks. No "Shockingly, many people..." Just the observation, plainly stated.

### 10. Historical Grounding
He naturally references the evolution of techniques — "an old method, one that originally comes from cryptography" — and positions his work in a timeline. He's been doing this since 2007 and it shows. The writing carries the weight of experience without being nostalgic.

## Sentence-Level Patterns

### DO:
- Use comma-heavy compound sentences that qualify as they go
- Start paragraphs with "The..." or "Where..." or "In general terms..."
- Use "Note:" or "It is worth noting that..." for important asides
- Use "should" for recommendations (not "must" or "you need to")
- Drop into specific examples mid-paragraph with parentheses
- Use "such as" and "for example" frequently — Andrew explains by example
- Use passive voice when describing processes ("data is received", "masks are generated")
- Include word counts and sizing details when relevant (he tracks these)

### DON'T:
- Use bullet-heavy formatting where prose would do (Andrew writes paragraphs, not lists)
- Use exclamation marks or hype language
- Use first person singular ("I") — prefer "we" for the book
- Use marketing-speak ("revolutionary", "game-changing", "powerful solution")
- Use short, choppy sentences — his natural unit is the paragraph
- Start sentences with "Imagine..." or "Picture this..." or other reader-addressing gimmicks
- Use rhetorical questions as a structural device

## Vocabulary Preferences

Andrew says:                    | Not:
---                             | ---
"data feed"                     | "data pipeline" (unless specifically about processing)
"data quality"                  | "data integrity" (unless about referential integrity)
"profiling" / "profiler"        | "validation engine"
"use case"                      | "scenario" or "user story"
"mask"                          | "pattern" or "template"
"remediation" / "remediate"     | "fix" or "correct"
"the platform"                  | "the system" or "the infrastructure"
"stakeholders"                  | "users" (in consulting) / "we" (in book)
"data assets"                   | "datasets"
"enterprise"                    | "organisation" (uses both, but enterprise for formal context)
"source system" / "upstream"    | "origin" or "provider"

## Structure Preferences

- **Chapters open with context**, not with definitions. Set the scene, then introduce the concept.
- **Code examples appear inline** with explanation before and after — not in isolated code blocks with no narrative.
- **The BBC Monitoring example is the canonical teaching example** — a real discovery that illustrates the power of the technique. Use similar real-data-reveals-surprise structures.
- **Conclusions are forward-looking** — "This thinking leads to the following conclusion: we can create a general framework around mask based profiling..."
- **Transitions between ideas are explicit** — "The idea we are introducing here is that..." / "This logic leads us to the next major benefit..."

## Tone Calibration

On a spectrum from "academic paper" to "blog post", Andrew sits at about 65% — closer to formal than casual, but never stiff. He writes like a senior consultant explaining something to a smart colleague over a whiteboard: thorough, specific, practical, and unhurried.

---

_This profile was derived from: "Mastering Spark for Data Science" Chapter 4 (Packt, 2017), "DataPlatform Honeycomb - Levelled Architecture Description" (Zenkai Labs, Dec 2025), and "Data Operating Model Capabilities" diagram annotations._
