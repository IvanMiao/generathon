import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import {
  importCanonicalProjectBundle,
  loadCanonicalProjectBundle,
  resolveCanonicalProjectBundle,
} from "@/lib/server/fixtures/canonical-project";
import {
  ProjectBundleIntegrityError,
  ProjectBundleRevisionConflictError,
  ProjectRepository,
} from "@/lib/server/repositories/project-repository";

const temporaryRoots: string[] = [];

function createRepository(): {
  databasePath: string;
  repository: ProjectRepository;
} {
  const root = mkdtempSync(path.join(tmpdir(), "generathon-repository-"));
  temporaryRoots.push(root);
  const databasePath = path.join(root, "generathon.sqlite");
  return {
    databasePath,
    repository: new ProjectRepository(databasePath),
  };
}

function countRows(databasePath: string, table: string): number {
  const database = new DatabaseSync(databasePath);
  try {
    const row = database
      .prepare(`SELECT COUNT(*) AS count FROM ${table}`)
      .get() as { count: number };
    return row.count;
  } finally {
    database.close();
  }
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("ProjectRepository", () => {
  it("imports the canonical fixture with versioned document metadata", () => {
    const { databasePath, repository } = createRepository();
    const bundle = importCanonicalProjectBundle(repository);

    const database = new DatabaseSync(databasePath);
    const row = database
      .prepare(`
        SELECT contract_version, revision, document_json, checksum, created_at, updated_at
        FROM project_bundles
        WHERE project_id = ?
      `)
      .get(bundle.project.id) as {
      contract_version: string;
      revision: number;
      document_json: string;
      checksum: string;
      created_at: string;
      updated_at: string;
    };
    database.close();

    expect(countRows(databasePath, "projects")).toBe(1);
    expect(countRows(databasePath, "project_bundles")).toBe(1);
    expect(row.contract_version).toBe(bundle.fixture_schema_version);
    expect(row.revision).toBe(bundle.project.revision);
    expect(row.created_at).toBe(bundle.project.created_at);
    expect(row.updated_at).toBe(bundle.project.updated_at);
    expect(row.checksum).toBe(
      createHash("sha256").update(row.document_json).digest("hex"),
    );
  });

  it("can repeat canonical fixture import without duplicate records", () => {
    const { databasePath, repository } = createRepository();

    const first = importCanonicalProjectBundle(repository);
    const second = importCanonicalProjectBundle(repository);

    expect(second).toEqual(first);
    expect(countRows(databasePath, "projects")).toBe(1);
    expect(countRows(databasePath, "project_bundles")).toBe(1);
  });

  it("upgrades a legacy demo bundle that no longer satisfies the duration contract", () => {
    const { databasePath, repository } = createRepository();
    const canonical = importCanonicalProjectBundle(repository);
    const legacyDocument = JSON.stringify({
      ...canonical,
      fixture_id: "fixture-impossible-city-demo-v1",
      project: {
        ...canonical.project,
        selected_audio_range: { start_seconds: 0, end_seconds: 61.277 },
        target_duration_seconds: 61.277,
      },
      audio_assets: canonical.audio_assets.map((audioAsset) =>
        audioAsset.id === canonical.project.selected_audio_asset_id
          ? {
              ...audioAsset,
              duration_seconds: 61.277,
              selected_range: { start_seconds: 0, end_seconds: 61.277 },
            }
          : audioAsset,
      ),
    });
    const legacyChecksum = createHash("sha256")
      .update(legacyDocument)
      .digest("hex");
    const database = new DatabaseSync(databasePath);
    database
      .prepare(`
        UPDATE project_bundles
        SET document_json = ?, checksum = ?
        WHERE project_id = ?
      `)
      .run(legacyDocument, legacyChecksum, canonical.project.id);
    database.close();

    const resolved = resolveCanonicalProjectBundle(
      repository,
      canonical.project.id,
    );

    expect(resolved.project.target_duration_seconds).toBe(120.024);
    expect(repository.getProjectBundle(canonical.project.id)).toEqual(resolved);
  });

  it("preserves workflow changes after the current canonical fixture is installed", () => {
    const { repository } = createRepository();
    const canonical = importCanonicalProjectBundle(repository);
    const edited = structuredClone(canonical);
    edited.project.revision += 1;
    edited.project.updated_at = "2026-08-01T13:00:00Z";
    edited.project.title = "Keep this workspace edit";
    repository.replaceProjectBundle(edited, canonical.project.revision);

    const resolved = resolveCanonicalProjectBundle(
      repository,
      canonical.project.id,
    );

    expect(resolved.project.revision).toBe(2);
    expect(resolved.project.title).toBe("Keep this workspace edit");
  });

  it("reads validated bundles and lists validated project summaries", () => {
    const { repository } = createRepository();
    const imported = importCanonicalProjectBundle(repository);

    expect(repository.getProjectBundle(imported.project.id)).toEqual(imported);
    expect(repository.getProjectBundle("missing-project")).toBeNull();
    expect(repository.listProjects()).toEqual([
      {
        id: imported.project.id,
        title: imported.project.title,
        creationMode: imported.project.creation_mode,
        creativeState: imported.project.creative_state,
        contractVersion: imported.fixture_schema_version,
        revision: imported.project.revision,
        checksum: expect.stringMatching(/^[a-f0-9]{64}$/),
        createdAt: imported.project.created_at,
        updatedAt: imported.project.updated_at,
      },
    ]);
  });

  it("rejects an invalid bundle before writing any project rows", () => {
    const { databasePath, repository } = createRepository();
    const validBundle = loadCanonicalProjectBundle();
    const invalidBundle = {
      ...validBundle,
      project: { ...validBundle.project, title: "" },
    };

    expect(() => repository.importProjectBundle(invalidBundle)).toThrow();
    expect(countRows(databasePath, "projects")).toBe(0);
    expect(countRows(databasePath, "project_bundles")).toBe(0);
  });

  it("rolls back the project index when document persistence fails", () => {
    const { databasePath, repository } = createRepository();
    const database = new DatabaseSync(databasePath);
    database.exec(`
      CREATE TRIGGER reject_project_bundle
      BEFORE INSERT ON project_bundles
      BEGIN
        SELECT RAISE(ABORT, 'forced document failure');
      END;
    `);
    database.close();

    expect(() => importCanonicalProjectBundle(repository)).toThrow(
      "forced document failure",
    );
    expect(countRows(databasePath, "projects")).toBe(0);
    expect(countRows(databasePath, "project_bundles")).toBe(0);
  });

  it("revalidates the contract when reading stored JSON", () => {
    const { databasePath, repository } = createRepository();
    const bundle = importCanonicalProjectBundle(repository);
    const invalidDocument = JSON.stringify({
      ...bundle,
      project: { ...bundle.project, title: "" },
    });
    const invalidChecksum = createHash("sha256")
      .update(invalidDocument)
      .digest("hex");
    const database = new DatabaseSync(databasePath);
    database
      .prepare(`
        UPDATE project_bundles
        SET document_json = ?, checksum = ?
        WHERE project_id = ?
      `)
      .run(invalidDocument, invalidChecksum, bundle.project.id);
    database.close();

    expect(() => repository.getProjectBundle(bundle.project.id)).toThrow(
      ProjectBundleIntegrityError,
    );
    expect(() => repository.listProjects()).toThrow(ProjectBundleIntegrityError);
  });

  it("replaces a bundle only at the expected project revision", () => {
    const { repository } = createRepository();
    const imported = importCanonicalProjectBundle(repository);
    const next = structuredClone(imported);
    next.project.revision += 1;
    next.project.updated_at = "2026-08-01T13:00:00Z";
    next.project.title = "Persisted workflow revision";

    const saved = repository.replaceProjectBundle(next, imported.project.revision);

    expect(saved.project.revision).toBe(2);
    expect(repository.getProjectBundle(imported.project.id)?.project.title).toBe(
      "Persisted workflow revision",
    );
    expect(() => repository.replaceProjectBundle(next, 1)).toThrow(
      ProjectBundleRevisionConflictError,
    );
  });
});
