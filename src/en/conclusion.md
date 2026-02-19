# Conclusion {.unnumbered}

Mask-based profiling is not a silver bullet. It will not catch semantic errors — a phone number that is structurally valid but belongs to the wrong person, a date that is correctly formatted but factually wrong, a numeric value that parses fine but represents a measurement in the wrong units. It will not replace domain expertise, business validation rules, or statistical anomaly detection. Those techniques have their place, and they should continue to be used where they are appropriate.

Mask-based profiling is complementary to tools like Great Expectations, dbt tests, and Soda — not a replacement for them. Those tools excel at *validating known expectations*: is this column non-null? Does this value fall within a range? Does this foreign key relationship hold? Mask-based profiling excels at *discovering what you did not know to expect*. Use DQOR to explore and characterise the data first, then encode what you learn as expectations in whatever validation framework your pipeline already uses. The masks tell you what to test for; the validation tools enforce the tests.

What mask-based profiling does, and does exceptionally well, is provide a **fast, assumption-free structural census** of any dataset at the point of consumption. It answers the question "what does this data actually look like?" before you invest time and resources in trying to use it. It generates quality metadata — masks, population profiles, error codes — as a side effect of profiling, at no additional cost. And it does so deterministically, reproducibly, and at any scale from a single CSV in a browser to billions of records on a Spark cluster.

The Data Quality on Read architecture that surrounds the technique — raw data preservation, deferred quality processing, the flat enhanced format, treatment functions keyed by mask — is designed for the reality of modern data work, where the data you need to use was created by someone else, documented imperfectly, and delivered with whatever level of quality the source system happened to produce. You cannot control the source. What you can control is how quickly and cheaply you understand what you have received, and how systematically you address the issues you find.

The tools are open source. The technique is simple enough to prototype in a single line of `sed` and powerful enough to run in production at enterprise scale. The hardest part, as with most things in data engineering, is not the technology but the discipline: profiling consistently, documenting what you find, building the quality loop, and maintaining it over time.

If there is a single lesson from nearly two decades of applying this technique across financial services, telecoms, government, and open data projects, it is this: the data is never as clean as the specification says it is, the specification is never as accurate as the author believes it is, and the cost of discovering these facts late is always higher than the cost of discovering them early.

Profile early. Profile often. Let the masks speak for themselves.

If you are ready to try the technique, the [Getting Started](./getting-started.md) appendix has everything you need to run your first profile in under a minute.
