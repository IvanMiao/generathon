# Veo Complex Shot 002 — Take 001

## Decision summary

| Field | Value |
| --- | --- |
| Decision | **Creative Mutation** |
| Strict prompt adherence | Repair required |
| Creative value | Keep for comparison and possible inclusion |
| Generated asset | [Local ignored artifact](../../artifacts/veo-complex-shot-002-take-001.mp4) |
| Review basis | ffprobe, deterministic FFmpeg checks, 2 FPS contact sheet, and visual inspection |
| Semantic critic | Not run; independent human review remains required |

The take does not visibly execute every requested concurrent event, but it compresses the intended narrative into a coherent transformation: an impossible paper-and-film city becomes a rejected storyboard surface, a magenta deletion mark appears, the world narrows into a vertical film seam, and a paper bird is preserved inside a film-frame arch. This is useful as a deliberate Creative Mutation rather than a strict pass.

## Generation record

| Field | Value |
| --- | --- |
| Provider | Google Gemini API / Veo |
| Model | `veo-3.1-generate-preview` |
| Operation | `models/veo-3.1-generate-preview/operations/i93jx81i0lr1` |
| Generated at | 2026-08-01 |
| Duration requested | 8 seconds |
| Aspect ratio | 16:9 |
| Resolution requested | 1080p |
| Seed | `20260801` |
| Native audio | Enabled by model |
| Filtered samples | 0 |
| Estimated cost | USD 3.20 (8 seconds × USD 0.40/second) |
| Billing verification | Estimate only; account billing was not queried |
| Local SHA-256 | `b2766c21d57994ba705650919f6b6d06d6a4a5da1328b2a8fd78c0f858584e4c` |

## Exact submitted prompt

```text
Eight-second 16:9 continuous single-take surreal mixed-media animation for The Director Who Does Not Exist, designed as a complex spatial transformation with synchronized native audio. The dominant material is tactile stop-motion architecture made from torn storyboard paper, matte cardboard, scanned emulsion, hand-painted film frames, and dry ink; nothing looks metallic, glossy, holographic, or generically cyberpunk. Color is discontinuous and restricted to acid cyan-green, burning magenta, deep blue-black, and intermittent warm gray.

0.0–2.0 seconds: a fast but stable low-angle camera glides into an impossible avenue built from stacked blank storyboard cards and perforated 35mm film. Several faceless low-poly paper pedestrians cross at different depths. Their flat architectural shadows move exactly one beat before their bodies, opening paper doors and turning corners before the pedestrians arrive. No shadow is shaped like a director.

2.0–5.0 seconds: on three sharp projector-click beats, physical crop marks rise from the road and become bridges; the entire street folds ninety degrees upward like a paper pop-up book while the camera rolls smoothly with it, preserving spatial orientation. Windows expose three contradictory versions of the same scene at once: a paper bird flying, falling, and remaining still. An invisible editing decision wipes two versions away with dry burning-magenta paint, but there is no cursor, hand, machine, blade, or visible controller. Acid cyan ink runs uphill through torn paper fibers against gravity.

5.0–8.0 seconds: the remaining bird commits an error and flies backward against the rhythm. A warm-gray frame line approaches to erase it, pauses without explanation, then folds around it as a protective architectural arch. Simultaneously the rest of the city compresses into a narrow vertical film seam and vanishes into deep blue-black negative space. Final image: the backward-flying paper bird and its one-beat-early rectangular shadow remain suspended inside the warm-gray arch; the camera hard-stops.

Sound design synchronized to action: rapid analog projector cadence, three dry paper snaps, reversed wing flutter, short sub-bass impact, sudden tape-stop silence at the final frame; no speech, no melody.

Maintain readable silhouettes, stable paper geometry, purposeful rhythmic motion, strong parallax, visible scanned grain and torn fibers. Do not generate readable writing, numbers, subtitles, logos, watermarks, neon grid floors, HUDs, holographic displays, glowing code, chrome robots, rainy neon streets, plastic 3D surfaces, lens flares, digital particle dust, visible directors, cameras, cursors, hands, blades, or slow purposeless cinematic drift.
```

## Mechanical inspection

| Check | Result | Evidence |
| --- | --- | --- |
| Container readable | Pass | MP4 container parsed successfully |
| Duration | Pass | 8.000 seconds |
| Video | Pass | H.264 High, 1920×1080, 24 fps, `yuv420p` |
| Audio | Pass | AAC, 48 kHz, stereo |
| File size | Pass | 14,181,294 bytes |
| Overall bitrate | Informational | 14,181,294 bits/second |
| Black frames | Pass | No `blackdetect` event at 0.10-second duration and 0.10 pixel threshold |
| Frozen frames | Pass | No `freezedetect` event lasting at least 0.50 seconds at −60 dB noise tolerance |
| Extended silence | Pass | No `silencedetect` event lasting at least 0.50 seconds below −50 dB |
| Mean audio level | Informational | −28.1 dB |
| Peak audio level | Informational | −0.5 dB |
| Hard scene cuts | Pass | No frame exceeded scene score 0.25 |

The absence of detected hard cuts supports the intended continuous transformation, but it does not prove that every transition is spatially coherent.

## Observed timeline

Timestamps are approximate and derived from a 2 FPS contact sheet.

| Time | Observation |
| --- | --- |
| 00:00–00:02 | The camera moves through a layered city made from film-bordered architecture. Multiple flat, faceless paper pedestrians cross at different depths. |
| 00:02–00:04 | The city transforms continuously into a large storyboard-like paper facade with perforated film borders, arches, torn apertures, and cyan folds. |
| 00:04–00:05 | A broad dry magenta paint stroke crosses the facade while the paper architecture opens and separates. |
| 00:05–00:06 | The facade narrows around a vertical dark seam; a white paper-bird form becomes visible near the seam. |
| 00:06–00:08 | The city is replaced by deep blue-black negative space. A white paper bird remains inside a warm-gray perforated film arch for the final image. |

## Acceptance criteria

| Criterion | Status | Evidence / limitation |
| --- | --- | --- |
| One continuous eight-second take | Pass | No hard cuts detected; contact-sheet geometry transforms continuously. |
| Tactile paper, cardboard, film, paint, and scanned texture | Pass | These materials dominate every sampled phase. |
| Restricted acid cyan, magenta, blue-black, and warm-gray palette | Pass | Palette is consistent across the take. |
| Multiple faceless paper pedestrians at different depths | Pass | Visible during the opening city movement. |
| Architectural shadows move one beat before bodies | Not observable | Still-frame sampling cannot establish exact beat ordering; requires playback review. |
| Crop marks become bridges and the street folds ninety degrees | Partial | Architecture folds and transforms, but distinct crop-mark bridges are not clearly readable. |
| Three contradictory bird versions coexist | Fail | Three simultaneous flying, falling, and still versions are not visible in sampled frames. |
| Magenta decision wipes exactly two bird versions | Partial | A strong magenta wipe appears, but its relationship to two rejected bird versions is unclear. |
| Acid cyan ink runs uphill | Not observable | Cyan material appears, but direction against gravity cannot be established from the contact sheet. |
| Remaining bird flies backward against the rhythm | Not observable | Direction and rhythm require playback and audio-synchronization review. |
| City compresses into a vertical film seam | Partial | A vertical seam transition occurs, but the city also behaves like an opening facade before disappearing. |
| Frame line preserves the bird as an arch | Pass | The final bird is clearly enclosed by a warm-gray perforated film arch. |
| Early rectangular shadow remains with the bird | Not observable | A separate shadow relationship is not clear in the final sampled frames. |
| No forbidden generic cyberpunk or explanatory UI | Pass | No HUD, hologram, neon grid, code, chrome robot, rainy street, or visible controller is present. |
| No readable text, logo, subtitle, or watermark | Pass | None observed in the sampled frames. |
| Requested synchronized sound design | Partial | Audio exists and is non-silent; individual projector, paper, wing, sub-bass, and tape-stop cues were not semantically audited. |

## Strengths

1. The opening city is materially distinct from generic cinematic AI footage.
2. Film perforations, paper surfaces, dry paint, and negative space form a reusable visual vocabulary.
3. The transition from city to facade to seam to preserved bird communicates revision without showing a director or interface.
4. The final film arch is a clear, legible symbol of an error being consciously preserved.
5. The take remains mechanically valid and visually continuous despite the high prompt complexity.

## Gaps and risks

1. The prompt contains more concurrent events than the model can make equally legible in eight seconds.
2. The crucial “shadow acts one beat early” rule is not established strongly enough in sampled evidence.
3. The three contradictory bird versions collapse into a more conventional single-bird reveal.
4. The city-to-seam action reads partly as an opening portal rather than pure deletion.
5. Audio timing needs human playback review before the take can be accepted for rhythm-sensitive editing.

## Recommended disposition

Keep this take as **Creative Mutation** and as the complex-provider capability proof. Do not treat it as a strict prompt-adherence pass.

For a repair take, preserve the material palette, city opening, magenta wipe, and final bird arch. Reduce the middle to one observable rule: show three bird versions in adjacent physical film windows, erase exactly two with one magenta stroke, and leave the third inside the arch. Use explicit first and last frames if available rather than adding more prose.

## Human review checklist

- [ ] Confirm whether shadows visibly move before their corresponding pedestrians.
- [ ] Confirm whether the bird motion is backward or otherwise rhythmically anomalous.
- [ ] Listen for projector clicks, three paper snaps, reversed wing flutter, sub-bass impact, and tape-stop silence.
- [ ] Decide whether the opening paper city is visually consistent with adjacent film shots.
- [ ] Decide whether the facade opening is a valuable mutation or a confusing failure.
- [ ] Approve or override the `Creative Mutation` decision.
