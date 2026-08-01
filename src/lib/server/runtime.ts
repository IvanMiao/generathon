import { mkdirSync } from "node:fs";
import type { ReadyResponse } from "@/lib/contracts/system";
import { initializeDatabase } from "@/lib/server/database";
import {
  getRuntimePaths,
  type RuntimeEnvironment,
  type RuntimePaths,
} from "@/lib/server/paths";

export interface RuntimeSnapshot extends ReadyResponse, RuntimePaths {}

interface RuntimeOptions {
  rootDir?: string;
  environment?: RuntimeEnvironment;
}

export function ensureRuntimeReady(options: RuntimeOptions = {}): RuntimeSnapshot {
  const environment = options.environment ?? process.env;
  const paths = getRuntimePaths(options.rootDir, environment);

  for (const directory of [
    paths.dataDir,
    paths.artifactsDir,
    paths.uploadsDir,
    paths.exportsDir,
  ]) {
    mkdirSync(directory, { recursive: true });
  }

  const schemaVersion = initializeDatabase(paths.databasePath);

  return {
    ...paths,
    status: "ready",
    database: "ready",
    artifact_store: "ready",
    environment: environment.APP_ENV || "development",
    schema_version: schemaVersion,
  };
}
