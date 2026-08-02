import path from "node:path";
import type { ProjectBundle } from "@/lib/domain/project";

export interface ManualTakeMediaAsset {
  mimeType: string;
  path: string;
}

function resolveInsideRoot(rootDir: string, relativePath: string) {
  const root = path.resolve(rootDir);
  const resolved = path.resolve(root, relativePath);
  return resolved !== root && resolved.startsWith(`${root}${path.sep}`)
    ? resolved
    : null;
}

export function resolveManualTakeMedia(
  bundle: ProjectBundle,
  takeId: string,
  rootDir = process.cwd(),
): ManualTakeMediaAsset | null {
  const take = bundle.takes.find((candidate) => candidate.id === takeId);
  if (!take || take.source !== "manual") return null;

  const artifact = bundle.artifacts.find(
    (candidate) => candidate.id === take.artifact_id,
  );
  if (!artifact || artifact.kind !== "video" || artifact.mime_type !== "video/mp4") {
    return null;
  }
  const filePath = resolveInsideRoot(rootDir, artifact.relative_path);
  return filePath ? { mimeType: artifact.mime_type, path: filePath } : null;
}
