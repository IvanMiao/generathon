#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const apiKey = process.env.ELEVENLABS_API_KEY;

if (!apiKey) {
  console.error(
    "Missing ELEVENLABS_API_KEY. Put it in the repository's ignored .env file, then load it before running this script.",
  );
  process.exit(1);
}

const outputPath = path.resolve(
  process.argv[2] ?? "exports/original-melodic-electronica-120s.mp3",
);

const prompt = `
Create an original, purely instrumental electronic track lasting exactly two minutes.

Style and mood: immersive melancholic electronica with deep-house and restrained melodic-techno elements; nocturnal, introspective, cinematic, warm, and hypnotic. Keep the energy controlled rather than festival-sized. Tempo around 114 BPM, 4/4, minor-key harmonic language.

Sound palette: a rounded sub-bass pulse, soft but precise kick, dry rim and muted clap accents, detailed shuffling percussion, organic found-sound textures, distant granular ambience, warm analog pads, and one fragile repeating plucked-synth motif. Add a sparse, wordless human-vocal texture only as an abstract atmospheric layer—no lyrics, no lead singer, and no recognizable melody.

Arrangement: 0:00–0:18 atmospheric opening with filtered texture and the motif emerging; 0:18–0:45 introduce the groove and bass gradually; 0:45–1:12 full hypnotic pulse with subtle countermelody; 1:12–1:30 intimate breakdown that removes the kick and exposes ambience; 1:30–1:52 emotionally lifted final groove with richer percussion and harmony; 1:52–2:00 clean, intentional outro suitable for an edit.

Production: spacious stereo image, strong low-end separation, nuanced micro-dynamics, tasteful sidechain movement, smooth transitions, subtle saturation, and a polished modern master. Avoid bright EDM supersaws, aggressive drops, big-room builds, trap hi-hats, pop chord clichés, cheerful tropical-house colors, and vocals with words. The result must be a fresh composition, not an imitation of any existing recording.
`.trim();

const response = await fetch(
  "https://api.elevenlabs.io/v1/music?output_format=mp3_48000_192",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify({
      prompt,
      music_length_ms: 120_000,
      model_id: "music_v2",
      force_instrumental: true,
      sign_with_c2pa: true,
    }),
  },
);

if (!response.ok) {
  const details = await response.text();
  throw new Error(
    `ElevenLabs Music API returned ${response.status} ${response.statusText}: ${details}`,
  );
}

const audio = Buffer.from(await response.arrayBuffer());
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, audio);

console.log(`Saved ${audio.length} bytes to ${outputPath}`);
console.log(`ElevenLabs song id: ${response.headers.get("song-id") ?? "not returned"}`);
