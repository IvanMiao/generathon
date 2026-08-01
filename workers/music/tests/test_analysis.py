"""Contract and determinism tests using tiny local synthetic audio."""

from __future__ import annotations

import hashlib
import json
import math
import tempfile
import unittest
import wave
from pathlib import Path

import numpy as np

from workers.music.analysis import (
    ENGINE_VERSION,
    AnalysisError,
    AnalysisParameters,
    AnalysisRequest,
    CacheError,
    MusicAnalyzer,
    cache_descriptor,
    extract_features,
    music_analysis_json,
)
from workers.music.cli import run

SAMPLE_RATE = 8_000


def synthetic_pulse_track(duration_seconds: float = 6.0) -> np.ndarray:
    """Create a deterministic 120 BPM pulse bed with a timbral midpoint change."""

    sample_count = round(duration_seconds * SAMPLE_RATE)
    time = np.arange(sample_count, dtype=np.float64) / SAMPLE_RATE
    audio = 0.025 * np.sin(2 * np.pi * 110 * time)
    audio += np.where(
        time >= duration_seconds / 2,
        0.02 * np.sin(2 * np.pi * 660 * time),
        0.0,
    )
    pulse_length = round(0.045 * SAMPLE_RATE)
    pulse = np.hanning(pulse_length) * 0.8
    for pulse_time in np.arange(0.25, duration_seconds, 0.5):
        start = round(float(pulse_time) * SAMPLE_RATE)
        stop = min(sample_count, start + pulse_length)
        audio[start:stop] += pulse[: stop - start]
    return np.asarray(np.clip(audio, -1.0, 1.0), dtype=np.float32)


def write_wav(path: Path, audio: np.ndarray) -> None:
    encoded = np.asarray(np.clip(audio, -1.0, 1.0) * 32_767, dtype="<i2")
    with wave.open(str(path), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(SAMPLE_RATE)
        output.writeframes(encoded.tobytes())


def test_parameters() -> AnalysisParameters:
    return AnalysisParameters(
        sample_rate_hz=SAMPLE_RATE,
        frame_length=512,
        hop_length=128,
        waveform_points=24,
        energy_points=24,
        target_section_seconds=1.5,
        min_section_seconds=0.5,
        max_sections=4,
        max_events_per_kind=4,
    )


class ArrayFeatureTests(unittest.TestCase):
    def test_timestamps_stay_on_original_track_axis_and_inside_selection(self) -> None:
        audio = synthetic_pulse_track(3.5)
        selected_range = {"start_seconds": 12.25, "end_seconds": 15.75}

        features = extract_features(
            audio,
            sample_rate_hz=SAMPLE_RATE,
            selected_range=selected_range,
            parameters=test_parameters(),
        )

        self.assertEqual(features["waveform"][0]["time_seconds"], 12.25)
        self.assertEqual(features["waveform"][-1]["time_seconds"], 15.75)
        self.assertEqual(features["energy_envelope"][0]["time_seconds"], 12.25)
        self.assertEqual(features["energy_envelope"][-1]["time_seconds"], 15.75)
        self.assertEqual(
            features["candidate_sections"][0]["range"]["start_seconds"],
            12.25,
        )
        self.assertEqual(
            features["candidate_sections"][-1]["range"]["end_seconds"],
            15.75,
        )

        timestamps = [
            *features["beats_seconds"],
            *features["onsets_seconds"],
            *(point["time_seconds"] for point in features["waveform"]),
            *(point["time_seconds"] for point in features["energy_envelope"]),
            *(event["time_seconds"] for event in features["events"]),
        ]
        self.assertTrue(timestamps)
        self.assertTrue(all(12.25 <= value <= 15.75 for value in timestamps))

    def test_rejects_invalid_array_shapes_duration_and_silence(self) -> None:
        parameters = test_parameters()
        selected_range = {"start_seconds": 0.0, "end_seconds": 1.0}
        with self.assertRaisesRegex(AnalysisError, "one-dimensional"):
            extract_features(
                np.zeros((2, SAMPLE_RATE), dtype=np.float32),
                sample_rate_hz=SAMPLE_RATE,
                selected_range=selected_range,
                parameters=parameters,
            )
        with self.assertRaisesRegex(AnalysisError, "silent"):
            extract_features(
                np.zeros(SAMPLE_RATE, dtype=np.float32),
                sample_rate_hz=SAMPLE_RATE,
                selected_range=selected_range,
                parameters=parameters,
            )
        with self.assertRaisesRegex(AnalysisError, "duration does not match"):
            extract_features(
                np.ones(SAMPLE_RATE // 2, dtype=np.float32),
                sample_rate_hz=SAMPLE_RATE,
                selected_range=selected_range,
                parameters=parameters,
            )


class FileAnalysisTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary_directory.name)
        self.audio_path = self.root / "pulse.wav"
        write_wav(self.audio_path, synthetic_pulse_track())
        self.parameters = test_parameters()

    def tearDown(self) -> None:
        self.temporary_directory.cleanup()

    def request(self, *, start: float = 1.0, end: float = 5.0) -> AnalysisRequest:
        return AnalysisRequest(
            audio_path=self.audio_path,
            project_id="project-test",
            audio_asset_id="audio-test",
            selected_start_seconds=start,
            selected_end_seconds=end,
        )

    def test_emits_only_strict_music_analysis_v1_fields(self) -> None:
        outcome = MusicAnalyzer(parameters=self.parameters).analyze(self.request())
        analysis = outcome.music_analysis

        self.assertEqual(
            set(analysis),
            {
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
            },
        )
        self.assertEqual(analysis["schema_version"], "1.0.0")
        self.assertEqual(analysis["created_at"], "1970-01-01T00:00:00Z")
        self.assertEqual(analysis["method"]["engine_version"], ENGINE_VERSION)
        self.assertEqual(len(analysis["method"]["parameters_hash"]), 64)
        self.assertGreater(analysis["tempo_bpm"], 0)
        self.assertGreaterEqual(analysis["spectral_centroid_mean_hz"], 0)
        self.assertTrue(analysis["candidate_sections"])
        self.assertTrue(analysis["events"])
        self.assertNotIn("music_reading", music_analysis_json(analysis).lower())

    def test_cache_key_and_bytes_are_stable_and_range_sensitive(self) -> None:
        cache_dir = self.root / "cache"
        analyzer = MusicAnalyzer(parameters=self.parameters, cache_dir=cache_dir)

        first = analyzer.analyze(self.request())
        self.assertFalse(first.cache_hit)
        self.assertIsNotNone(first.cache_path)
        assert first.cache_path is not None
        first_bytes = first.cache_path.read_bytes()
        first_mtime = first.cache_path.stat().st_mtime_ns

        second = analyzer.analyze(self.request())
        self.assertTrue(second.cache_hit)
        self.assertEqual(first.cache_key, second.cache_key)
        self.assertEqual(first.music_analysis, second.music_analysis)
        self.assertEqual(first_bytes, second.cache_path.read_bytes())
        self.assertEqual(first_mtime, second.cache_path.stat().st_mtime_ns)

        changed_range = analyzer.analyze(self.request(start=0.5, end=4.5))
        self.assertNotEqual(first.cache_key, changed_range.cache_key)

        envelope = json.loads(first_bytes)
        descriptor = cache_descriptor(
            audio_sha256=first.audio_sha256,
            selected_range={"start_seconds": 1.0, "end_seconds": 5.0},
            engine_version=ENGINE_VERSION,
            parameters_hash=self.parameters.parameters_hash,
        )
        for field, value in descriptor.items():
            self.assertEqual(envelope[field], value)
        expected_key = hashlib.sha256(
            json.dumps(
                descriptor,
                sort_keys=True,
                separators=(",", ":"),
            ).encode()
        ).hexdigest()
        self.assertEqual(first.cache_key, expected_key)

    def test_output_is_deterministic_without_cache(self) -> None:
        analyzer = MusicAnalyzer(parameters=self.parameters)
        first = music_analysis_json(analyzer.analyze(self.request()).music_analysis)
        second = music_analysis_json(analyzer.analyze(self.request()).music_analysis)
        self.assertEqual(first, second)

    def test_rejects_missing_files_bad_ranges_silence_and_corrupt_cache(self) -> None:
        analyzer = MusicAnalyzer(parameters=self.parameters)
        with self.assertRaisesRegex(AnalysisError, "does not exist"):
            analyzer.analyze(
                AnalysisRequest(
                    audio_path=self.root / "missing.wav",
                    project_id="project-test",
                    audio_asset_id="audio-test",
                    selected_start_seconds=0,
                    selected_end_seconds=1,
                )
            )
        with self.assertRaisesRegex(AnalysisError, "greater than start"):
            self.request(start=2, end=2)
        with self.assertRaisesRegex(AnalysisError, "ends after the audio"):
            analyzer.analyze(self.request(start=5, end=7))

        silent_path = self.root / "silent.wav"
        write_wav(silent_path, np.zeros(SAMPLE_RATE * 2, dtype=np.float32))
        with self.assertRaisesRegex(AnalysisError, "silent"):
            analyzer.analyze(
                AnalysisRequest(
                    audio_path=silent_path,
                    project_id="project-test",
                    audio_asset_id="audio-silent",
                    selected_start_seconds=0,
                    selected_end_seconds=1,
                )
            )

        cached = MusicAnalyzer(
            parameters=self.parameters,
            cache_dir=self.root / "cache",
        ).analyze(self.request())
        assert cached.cache_path is not None
        cached.cache_path.write_text("not-json", encoding="utf-8")
        with self.assertRaises(CacheError):
            MusicAnalyzer(
                parameters=self.parameters,
                cache_dir=self.root / "cache",
            ).analyze(self.request())

    def test_cli_writes_contract_json_and_reports_cache(self) -> None:
        output_path = self.root / "result" / "analysis.json"
        cache_dir = self.root / "cli-cache"
        status = run(
            [
                str(self.audio_path),
                "--project-id",
                "project-cli",
                "--audio-asset-id",
                "audio-cli",
                "--start",
                "1",
                "--end",
                "5",
                "--cache-dir",
                str(cache_dir),
                "--output",
                str(output_path),
            ]
        )
        self.assertEqual(status, 0)
        output = json.loads(output_path.read_text(encoding="utf-8"))
        self.assertEqual(output["project_id"], "project-cli")
        self.assertEqual(output["audio_asset_id"], "audio-cli")
        self.assertEqual(
            output["analyzed_range"], {"start_seconds": 1.0, "end_seconds": 5.0}
        )
        self.assertEqual(len(list(cache_dir.glob("*.json"))), 1)


class RequestValidationTests(unittest.TestCase):
    def test_rejects_non_finite_ranges_and_invalid_record_metadata(self) -> None:
        with self.assertRaisesRegex(AnalysisError, "finite"):
            AnalysisRequest(Path("audio.wav"), "project", "audio", math.nan, 1)
        with self.assertRaisesRegex(AnalysisError, "non-empty"):
            AnalysisRequest(Path("audio.wav"), " ", "audio", 0, 1)
        with self.assertRaisesRegex(AnalysisError, "UTC offset"):
            AnalysisRequest(
                Path("audio.wav"),
                "project",
                "audio",
                0,
                1,
                recorded_at="2026-08-01T10:00:00",
            )


if __name__ == "__main__":
    unittest.main()
