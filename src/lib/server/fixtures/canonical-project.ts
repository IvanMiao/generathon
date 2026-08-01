import { readFileSync } from "node:fs";
import path from "node:path";
import type { ProjectBundle } from "@/lib/domain/project";
import { parseProjectBundle } from "@/lib/domain/validation";
import {
  isProjectBundleIntegrityError,
  type ProjectRepository,
} from "@/lib/server/repositories/project-repository";

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

export function resolveCanonicalProjectBundle(
  repository: ProjectRepository,
  projectId: string,
  rootDir = process.cwd(),
): ProjectBundle {
  const canonical = loadCanonicalProjectBundle(rootDir);

  try {
    const stored = repository.getProjectBundle(projectId);
    if (!stored || stored.fixture_id !== canonical.fixture_id) {
      return repository.importProjectBundle(canonical);
    }
    return stored;
  } catch (error) {
    const isLegacyDuration =
      isProjectBundleIntegrityError(error) &&
      error.validationIssues.some(
        (issue) => issue.code === "selected_range_duration_invalid",
      );
    if (isLegacyDuration) {
      return repository.importProjectBundle(canonical);
    }
    throw error;
  }
}
