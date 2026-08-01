# Local Music Analysis worker

This package turns one selected range of a local audio file into the frozen
`MusicAnalysis` v1 JSON contract. It performs measurements only: it does not
create `MusicReading`, infer emotion, upload audio, or call any model.

Run the CLI from the repository root:

```bash
uv run python -m workers.music AUDIO \
  --project-id PROJECT_ID \
  --audio-asset-id AUDIO_ASSET_ID \
  --start 0 \
  --end 16 \
  --output artifacts/music-analysis/analysis.v1.json
```

Without `--output`, the strict JSON document is written to stdout. Cache
diagnostics go to stderr. The default content-addressed cache is
`artifacts/music-analysis/cache/`; `--no-cache` disables cache reads and writes.
Each key hashes the audio SHA256, canonical selected range, engine name and
version, and parameters hash. Project and audio IDs are applied after cached
measurement so the same features can safely back distinct records.

Python callers can use `MusicAnalyzer.analyze(AnalysisRequest(...))` when they
need cache provenance, or `analyze_music(...)` when they need only the strict
contract dictionary. `extract_features(...)` is the deterministic array-level
entry point.

Times are quantized to microseconds and remain on the original-track axis. The
CLI defaults record timestamps to the Unix epoch so identical explicit inputs
produce identical JSON even without a cache. A control-plane caller should pass
its persisted operation time with `--recorded-at` when wall-clock provenance is
required.

Beat, onset, chroma segmentation, energy peaks, and spectral-change results are
heuristic measurements. Tempo may be doubled or halved; soft, rubato, ambient,
or very short selections may have weak or unavailable tempo/section evidence.
The immutable result is intended to be corrected through a separate
`MusicAnalysisRevision`.
