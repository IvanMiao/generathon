# Modal worker boundary

This directory is reserved for the open-weight GPU execution lane. It will use an
isolated, revision-pinned Python 3.12/CUDA image rather than the repository's local
Python 3.14 environment.

The first candidate is LTX-2.3 distilled, subject to license review before any
commercial launch. Its contract will accept versioned ShotSpecs and immutable
visual-state references, persist an asynchronous run ID, and return artifact
metadata—not mutate product state directly.

No Modal dependency or model weight is installed in Step 1. Deployment begins
only after the fixture workflow and provider-run contracts are frozen.
