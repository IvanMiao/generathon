import { createHash } from "node:crypto";
import type { Project, ProjectBundle } from "@/lib/domain/project";
import {
  type DomainValidationIssue,
  parseProjectBundle,
} from "@/lib/domain/validation";
import {
  initializeDatabase,
  openDatabase,
} from "@/lib/server/database";

interface StoredProjectBundle {
  project_id: string;
  contract_version: string;
  revision: number;
  document_json: string;
  checksum: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectSummary {
  id: string;
  title: string;
  creationMode: Project["creation_mode"];
  creativeState: Project["creative_state"];
  contractVersion: string;
  revision: number;
  checksum: string;
  createdAt: string;
  updatedAt: string;
}

export class ProjectBundleIntegrityError extends Error {
  constructor(
    readonly projectId: string,
    readonly reason: string,
    readonly validationIssues: DomainValidationIssue[] = [],
  ) {
    super(`Stored project bundle "${projectId}" failed integrity validation: ${reason}`);
    this.name = "ProjectBundleIntegrityError";
  }
}

export function isProjectBundleIntegrityError(
  error: unknown,
): error is ProjectBundleIntegrityError {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "ProjectBundleIntegrityError" &&
    "validationIssues" in error &&
    Array.isArray(error.validationIssues)
  );
}

export class ProjectBundleRevisionConflictError extends Error {
  constructor(
    readonly projectId: string,
    readonly expectedRevision: number,
    readonly actualRevision: number,
  ) {
    super(
      `Project bundle "${projectId}" changed from revision ${expectedRevision} to ${actualRevision}.`,
    );
    this.name = "ProjectBundleRevisionConflictError";
  }
}

export class ProjectBundleNotFoundError extends Error {
  constructor(readonly projectId: string) {
    super(`Project bundle "${projectId}" does not exist.`);
    this.name = "ProjectBundleNotFoundError";
  }
}

function checksum(documentJson: string): string {
  return createHash("sha256").update(documentJson).digest("hex");
}

function readDomainValidationIssues(error: unknown): DomainValidationIssue[] {
  if (
    typeof error !== "object" ||
    error === null ||
    !("issues" in error) ||
    !Array.isArray(error.issues)
  ) {
    return [];
  }

  return error.issues.filter(
    (issue): issue is DomainValidationIssue =>
      typeof issue === "object" &&
      issue !== null &&
      "code" in issue &&
      typeof issue.code === "string" &&
      "path" in issue &&
      typeof issue.path === "string" &&
      "message" in issue &&
      typeof issue.message === "string",
  );
}

function parseStoredBundle(row: StoredProjectBundle): ProjectBundle {
  if (checksum(row.document_json) !== row.checksum) {
    throw new ProjectBundleIntegrityError(row.project_id, "checksum mismatch");
  }

  let document: unknown;
  try {
    document = JSON.parse(row.document_json) as unknown;
  } catch {
    throw new ProjectBundleIntegrityError(row.project_id, "document is not valid JSON");
  }

  let bundle: ProjectBundle;
  try {
    bundle = parseProjectBundle(document);
  } catch (error) {
    throw new ProjectBundleIntegrityError(
      row.project_id,
      error instanceof Error ? error.message : "contract validation failed",
      readDomainValidationIssues(error),
    );
  }

  if (bundle.project.id !== row.project_id) {
    throw new ProjectBundleIntegrityError(row.project_id, "project ID mismatch");
  }
  if (bundle.fixture_schema_version !== row.contract_version) {
    throw new ProjectBundleIntegrityError(row.project_id, "contract version mismatch");
  }
  if (bundle.project.revision !== row.revision) {
    throw new ProjectBundleIntegrityError(row.project_id, "revision mismatch");
  }
  if (bundle.project.created_at !== row.created_at) {
    throw new ProjectBundleIntegrityError(row.project_id, "created time mismatch");
  }
  if (bundle.project.updated_at !== row.updated_at) {
    throw new ProjectBundleIntegrityError(row.project_id, "updated time mismatch");
  }

  return bundle;
}

function toSummary(bundle: ProjectBundle, row: StoredProjectBundle): ProjectSummary {
  return {
    id: bundle.project.id,
    title: bundle.project.title,
    creationMode: bundle.project.creation_mode,
    creativeState: bundle.project.creative_state,
    contractVersion: row.contract_version,
    revision: row.revision,
    checksum: row.checksum,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ProjectRepository {
  constructor(private readonly databasePath: string) {
    initializeDatabase(databasePath);
  }

  importProjectBundle(input: unknown): ProjectBundle {
    const bundle = parseProjectBundle(input);
    const documentJson = JSON.stringify(bundle);
    const documentChecksum = checksum(documentJson);
    const database = openDatabase(this.databasePath);

    try {
      database.exec("BEGIN IMMEDIATE");
      try {
        database
          .prepare(`
            INSERT INTO projects (
              id, name, creation_mode, creative_state, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              creation_mode = excluded.creation_mode,
              creative_state = excluded.creative_state,
              created_at = excluded.created_at,
              updated_at = excluded.updated_at
          `)
          .run(
            bundle.project.id,
            bundle.project.title,
            bundle.project.creation_mode,
            bundle.project.creative_state,
            bundle.project.created_at,
            bundle.project.updated_at,
          );

        database
          .prepare(`
            INSERT INTO project_bundles (
              project_id,
              contract_version,
              revision,
              document_json,
              checksum,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(project_id) DO UPDATE SET
              contract_version = excluded.contract_version,
              revision = excluded.revision,
              document_json = excluded.document_json,
              checksum = excluded.checksum,
              created_at = excluded.created_at,
              updated_at = excluded.updated_at
            WHERE project_bundles.checksum <> excluded.checksum
          `)
          .run(
            bundle.project.id,
            bundle.fixture_schema_version,
            bundle.project.revision,
            documentJson,
            documentChecksum,
            bundle.project.created_at,
            bundle.project.updated_at,
          );

        database.exec("COMMIT");
      } catch (error) {
        if (database.isTransaction) database.exec("ROLLBACK");
        throw error;
      }
    } finally {
      database.close();
    }

    return bundle;
  }

  getProjectBundle(projectId: string): ProjectBundle | null {
    const database = openDatabase(this.databasePath);
    try {
      const row = database
        .prepare(`
          SELECT
            project_id,
            contract_version,
            revision,
            document_json,
            checksum,
            created_at,
            updated_at
          FROM project_bundles
          WHERE project_id = ?
        `)
        .get(projectId) as StoredProjectBundle | undefined;

      return row ? parseStoredBundle(row) : null;
    } finally {
      database.close();
    }
  }

  replaceProjectBundle(
    input: unknown,
    expectedRevision: number,
  ): ProjectBundle {
    const bundle = parseProjectBundle(input);
    if (bundle.project.revision !== expectedRevision + 1) {
      throw new ProjectBundleRevisionConflictError(
        bundle.project.id,
        expectedRevision,
        bundle.project.revision,
      );
    }

    const documentJson = JSON.stringify(bundle);
    const documentChecksum = checksum(documentJson);
    const database = openDatabase(this.databasePath);

    try {
      database.exec("BEGIN IMMEDIATE");
      try {
        const current = database
          .prepare(`
            SELECT
              project_id,
              contract_version,
              revision,
              document_json,
              checksum,
              created_at,
              updated_at
            FROM project_bundles
            WHERE project_id = ?
          `)
          .get(bundle.project.id) as StoredProjectBundle | undefined;

        if (!current) {
          throw new ProjectBundleNotFoundError(bundle.project.id);
        }
        parseStoredBundle(current);
        if (current.revision !== expectedRevision) {
          throw new ProjectBundleRevisionConflictError(
            bundle.project.id,
            expectedRevision,
            current.revision,
          );
        }

        database
          .prepare(`
            UPDATE projects
            SET
              name = ?,
              creation_mode = ?,
              creative_state = ?,
              created_at = ?,
              updated_at = ?
            WHERE id = ?
          `)
          .run(
            bundle.project.title,
            bundle.project.creation_mode,
            bundle.project.creative_state,
            bundle.project.created_at,
            bundle.project.updated_at,
            bundle.project.id,
          );

        const update = database
          .prepare(`
            UPDATE project_bundles
            SET
              contract_version = ?,
              revision = ?,
              document_json = ?,
              checksum = ?,
              created_at = ?,
              updated_at = ?
            WHERE project_id = ? AND revision = ?
          `)
          .run(
            bundle.fixture_schema_version,
            bundle.project.revision,
            documentJson,
            documentChecksum,
            bundle.project.created_at,
            bundle.project.updated_at,
            bundle.project.id,
            expectedRevision,
          );

        if (Number(update.changes) !== 1) {
          const actual = database
            .prepare("SELECT revision FROM project_bundles WHERE project_id = ?")
            .get(bundle.project.id) as { revision: number } | undefined;
          throw new ProjectBundleRevisionConflictError(
            bundle.project.id,
            expectedRevision,
            actual?.revision ?? expectedRevision,
          );
        }

        database.exec("COMMIT");
      } catch (error) {
        if (database.isTransaction) database.exec("ROLLBACK");
        throw error;
      }
    } finally {
      database.close();
    }

    return bundle;
  }

  listProjects(): ProjectSummary[] {
    const database = openDatabase(this.databasePath);
    try {
      const rows = database
        .prepare(`
          SELECT
            project_id,
            contract_version,
            revision,
            document_json,
            checksum,
            created_at,
            updated_at
          FROM project_bundles
          ORDER BY updated_at DESC, project_id ASC
        `)
        .all() as unknown as StoredProjectBundle[];

      return rows.map((row) => toSummary(parseStoredBundle(row), row));
    } finally {
      database.close();
    }
  }
}
