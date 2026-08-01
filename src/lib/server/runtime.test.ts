import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { ensureRuntimeReady } from "@/lib/server/runtime";

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("ensureRuntimeReady", () => {
  it("creates local stores and migrates the SQLite database", () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "generathon-runtime-"));
    temporaryRoots.push(rootDir);

    const snapshot = ensureRuntimeReady({
      rootDir,
      environment: { APP_ENV: "test" },
    });

    expect(snapshot.status).toBe("ready");
    expect(snapshot.environment).toBe("test");
    expect(snapshot.schema_version).toBe(1);
    expect(existsSync(snapshot.artifactsDir)).toBe(true);
    expect(existsSync(snapshot.uploadsDir)).toBe(true);
    expect(existsSync(snapshot.exportsDir)).toBe(true);
    expect(existsSync(snapshot.databasePath)).toBe(true);

    const database = new DatabaseSync(snapshot.databasePath);
    const tables = database
      .prepare("SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => (row as { name: string }).name);
    database.close();

    expect(tables).toEqual(
      expect.arrayContaining([
        "artifacts",
        "projects",
        "provider_runs",
        "schema_migrations",
      ]),
    );

    expect(
      ensureRuntimeReady({ rootDir, environment: { APP_ENV: "test" } }).schema_version,
    ).toBe(1);
  });
});
