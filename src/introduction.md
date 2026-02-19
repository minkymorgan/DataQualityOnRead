# Introduction

> *"Bad data is worse than no data — it gives you confidence in the wrong answer."*

Most data quality frameworks focus on **writing clean data** — validation at the point of entry, schema enforcement, constraints. But what happens when you inherit a dataset? When you receive a CSV from a partner, scrape a website, or merge two systems that were never designed to talk to each other?

This book introduces a different philosophy: **Data Quality on Read**. Rather than assuming data is clean, we profile it at the moment of consumption — cheaply, deterministically, and at scale.

The core technique is **mask-based profiling**: translating every character in a field into its character class (uppercase, lowercase, digit, punctuation) to reveal the structural patterns hiding inside your data. A phone number becomes `9999 999 9999`. A name becomes `Aaaaaa`. A corrupted record becomes immediately visible.

This is not a new idea — the author first implemented it in 2007 — but it remains underused, undertaught, and under-tooled. This book aims to fix that, with two open-source tools:

- **bytefreq** — a command-line profiler that generates mask-based profiles from any delimited data
- **dataradar** — a configuration-driven framework for applying profiling rules at scale

In ~10 chapters, you'll learn the theory, see the tools, and understand how to turn masks into actionable data quality error codes.

Let's begin.
