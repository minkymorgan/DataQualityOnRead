# Why Data Quality Still Breaks Things

There is a widely cited statistic that poor data quality costs organisations between 15 and 25 percent of revenue. The number has been repeated so often that it has become background noise, the kind of thing people nod at in presentations and then promptly ignore when scoping their next project. The reason it persists, despite everyone knowing about it, is structural: most data quality problems are invisible until they cause a failure downstream, and by then the cost of remediation is orders of magnitude higher than the cost of early detection.

Consider a simple example. A retail company receives a daily feed of product catalogue updates from a supplier. The feed is a CSV file, delivered via SFTP, containing product codes, descriptions, prices, and stock levels. The specification says prices are in GBP, formatted as decimal numbers with two decimal places. For six months the feed arrives on time, the prices parse correctly, and everyone is happy. Then one Monday the supplier's system is upgraded, and the price field starts arriving with a currency symbol prefix — `£12.99` instead of `12.99`. The downstream pricing engine, which casts the field to a numeric type, throws a parse error. The product catalogue goes stale. Customer-facing prices are wrong for four hours until someone notices and writes a hotfix.

The fix takes ten minutes. The investigation takes two hours. The post-incident review takes half a day. The customer complaints take a week to resolve. The root cause was a single character in a single field, and the total cost — in engineering time, reputational damage, and operational disruption — was wildly disproportionate to the simplicity of the underlying issue.

This pattern repeats across every industry that depends on data received from sources it does not control. The specific failures vary — date formats flip between `DD/MM/YYYY` and `MM/DD/YYYY`, encoding shifts from UTF-8 to Latin-1, a column that was always numeric starts containing the string `NULL` instead of an actual null — but the shape of the problem is always the same. Data that was assumed to be clean turns out not to be, and the assumption is only tested at the point of failure.

## The Read Problem

Most data quality tooling is designed around the assumption that you control the data pipeline end to end. Schema validation at the point of entry, constraint enforcement in the database, type checking in the application layer — these are all "quality on write" techniques, and they work well when you are the author of the data. The difficulty arises when you are the *reader* rather than the writer.

In modern data architectures, the proportion of data that arrives from sources you do not control is substantial and growing. Third-party feeds, partner integrations, open data portals, scraped web content, legacy system exports, IoT sensor streams, and API responses from services maintained by other teams — all of these represent data that was created according to someone else's assumptions, documented (if at all) according to someone else's standards, and delivered with whatever level of quality the source system happened to produce that day.

You cannot fix the source. In many cases you cannot even influence it. What you can do is understand what you have received, quickly and cheaply, before you attempt to use it. That understanding — structural, not semantic — is the domain of Data Quality on Read.

## What Goes Wrong

In working with data platforms across financial services, telecoms, government, and open data projects, we have seen the same categories of data quality failure appear repeatedly. They are worth enumerating because they inform the design of the profiling techniques that follow.

**Format inconsistency** is the most common. A date column contains values in three or four different formats — `2024-01-15`, `15/01/2024`, `Jan 15 2024`, and occasionally just `2024` — because the upstream system aggregated data from multiple sources without normalising it. A phone number column mixes UK mobile (`07700 900123`), international (`+44 7700 900123`), US (`(555) 123-4567`), and free-text entries like `"ask for Dave"`. Each of these is individually valid; the problem is that they coexist in the same column with no indicator of which format applies to which record.

**Encoding corruption** is subtler and often goes undetected for longer. A file that was encoded in Latin-1 is read as UTF-8, producing garbled characters in names and addresses. A BOM marker at the start of a CSV causes the first column header to parse incorrectly. Control characters — tabs, carriage returns, null bytes — appear in fields that should contain only printable text, breaking downstream parsers that assumed simple delimited input.

**Structural drift** happens when the shape of the data changes over time without corresponding updates to the documentation or the downstream systems that consume it. A new column is added to a feed, shifting all subsequent field positions. An optional field starts being populated where it was previously always empty, triggering unexpected code paths. A field that was always a single value starts containing comma-separated lists.

**Placeholder abuse** is endemic. The strings `N/A`, `NULL`, `none`, `n/a`, `-`, `TBC`, `unknown`, `test`, and the empty string all appear in production data as substitutes for missing values, each encoded differently, each requiring different handling, and none of them matching the expected format of the field they occupy. In one government dataset we profiled, the placeholder `REDACTED` appeared in the postcode field of 3% of records, which was useful to know before attempting geocoding.

**Population shifts** are the hardest to detect without profiling. The data looks structurally correct — all the fields parse, all the types are right — but the distribution has changed. A column that previously had 99.5% population now has 15% nulls because an upstream collection process was turned off. A field that used to contain 8 distinct values now contains 47, because a system migration expanded the code set without updating the documentation.

None of these problems are exotic. They are the ordinary, everyday reality of working with data that someone else created. The question is not whether they exist in your data — they almost certainly do — but whether you have a systematic way of finding them before they cause harm.
