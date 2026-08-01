"""Step 0 provider smoke tests with secret-safe JSON output.

Examples:
  uv run python scripts/step0_provider_smoke.py gemini-text
  uv run python scripts/step0_provider_smoke.py gemini-audio exports/track.mp3
  uv run python scripts/step0_provider_smoke.py gemini-image artifacts/step0/visual-anchor.png
  uv run python scripts/step0_provider_smoke.py gemini-video-review video-1.mp4
  uv run python scripts/step0_provider_smoke.py gemini-video OUTPUT.mp4 \
    --prompt-file LOCKED_SHOT_PROMPT.md --confirm-final-candidate
  uv run python scripts/step0_provider_smoke.py openai-capability

The script reads repository-local .env through python-dotenv. It never prints
credential values, request headers, uploaded file URIs, or provider object dumps.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import sys
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv
from pydantic import BaseModel, Field

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_GEMINI_TEXT_MODEL = "gemini-3.6-flash"
DEFAULT_GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image"
DEFAULT_GEMINI_VIDEO_MODEL = "gemini-omni-flash-preview"


class TextSmokeResult(BaseModel):
    product_axis: Literal["music_structure", "visual_direction"]
    constraint: str


class MusicSection(BaseModel):
    start_seconds: float = Field(ge=0)
    end_seconds: float = Field(gt=0)
    energy: Literal["low", "medium", "high"]
    narrative_function: str
    visual_impulse: str
    evidence: str


class MusicReading(BaseModel):
    summary: str
    emotional_arc: str
    sections: list[MusicSection]
    uncertainty: list[str]


class VideoReading(BaseModel):
    summary: str
    dominant_palette: list[str]
    camera_motion: str
    continuity_risks: list[str]


def emit(payload: dict[str, object]) -> None:
    print(json.dumps(payload, ensure_ascii=False, indent=2))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def require_file(raw_path: str) -> Path:
    path = Path(raw_path).expanduser().resolve()
    if not path.is_file():
        raise FileNotFoundError(path)
    return path


def gemini_client():
    from google import genai

    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY or GOOGLE_API_KEY is not configured")
    return genai.Client(api_key=api_key)


def gemini_text() -> None:
    client = gemini_client()
    model = os.getenv("GEMINI_TEXT_MODEL", DEFAULT_GEMINI_TEXT_MODEL)
    interaction = client.interactions.create(
        model=model,
        input=(
            "Return the requested schema. For a score-to-cinema directing tool, "
            "choose music_structure as the axis and state one concise constraint "
            "that keeps measured MIR evidence separate from interpretation."
        ),
        response_format={
            "type": "text",
            "mime_type": "application/json",
            "schema": TextSmokeResult.model_json_schema(),
        },
        store=False,
    )
    parsed = TextSmokeResult.model_validate_json(interaction.output_text)
    emit({"status": "passed", "provider": "gemini", "model": model, "result": parsed.model_dump()})


def gemini_audio(raw_path: str, output: str | None) -> None:
    client = gemini_client()
    path = require_file(raw_path)
    model = os.getenv("GEMINI_TEXT_MODEL", DEFAULT_GEMINI_TEXT_MODEL)
    uploaded = client.files.upload(file=path)
    interaction = client.interactions.create(
        model=model,
        input=[
            {
                "type": "text",
                "text": (
                    "Analyze this instrumental electronic track as a film director, not as a beat detector. "
                    "Describe its editable narrative/emotional arc and 3-6 evidence-backed sections. "
                    "Use timestamps, but explicitly expose uncertainty; do not identify or imitate an artist."
                ),
            },
            {"type": "audio", "uri": uploaded.uri, "mime_type": uploaded.mime_type},
        ],
        response_format={
            "type": "text",
            "mime_type": "application/json",
            "schema": MusicReading.model_json_schema(),
        },
        store=False,
    )
    parsed = MusicReading.model_validate_json(interaction.output_text)
    result = {
        "status": "passed",
        "provider": "gemini",
        "model": model,
        "input": {"path": str(path.relative_to(REPO_ROOT)), "sha256": sha256(path)},
        "reading": parsed.model_dump(),
    }
    if output:
        output_path = Path(output).expanduser().resolve()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
        result["saved_to"] = str(output_path)
    emit(result)


def gemini_image(raw_output: str) -> None:
    client = gemini_client()
    output = Path(raw_output).expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    model = os.getenv("GEMINI_IMAGE_MODEL", DEFAULT_GEMINI_IMAGE_MODEL)
    interaction = client.interactions.create(
        model=model,
        input=(
            "A single cinematic visual-system anchor for an auteur electronic-music short: "
            "a vast black mineral chamber crossed by one translucent membrane, graphite, cold silver, "
            "subtle oxidized amber, volumetric side light, tactile macro detail within monumental scale, "
            "restrained composition, no people, no typography, no logos, no collage, 16:9."
        ),
        response_format={"type": "image", "aspect_ratio": "16:9", "image_size": "1K"},
        store=False,
    )
    if not interaction.output_image or not interaction.output_image.data:
        raise RuntimeError("Gemini returned no image data")
    output.write_bytes(base64.b64decode(interaction.output_image.data))
    emit(
        {
            "status": "passed",
            "provider": "gemini",
            "model": model,
            "output": str(output),
            "bytes": output.stat().st_size,
            "sha256": sha256(output),
        }
    )


def gemini_video_review(raw_path: str) -> None:
    client = gemini_client()
    path = require_file(raw_path)
    model = os.getenv("GEMINI_VIDEO_REVIEW_MODEL", os.getenv("GEMINI_TEXT_MODEL", DEFAULT_GEMINI_TEXT_MODEL))
    video_data = base64.b64encode(path.read_bytes()).decode("ascii")
    interaction = client.interactions.create(
        model=model,
        input=[
            {
                "type": "text",
                "text": (
                    "Review this short video as a continuity checker. Describe only visible evidence, "
                    "including palette, camera motion, and concrete continuity risks."
                ),
            },
            {"type": "video", "data": video_data, "mime_type": "video/mp4"},
        ],
        response_format={
            "type": "text",
            "mime_type": "application/json",
            "schema": VideoReading.model_json_schema(),
        },
        store=False,
    )
    parsed = VideoReading.model_validate_json(interaction.output_text)
    emit(
        {
            "status": "passed",
            "provider": "gemini",
            "model": model,
            "input": {"path": str(path.relative_to(REPO_ROOT)), "sha256": sha256(path)},
            "reading": parsed.model_dump(),
        }
    )


def gemini_video(raw_output: str, raw_prompt_file: str, confirmed: bool) -> None:
    if not confirmed:
        raise RuntimeError("video generation requires --confirm-final-candidate")
    prompt_file = require_file(raw_prompt_file)
    prompt = prompt_file.read_text().strip()
    if len(prompt) < 600:
        raise ValueError("locked video prompt must contain at least 600 characters")
    required_sections = (
        "SHOT INTENT",
        "VISUAL CONTINUITY",
        "TIME-CODED ACTION",
        "CAMERA",
        "LIGHT AND COLOR",
        "MATERIAL AND PHYSICS",
        "EXCLUSIONS",
        "EDITORIAL USE",
    )
    missing_sections = [section for section in required_sections if section not in prompt]
    if missing_sections:
        raise ValueError(f"locked video prompt is missing sections: {', '.join(missing_sections)}")
    if "{{" in prompt or "REPLACE_ME" in prompt:
        raise ValueError("locked video prompt still contains template placeholders")
    client = gemini_client()
    output = Path(raw_output).expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    model = os.getenv("GEMINI_VIDEO_MODEL", DEFAULT_GEMINI_VIDEO_MODEL)
    interaction = client.interactions.create(
        model=model,
        input=prompt,
        response_format={"type": "video", "aspect_ratio": "16:9"},
        store=False,
        background=False,
    )
    if not interaction.output_video or not interaction.output_video.data:
        raise RuntimeError("Gemini returned no inline video data")
    output.write_bytes(base64.b64decode(interaction.output_video.data))
    emit(
        {
            "status": "passed",
            "provider": "gemini",
            "model": model,
            "prompt_file": str(prompt_file),
            "prompt_sha256": sha256(prompt_file),
            "candidate_policy": "locked_final_cut_candidate",
            "output": str(output),
            "bytes": output.stat().st_size,
            "sha256": sha256(output),
        }
    )


def openai_capability() -> None:
    from openai import OpenAI

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured")
    model = os.getenv("OPENAI_VIDEO_MODEL", "sora-2")
    client = OpenAI(api_key=api_key)
    model_info = client.models.retrieve(model)
    page = client.videos.list(limit=1, order="desc")
    emit(
        {
            "status": "passed",
            "provider": "openai",
            "model": model_info.id,
            "videos_endpoint_accessible": True,
            "returned_items": len(page.data),
            "shutdown_date": "2026-09-24",
            "production_role": "transition_only",
        }
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("gemini-text")

    audio = subparsers.add_parser("gemini-audio")
    audio.add_argument("path")
    audio.add_argument("--output")

    image = subparsers.add_parser("gemini-image")
    image.add_argument("output")

    review = subparsers.add_parser("gemini-video-review")
    review.add_argument("path")

    video = subparsers.add_parser("gemini-video")
    video.add_argument("output")
    video.add_argument("--prompt-file", required=True)
    video.add_argument("--confirm-final-candidate", action="store_true")

    subparsers.add_parser("openai-capability")
    return parser


def main() -> int:
    load_dotenv(REPO_ROOT / ".env", override=False)
    args = build_parser().parse_args()
    try:
        if args.command == "gemini-text":
            gemini_text()
        elif args.command == "gemini-audio":
            gemini_audio(args.path, args.output)
        elif args.command == "gemini-image":
            gemini_image(args.output)
        elif args.command == "gemini-video-review":
            gemini_video_review(args.path)
        elif args.command == "gemini-video":
            gemini_video(args.output, args.prompt_file, args.confirm_final_candidate)
        elif args.command == "openai-capability":
            openai_capability()
        else:
            raise AssertionError(args.command)
    except Exception as exc:  # noqa: BLE001 - CLI boundary emits a safe, typed failure.
        emit({"status": "failed", "command": args.command, "error_type": type(exc).__name__, "message": str(exc)})
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
