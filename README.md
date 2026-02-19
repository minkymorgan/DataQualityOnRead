# Data Quality on Read

A practical guide to mask-based data profiling with [bytefreq](https://github.com/minkymorgan/bytefreq) and [dataradar](https://dataradar.co.uk).

📖 **Read online:** [minkymorgan.github.io/DataQualityOnRead](https://minkymorgan.github.io/DataQualityOnRead)

## About

Most data quality frameworks focus on writing clean data. This book introduces a different approach: **profiling data at the moment of consumption** using character-class masks to reveal structural patterns — cheaply, deterministically, and at scale.

## Building Locally

```bash
# Install mdBook
cargo install mdbook
# or download from https://github.com/rust-lang/mdBook/releases

# Build
mdbook build

# Serve locally with hot-reload
mdbook serve --open
```

## Author

**Andrew Morgan** — author of *Mastering Spark for Data Science* (Packt), creator of bytefreq and dataradar.

## License

© Andrew Morgan. All rights reserved.
