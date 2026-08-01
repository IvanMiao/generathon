import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import * as z from "zod";

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const RangeSchema = z.strictObject({
  start_seconds: z.number().nonnegative(),
  end_seconds: z.number().positive(),
});

export const DeterministicAssemblyPlanSchema = z.strictObject({
  schema_version: z.literal("1.0.0"),
  id: z.string().min(1),
  project_id: z.string().min(1),
  audio: z.strictObject({
    relative_path: z.string().min(1),
    sha256: Sha256Schema,
    selected_range: RangeSchema,
  }),
  output: z.strictObject({
    relative_path: z.string().min(1),
    manifest_relative_path: z.string().min(1),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    fps: z.number().int().positive(),
    video_codec: z.literal("libx264"),
    audio_codec: z.literal("aac"),
  }),
  clips: z.array(
    z.strictObject({
      id: z.string().min(1),
      segment_id: z.string().min(1),
      take_id: z.string().min(1),
      locked: z.literal(true),
      relative_path: z.string().min(1),
      sha256: Sha256Schema,
      source_range: RangeSchema,
      timeline_range: RangeSchema,
      operation: z.enum(["stretch", "hold"]),
    }),
  ).min(1),
});

export type DeterministicAssemblyPlan = z.infer<
  typeof DeterministicAssemblyPlanSchema
>;

export interface AssemblySnapshot {
  assemblyId: string;
  audioPresent: boolean;
  codec: string;
  driftSeconds: number;
  durationSeconds: number;
  expectedDurationSeconds: number;
  manifestPath: string;
  outputPath: string;
  outputSha256: string;
  ready: boolean;
  renderedAt: string;
  sourceCount: number;
}

interface ProbeStream {
  codec_name?: string;
  codec_type?: string;
  height?: number;
  r_frame_rate?: string;
  width?: number;
}

interface ProbeResult {
  format?: { duration?: string };
  streams?: ProbeStream[];
}

export const DEMO_ASSEMBLY_PLAN_PATH =
  "fixtures/assembly/impossible-city-demo.assembly.v1.json";

const TIME_TOLERANCE_SECONDS = 1 / 24 + 0.001;

function duration(range: z.infer<typeof RangeSchema>) {
  return range.end_seconds - range.start_seconds;
}

function nearlyEqual(left: number, right: number) {
  return Math.abs(left - right) <= 0.000_001;
}

function resolveInsideRoot(rootDir: string, relativePath: string) {
  const root = path.resolve(rootDir);
  const resolved = path.resolve(root, relativePath);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Assembly path escapes the repository root: ${relativePath}`);
  }
  return resolved;
}

export function readDemoAssemblyPlan(
  rootDir = process.cwd(),
): DeterministicAssemblyPlan {
  const planPath = resolveInsideRoot(rootDir, DEMO_ASSEMBLY_PLAN_PATH);
  const plan = DeterministicAssemblyPlanSchema.parse(
    JSON.parse(readFileSync(planPath, "utf8")),
  );
  validateAssemblyPlan(plan);
  return plan;
}

export function validateAssemblyPlan(plan: DeterministicAssemblyPlan) {
  const selectedRange = plan.audio.selected_range;
  if (selectedRange.end_seconds <= selectedRange.start_seconds) {
    throw new Error("Assembly audio selection must have positive duration.");
  }

  let cursor = selectedRange.start_seconds;
  for (const clip of plan.clips) {
    if (clip.source_range.end_seconds <= clip.source_range.start_seconds) {
      throw new Error(`Assembly clip ${clip.id} has an invalid source range.`);
    }
    if (!nearlyEqual(clip.timeline_range.start_seconds, cursor)) {
      throw new Error(`Assembly clip ${clip.id} creates a timeline gap or overlap.`);
    }
    if (clip.timeline_range.end_seconds <= clip.timeline_range.start_seconds) {
      throw new Error(`Assembly clip ${clip.id} has an invalid timeline range.`);
    }
    cursor = clip.timeline_range.end_seconds;
  }

  if (!nearlyEqual(cursor, selectedRange.end_seconds)) {
    throw new Error("Assembly clips do not cover the complete selected score range.");
  }
}

export function buildAssemblyFilter(plan: DeterministicAssemblyPlan) {
  const clipFilters = plan.clips.map((clip, index) => {
    const sourceDuration = duration(clip.source_range);
    const timelineDuration = duration(clip.timeline_range);
    const base = [
      `[${index + 1}:v]trim=start=${clip.source_range.start_seconds}:end=${clip.source_range.end_seconds}`,
      "setpts=PTS-STARTPTS",
      `scale=${plan.output.width}:${plan.output.height}:flags=lanczos`,
      `fps=${plan.output.fps}`,
      "format=yuv420p",
    ];

    if (clip.operation === "stretch") {
      const playbackRate = sourceDuration / timelineDuration;
      base[1] = `setpts=(PTS-STARTPTS)/${playbackRate.toFixed(12)}`;
    } else {
      base.push(
        `tpad=stop_mode=clone:stop_duration=${timelineDuration.toFixed(6)}`,
      );
    }

    base.push(
      `trim=duration=${timelineDuration.toFixed(6)}`,
      "setpts=PTS-STARTPTS",
    );
    return `${base.join(",")}[v${index}]`;
  });
  const concatInputs = plan.clips.map((_, index) => `[v${index}]`).join("");
  const selectedRange = plan.audio.selected_range;

  return [
    ...clipFilters,
    `${concatInputs}concat=n=${plan.clips.length}:v=1:a=0[vout]`,
    `[0:a]atrim=start=${selectedRange.start_seconds}:end=${selectedRange.end_seconds},asetpts=PTS-STARTPTS,aresample=48000:async=0:first_pts=0[aout]`,
  ].join(";");
}

export function buildFfmpegArguments(
  plan: DeterministicAssemblyPlan,
  rootDir: string,
  temporaryOutputPath: string,
) {
  const audioPath = resolveInsideRoot(rootDir, plan.audio.relative_path);
  const inputArgs = plan.clips.flatMap((clip) => [
    "-i",
    resolveInsideRoot(rootDir, clip.relative_path),
  ]);
  const expectedDuration = duration(plan.audio.selected_range);

  return [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-fflags",
    "+bitexact",
    "-i",
    audioPath,
    ...inputArgs,
    "-filter_complex",
    buildAssemblyFilter(plan),
    "-map",
    "[vout]",
    "-map",
    "[aout]",
    "-t",
    expectedDuration.toFixed(6),
    "-c:v",
    plan.output.video_codec,
    "-preset",
    "medium",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    "-fps_mode",
    "cfr",
    "-threads",
    "1",
    "-x264-params",
    "threads=1:lookahead_threads=1:sliced_threads=0",
    "-flags:v",
    "+bitexact",
    "-c:a",
    plan.output.audio_codec,
    "-b:a",
    "320k",
    "-ar",
    "48000",
    "-ac",
    "2",
    "-flags:a",
    "+bitexact",
    "-map_metadata",
    "-1",
    "-movflags",
    "+faststart",
    temporaryOutputPath,
  ];
}

function sha256File(filePath: string) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function verifyInput(filePath: string, expectedSha256: string) {
  if (!existsSync(filePath)) {
    throw new Error(`Assembly input is missing: ${filePath}`);
  }
  const actualSha256 = sha256File(filePath);
  if (actualSha256 !== expectedSha256) {
    throw new Error(
      `Assembly input hash changed: ${filePath} (${actualSha256} != ${expectedSha256})`,
    );
  }
}

function probeMedia(filePath: string): ProbeResult {
  const probe = spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration:stream=codec_type,codec_name,width,height,r_frame_rate",
      "-of",
      "json",
      filePath,
    ],
    { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
  );
  if (probe.status !== 0) {
    throw new Error(`ffprobe failed: ${probe.stderr || probe.stdout}`);
  }
  return JSON.parse(probe.stdout) as ProbeResult;
}

function ffmpegVersion() {
  const version = spawnSync("ffmpeg", ["-version"], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });
  if (version.status !== 0) throw new Error("ffmpeg is not available.");
  return version.stdout.split("\n", 1)[0];
}

function atomicWriteJson(filePath: string, value: unknown) {
  const temporaryPath = `${filePath}.tmp-${process.pid}`;
  writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(temporaryPath, filePath);
}

export function runDeterministicAssembly(
  plan: DeterministicAssemblyPlan,
  rootDir = process.cwd(),
): AssemblySnapshot {
  validateAssemblyPlan(plan);
  const audioPath = resolveInsideRoot(rootDir, plan.audio.relative_path);
  verifyInput(audioPath, plan.audio.sha256);
  for (const clip of plan.clips) {
    verifyInput(resolveInsideRoot(rootDir, clip.relative_path), clip.sha256);
  }

  const outputPath = resolveInsideRoot(rootDir, plan.output.relative_path);
  const manifestPath = resolveInsideRoot(
    rootDir,
    plan.output.manifest_relative_path,
  );
  const temporaryOutputPath = `${outputPath}.tmp-${process.pid}.mp4`;
  const args = buildFfmpegArguments(plan, rootDir, temporaryOutputPath);
  const render = spawnSync("ffmpeg", args, {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (render.status !== 0) {
    throw new Error(`ffmpeg assembly failed: ${render.stderr || render.stdout}`);
  }
  renameSync(temporaryOutputPath, outputPath);

  const probe = probeMedia(outputPath);
  const outputDuration = Number(probe.format?.duration);
  const expectedDuration = duration(plan.audio.selected_range);
  const driftSeconds = outputDuration - expectedDuration;
  const video = probe.streams?.find((stream) => stream.codec_type === "video");
  const audio = probe.streams?.find((stream) => stream.codec_type === "audio");
  if (!Number.isFinite(outputDuration)) {
    throw new Error("Assembly output duration could not be measured.");
  }
  if (Math.abs(driftSeconds) > TIME_TOLERANCE_SECONDS) {
    throw new Error(
      `Assembly duration drift ${driftSeconds.toFixed(6)}s exceeds tolerance.`,
    );
  }
  if (!audio || !video) {
    throw new Error("Assembly output must contain both video and original audio.");
  }
  if (
    video.width !== plan.output.width ||
    video.height !== plan.output.height ||
    video.r_frame_rate !== `${plan.output.fps}/1`
  ) {
    throw new Error("Assembly output geometry or frame rate differs from the plan.");
  }

  const planSha256 = createHash("sha256")
    .update(JSON.stringify(plan))
    .digest("hex");
  const outputSha256 = sha256File(outputPath);
  const renderedAt = new Date(statSync(outputPath).mtimeMs).toISOString();
  const manifest = {
    schema_version: "1.0.0",
    assembly_id: plan.id,
    project_id: plan.project_id,
    deterministic_boundary:
      "Same verified inputs, plan, FFmpeg build, and architecture produce the same editorial result.",
    plan_sha256: planSha256,
    tool: ffmpegVersion(),
    sources: {
      audio: {
        relative_path: plan.audio.relative_path,
        sha256: plan.audio.sha256,
        native_audio_preserved: true,
      },
      clips: plan.clips.map((clip) => ({
        id: clip.id,
        segment_id: clip.segment_id,
        take_id: clip.take_id,
        locked: clip.locked,
        relative_path: clip.relative_path,
        sha256: clip.sha256,
        source_range: clip.source_range,
        timeline_range: clip.timeline_range,
        operation: clip.operation,
      })),
    },
    output: {
      relative_path: plan.output.relative_path,
      sha256: outputSha256,
      bytes: statSync(outputPath).size,
      duration_seconds: outputDuration,
      expected_duration_seconds: expectedDuration,
      drift_seconds: driftSeconds,
      video_codec: video.codec_name,
      audio_codec: audio.codec_name,
      width: video.width,
      height: video.height,
      frame_rate: video.r_frame_rate,
      audio_present: true,
    },
    rendered_at: renderedAt,
  };
  atomicWriteJson(manifestPath, manifest);

  return {
    assemblyId: plan.id,
    audioPresent: true,
    codec: `${video.codec_name ?? "unknown"}/${audio.codec_name ?? "unknown"}`,
    driftSeconds,
    durationSeconds: outputDuration,
    expectedDurationSeconds: expectedDuration,
    manifestPath: plan.output.manifest_relative_path,
    outputPath: plan.output.relative_path,
    outputSha256,
    ready: true,
    renderedAt,
    sourceCount: plan.clips.length,
  };
}

export function runDemoAssembly(rootDir = process.cwd()) {
  return runDeterministicAssembly(readDemoAssemblyPlan(rootDir), rootDir);
}

export function readDemoAssemblySnapshot(
  rootDir = process.cwd(),
): AssemblySnapshot | null {
  const plan = readDemoAssemblyPlan(rootDir);
  const outputPath = resolveInsideRoot(rootDir, plan.output.relative_path);
  const manifestPath = resolveInsideRoot(
    rootDir,
    plan.output.manifest_relative_path,
  );
  if (!existsSync(outputPath) || !existsSync(manifestPath)) return null;

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    assembly_id: string;
    rendered_at: string;
    sources: { clips: unknown[] };
    output: {
      audio_codec: string;
      audio_present: boolean;
      drift_seconds: number;
      duration_seconds: number;
      expected_duration_seconds: number;
      relative_path: string;
      sha256: string;
      video_codec: string;
    };
  };
  if (sha256File(outputPath) !== manifest.output.sha256) return null;

  return {
    assemblyId: manifest.assembly_id,
    audioPresent: manifest.output.audio_present,
    codec: `${manifest.output.video_codec}/${manifest.output.audio_codec}`,
    driftSeconds: manifest.output.drift_seconds,
    durationSeconds: manifest.output.duration_seconds,
    expectedDurationSeconds: manifest.output.expected_duration_seconds,
    manifestPath: plan.output.manifest_relative_path,
    outputPath: manifest.output.relative_path,
    outputSha256: manifest.output.sha256,
    ready: true,
    renderedAt: manifest.rendered_at,
    sourceCount: manifest.sources.clips.length,
  };
}
