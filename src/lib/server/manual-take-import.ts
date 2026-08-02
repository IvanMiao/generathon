import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  mkdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import type { ProjectBundle } from "@/lib/domain/project";
import { parseProjectBundle } from "@/lib/domain/validation";
import {
  ProjectBundleNotFoundError,
  ProjectBundleRevisionConflictError,
  type ProjectRepository,
} from "@/lib/server/repositories/project-repository";

export const MAX_MANUAL_TAKE_BYTES = 512 * 1024 * 1024;
const MP4_FILE_NAME = /\.mp4$/i;

interface ProbeStream {
  channels?: number;
  codec_name?: string;
  codec_type?: string;
  height?: number;
  r_frame_rate?: string;
  sample_rate?: string;
  width?: number;
}

interface ProbeResult {
  format?: { duration?: string };
  streams?: ProbeStream[];
}

export interface ImportedMediaReport {
  durationSeconds: number;
  video: {
    codec: string;
    width: number;
    height: number;
    frameRate: string;
  };
  audio: {
    present: boolean;
    codec: string | null;
    sampleRateHz: number | null;
    channels: number | null;
  };
}

export interface ManualTakeImportInput {
  projectId: string;
  expectedProjectRevision: number;
  shotSpecId: string;
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
}

export interface ManualTakeImportResult {
  projectRevision: number;
  artifact: {
    id: string;
    relativePath: string;
    sha256: string;
  };
  take: {
    id: string;
    shotSpecId: string;
    source: "manual";
    status: "candidate";
    locked: false;
  };
  media: ImportedMediaReport;
}

export type ManualTakeImportErrorCode =
  | "manual_take_file_invalid"
  | "manual_take_media_invalid"
  | "manual_take_shot_not_found"
  | "manual_take_write_failed";

export class ManualTakeImportError extends Error {
  constructor(
    readonly code: ManualTakeImportErrorCode,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ManualTakeImportError";
  }
}

export function isManualTakeImportError(
  error: unknown,
): error is ManualTakeImportError {
  return error instanceof ManualTakeImportError;
}

interface ManualTakeImportOptions {
  rootDir?: string;
  uploadsDir?: string;
  now?: () => string;
  idFactory?: () => string;
  probeMedia?: (filePath: string) => ImportedMediaReport;
}

function resolveInsideDirectory(directory: string, child: string) {
  const root = path.resolve(directory);
  const resolved = path.resolve(root, child);
  if (resolved === root || !resolved.startsWith(`${root}${path.sep}`)) {
    throw new ManualTakeImportError(
      "manual_take_write_failed",
      "The imported video could not be stored safely.",
      500,
    );
  }
  return resolved;
}

function relativePathInsideRoot(rootDir: string, absolutePath: string) {
  const root = path.resolve(rootDir);
  const relativePath = path.relative(root, absolutePath);
  if (
    !relativePath ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw new ManualTakeImportError(
      "manual_take_write_failed",
      "The upload directory must be inside the project workspace.",
      500,
    );
  }
  return relativePath.split(path.sep).join("/");
}

function validateImportFile(input: ManualTakeImportInput) {
  const mimeType = input.mimeType.trim().toLowerCase();
  const acceptedMimeType =
    mimeType === "" || mimeType === "video/mp4" || mimeType === "application/mp4";
  if (!MP4_FILE_NAME.test(input.fileName) || !acceptedMimeType) {
    throw new ManualTakeImportError(
      "manual_take_file_invalid",
      "Import an MP4 video file.",
      400,
    );
  }
  if (input.bytes.byteLength === 0) {
    throw new ManualTakeImportError(
      "manual_take_file_invalid",
      "The imported video file is empty.",
      400,
    );
  }
  if (input.bytes.byteLength > MAX_MANUAL_TAKE_BYTES) {
    throw new ManualTakeImportError(
      "manual_take_file_invalid",
      "The imported video exceeds the 512 MB limit.",
      413,
    );
  }
}

function defaultProbeMedia(filePath: string): ImportedMediaReport {
  const result = spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration:stream=codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels",
      "-of",
      "json",
      filePath,
    ],
    { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
  );
  if (result.status !== 0) {
    throw new ManualTakeImportError(
      "manual_take_media_invalid",
      "The imported file is not a readable MP4 video.",
      422,
    );
  }

  let probe: ProbeResult;
  try {
    probe = JSON.parse(result.stdout) as ProbeResult;
  } catch {
    throw new ManualTakeImportError(
      "manual_take_media_invalid",
      "The imported file is not a readable MP4 video.",
      422,
    );
  }

  const durationSeconds = Number(probe.format?.duration);
  const video = probe.streams?.find((stream) => stream.codec_type === "video");
  const audio = probe.streams?.find((stream) => stream.codec_type === "audio");
  const videoCodec = video?.codec_name;
  const width = video?.width;
  const height = video?.height;
  const frameRate = video?.r_frame_rate;
  if (
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0 ||
    !video ||
    videoCodec !== "h264" ||
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    !width ||
    !height ||
    !frameRate ||
    frameRate === "0/0"
  ) {
    throw new ManualTakeImportError(
      "manual_take_media_invalid",
      "The imported video must contain a timed H.264 video stream.",
      422,
    );
  }

  const sampleRateHz = audio?.sample_rate ? Number(audio.sample_rate) : null;
  return {
    durationSeconds,
    video: {
      codec: videoCodec,
      width,
      height,
      frameRate,
    },
    audio: {
      present: Boolean(audio),
      codec: audio?.codec_name ?? null,
      sampleRateHz:
        sampleRateHz !== null && Number.isFinite(sampleRateHz)
          ? sampleRateHz
          : null,
      channels: audio?.channels ?? null,
    },
  };
}

function validateMediaReport(report: ImportedMediaReport) {
  if (
    !Number.isFinite(report.durationSeconds) ||
    report.durationSeconds <= 0 ||
    report.video.codec !== "h264" ||
    !Number.isInteger(report.video.width) ||
    report.video.width <= 0 ||
    !Number.isInteger(report.video.height) ||
    report.video.height <= 0 ||
    report.video.frameRate.length === 0
  ) {
    throw new ManualTakeImportError(
      "manual_take_media_invalid",
      "The imported video must contain a timed H.264 video stream.",
      422,
    );
  }
}

function buildImportedBundle(
  bundle: ProjectBundle,
  input: ManualTakeImportInput,
  artifactId: string,
  takeId: string,
  relativePath: string,
  sha256: string,
  media: ImportedMediaReport,
  now: string,
) {
  const shot = bundle.shot_specs.find((candidate) => candidate.id === input.shotSpecId);
  if (!shot) {
    throw new ManualTakeImportError(
      "manual_take_shot_not_found",
      "The selected ShotSpec does not exist in this project.",
      404,
    );
  }
  const artifactsById = new Map(bundle.artifacts.map((artifact) => [artifact.id, artifact]));
  const referenceVersions = shot.references.map((reference) => {
    const artifact = artifactsById.get(reference.artifact_id);
    if (!artifact) {
      throw new ManualTakeImportError(
        "manual_take_write_failed",
        "The selected ShotSpec has an invalid reference artifact.",
        500,
      );
    }
    return { artifact_id: artifact.id, revision: artifact.revision };
  });
  const nextProject = {
    ...bundle.project,
    creative_state:
      bundle.project.creative_state === "score_approved"
        ? ("in_production" as const)
        : bundle.project.creative_state,
    revision: bundle.project.revision + 1,
    updated_at: now,
  };

  return parseProjectBundle({
    ...bundle,
    project: nextProject,
    artifacts: [
      ...bundle.artifacts,
      {
        schema_version: "1.0.0",
        id: artifactId,
        project_id: input.projectId,
        revision: 1,
        created_at: now,
        updated_at: now,
        kind: "video",
        relative_path: relativePath,
        sha256,
        mime_type: "video/mp4",
        provenance: {
          source: "import",
          provider_run_id: null,
          parent_artifact_ids: [],
        },
      },
    ],
    takes: [
      ...bundle.takes,
      {
        schema_version: "1.0.0",
        id: takeId,
        project_id: input.projectId,
        revision: 1,
        created_at: now,
        updated_at: now,
        shot_spec_id: shot.id,
        artifact_id: artifactId,
        source: "manual",
        provider: null,
        prompt_version: null,
        reference_versions: referenceVersions,
        generation_settings: {
          import_format: "mp4",
          duration_seconds: media.durationSeconds,
          video_codec: media.video.codec,
          width: media.video.width,
          height: media.video.height,
          frame_rate: media.video.frameRate,
          audio_present: media.audio.present,
        },
        cost_usd: 0,
        status: "candidate",
        locked: false,
      },
    ],
  });
}

export class ManualTakeImportService {
  private readonly rootDir: string;
  private readonly uploadsDir: string;
  private readonly now: () => string;
  private readonly idFactory: () => string;
  private readonly probeMedia: (filePath: string) => ImportedMediaReport;

  constructor(
    private readonly repository: ProjectRepository,
    options: ManualTakeImportOptions = {},
  ) {
    this.rootDir = options.rootDir ?? process.cwd();
    this.uploadsDir = options.uploadsDir ?? path.join(this.rootDir, "uploads");
    this.now = options.now ?? (() => new Date().toISOString());
    this.idFactory = options.idFactory ?? randomUUID;
    this.probeMedia = options.probeMedia ?? defaultProbeMedia;
  }

  importManualTake(input: ManualTakeImportInput): ManualTakeImportResult {
    validateImportFile(input);
    const bundle = this.repository.getProjectBundle(input.projectId);
    if (!bundle) throw new ProjectBundleNotFoundError(input.projectId);
    if (bundle.project.revision !== input.expectedProjectRevision) {
      throw new ProjectBundleRevisionConflictError(
        input.projectId,
        input.expectedProjectRevision,
        bundle.project.revision,
      );
    }
    if (!bundle.shot_specs.some((shot) => shot.id === input.shotSpecId)) {
      throw new ManualTakeImportError(
        "manual_take_shot_not_found",
        "The selected ShotSpec does not exist in this project.",
        404,
      );
    }

    const artifactId = `artifact-import-${this.idFactory()}`;
    const takeId = `take-manual-${this.idFactory()}`;
    const projectUploadsDir = resolveInsideDirectory(this.uploadsDir, input.projectId);
    const destinationPath = resolveInsideDirectory(projectUploadsDir, `${takeId}.mp4`);
    const temporaryPath = `${destinationPath}.tmp-${this.idFactory()}`;
    const relativePath = relativePathInsideRoot(this.rootDir, destinationPath);
    const sha256 = createHash("sha256").update(input.bytes).digest("hex");
    let savedFile = false;

    try {
      mkdirSync(projectUploadsDir, { recursive: true });
      writeFileSync(temporaryPath, input.bytes, { flag: "wx" });
      const media = this.probeMedia(temporaryPath);
      validateMediaReport(media);
      renameSync(temporaryPath, destinationPath);
      savedFile = true;
      const nextBundle = buildImportedBundle(
        bundle,
        input,
        artifactId,
        takeId,
        relativePath,
        sha256,
        media,
        this.now(),
      );
      const saved = this.repository.replaceProjectBundle(
        nextBundle,
        input.expectedProjectRevision,
      );
      return {
        projectRevision: saved.project.revision,
        artifact: { id: artifactId, relativePath, sha256 },
        take: {
          id: takeId,
          shotSpecId: input.shotSpecId,
          source: "manual",
          status: "candidate",
          locked: false,
        },
        media,
      };
    } catch (error) {
      rmSync(temporaryPath, { force: true });
      if (savedFile) rmSync(destinationPath, { force: true });
      if (isManualTakeImportError(error)) throw error;
      throw error;
    }
  }
}
