import { readFileSync } from "node:fs";
import path from "node:path";
import type { ProjectBundle } from "@/lib/domain/project";
import { parseProjectBundle } from "@/lib/domain/validation";
import type { ProjectRepository } from "@/lib/server/repositories/project-repository";

export const CANONICAL_PROJECT_FIXTURE = path.join(
  "fixtures",
  "projects",
  "impossible-city-demo.v1.json",
);

export function loadCanonicalProjectBundle(
  rootDir = process.cwd(),
): ProjectBundle {
  const contents = readFileSync(
    path.join(rootDir, CANONICAL_PROJECT_FIXTURE),
    "utf8",
  );
  return parseProjectBundle(JSON.parse(contents) as unknown);
}

export function importCanonicalProjectBundle(
  repository: ProjectRepository,
  rootDir = process.cwd(),
): ProjectBundle {
  const contents = readFileSync(
    path.join(rootDir, CANONICAL_PROJECT_FIXTURE),
    "utf8",
  );
  return repository.importProjectBundle(JSON.parse(contents) as unknown);
}
