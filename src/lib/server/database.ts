import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export const DATABASE_SCHEMA_VERSION = 2;

const INITIAL_SCHEMA = `
  CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    creation_mode TEXT NOT NULL CHECK (creation_mode IN ('listen_first', 'direct_first')),
    creative_state TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ) STRICT;

  CREATE TABLE artifacts (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    kind TEXT NOT NULL,
    relative_path TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (project_id, relative_path)
  ) STRICT;

  CREATE TABLE provider_runs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    provider TEXT NOT NULL CHECK (provider IN ('gemini', 'openai', 'open_weight_on_modal')),
    operation TEXT NOT NULL,
    status TEXT NOT NULL,
    external_id TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ) STRICT;
`;

const PROJECT_BUNDLE_SCHEMA = `
  CREATE TABLE project_bundles (
    project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
    contract_version TEXT NOT NULL,
    revision INTEGER NOT NULL CHECK (revision > 0),
    document_json TEXT NOT NULL CHECK (json_valid(document_json)),
    checksum TEXT NOT NULL CHECK (
      length(checksum) = 64 AND checksum NOT GLOB '*[^0-9a-f]*'
    ),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT;

  CREATE INDEX project_bundles_updated_at_idx
    ON project_bundles(updated_at DESC, project_id ASC);
`;

const MIGRATIONS = [
  { version: 1, sql: INITIAL_SCHEMA },
  { version: 2, sql: PROJECT_BUNDLE_SCHEMA },
] as const;

export function openDatabase(databasePath: string): DatabaseSync {
  const database = new DatabaseSync(databasePath, {
    timeout: 5_000,
  });
  database.exec("PRAGMA foreign_keys = ON");
  return database;
}

export function initializeDatabase(databasePath: string): number {
  mkdirSync(path.dirname(databasePath), { recursive: true });
  const database = openDatabase(databasePath);

  try {
    database.exec(`
      PRAGMA foreign_keys = ON;
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ) STRICT;
    `);

    database.exec("BEGIN IMMEDIATE");
    try {
      const current = database
        .prepare("SELECT MAX(version) AS version FROM schema_migrations")
        .get() as { version: number | null };

      if ((current.version ?? 0) > DATABASE_SCHEMA_VERSION) {
        throw new Error(
          `Database schema version ${current.version} is newer than supported version ${DATABASE_SCHEMA_VERSION}.`,
        );
      }

      for (const migration of MIGRATIONS) {
        if (migration.version <= (current.version ?? 0)) continue;

        database.exec(migration.sql);
        database
          .prepare("INSERT INTO schema_migrations (version) VALUES (?)")
          .run(migration.version);
      }
      database.exec("COMMIT");
    } catch (error) {
      if (database.isTransaction) {
        database.exec("ROLLBACK");
      }
      throw error;
    }

    const migrated = database
      .prepare("SELECT MAX(version) AS version FROM schema_migrations")
      .get() as { version: number | null };
    return migrated.version ?? 0;
  } finally {
    database.close();
  }
}
