"""Reusable, network-free MusicAnalysis v1 extraction and content cache.

The worker deliberately emits measured data only. It never creates a
MusicReading, assigns emotion, or sends audio outside the local process.
"""

from __future__ import annotations

import hashlib
import json
import math
import tempfile
from dataclasses import asdict, dataclass
from datetime import datetime
from itertools import pairwise
from pathlib import Path
from typing import Any

import librosa
import numpy as np
from numpy.typing import NDArray

SCHEMA_VERSION = "1.0.0"
ENGINE_NAME = "generathon-librosa"
ENGINE_VERSION = f"1.0.0+librosa.{librosa.__version__}"
DETERMINISTIC_TIMESTAMP = "1970-01-01T00:00:00Z"
CACHE_SCHEMA_VERSION = "1.0.0"
_TIME_PRECISION = 6
_VALUE_PRECISION = 6
_EPSILON = 1e-10


class AnalysisError(ValueError):
    """An expected input, decoding, measurement, or cache failure."""


class CacheError(AnalysisError):
    """A cache entry exists but cannot be trusted."""


@dataclass(frozen=True, slots=True)
class AnalysisParameters:
    """Versioned numerical settings included in ``parameters_hash``."""

    sample_rate_hz: int = 22_050
    resample_type: str = "soxr_hq"
    frame_length: int = 2_048
    hop_length: int = 512
    waveform_points: int = 256
    energy_points: int = 256
    target_section_seconds: float = 12.0
    min_section_seconds: float = 4.0
    max_sections: int = 6
    max_events_per_kind: int = 8
    event_min_separation_seconds: float = 0.12
    time_precision: int = _TIME_PRECISION
    value_precision: int = _VALUE_PRECISION

    def __post_init__(self) -> None:
        positive_integers = (
            self.sample_rate_hz,
            self.frame_length,
            self.hop_length,
            self.waveform_points,
            self.energy_points,
            self.max_sections,
            self.max_events_per_kind,
        )
        if any(value <= 0 for value in positive_integers):
            raise AnalysisError("Analysis integer parameters must be positive.")
        if self.waveform_points < 2 or self.energy_points < 2:
            raise AnalysisError(
                "Waveform and energy output require at least two points."
            )
        if self.target_section_seconds <= 0 or self.min_section_seconds <= 0:
            raise AnalysisError("Section durations must be positive.")
        if self.event_min_separation_seconds < 0:
            raise AnalysisError("Event separation cannot be negative.")

    @property
    def parameters_hash(self) -> str:
        payload = {
            **asdict(self),
            "librosa_version": librosa.__version__,
        }
        return _sha256_json(payload)


@dataclass(frozen=True, slots=True)
class AnalysisRequest:
    """Identity and selected original-track range for one immutable analysis."""

    audio_path: Path
    project_id: str
    audio_asset_id: str
    selected_start_seconds: float
    selected_end_seconds: float
    revision: int = 1
    recorded_at: str = DETERMINISTIC_TIMESTAMP
    analysis_id: str | None = None

    def __post_init__(self) -> None:
        _validate_id(self.project_id, "project_id")
        _validate_id(self.audio_asset_id, "audio_asset_id")
        if self.analysis_id is not None:
            _validate_id(self.analysis_id, "analysis_id")
        if (
            not isinstance(self.revision, int)
            or isinstance(self.revision, bool)
            or self.revision < 1
        ):
            raise AnalysisError("revision must be a positive integer.")
        _validate_timestamp(self.recorded_at)

        start = self.selected_start_seconds
        end = self.selected_end_seconds
        if not math.isfinite(start) or not math.isfinite(end):
            raise AnalysisError("Selected range values must be finite.")
        if start < 0:
            raise AnalysisError("Selected range start must be non-negative.")
        if end <= start:
            raise AnalysisError("Selected range end must be greater than start.")

    @property
    def selected_range(self) -> dict[str, float]:
        start = _round_number(self.selected_start_seconds, _TIME_PRECISION)
        end = _round_number(self.selected_end_seconds, _TIME_PRECISION)
        if end <= start:
            raise AnalysisError(
                f"Selected range must remain positive at {_TIME_PRECISION}-digit precision."
            )
        return {"start_seconds": start, "end_seconds": end}


@dataclass(frozen=True, slots=True)
class AnalysisOutcome:
    """Strict output plus local cache provenance kept outside the contract JSON."""

    music_analysis: dict[str, Any]
    cache_key: str
    cache_path: Path | None
    cache_hit: bool
    audio_sha256: str


class MusicAnalyzer:
    """Analyze audio locally and reuse measured features by content identity."""

    def __init__(
        self,
        *,
        parameters: AnalysisParameters | None = None,
        cache_dir: Path | None = None,
    ) -> None:
        self.parameters = parameters or AnalysisParameters()
        self.cache_dir = cache_dir

    def analyze(self, request: AnalysisRequest) -> AnalysisOutcome:
        audio_path = request.audio_path.expanduser().resolve()
        if not audio_path.is_file():
            raise AnalysisError(f"Audio file does not exist: {audio_path}")

        selected_range = request.selected_range
        duration_seconds = _audio_duration(audio_path)
        if selected_range["end_seconds"] > duration_seconds:
            raise AnalysisError(
                "Selected range ends after the audio: "
                f"{selected_range['end_seconds']:.6f}s > {duration_seconds:.6f}s."
            )

        audio_sha256 = sha256_file(audio_path)
        parameters_hash = self.parameters.parameters_hash
        descriptor = cache_descriptor(
            audio_sha256=audio_sha256,
            selected_range=selected_range,
            engine_version=ENGINE_VERSION,
            parameters_hash=parameters_hash,
        )
        key = _sha256_json(descriptor)
        cache_path = self.cache_dir / f"{key}.json" if self.cache_dir else None
        features: dict[str, Any]
        cache_hit = False

        if cache_path is not None and cache_path.exists():
            features = _read_cache(cache_path, key, descriptor)
            cache_hit = True
        else:
            audio = _load_selected_audio(audio_path, selected_range, self.parameters)
            features = extract_features(
                audio,
                sample_rate_hz=self.parameters.sample_rate_hz,
                selected_range=selected_range,
                parameters=self.parameters,
            )
            if cache_path is not None:
                _write_cache(cache_path, key, descriptor, features)

        analysis = _materialize_music_analysis(
            request=request,
            selected_range=selected_range,
            parameters_hash=parameters_hash,
            cache_key=key,
            features=features,
        )
        validate_music_analysis(analysis)
        return AnalysisOutcome(
            music_analysis=analysis,
            cache_key=key,
            cache_path=cache_path,
            cache_hit=cache_hit,
            audio_sha256=audio_sha256,
        )


def analyze_music(
    request: AnalysisRequest,
    *,
    parameters: AnalysisParameters | None = None,
    cache_dir: Path | None = None,
) -> dict[str, Any]:
    """Convenience API returning only strict MusicAnalysis v1 JSON data."""

    return (
        MusicAnalyzer(parameters=parameters, cache_dir=cache_dir)
        .analyze(request)
        .music_analysis
    )


def cache_descriptor(
    *,
    audio_sha256: str,
    selected_range: dict[str, float],
    engine_version: str,
    parameters_hash: str,
    engine: str = ENGINE_NAME,
) -> dict[str, Any]:
    """Return the complete, canonical cache identity required by the worker."""

    return {
        "audio_sha256": audio_sha256,
        "selected_range": selected_range,
        "engine": engine,
        "engine_version": engine_version,
        "parameters_hash": parameters_hash,
    }


def sha256_file(path: Path, chunk_size: int = 1024 * 1024) -> str:
    digest = hashlib.sha256()
    try:
        with path.open("rb") as stream:
            while chunk := stream.read(chunk_size):
                digest.update(chunk)
    except OSError as exc:
        raise AnalysisError(f"Could not read audio file: {path}: {exc}") from exc
    return digest.hexdigest()


def extract_features(
    audio: NDArray[np.floating[Any]],
    *,
    sample_rate_hz: int,
    selected_range: dict[str, float],
    parameters: AnalysisParameters | None = None,
) -> dict[str, Any]:
    """Extract deterministic measured features from a mono selected-range array.

    This array-level entry point makes the numerical engine independently testable.
    All returned timestamps are shifted to the original track's time axis.
    """

    settings = parameters or AnalysisParameters(sample_rate_hz=sample_rate_hz)
    if sample_rate_hz != settings.sample_rate_hz:
        raise AnalysisError("Array sample rate must match the analysis parameters.")

    samples = np.asarray(audio, dtype=np.float32)
    if samples.ndim != 1:
        raise AnalysisError("Selected audio must be a one-dimensional mono array.")
    if samples.size < 2:
        raise AnalysisError("Selected audio contains fewer than two samples.")
    if not np.all(np.isfinite(samples)):
        raise AnalysisError("Selected audio contains non-finite samples.")
    peak_amplitude = float(np.max(np.abs(samples)))
    if peak_amplitude <= _EPSILON:
        raise AnalysisError("Selected audio is silent; tempo cannot be measured.")

    start = float(selected_range["start_seconds"])
    end = float(selected_range["end_seconds"])
    expected_duration = end - start
    actual_duration = samples.size / sample_rate_hz
    sample_tolerance = max(1.0 / sample_rate_hz, 10**-_TIME_PRECISION)
    if abs(actual_duration - expected_duration) > sample_tolerance:
        raise AnalysisError(
            "Selected array duration does not match selected_range: "
            f"{actual_duration:.6f}s != {expected_duration:.6f}s."
        )

    onset_envelope = librosa.onset.onset_strength(
        y=samples,
        sr=sample_rate_hz,
        n_fft=settings.frame_length,
        hop_length=settings.hop_length,
    )
    tempo_value, beat_frames = librosa.beat.beat_track(
        onset_envelope=onset_envelope,
        sr=sample_rate_hz,
        hop_length=settings.hop_length,
    )
    onset_frames = librosa.onset.onset_detect(
        onset_envelope=onset_envelope,
        sr=sample_rate_hz,
        hop_length=settings.hop_length,
        units="frames",
    )

    tempo_bpm = float(np.ravel(np.asarray(tempo_value))[0])
    if not math.isfinite(tempo_bpm) or tempo_bpm <= 0:
        raise AnalysisError(
            "No positive tempo could be measured in the selected audio range."
        )

    magnitude = np.abs(
        librosa.stft(
            samples,
            n_fft=settings.frame_length,
            hop_length=settings.hop_length,
        )
    )
    rms = librosa.feature.rms(
        y=samples,
        frame_length=settings.frame_length,
        hop_length=settings.hop_length,
    )[0]
    centroid = librosa.feature.spectral_centroid(
        S=magnitude,
        sr=sample_rate_hz,
    )[0]
    spectral_flux = _spectral_flux(magnitude)

    boundaries = _candidate_boundaries(
        magnitude=magnitude,
        sample_rate_hz=sample_rate_hz,
        duration_seconds=expected_duration,
        parameters=settings,
    )
    beat_times = _absolute_frame_times(
        beat_frames,
        start=start,
        end=end,
        sample_rate_hz=sample_rate_hz,
        hop_length=settings.hop_length,
    )
    onset_times = _absolute_frame_times(
        onset_frames,
        start=start,
        end=end,
        sample_rate_hz=sample_rate_hz,
        hop_length=settings.hop_length,
    )

    sections = _build_sections(
        boundaries=boundaries,
        start=start,
        end=end,
        onset_envelope=onset_envelope,
        spectral_flux=spectral_flux,
        sample_rate_hz=sample_rate_hz,
        parameters=settings,
    )
    events = _build_events(
        beat_frames=np.asarray(beat_frames, dtype=int),
        onset_frames=np.asarray(onset_frames, dtype=int),
        rms=rms,
        spectral_flux=spectral_flux,
        boundary_seconds=boundaries[1:-1],
        start=start,
        end=end,
        sample_rate_hz=sample_rate_hz,
        parameters=settings,
        onset_envelope=onset_envelope,
    )

    return {
        "waveform": _summarize_samples(
            samples,
            start=start,
            end=end,
            point_count=settings.waveform_points,
            mode="peak",
            precision=settings.value_precision,
        ),
        "energy_envelope": _summarize_samples(
            samples,
            start=start,
            end=end,
            point_count=settings.energy_points,
            mode="rms",
            precision=settings.value_precision,
        ),
        "tempo_bpm": _round_number(tempo_bpm, 3),
        "beats_seconds": beat_times,
        "onsets_seconds": onset_times,
        "spectral_centroid_mean_hz": _round_number(float(np.mean(centroid)), 3),
        "candidate_sections": sections,
        "events": events,
        "confidence": _analysis_confidence(
            beat_times=beat_times,
            onset_times=onset_times,
            section_confidences=[section["confidence"] for section in sections],
            duration_seconds=expected_duration,
        ),
    }


def music_analysis_json(analysis: dict[str, Any], *, indent: int = 2) -> str:
    """Serialize strict analysis output with stable ordering and no NaN values."""

    validate_music_analysis(analysis)
    return (
        json.dumps(
            analysis,
            indent=indent,
            sort_keys=True,
            allow_nan=False,
            ensure_ascii=False,
        )
        + "\n"
    )


def validate_music_analysis(analysis: dict[str, Any]) -> None:
    """Guard the Python boundary against additions or MusicReading cross-write."""

    expected_top_level = {
        "schema_version",
        "id",
        "project_id",
        "revision",
        "created_at",
        "updated_at",
        "audio_asset_id",
        "method",
        "analyzed_range",
        "waveform",
        "energy_envelope",
        "tempo_bpm",
        "beats_seconds",
        "onsets_seconds",
        "spectral_centroid_mean_hz",
        "candidate_sections",
        "events",
        "confidence",
    }
    if set(analysis) != expected_top_level:
        unexpected = sorted(set(analysis) - expected_top_level)
        missing = sorted(expected_top_level - set(analysis))
        raise AnalysisError(
            f"MusicAnalysis v1 keys differ; missing={missing}, unexpected={unexpected}."
        )
    if analysis["schema_version"] != SCHEMA_VERSION:
        raise AnalysisError("MusicAnalysis schema_version must be 1.0.0.")
    for field in ("id", "project_id", "audio_asset_id"):
        _validate_id(analysis[field], field)
    if (
        not isinstance(analysis["revision"], int)
        or isinstance(analysis["revision"], bool)
        or analysis["revision"] < 1
    ):
        raise AnalysisError("MusicAnalysis revision must be a positive integer.")
    _validate_timestamp(analysis["created_at"])
    _validate_timestamp(analysis["updated_at"])
    if set(analysis["method"]) != {"engine", "engine_version", "parameters_hash"}:
        raise AnalysisError("MusicAnalysis method keys differ from v1.")
    if (
        not isinstance(analysis["method"]["engine"], str)
        or not analysis["method"]["engine"].strip()
    ):
        raise AnalysisError("MusicAnalysis method engine cannot be empty.")
    if (
        not isinstance(analysis["method"]["engine_version"], str)
        or not analysis["method"]["engine_version"].strip()
    ):
        raise AnalysisError("MusicAnalysis method engine_version cannot be empty.")
    if not _is_sha256(analysis["method"]["parameters_hash"]):
        raise AnalysisError("MusicAnalysis parameters_hash is not SHA-256.")

    selected_range = analysis["analyzed_range"]
    if set(selected_range) != {"start_seconds", "end_seconds"}:
        raise AnalysisError("MusicAnalysis analyzed_range keys differ from v1.")
    start = selected_range["start_seconds"]
    end = selected_range["end_seconds"]
    if not _is_finite_number(start) or not _is_finite_number(end) or end <= start:
        raise AnalysisError("MusicAnalysis analyzed_range is invalid.")

    for field in ("waveform", "energy_envelope"):
        points = analysis[field]
        if len(points) < 2:
            raise AnalysisError(f"MusicAnalysis {field} requires at least two points.")
        _validate_timed_values(points, start, end, field)
    for field in ("beats_seconds", "onsets_seconds"):
        _validate_times(analysis[field], start, end, field)
    if not _is_finite_number(analysis["tempo_bpm"]) or analysis["tempo_bpm"] <= 0:
        raise AnalysisError("MusicAnalysis tempo_bpm must be positive.")
    if (
        not _is_finite_number(analysis["spectral_centroid_mean_hz"])
        or analysis["spectral_centroid_mean_hz"] < 0
    ):
        raise AnalysisError("MusicAnalysis spectral centroid must be non-negative.")
    _validate_confidence(analysis["confidence"], "confidence")

    sections = analysis["candidate_sections"]
    if not sections:
        raise AnalysisError("MusicAnalysis requires at least one candidate section.")
    previous_end: float | None = None
    for index, section in enumerate(sections):
        if set(section) != {"id", "range", "label", "confidence"}:
            raise AnalysisError("Candidate section keys differ from v1.")
        _validate_id(section["id"], f"candidate_sections.{index}.id")
        if not isinstance(section["label"], str) or not section["label"].strip():
            raise AnalysisError("Candidate section label cannot be empty.")
        _validate_confidence(section["confidence"], "candidate section confidence")
        if set(section["range"]) != {"start_seconds", "end_seconds"}:
            raise AnalysisError("Candidate section range keys differ from v1.")
        section_start = section["range"]["start_seconds"]
        section_end = section["range"]["end_seconds"]
        if section_start < start or section_end > end or section_end <= section_start:
            raise AnalysisError("Candidate section is outside the analyzed range.")
        if previous_end is not None and section_start < previous_end:
            raise AnalysisError("Candidate sections overlap or are out of order.")
        previous_end = section_end

    event_kinds = {"beat", "onset", "energy_peak", "spectral_change", "boundary"}
    for index, event in enumerate(analysis["events"]):
        if set(event) != {"id", "time_seconds", "kind", "strength", "confidence"}:
            raise AnalysisError("Measured event keys differ from v1.")
        _validate_id(event["id"], f"events.{index}.id")
        if event["kind"] not in event_kinds:
            raise AnalysisError(f"Unknown measured event kind: {event['kind']}")
        if not _is_finite_number(event["strength"]):
            raise AnalysisError("Measured event strength must be finite.")
        _validate_confidence(event["confidence"], "event confidence")
        _validate_times([event["time_seconds"]], start, end, "events")

    # Final recursive serialization check rejects NumPy scalars, infinity, and NaN.
    try:
        json.dumps(analysis, allow_nan=False)
    except (TypeError, ValueError) as exc:
        raise AnalysisError(f"MusicAnalysis is not strict JSON: {exc}") from exc


def _audio_duration(path: Path) -> float:
    try:
        duration = float(librosa.get_duration(path=path))
    except Exception as exc:  # decoder exceptions differ by installed backend
        raise AnalysisError(f"Could not inspect audio file: {path}: {exc}") from exc
    if not math.isfinite(duration) or duration <= 0:
        raise AnalysisError(f"Audio duration is invalid: {duration!r}.")
    return duration


def _load_selected_audio(
    path: Path,
    selected_range: dict[str, float],
    parameters: AnalysisParameters,
) -> NDArray[np.float32]:
    start = selected_range["start_seconds"]
    duration = selected_range["end_seconds"] - start
    expected_samples = round(duration * parameters.sample_rate_hz)
    try:
        audio, sample_rate = librosa.load(
            path,
            sr=parameters.sample_rate_hz,
            mono=True,
            offset=start,
            duration=duration,
            res_type=parameters.resample_type,
        )
    except Exception as exc:  # decoder exceptions differ by file type/backend
        raise AnalysisError(f"Could not decode selected audio: {path}: {exc}") from exc
    if sample_rate != parameters.sample_rate_hz:
        raise AnalysisError(
            f"Decoder returned {sample_rate} Hz; expected {parameters.sample_rate_hz} Hz."
        )
    return np.asarray(
        librosa.util.fix_length(audio, size=expected_samples), dtype=np.float32
    )


def _candidate_boundaries(
    *,
    magnitude: NDArray[np.floating[Any]],
    sample_rate_hz: int,
    duration_seconds: float,
    parameters: AnalysisParameters,
) -> list[float]:
    if duration_seconds < 2 * parameters.min_section_seconds:
        return [0.0, duration_seconds]

    requested_sections = round(duration_seconds / parameters.target_section_seconds)
    section_count = min(parameters.max_sections, max(2, requested_sections))
    chroma = librosa.feature.chroma_stft(
        S=np.square(magnitude),
        sr=sample_rate_hz,
    )
    try:
        frames = librosa.segment.agglomerative(chroma, k=section_count)
    except ValueError, FloatingPointError:
        # Degenerate but non-silent material gets deterministic even spacing.
        frames = np.asarray([], dtype=int)

    raw = librosa.frames_to_time(
        frames,
        sr=sample_rate_hz,
        hop_length=parameters.hop_length,
    )
    internal = sorted(
        float(value)
        for value in raw
        if parameters.min_section_seconds
        <= float(value)
        <= duration_seconds - parameters.min_section_seconds
    )
    kept: list[float] = []
    for value in internal:
        if not kept or value - kept[-1] >= parameters.min_section_seconds:
            kept.append(value)
    while kept and duration_seconds - kept[-1] < parameters.min_section_seconds:
        kept.pop()

    if not kept and section_count > 1:
        kept = [
            duration_seconds * index / section_count
            for index in range(1, section_count)
        ]
    return [0.0, *kept, duration_seconds]


def _build_sections(
    *,
    boundaries: list[float],
    start: float,
    end: float,
    onset_envelope: NDArray[np.floating[Any]],
    spectral_flux: NDArray[np.floating[Any]],
    sample_rate_hz: int,
    parameters: AnalysisParameters,
) -> list[dict[str, Any]]:
    novelty = _normalize(np.maximum(onset_envelope, spectral_flux))
    sections: list[dict[str, Any]] = []
    for index, (relative_start, relative_end) in enumerate(
        pairwise(boundaries),
        start=1,
    ):
        boundary_frame = min(
            len(novelty) - 1,
            max(
                0,
                round(relative_start * sample_rate_hz / parameters.hop_length),
            ),
        )
        boundary_strength = float(novelty[boundary_frame]) if index > 1 else 0.5
        confidence = _round_number(0.55 + 0.35 * boundary_strength, 6)
        sections.append(
            {
                "range": {
                    "start_seconds": _absolute_time(relative_start, start, end),
                    "end_seconds": _absolute_time(relative_end, start, end),
                },
                "label": f"Candidate section {index:02d}",
                "confidence": confidence,
            }
        )
    return sections


def _build_events(
    *,
    beat_frames: NDArray[np.integer[Any]],
    onset_frames: NDArray[np.integer[Any]],
    rms: NDArray[np.floating[Any]],
    spectral_flux: NDArray[np.floating[Any]],
    boundary_seconds: list[float],
    start: float,
    end: float,
    sample_rate_hz: int,
    parameters: AnalysisParameters,
    onset_envelope: NDArray[np.floating[Any]],
) -> list[dict[str, Any]]:
    normalized_onsets = _normalize(onset_envelope)
    normalized_rms = _normalize(rms)
    normalized_flux = _normalize(spectral_flux)
    events: list[dict[str, Any]] = []

    def add_frames(
        kind: str, frames: NDArray[np.integer[Any]], strengths: NDArray
    ) -> None:
        selected = _select_salient_frames(
            frames,
            strengths,
            max_count=parameters.max_events_per_kind,
            min_separation_frames=max(
                1,
                round(
                    parameters.event_min_separation_seconds
                    * sample_rate_hz
                    / parameters.hop_length
                ),
            ),
        )
        for frame in selected:
            strength = float(strengths[min(int(frame), len(strengths) - 1)])
            relative = float(
                librosa.frames_to_time(
                    int(frame),
                    sr=sample_rate_hz,
                    hop_length=parameters.hop_length,
                )
            )
            events.append(
                {
                    "time_seconds": _absolute_time(relative, start, end),
                    "kind": kind,
                    "strength": _round_number(strength, parameters.value_precision),
                    "confidence": _round_number(0.55 + 0.4 * strength, 6),
                }
            )

    add_frames("beat", beat_frames, normalized_onsets)
    add_frames("onset", onset_frames, normalized_onsets)
    add_frames("energy_peak", _local_peak_frames(normalized_rms), normalized_rms)
    add_frames(
        "spectral_change",
        _local_peak_frames(normalized_flux),
        normalized_flux,
    )

    combined_novelty = _normalize(np.maximum(normalized_onsets, normalized_flux))
    for relative in boundary_seconds:
        frame = min(
            len(combined_novelty) - 1,
            max(0, round(relative * sample_rate_hz / parameters.hop_length)),
        )
        strength = float(combined_novelty[frame])
        events.append(
            {
                "time_seconds": _absolute_time(relative, start, end),
                "kind": "boundary",
                "strength": _round_number(strength, parameters.value_precision),
                "confidence": _round_number(0.6 + 0.35 * strength, 6),
            }
        )

    return sorted(events, key=lambda event: (event["time_seconds"], event["kind"]))


def _spectral_flux(
    magnitude: NDArray[np.floating[Any]],
) -> NDArray[np.float64]:
    column_sums = np.sum(magnitude, axis=0, keepdims=True)
    normalized = magnitude / np.maximum(column_sums, _EPSILON)
    positive_difference = np.maximum(np.diff(normalized, axis=1), 0.0)
    flux = np.sqrt(np.sum(np.square(positive_difference), axis=0))
    return np.concatenate((np.zeros(1, dtype=np.float64), flux))


def _summarize_samples(
    samples: NDArray[np.float32],
    *,
    start: float,
    end: float,
    point_count: int,
    mode: str,
    precision: int,
) -> list[dict[str, float]]:
    count = min(point_count, samples.size)
    count = max(2, count)
    edges = np.linspace(0, samples.size, count + 1, dtype=int)
    times = np.linspace(start, end, count)
    points: list[dict[str, float]] = []
    for index, time_seconds in enumerate(times):
        chunk = samples[edges[index] : edges[index + 1]]
        if chunk.size == 0:
            chunk = samples[min(edges[index], samples.size - 1) :][:1]
        if mode == "peak":
            value = float(np.max(np.abs(chunk)))
        else:
            value = float(np.sqrt(np.mean(np.square(chunk, dtype=np.float64))))
        points.append(
            {
                "time_seconds": _round_number(float(time_seconds), _TIME_PRECISION),
                "value": _round_number(value, precision),
            }
        )
    points[0]["time_seconds"] = start
    points[-1]["time_seconds"] = end
    return points


def _absolute_frame_times(
    frames: NDArray[np.integer[Any]],
    *,
    start: float,
    end: float,
    sample_rate_hz: int,
    hop_length: int,
) -> list[float]:
    relative_times = librosa.frames_to_time(
        frames,
        sr=sample_rate_hz,
        hop_length=hop_length,
    )
    return sorted(
        {
            _absolute_time(float(relative), start, end)
            for relative in relative_times
            if 0 <= float(relative) <= end - start
        }
    )


def _absolute_time(relative: float, start: float, end: float) -> float:
    return _round_number(min(end, max(start, start + relative)), _TIME_PRECISION)


def _normalize(values: NDArray[np.floating[Any]]) -> NDArray[np.float64]:
    array = np.asarray(values, dtype=np.float64)
    if array.size == 0:
        return array
    maximum = float(np.max(array))
    minimum = float(np.min(array))
    span = maximum - minimum
    if span <= _EPSILON:
        return np.zeros_like(array)
    return (array - minimum) / span


def _local_peak_frames(values: NDArray[np.floating[Any]]) -> NDArray[np.int64]:
    if len(values) < 3:
        return np.asarray([], dtype=np.int64)
    middle = values[1:-1]
    mask = (middle > values[:-2]) & (middle >= values[2:]) & (middle > 0)
    return np.flatnonzero(mask).astype(np.int64) + 1


def _select_salient_frames(
    frames: NDArray[np.integer[Any]],
    strengths: NDArray[np.floating[Any]],
    *,
    max_count: int,
    min_separation_frames: int,
) -> list[int]:
    valid = sorted(
        {int(frame) for frame in frames if 0 <= int(frame) < len(strengths)},
        key=lambda frame: (-float(strengths[frame]), frame),
    )
    selected: list[int] = []
    for frame in valid:
        if all(abs(frame - other) >= min_separation_frames for other in selected):
            selected.append(frame)
        if len(selected) >= max_count:
            break
    return sorted(selected)


def _analysis_confidence(
    *,
    beat_times: list[float],
    onset_times: list[float],
    section_confidences: list[float],
    duration_seconds: float,
) -> float:
    if len(beat_times) >= 3:
        intervals = np.diff(beat_times)
        mean_interval = float(np.mean(intervals))
        regularity = 1.0 - min(
            1.0, float(np.std(intervals)) / max(mean_interval, _EPSILON)
        )
    else:
        regularity = 0.2
    onset_evidence = min(1.0, len(onset_times) / max(2.0, duration_seconds / 2.0))
    section_evidence = (
        float(np.mean(section_confidences)) if section_confidences else 0.4
    )
    confidence = 0.45 * regularity + 0.25 * onset_evidence + 0.30 * section_evidence
    return _round_number(min(0.99, max(0.1, confidence)), 6)


def _materialize_music_analysis(
    *,
    request: AnalysisRequest,
    selected_range: dict[str, float],
    parameters_hash: str,
    cache_key: str,
    features: dict[str, Any],
) -> dict[str, Any]:
    identity_hash = _sha256_json(
        {
            "project_id": request.project_id,
            "audio_asset_id": request.audio_asset_id,
            "cache_key": cache_key,
        }
    )
    analysis_id = request.analysis_id or f"analysis-{identity_hash[:24]}"
    sections = [
        {
            "id": f"section-{cache_key[:16]}-{index:02d}",
            **section,
        }
        for index, section in enumerate(features["candidate_sections"], start=1)
    ]
    events = [
        {
            "id": f"event-{cache_key[:16]}-{index:03d}",
            **event,
        }
        for index, event in enumerate(features["events"], start=1)
    ]
    return {
        "schema_version": SCHEMA_VERSION,
        "id": analysis_id,
        "project_id": request.project_id,
        "revision": request.revision,
        "created_at": request.recorded_at,
        "updated_at": request.recorded_at,
        "audio_asset_id": request.audio_asset_id,
        "method": {
            "engine": ENGINE_NAME,
            "engine_version": ENGINE_VERSION,
            "parameters_hash": parameters_hash,
        },
        "analyzed_range": selected_range,
        "waveform": features["waveform"],
        "energy_envelope": features["energy_envelope"],
        "tempo_bpm": features["tempo_bpm"],
        "beats_seconds": features["beats_seconds"],
        "onsets_seconds": features["onsets_seconds"],
        "spectral_centroid_mean_hz": features["spectral_centroid_mean_hz"],
        "candidate_sections": sections,
        "events": events,
        "confidence": features["confidence"],
    }


def _read_cache(
    path: Path,
    expected_key: str,
    expected_descriptor: dict[str, Any],
) -> dict[str, Any]:
    try:
        envelope = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise CacheError(f"Could not read cache entry {path}: {exc}") from exc
    expected_keys = {
        "cache_schema_version",
        "cache_key",
        *expected_descriptor.keys(),
        "features",
    }
    if not isinstance(envelope, dict) or set(envelope) != expected_keys:
        raise CacheError(f"Cache entry has unexpected fields: {path}")
    if envelope["cache_schema_version"] != CACHE_SCHEMA_VERSION:
        raise CacheError(f"Cache schema version does not match: {path}")
    if envelope["cache_key"] != expected_key:
        raise CacheError(f"Cache key does not match its file name: {path}")
    for field, value in expected_descriptor.items():
        if envelope[field] != value:
            raise CacheError(f"Cache descriptor field '{field}' does not match: {path}")
    if not isinstance(envelope["features"], dict):
        raise CacheError(f"Cache feature payload is invalid: {path}")
    features = envelope["features"]
    expected_feature_keys = {
        "waveform",
        "energy_envelope",
        "tempo_bpm",
        "beats_seconds",
        "onsets_seconds",
        "spectral_centroid_mean_hz",
        "candidate_sections",
        "events",
        "confidence",
    }
    if set(features) != expected_feature_keys:
        raise CacheError(f"Cache feature fields differ from the engine payload: {path}")
    return features


def _write_cache(
    path: Path,
    key: str,
    descriptor: dict[str, Any],
    features: dict[str, Any],
) -> None:
    envelope = {
        "cache_schema_version": CACHE_SCHEMA_VERSION,
        "cache_key": key,
        **descriptor,
        "features": features,
    }
    payload = _canonical_json(envelope) + "\n"
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=path.parent,
            prefix=f".{path.stem}.",
            suffix=".tmp",
            delete=False,
        ) as temporary:
            temporary.write(payload)
            temporary_path = Path(temporary.name)
        temporary_path.replace(path)
    except OSError as exc:
        raise CacheError(f"Could not write cache entry {path}: {exc}") from exc


def _validate_timed_values(
    points: list[dict[str, Any]],
    start: float,
    end: float,
    field: str,
) -> None:
    previous: float | None = None
    for point in points:
        if set(point) != {"time_seconds", "value"}:
            raise AnalysisError(f"MusicAnalysis {field} point keys differ from v1.")
        time_seconds = point["time_seconds"]
        if not _is_finite_number(point["value"]):
            raise AnalysisError(f"MusicAnalysis {field} value must be finite.")
        if not _is_finite_number(time_seconds) or not start <= time_seconds <= end:
            raise AnalysisError(f"MusicAnalysis {field} timestamp is out of range.")
        if previous is not None and time_seconds < previous:
            raise AnalysisError(f"MusicAnalysis {field} timestamps are not ordered.")
        previous = time_seconds


def _validate_times(values: list[Any], start: float, end: float, field: str) -> None:
    previous: float | None = None
    for value in values:
        if not _is_finite_number(value) or not start <= value <= end:
            raise AnalysisError(f"MusicAnalysis {field} timestamp is out of range.")
        if previous is not None and value < previous:
            raise AnalysisError(f"MusicAnalysis {field} timestamps are not ordered.")
        previous = value


def _validate_confidence(value: Any, field: str) -> None:
    if not _is_finite_number(value) or not 0 <= value <= 1:
        raise AnalysisError(f"MusicAnalysis {field} must be between zero and one.")


def _validate_id(value: Any, field: str) -> None:
    if (
        not isinstance(value, str)
        or not value.strip()
        or value != value.strip()
        or len(value) > 160
    ):
        raise AnalysisError(
            f"{field} must be a trimmed non-empty string of at most 160 characters."
        )


def _validate_timestamp(value: Any) -> None:
    if not isinstance(value, str):
        raise AnalysisError("recorded_at must be an ISO 8601 timestamp with an offset.")
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError as exc:
        raise AnalysisError(
            "recorded_at must be an ISO 8601 timestamp with an offset."
        ) from exc
    if parsed.tzinfo is None:
        raise AnalysisError("recorded_at must include a UTC offset.")


def _is_finite_number(value: Any) -> bool:
    return (
        isinstance(value, (int, float))
        and not isinstance(value, bool)
        and math.isfinite(value)
    )


def _is_sha256(value: Any) -> bool:
    return (
        isinstance(value, str)
        and len(value) == 64
        and all(character in "0123456789abcdef" for character in value)
    )


def _round_number(value: float, precision: int) -> float:
    rounded = round(float(value), precision)
    return 0.0 if rounded == 0 else rounded


def _canonical_json(value: Any) -> str:
    return json.dumps(
        value,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=True,
        allow_nan=False,
    )


def _sha256_json(value: Any) -> str:
    return hashlib.sha256(_canonical_json(value).encode("utf-8")).hexdigest()
