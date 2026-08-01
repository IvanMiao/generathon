"""Command-line boundary for deterministic local MusicAnalysis v1 output."""

from __future__ import annotations

import argparse
import sys
import tempfile
from collections.abc import Sequence
from pathlib import Path

from .analysis import (
    DETERMINISTIC_TIMESTAMP,
    AnalysisError,
    AnalysisRequest,
    MusicAnalyzer,
    music_analysis_json,
)

DEFAULT_CACHE_DIR = Path("artifacts/music-analysis/cache")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m workers.music",
        description=(
            "Analyze a local audio selection into strict MusicAnalysis v1 JSON. "
            "No audio leaves this process."
        ),
    )
    parser.add_argument("audio", type=Path, help="Path to a local audio file")
    parser.add_argument("--project-id", required=True)
    parser.add_argument("--audio-asset-id", required=True)
    parser.add_argument(
        "--start", required=True, type=float, help="Original-track seconds"
    )
    parser.add_argument(
        "--end", required=True, type=float, help="Original-track seconds"
    )
    parser.add_argument(
        "--analysis-id", help="Optional caller-owned immutable record ID"
    )
    parser.add_argument("--revision", type=int, default=1)
    parser.add_argument(
        "--recorded-at",
        default=DETERMINISTIC_TIMESTAMP,
        help=(
            "ISO 8601 record timestamp. The deterministic default is the Unix epoch; "
            "control-plane callers should pass their persisted operation timestamp."
        ),
    )
    parser.add_argument(
        "--cache-dir",
        type=Path,
        default=DEFAULT_CACHE_DIR,
        help=f"Content-addressed feature cache (default: {DEFAULT_CACHE_DIR})",
    )
    parser.add_argument(
        "--no-cache",
        action="store_true",
        help="Analyze without reading or writing the feature cache",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Write JSON atomically to this path instead of standard output",
    )
    return parser


def run(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        request = AnalysisRequest(
            audio_path=args.audio,
            project_id=args.project_id,
            audio_asset_id=args.audio_asset_id,
            selected_start_seconds=args.start,
            selected_end_seconds=args.end,
            analysis_id=args.analysis_id,
            revision=args.revision,
            recorded_at=args.recorded_at,
        )
        analyzer = MusicAnalyzer(cache_dir=None if args.no_cache else args.cache_dir)
        outcome = analyzer.analyze(request)
        payload = music_analysis_json(outcome.music_analysis)
        if args.output is None:
            sys.stdout.write(payload)
        else:
            _write_output(args.output, payload)
            print(str(args.output.resolve()))
        cache_status = "hit" if outcome.cache_hit else "miss"
        if outcome.cache_path is not None:
            print(
                f"cache={cache_status} key={outcome.cache_key} "
                f"path={outcome.cache_path.resolve()}",
                file=sys.stderr,
            )
    except AnalysisError as exc:
        parser.exit(2, f"error: {exc}\n")
    return 0


def _write_output(path: Path, payload: str) -> None:
    resolved = path.expanduser().resolve()
    try:
        resolved.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=resolved.parent,
            prefix=f".{resolved.stem}.",
            suffix=".tmp",
            delete=False,
        ) as temporary:
            temporary.write(payload)
            temporary_path = Path(temporary.name)
        temporary_path.replace(resolved)
    except OSError as exc:
        raise AnalysisError(f"Could not write output {resolved}: {exc}") from exc


def main() -> None:
    raise SystemExit(run())


if __name__ == "__main__":
    main()
