import { describe, expect, it } from "vitest";
import impossibleCityFixture from "../../../fixtures/projects/impossible-city-demo.v1.json";
import { ProjectBundleSchema } from "@/lib/domain/project";
import {
  createScoreRoomProjection,
  formatDomainLabel,
  formatTimestamp,
} from "@/components/score-room/score-room-data";

const bundle = ProjectBundleSchema.parse(impossibleCityFixture);

describe("Score Room fixture projection", () => {
  it("formats domain values and score timestamps for display", () => {
    expect(formatDomainLabel("motif_binding")).toBe("Motif binding");
    expect(formatTimestamp(0)).toBe("00:00");
    expect(formatTimestamp(9.51)).toBe("00:09.5");
    expect(formatTimestamp(61.277)).toBe("01:01.3");
  });

  it("keeps measured analysis separate from interpreted reading", () => {
    const view = createScoreRoomProjection(bundle);

    expect(view.measuredMusic.kind).toBe("measured");
    expect(view.interpretedMusic.kind).toBe("interpreted");
    expect(view.measuredMusic.analysisId).not.toBe(
      view.interpretedMusic.readingId,
    );
    expect(view.measuredMusic.sections).toHaveLength(4);
    expect(view.interpretedMusic.sections).toHaveLength(6);
    expect(view.measuredMusic.sourceDescription).toMatch(/deterministic/i);
    expect(view.interpretedMusic.sourceDescription).toMatch(/interpretation/i);
  });

  it("projects three treatments and the locked selected direction", () => {
    const view = createScoreRoomProjection(bundle);
    const selectedTreatments = view.treatments.filter(
      (treatment) => treatment.selected,
    );

    expect(view.treatments).toHaveLength(3);
    expect(selectedTreatments).toHaveLength(1);
    expect(selectedTreatments[0]?.id).toBe(view.selectedTreatment.id);
    expect(view.filmBible.isLocked).toBe(true);
    expect(view.filmBible.status).toBe("locked");
  });

  it("projects the complete six-part score with all relationship modes", () => {
    const view = createScoreRoomProjection(bundle);
    const modes = new Set(
      view.scoreSegments.map((segment) => segment.relationshipMode),
    );

    expect(view.scoreSegments).toHaveLength(6);
    expect(view.scoreSegments[0]?.range.start_seconds).toBe(
      view.project.selectedRange.start_seconds,
    );
    expect(view.scoreSegments.at(-1)?.range.end_seconds).toBe(
      view.project.selectedRange.end_seconds,
    );
    expect(modes).toEqual(
      new Set(["mirror", "counterpoint", "suspension", "motif_binding"]),
    );
    expect(
      view.scoreSegments.every((segment) => segment.visualStates.length > 0),
    ).toBe(true);
    expect(view.visualStates).toHaveLength(3);
  });

  it("projects six shots with all three required functions", () => {
    const view = createScoreRoomProjection(bundle);

    expect(view.shots).toHaveLength(6);
    for (const shot of view.shots) {
      expect(shot.musicalFunction.length).toBeGreaterThan(0);
      expect(shot.narrativeFunction.length).toBeGreaterThan(0);
      expect(shot.visualFunction.length).toBeGreaterThan(0);
      expect(shot.startState.name.length).toBeGreaterThan(0);
      expect(shot.endState.name.length).toBeGreaterThan(0);
    }
  });

  it("projects the repair decision and the guarded generation context", () => {
    const view = createScoreRoomProjection(bundle);

    expect(view.reviewDemo.failedTakeId).toBe(
      bundle.demo_evidence.failed_take_id,
    );
    expect(view.reviewDemo.repairedTakeId).toBe(
      bundle.demo_evidence.repaired_take_id,
    );
    expect(view.reviewDemo.repairLayerLabel).toBe("Editorial timing");
    expect(view.reviewDemo.generationEligible).toBe(true);
    expect(view.reviewDemo.generationIssues).toEqual([]);
    expect(view.reviewDemo.compiledPromptCharacters).toBeGreaterThanOrEqual(600);
    expect(view.reviewDemo.quotaRemaining).toBe(9);
    expect(view.provenance.assemblyDriftLabel).toBe("0.000 s");
  });
});
