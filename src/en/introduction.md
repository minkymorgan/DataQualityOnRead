# Introduction {.unnumbered}

In 2007, while working on a data migration for a financial services client, we received a file that was described as containing customer addresses. The specification said the fields were fixed-width, ASCII-encoded, with UK postcodes in column 47. When we loaded the file and profiled it, we discovered that column 47 contained a mixture of valid postcodes, phone numbers, the string "N/A" repeated 11,000 times, and — in one memorable case — what appeared to be someone's lunch order.

The specification was wrong. Or rather, the specification described what the data *should* look like, and the file contained what the data *actually* looked like. These are not the same thing, and the gap between them is where data quality lives.

This experience, repeated in various forms across financial services, telecoms, government, and open data projects over nearly two decades, led to the development of a simple but surprisingly powerful technique: **mask-based data profiling**. The idea is straightforward. Take every character in a data field and translate it to its character class — uppercase letters become `A`, lowercase become `a`, digits become `9`, and everything else (punctuation, spaces, symbols) stays as it is. The result is a structural fingerprint of the value, a *mask*, that strips away the content and reveals the shape of the data underneath.

When you profile a column by counting the frequency of each mask, patterns emerge immediately. The dominant masks tell you what the data is supposed to look like. The rare masks — the long tail — tell you where the problems are hiding. No regex, no schema, no assumptions about the data required. Just a mechanical translation that lets the structure speak for itself.

This book describes that technique, the architecture around it, and the tools that implement it. The technique itself is called **Data Quality on Read** (DQOR), a deliberate parallel to the "Schema on Read" principle that underpins modern data lake architectures. The core idea is the same in both cases: accept raw data as-is, defer processing until the moment of consumption, and never overwrite the original. In the schema case, you defer structural interpretation. In the quality case, you defer profiling, validation, and remediation. The benefits are the same: agility, provenance, and the ability to reprocess history when your understanding improves.

The tools are **bytefreq**, an open-source command-line profiler now implemented in Rust, and **DataRadar**, a browser-based profiling tool that runs entirely client-side using WebAssembly. Both implement DQOR from the ground up, and both are free to use.

The book is structured in three parts. Part I sets out the problem: why data quality is hard, and why the traditional approaches — schema validation, statistical profiling, regex-based checks — leave gaps that mask-based profiling can fill. Part II introduces the technique in detail: masks, grain levels, Unicode handling, population analysis, error codes, and treatment functions. Part III describes the architecture that ties it all together: the flat enhanced format (a trick borrowed from Hadoop-era feature stores), and the tools that implement it at different scales.

The intended audience is anyone who works with data they did not create: data engineers, analysts, scientists, and the growing number of people who find themselves responsible for data quality without having chosen it as a career. The technique is simple enough to prototype in a single line of `sed`, and powerful enough to run in production at enterprise scale. We will cover the full range.

## Discovery Before Exploration

Before you profile the values in a field, you need to know what fields exist and how populated they are. This sounds obvious. It is obvious. And yet the most common mistake in data quality work is to dive straight into field-level analysis — examining the values in a column — without first understanding the shape of the dataset as a whole. Structure discovery comes before content exploration. Always.

For tabular data — CSV files, fixed-width extracts, pipe-delimited feeds — this means counting non-null values per column. If a dataset has 55 columns but only 20 of them are more than 50% populated, that fact alone reshapes your entire profiling strategy. You do not need to know *what* is in the other 35 columns yet. You need to know they are mostly empty. That knowledge takes seconds to acquire and saves hours of misdirected effort.

For nested data — JSON, XML, hierarchical formats — the same principle applies, but the discovery step is different. You walk the structure to find every field path, then count how many records contain each path. A JSON feed might have 200 distinct field paths, but any given record might populate only 40 of them. A field that appears in 10% of records tells you something important before you have looked at a single value. A field that appears in 100% of records tells you something different. The population profile across all paths is the first thing you need, and the last thing most people think to check.

Think of it as a census before a survey. The census maps the territory: what exists, where it is, how much of it there is. The survey examines individual items in detail. Running the survey without the census means you do not know what you are missing, what you are over-sampling, or where your effort is best spent. The field population profile is the map. Profile without it and you are navigating blind.

This principle prevents wasted effort in both directions. Profiling a field that is 99% empty is rarely the best use of your time — you will generate a mask frequency table dominated by a single empty-value pattern and learn almost nothing. Conversely, discovering that a field described as "mandatory" in the specification is only 45% populated is itself a significant data quality finding — and you found it in the discovery phase, before spending any time on content analysis. Some of the most valuable insights come from the map, not from the territory it describes.

The worked examples in this book follow this principle explicitly. Each begins with a structure discovery phase — field counts, population rates, structural metadata — before moving to field-by-field mask analysis. This is not a stylistic choice. It is the method. Discovery before exploration, every time.

## Data Quality Without Borders

The world's largest generators and consumers of data are in the public sector. Central, regional, and local governments manage millions of data transfers across ministerial boundaries every day. This separation of concerns makes government the single largest environment where Data Quality on Read is most urgently needed.

The stakes are high. "Single view of citizen" systems help governments deliver better services and ensure people do not fall between the cracks. But building these views requires integrating data from systems that were never designed to talk to each other, encoded in formats nobody fully documented. And because the data is personally identifiable, access to view raw records is rightly restricted — making data quality work uniquely difficult. You need to understand structure and quality without seeing content. This is where mask-based profiling shines: a mask reveals the shape of the data without exposing whose data it is.

The 33 languages in DataRadar's first tier of localisation — from English and French to Amharic, Hausa, Swahili, Tamil, Nepali, and Chinese — cover approximately 5.5 billion citizens. Data quality tools have historically supported only English interfaces and Latin-script datasets. A civil servant in Addis Ababa profiling census data in Amharic, or a local government analyst in Lagos working with Hausa-language records, had no tools built for them. DataRadar and bytefreq are.

All citizens deserve effective government services, and data quality is a prerequisite for delivering them. Multilingual, privacy-first, zero-install tools that work across scripts, languages, and borders — that is the ambition.

## From Files to Services

The techniques in this book can profile a single file in seconds. But the real prize is bigger than files.

Consider a government department that receives data from dozens of external collectors — local councils, NHS trusts, schools, partner agencies — and publishes onward to downstream consumers. How does a Chief Data Officer know whether the department is producing good quality data? How does a CTO assure the service, not just individual datasets?

The answer is to treat data quality profiling as **infrastructure**, not as a one-off activity. The building blocks described in this book — mask-based profiling, the flat enhanced format, population analysis, assertion rules — are designed to assemble into a monitoring architecture that can assure an entire data service.

The pattern has two sides.

**Exit checks** run at the point of production. Before a department publishes a data feed, the profiling engine runs against the output and generates a quality report — mask distributions, population rates, character encoding composition, assertion rule results. This report is stored as a timestamped fact record. Over weeks and months, a timeseries builds up: a continuous measurement of what the department is actually shipping.

**Entrance checks** run at the point of consumption. When a downstream system receives a data feed, the same profiling engine runs against the input. The entrance report is compared against the expected baseline (derived from the exit checks or from an agreed specification). Deviations are flagged. New masks appearing, population rates dropping, encoding shifts — all are detected automatically, before the data enters the consumer's pipeline.

Between these two checkpoints, something powerful emerges: **line of sight**. When a downstream system encounters a quality issue, the entrance check report traces it back to the feed. The feed's exit check report traces it back to the collector. The timeseries shows when the problem started. Connected to lineage tools that track data flow across systems, this creates an automated root cause analysis — not "something is wrong somewhere" but "this specific field in this specific feed from this specific collector started producing a new mask pattern on this date, and the downstream impact is quantifiable."

That quantification matters. When you can say "Department X's data collection issues caused 2,000 downstream failures last quarter, costing an estimated £Y million in rework, delayed decisions, and incorrect outputs," the conversation changes. Quality stops being an abstract concern and becomes a line item. The timeseries is the measuring stick that makes consistent performance conversations possible — not blame, but evidence.

This reframes the purpose of data quality. The traditional question is: "Is this data fit for purpose?" — meaning, can the immediate consumer use it? The better question is: **"Is this data fit for the journey?"** Data rarely has one consumer. A dataset collected by a local council may pass through a regional aggregator, a central government platform, a statistical publication pipeline, and a public API before reaching its final consumers. Quality at the point of collection is not enough if the data degrades, is misinterpreted, or hits structural incompatibilities at any stage of that journey. Fit for the journey means the data carries enough structural metadata — masks, population profiles, assertion results — to be understood and validated at every stage, by every hand it passes through.

The profiling reports described in this book — both the DQ mask frequency tables and the CP character profiling reports — are the raw telemetry for this monitoring architecture. They are structured, machine-readable, and designed to be stored and queried as fact tables. The technical implementation — time-partitioned directories, DuckDB queries, KPI dashboards — is covered in the Quality Monitoring chapter in Part III.

The tools in Part III are the building blocks. The architecture they enable is a data quality assurance service: continuous, measurable, and accountable.

Let's begin.
