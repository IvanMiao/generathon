# Step 0 Capability Gate

Checked on 2026-08-01 for the hackathon environment described in `IMPLEMENTATION_PLAN.md`.

## Outcome

Step 0 is partially complete. The local media toolchain passed, and CapCut Manual is selected as the safe generation fallback. The gate remains blocked because no Gemini or automated video-provider credentials are configured, and no real CapCut-exported clip is present in the repository.

Do not build the MVP around an assumed automated video provider. Continue to treat manual generation and take import as the guaranteed path until a provider smoke test passes.

## Verified locally

| Capability | Result | Evidence |
| --- | --- | --- |
| Python | Passed | Python 3.14.3 |
| Node.js | Passed | Node.js 24.17.0 |
| npm | Passed | npm 11.13.0 |
| FFmpeg | Passed | FFmpeg 8.0.1 |
| ffprobe | Passed | ffprobe 8.0.1 |
| Media inspection | Passed | A 3-second H.264/AAC MP4 was probed as 640×360 at 24 fps with one audio stream. |
| Media transcode | Passed | The sample was transcoded to a 320×180 H.264/AAC fast-start MP4. |

The smoke-test media was generated in `/tmp` and is intentionally not committed. Step 1 requires a tiny rights-cleared fixture to be added separately.

## Credential gate

Only credential presence was checked; no secret values were read or logged.

| Credential | Result |
| --- | --- |
| `GEMINI_API_KEY` / `GOOGLE_API_KEY` | Missing |
| Google Application Default Credentials | Missing |
| `RUNWAY_API_KEY` | Missing |
| BytePlus / ModelArk credentials | Missing |

Because of these missing credentials, the required real Gemini structured-text, image, and timestamped video-understanding requests could not run. Runway and BytePlus credits and account-specific limits also remain unverified.

## Pinned capability candidates

- Text, structured output, and video understanding: `gemini-3.6-flash` (stable).
- Image generation and editing: `gemini-3.1-flash-image` (stable).
- Preferred automated video candidate after credentials are available: Runway `seedance2`.
- Secondary automated candidate: BytePlus ModelArk `dreamina-seedance-2-0-260128` in the `ap-southeast` API region.
- Guaranteed generation path for the MVP: `capcut_manual`, without private APIs or browser automation.

Gemini video review must account for the documented default visual sampling rate of approximately 1 FPS. Mechanical checks and dense local frame sampling remain required for rapid motion and quick cuts.

## Published limits and costs recorded for planning

- `gemini-3.6-flash`: 1,048,576 input tokens and 65,536 output tokens; supports video input and structured output.
- Gemini video File API: up to 2 GB on the free tier or 20 GB on the paid tier; inline video is for payloads under 100 MB.
- `gemini-3.1-flash-image`: 0.5K, 1K, 2K, and 4K output options; generated images include SynthID.
- Runway `seedance2`: 36 credits/second at 480p or 720p, 40 credits/second at 1080p, and 150 credits/second at 4K. Account balance is not verified.

These values are current planning inputs, not permanent product constants. Provider adapters must expose capabilities dynamically where possible.

## Remaining actions to close Step 0

1. Configure `GEMINI_API_KEY` or `GOOGLE_API_KEY` outside the repository.
2. Run one real structured-text request with `gemini-3.6-flash`.
3. Run one real image generation or edit with `gemini-3.1-flash-image`.
4. Upload a short clip and obtain a timestamped description from `gemini-3.6-flash`.
5. Export one MP4 from CapCut and verify local import with ffprobe.
6. If an automated provider key and credits become available, test it once and update `config/capabilities.json`; otherwise retain CapCut Manual for the demo.

## Official references

- [Gemini models](https://ai.google.dev/gemini-api/docs/models)
- [Gemini 3.6 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.6-flash)
- [Gemini video understanding](https://ai.google.dev/gemini-api/docs/video-understanding)
- [Gemini image generation](https://ai.google.dev/gemini-api/docs/image-generation)
- [Runway models](https://docs.dev.runwayml.com/guides/models/)
- [Runway pricing](https://docs.dev.runwayml.com/guides/pricing/)
- [BytePlus Seedance 2.0 API](https://docs.byteplus.com/en/docs/modelark/1520757)
