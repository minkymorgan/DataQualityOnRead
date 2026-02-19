# Foreword {.unnumbered}

Every organisation that works with data eventually discovers the same uncomfortable truth: the data is not what the documentation says it is. The specification describes an ideal. The file contains reality. The gap between them is where projects stall, budgets overrun, and decisions go wrong.

In nearly two decades of building data platforms — across financial services, government, telecoms, and open data — I have seen this gap consume more time, money, and goodwill than any other single problem in data engineering. Not because the problem is hard to understand, but because the tools for discovering it have historically been slow, expensive, and assumption-heavy. You needed to know what you were looking for before you could look for it.

Mask-based profiling inverts that assumption. It asks no questions about the data. It makes no assumptions about what the data should contain. It simply translates every value into its structural fingerprint and counts the results. The dominant patterns tell you what the data is. The rare patterns tell you what has gone wrong. The technique is mechanical, deterministic, and fast — and it works on any data, in any language, at any scale.

This book describes the technique, the architecture that surrounds it, and the open-source tools that implement it. It is written for practitioners: data engineers, analysts, and anyone who has ever opened a file and wondered what they were looking at. The ideas are simple. The implementation is straightforward. The impact, in my experience, is transformative.

I hope you find it useful.

*Andrew Morgan*
*February 2026*
