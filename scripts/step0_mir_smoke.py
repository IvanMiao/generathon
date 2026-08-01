"""Run the Step 0 deterministic music-analysis capability smoke test."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import librosa
import numpy as np


def _as_seconds(frames: np.ndarray, sample_rate: int) -> list[float]:
    values = librosa.frames_to_time(frames, sr=sample_rate)
    return [round(float(value), 3) for value in values]


def _candidate_sections(
    audio: np.ndarray,
    sample_rate: int,
    duration_seconds: float,
) -> list[float]:
    if duration_seconds < 4:
        return [0.0, round(duration_seconds, 3)]

    chroma = librosa.feature.chroma_stft(y=audio, sr=sample_rate)
    segment_count = min(4, max(2, int(duration_seconds // 4)))
    boundary_frames = librosa.segment.agglomerative(chroma, k=segment_count)
    boundaries = _as_seconds(boundary_frames, sample_rate)

    if not boundaries or boundaries[0] != 0.0:
        boundaries.insert(0, 0.0)
    duration = round(duration_seconds, 3)
    if boundaries[-1] != duration:
        boundaries.append(duration)
    return boundaries


def analyze(path: Path) -> dict[str, object]:
    audio, sample_rate = librosa.load(path, sr=22_050, mono=True)
    duration_seconds = float(librosa.get_duration(y=audio, sr=sample_rate))

    onset_envelope = librosa.onset.onset_strength(y=audio, sr=sample_rate)
    tempo, beat_frames = librosa.beat.beat_track(
        onset_envelope=onset_envelope,
        sr=sample_rate,
    )
    onset_frames = librosa.onset.onset_detect(
        onset_envelope=onset_envelope,
        sr=sample_rate,
    )
    rms = librosa.feature.rms(y=audio)[0]
    spectral_centroid = librosa.feature.spectral_centroid(
        y=audio,
        sr=sample_rate,
    )[0]

    return {
        "source": str(path.resolve()),
        "duration_seconds": round(duration_seconds, 3),
        "analysis_sample_rate": sample_rate,
        "tempo_bpm": round(float(np.atleast_1d(tempo)[0]), 3),
        "beat_count": len(beat_frames),
        "beats_seconds": _as_seconds(beat_frames, sample_rate),
        "onset_count": len(onset_frames),
        "onsets_seconds": _as_seconds(onset_frames, sample_rate),
        "rms": {
            "minimum": round(float(np.min(rms)), 6),
            "mean": round(float(np.mean(rms)), 6),
            "maximum": round(float(np.max(rms)), 6),
        },
        "spectral_centroid_mean_hz": round(float(np.mean(spectral_centroid)), 3),
        "candidate_section_boundaries_seconds": _candidate_sections(
            audio,
            sample_rate,
            duration_seconds,
        ),
        "method": {
            "library": "librosa",
            "version": librosa.__version__,
            "section_boundaries": "chroma_stft_agglomerative_heuristic",
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("audio", type=Path)
    parser.add_argument("--expected-bpm", type=float)
    parser.add_argument("--bpm-tolerance", type=float, default=5.0)
    args = parser.parse_args()

    if not args.audio.is_file():
        parser.error(f"Audio file does not exist: {args.audio}")

    result = analyze(args.audio)
    print(json.dumps(result, indent=2, sort_keys=True))

    if args.expected_bpm is not None:
        measured = float(result["tempo_bpm"])
        if abs(measured - args.expected_bpm) > args.bpm_tolerance:
            raise SystemExit(
                f"Tempo check failed: measured {measured:.3f} BPM, "
                f"expected {args.expected_bpm:.3f} ± {args.bpm_tolerance:.3f}"
            )


if __name__ == "__main__":
    main()
