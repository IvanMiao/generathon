import { existsSync, readFileSync, rmSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ManualTakeImportError,
  ManualTakeImportService,
  type ImportedMediaReport,
} from "@/lib/server/manual-take-import";
import { importCanonicalProjectBundle } from "@/lib/server/fixtures/canonical-project";
import {
  ProjectBundleRevisionConflictError,
  ProjectRepository,
} from "@/lib/server/repositories/project-repository";

const temporaryRoots: string[] = [];

const validMediaReport: ImportedMediaReport = {
  durationSeconds: 8.042,
  video: {
    codec: "h264",
    width: 1280,
    height: 720,
    frameRate: "24/1",
  },
  audio: {
    present: false,
    codec: null,
    sampleRateHz: null,
    channels: null,
  },
};

function createService() {
  const root = mkdtempSync(path.join(tmpdir(), "generathon-manual-take-"));
  temporaryRoots.push(root);
  const repository = new ProjectRepository(path.join(root, "manual-take.sqlite"));
  const bundle = importCanonicalProjectBundle(repository);
  let identifier = 0;
  const service = new ManualTakeImportService(repository, {
    rootDir: root,
    uploadsDir: path.join(root, "uploads"),
    now: () => "2026-08-02T10:00:00Z",
    idFactory: () => `test-${++identifier}`,
    probeMedia: () => validMediaReport,
  });
  return { bundle, repository, root, service };
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("manual Take import", () => {
  it("stores a validated local MP4 as a candidate Take without changing its locked ShotSpec", () => {
    const { bundle, repository, root, service } = createService();
    const bytes = new Uint8Array([0, 1, 2, 3, 4, 5]);

    const result = service.importManualTake({
      projectId: bundle.project.id,
      expectedProjectRevision: bundle.project.revision,
      shotSpecId: "shot-02",
      fileName: "provider-export.mp4",
      mimeType: "video/mp4",
      bytes,
    });

    expect(result).toMatchObject({
      projectRevision: 2,
      take: {
        source: "manual",
        status: "candidate",
        locked: false,
        shotSpecId: "shot-02",
      },
      media: validMediaReport,
    });
    const stored = repository.getProjectBundle(bundle.project.id);
    const importedTake = stored?.takes.find((take) => take.id === result.take.id);
    const importedArtifact = stored?.artifacts.find(
      (artifact) => artifact.id === result.artifact.id,
    );
    expect(importedTake).toMatchObject({ source: "manual", locked: false });
    expect(importedArtifact).toMatchObject({
      kind: "video",
      mime_type: "video/mp4",
      provenance: { source: "import", provider_run_id: null },
    });
    expect(
      stored?.shot_specs.find((shot) => shot.id === "shot-02"),
    ).toMatchObject({ status: "locked", revision: 1 });
    expect(
      readFileSync(path.join(root, importedArtifact!.relative_path)),
    ).toEqual(Buffer.from(bytes));
  });

  it("rejects unsafe files and stale project revisions before writing an upload", () => {
    const { bundle, root, service } = createService();

    expect(() =>
      service.importManualTake({
        projectId: bundle.project.id,
        expectedProjectRevision: bundle.project.revision,
        shotSpecId: "shot-02",
        fileName: "not-a-video.mov",
        mimeType: "video/quicktime",
        bytes: new Uint8Array([1]),
      }),
    ).toThrowError(
      expect.objectContaining({ code: "manual_take_file_invalid" }),
    );
    expect(() =>
      service.importManualTake({
        projectId: bundle.project.id,
        expectedProjectRevision: 99,
        shotSpecId: "shot-02",
        fileName: "provider-export.mp4",
        mimeType: "video/mp4",
        bytes: new Uint8Array([1]),
      }),
    ).toThrowError(ProjectBundleRevisionConflictError);
    expect(existsSync(path.join(root, "uploads"))).toBe(false);
  });

  it("rejects media that the mechanical probe cannot play in the browser", () => {
    const root = mkdtempSync(path.join(tmpdir(), "generathon-manual-take-probe-"));
    temporaryRoots.push(root);
    const repository = new ProjectRepository(path.join(root, "manual-take.sqlite"));
    const bundle = importCanonicalProjectBundle(repository);
    const service = new ManualTakeImportService(repository, {
      rootDir: root,
      uploadsDir: path.join(root, "uploads"),
      probeMedia: () => {
        throw new ManualTakeImportError(
          "manual_take_media_invalid",
          "The imported video must contain an H.264 video stream.",
          422,
        );
      },
    });

    expect(() =>
      service.importManualTake({
        projectId: bundle.project.id,
        expectedProjectRevision: bundle.project.revision,
        shotSpecId: "shot-02",
        fileName: "provider-export.mp4",
        mimeType: "video/mp4",
        bytes: new Uint8Array([1]),
      }),
    ).toThrowError(
      expect.objectContaining({ code: "manual_take_media_invalid" }),
    );
    expect(existsSync(path.join(root, "uploads"))).toBe(true);
  });
});
