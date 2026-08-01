import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export const DATABASE_SCHEMA_VERSION = 1;

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

function openDatabase(databasePath: string) {
  return new DatabaseSync(databasePath, {
    timeout: 5_000,
  });
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

      if ((current.version ?? 0) < DATABASE_SCHEMA_VERSION) {
        database.exec(INITIAL_SCHEMA);
        database
          .prepare("INSERT INTO schema_migrations (version) VALUES (?)")
          .run(DATABASE_SCHEMA_VERSION);
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
