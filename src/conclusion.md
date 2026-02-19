# Conclusion

<!-- TODO: Refine with Andrew's voice -->

Mask-based profiling is not a silver bullet. It won't catch semantic errors (a valid-looking phone number that belongs to the wrong person), and it won't replace domain expertise. But as a **first pass** — a cheap, fast, assumption-free structural analysis — it's remarkably powerful.

## Key Takeaways

1. **Profile on read, not just on write.** You can't always control the source.
2. **Masks reveal structure** that statistics miss. A mean and standard deviation won't show you that 2% of your "dates" are actually names.
3. **Low grain first, high grain second.** Start broad, drill down.
4. **Masks are error codes for free.** The profiler generates diagnostics as a side effect of profiling.
5. **Treatment follows detection.** Map masks to remediation actions for a complete quality pipeline.
6. **Iterate.** Data quality is a loop, not a project.

## Where to Go Next

- Try **bytefreq** on your own data — even one file will be illuminating
- Set up **dataradar** for your most critical data feeds
- Build a mask whitelist for your key columns
- Integrate profiling into your CI/CD or ETL pipeline
- Share your findings — data quality is everyone's problem

The tools are open source. The technique is simple. The hardest part is starting.

Start.
