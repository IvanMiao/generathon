import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RecordedFixtureDirectionCompiler } from "@/lib/application/direction";
import { parseProjectBundle } from "@/lib/domain/validation";

function readBundle() {
  return parseProjectBundle(
    JSON.parse(
      readFileSync(
        path.join(
          process.cwd(),
          "fixtures",
          "projects",
          "impossible-city-demo.v1.json",
        ),
        "utf8",
      ),
    ),
  );
}

describe("RecordedFixtureDirectionCompiler", () => {
  it("replays the complete validated direction chain without network access", async () => {
    const bundle = readBundle();
    const compiler = new RecordedFixtureDirectionCompiler(bundle);

    const direction = await compiler.compileDirection(
      bundle.music_analysis_revisions[0],
    );

    expect(direction.musicReading.id).toBe("reading-city-memory-v1");
    expect(direction.treatments).toHaveLength(3);
    expect(direction.selectedTreatment.status).toBe("selected");
    expect(direction.filmBible.status).toBe("locked");
    expect(direction.audiovisualContract.status).toBe("approved");
    expect(direction.visualScore).toHaveLength(6);
    expect(
      new Set(direction.visualScore.map((segment) => segment.relationship_mode)),
    ).toEqual(
      new Set(["mirror", "counterpoint", "suspension", "motif_binding"]),
    );
  });

  it("keeps measured MusicAnalysis immutable and outside compiler outputs", async () => {
    const bundle = readBundle();
    const measuredBefore = structuredClone(bundle.music_analyses);
    const compiler = new RecordedFixtureDirectionCompiler(bundle);

    const direction = await compiler.compileDirection(
      bundle.music_analysis_revisions[0],
    );

    expect(bundle.music_analyses).toEqual(measuredBefore);
    expect(direction).not.toHaveProperty("musicAnalysis");
    expect(direction.musicReading).not.toHaveProperty("tempo_bpm");
    expect(direction.musicReading).not.toHaveProperty("energy_envelope");
  });

  it("rejects an analysis revision that has no recorded reading", async () => {
    const bundle = readBundle();
    const compiler = new RecordedFixtureDirectionCompiler(bundle);
    const unknownRevision = {
      ...bundle.music_analysis_revisions[0],
      id: "analysis-revision-without-recording",
    };

    await expect(compiler.compileMusicReading(unknownRevision)).rejects.toMatchObject({
      code: "recorded_direction_not_found",
    });
  });
});
