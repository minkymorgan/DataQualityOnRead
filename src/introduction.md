# Introduction

In 2007, while working on a data migration for a financial services client, we received a file that was described as containing customer addresses. The specification said the fields were fixed-width, ASCII-encoded, with UK postcodes in column 47. When we loaded the file and profiled it, we discovered that column 47 contained a mixture of valid postcodes, phone numbers, the string "N/A" repeated eleven thousand times, and — in one memorable case — what appeared to be someone's lunch order.

The specification was wrong. Or rather, the specification described what the data *should* look like, and the file contained what the data *actually* looked like. These are not the same thing, and the gap between them is where data quality lives.

This experience, repeated in various forms across financial services, telecoms, government, and open data projects over nearly two decades, led to the development of a simple but surprisingly powerful technique: **mask-based data profiling**. The idea is straightforward. Take every character in a data field and translate it to its character class — uppercase letters become `A`, lowercase become `a`, digits become `9`, and everything else (punctuation, spaces, symbols) stays as it is. The result is a structural fingerprint of the value, a *mask*, that strips away the content and reveals the shape of the data underneath.

When you profile a column by counting the frequency of each mask, patterns emerge immediately. The dominant masks tell you what the data is supposed to look like. The rare masks — the long tail — tell you where the problems are hiding. No regex, no schema, no assumptions about the data required. Just a mechanical translation that lets the structure speak for itself.

This book describes that technique, the architecture around it, and the tools that implement it. The technique itself is called **Data Quality on Read** (DQOR), a deliberate parallel to the "Schema on Read" principle that underpins modern data lake architectures. The core idea is the same in both cases: accept raw data as-is, defer processing until the moment of consumption, and never overwrite the original. In the schema case, you defer structural interpretation. In the quality case, you defer profiling, validation, and remediation. The benefits are the same: agility, provenance, and the ability to reprocess history when your understanding improves.

The tools are **bytefreq**, an open-source command-line profiler now implemented in Rust, and **DataRadar**, a browser-based profiling tool that runs entirely client-side using WebAssembly. Both implement DQOR from the ground up, and both are free to use.

The book is structured in three parts. Part I sets out the problem: why data quality is hard, and why the traditional approaches — schema validation, statistical profiling, regex-based checks — leave gaps that mask-based profiling can fill. Part II introduces the technique in detail: masks, grain levels, Unicode handling, population analysis, error codes, and treatment functions. Part III describes the architecture that ties it all together: the flat enhanced format (a trick borrowed from Hadoop-era feature stores), and the tools that implement it at different scales.

The intended audience is anyone who works with data they did not create: data engineers, analysts, scientists, and the growing number of people who find themselves responsible for data quality without having chosen it as a career. The technique is simple enough to prototype in a single line of `sed`, and powerful enough to run in production at enterprise scale. We will cover the full range.

Let's begin.
