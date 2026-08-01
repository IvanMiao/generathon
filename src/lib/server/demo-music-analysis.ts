import { readFileSync } from "node:fs";
import path from "node:path";
import {
  MusicAnalysisSchema,
  type MusicAnalysis,
} from "@/lib/domain/music";

export const DEMO_MUSIC_ANALYSIS_PATH =
  "artifacts/music-analysis/demo-track-full-120.024.v1.json";

export function readDemoMusicAnalysis(
  rootDir = process.cwd(),
): MusicAnalysis | null {
  const analysisPath = path.resolve(rootDir, DEMO_MUSIC_ANALYSIS_PATH);

  try {
    return MusicAnalysisSchema.parse(
      JSON.parse(readFileSync(analysisPath, "utf8")),
    );
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return null;
    }
    throw new Error(
      `Demo MusicAnalysis is invalid at ${analysisPath}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}
