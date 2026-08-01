import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import {
  DATABASE_SCHEMA_VERSION,
  initializeDatabase,
} from "@/lib/server/database";

const temporaryRoots: string[] = [];

function temporaryDatabasePath(): string {
  const root = mkdtempSync(path.join(tmpdir(), "generathon-database-"));
  temporaryRoots.push(root);
  return path.join(root, "generathon.sqlite");
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("initializeDatabase", () => {
  it("applies schema v2 once and is idempotent", () => {
    const databasePath = temporaryDatabasePath();

    expect(initializeDatabase(databasePath)).toBe(DATABASE_SCHEMA_VERSION);
    expect(initializeDatabase(databasePath)).toBe(DATABASE_SCHEMA_VERSION);

    const database = new DatabaseSync(databasePath);
    const migrations = database
      .prepare("SELECT version FROM schema_migrations ORDER BY version")
      .all()
      .map((row) => (row as { version: number }).version);
    const bundleTable = database
      .prepare(
        "SELECT name FROM sqlite_schema WHERE type = 'table' AND name = 'project_bundles'",
      )
      .get();
    database.close();

    expect(migrations).toEqual([1, 2]);
    expect(bundleTable).toEqual({ name: "project_bundles" });
  });

  it("migrates a populated v1 database without replacing legacy rows", () => {
    const databasePath = temporaryDatabasePath();
    initializeDatabase(databasePath);

    const legacyDatabase = new DatabaseSync(databasePath);
    legacyDatabase.exec(`
      DROP TABLE project_bundles;
      DELETE FROM schema_migrations WHERE version = 2;
    `);
    legacyDatabase
      .prepare(`
        INSERT INTO projects (id, name, creation_mode, creative_state)
        VALUES (?, ?, ?, ?)
      `)
      .run("legacy-project", "Legacy project", "listen_first", "draft");
    legacyDatabase.close();

    expect(initializeDatabase(databasePath)).toBe(2);
    expect(initializeDatabase(databasePath)).toBe(2);

    const migratedDatabase = new DatabaseSync(databasePath);
    const legacyProject = migratedDatabase
      .prepare("SELECT id, name FROM projects WHERE id = ?")
      .get("legacy-project");
    const migrationCount = migratedDatabase
      .prepare("SELECT COUNT(*) AS count FROM schema_migrations")
      .get() as { count: number };
    migratedDatabase.close();

    expect(legacyProject).toEqual({
      id: "legacy-project",
      name: "Legacy project",
    });
    expect(migrationCount.count).toBe(2);
  });
});
