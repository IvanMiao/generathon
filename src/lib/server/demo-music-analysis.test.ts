import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadCanonicalProjectBundle } from "@/lib/server/fixtures/canonical-project";
import {
  DEMO_MUSIC_ANALYSIS_PATH,
  readDemoMusicAnalysis,
} from "@/lib/server/demo-music-analysis";

describe("readDemoMusicAnalysis", () => {
  it("returns null when the deterministic artifact has not been prepared", () => {
    expect(readDemoMusicAnalysis(path.join(tmpdir(), "missing-demo-root"))).toBeNull();
  });

  it("parses a strict measured analysis artifact", () => {
    const rootDir = path.join(
      tmpdir(),
      `generathon-analysis-${process.pid}-${Date.now()}`,
    );
    const analysisPath = path.join(rootDir, DEMO_MUSIC_ANALYSIS_PATH);
    const analysis = loadCanonicalProjectBundle().music_analyses[0];
    mkdirSync(path.dirname(analysisPath), { recursive: true });
    writeFileSync(analysisPath, JSON.stringify(analysis));

    expect(readDemoMusicAnalysis(rootDir)?.id).toBe(analysis.id);
  });
});
