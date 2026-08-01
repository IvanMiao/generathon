import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyFixtureMutations,
  InvalidFixtureSchema,
} from "@/lib/domain/mutation-fixture";
import { ProjectBundleSchema } from "@/lib/domain/project";
import { planRevisionImpact, validateRevision } from "@/lib/domain/revision";
import { parseProjectBundle } from "@/lib/domain/validation";

function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(path.join(process.cwd(), relativePath), "utf8"));
}

function readBundle() {
  return parseProjectBundle(
    readJson("fixtures/projects/impossible-city-demo.v1.json"),
  );
}

describe("revision and lock rules", () => {
  it("rejects a locked Film Bible mutation fixture", () => {
    const fixture = InvalidFixtureSchema.parse(
      readJson("fixtures/invalid/locked-film-bible-mutation.json"),
    );
    const previousBundle = readBundle();
    const nextBundle = ProjectBundleSchema.parse(
      applyFixtureMutations(previousBundle, fixture.mutations),
    );
    const previous = previousBundle.film_bibles.find(
      (record) => record.id === fixture.record_id,
    );
    const next = nextBundle.film_bibles.find((record) => record.id === fixture.record_id);
    if (!previous || !next) throw new Error("Revision fixture record is missing.");

    const result = validateRevision({
      record_type: "film_bible",
      previous,
      next,
      explicitly_reopened: fixture.explicitly_reopened,
    });

    expect(result.success).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(fixture.expected_issue_codes),
    );
  });

  it("keeps measured analysis immutable and directs edits to a revision", () => {
    const bundle = readBundle();
    const previous = bundle.music_analyses[0];
    const next = structuredClone(previous);
    next.tempo_bpm = 120;

    const result = validateRevision({
      record_type: "music_analysis",
      previous,
      next,
    });

    expect(result.success).toBe(false);
    expect(result.issues[0].code).toBe("measured_analysis_immutable");
  });

  it("accepts a sequential user correction over the immutable analysis", () => {
    const bundle = readBundle();
    const previous = bundle.music_analysis_revisions[0];
    const next = structuredClone(previous);
    next.revision += 1;
    next.note = "Second human correction preserves the same immutable measurement.";

    const result = validateRevision({
      record_type: "music_analysis_revision",
      previous,
      next,
    });

    expect(result).toEqual({ success: true, issues: [] });
  });

  it("reopens an approved Music Reading as a draft revision", () => {
    const bundle = readBundle();
    const previous = bundle.music_readings[0];
    const next = structuredClone(previous);
    next.revision += 1;
    next.status = "draft";
    next.summary = "A revised interpretation that does not alter measured music data.";

    const result = validateRevision({
      record_type: "music_reading",
      previous,
      next,
      explicitly_reopened: true,
    });

    expect(result).toEqual({ success: true, issues: [] });
  });

  it("requires approved Visual Score revisions to be explicitly reopened", () => {
    const bundle = readBundle();
    const next = structuredClone(bundle.visual_score_segments);
    next[0].narrative_state = "A changed narrative state.";
    next[0].revision += 1;

    const result = validateRevision({
      record_type: "visual_score",
      previous: bundle.visual_score_segments,
      next,
      previous_status: "approved",
      next_status: "approved",
    });

    expect(result.success).toBe(false);
    expect(result.issues[0].code).toBe("approved_score_requires_reopen");
  });

  it("accepts an explicitly reopened Visual Score as a new draft revision", () => {
    const bundle = readBundle();
    const next = structuredClone(bundle.visual_score_segments);
    next.forEach((segment) => {
      segment.revision += 1;
    });
    next[0].narrative_state = "The city is present and begins to suspect movement.";

    const result = validateRevision({
      record_type: "visual_score",
      previous: bundle.visual_score_segments,
      next,
      previous_status: "approved",
      next_status: "draft",
      explicitly_reopened: true,
    });

    expect(result).toEqual({ success: true, issues: [] });
  });

  it("invalidates only unlocked dependents and reports protected records", () => {
    const bundle = readBundle();
    const impact = planRevisionImpact(bundle, "visual_score");

    expect(impact.protected_record_ids).toContain("take-shot-01-repaired");
    expect(impact.protected_record_ids).toContain("shot-01");
    expect(impact.invalidated_record_ids).toContain("run-shot-01-gemini");
    expect(impact.invalidated_record_ids).not.toContain("take-shot-01-repaired");
  });

  it("does not allow a locked take to be replaced", () => {
    const bundle = readBundle();
    const previous = bundle.takes.find((take) => take.id === "take-shot-01-repaired");
    if (!previous) throw new Error("Locked fixture take is missing.");
    const next = structuredClone(previous);
    next.artifact_id = "artifact-shot-01-failed";
    next.revision += 1;

    const result = validateRevision({ record_type: "take", previous, next });

    expect(result.success).toBe(false);
    expect(result.issues[0].code).toBe("locked_record_mutation");
  });
});
