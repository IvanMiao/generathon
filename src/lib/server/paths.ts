import path from "node:path";

export interface RuntimePaths {
  rootDir: string;
  dataDir: string;
  artifactsDir: string;
  uploadsDir: string;
  exportsDir: string;
  databasePath: string;
}

export type RuntimeEnvironment = Record<string, string | undefined>;

function resolveFromRoot(rootDir: string, value: string | undefined, fallback: string) {
  return path.resolve(rootDir, value || fallback);
}

export function getRuntimePaths(
  rootDir = process.cwd(),
  environment: RuntimeEnvironment = process.env,
): RuntimePaths {
  return {
    rootDir,
    dataDir: resolveFromRoot(rootDir, environment.DATA_DIR, "data"),
    artifactsDir: resolveFromRoot(rootDir, environment.ARTIFACTS_DIR, "artifacts"),
    uploadsDir: resolveFromRoot(rootDir, environment.UPLOADS_DIR, "uploads"),
    exportsDir: resolveFromRoot(rootDir, environment.EXPORTS_DIR, "exports"),
    databasePath: resolveFromRoot(
      rootDir,
      environment.DATABASE_PATH,
      "data/generathon.sqlite3",
    ),
  };
}
