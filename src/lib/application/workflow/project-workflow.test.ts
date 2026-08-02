import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEMO_LOCK_DECISION_ID,
  DEMO_REPAIR_DECISION_ID,
  demoReviewWorkflowState,
  ProjectWorkflowError,
  ProjectWorkflowService,
} from "@/lib/application/workflow/project-workflow";
import type { ProjectBundle } from "@/lib/domain/project";
import { importCanonicalProjectBundle } from "@/lib/server/fixtures/canonical-project";
import { ProjectRepository } from "@/lib/server/repositories/project-repository";

const temporaryRoots: string[] = [];

function createService() {
  const root = mkdtempSync(path.join(tmpdir(), "generathon-workflow-"));
  temporaryRoots.push(root);
  const repository = new ProjectRepository(path.join(root, "workflow.sqlite"));
  const bundle = importCanonicalProjectBundle(repository);
  const service = new ProjectWorkflowService(repository, {
    now: () => "2026-08-01T13:00:00Z",
  });
  return { bundle, repository, service };
}

function addManualCandidate(
  repository: ProjectRepository,
  bundle: ProjectBundle,
) {
  const next = structuredClone(bundle);
  next.artifacts.push({
    schema_version: "1.0.0",
    id: "artifact-manual-candidate",
    project_id: bundle.project.id,
    revision: 1,
    created_at: "2026-08-01T12:00:00Z",
    updated_at: "2026-08-01T12:00:00Z",
    kind: "video",
    relative_path: "uploads/project-impossible-city/take-manual-candidate.mp4",
    sha256: "0".repeat(64),
    mime_type: "video/mp4",
    provenance: {
      source: "import",
      provider_run_id: null,
      parent_artifact_ids: [],
    },
  });
  next.takes.push({
    schema_version: "1.0.0",
    id: "take-manual-candidate",
    project_id: bundle.project.id,
    revision: 1,
    created_at: "2026-08-01T12:00:00Z",
    updated_at: "2026-08-01T12:00:00Z",
    shot_spec_id: "shot-02",
    artifact_id: "artifact-manual-candidate",
    source: "manual",
    provider: null,
    prompt_version: null,
    reference_versions: [
      { artifact_id: "artifact-state-breath", revision: 1 },
    ],
    generation_settings: {
      import_format: "mp4",
      duration_seconds: 8.042,
      video_codec: "h264",
      width: 1280,
      height: 720,
      frame_rate: "24/1",
      audio_present: false,
    },
    cost_usd: 0,
    status: "candidate",
    locked: false,
  });
  return repository.importProjectBundle(next);
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("Visual Score relationship workflow", () => {
  it("reopens the approved score, increments its revision, and preserves coverage", () => {
    const { bundle, repository, service } = createService();

    const result = service.reviseRelationship({
      projectId: bundle.project.id,
      expectedProjectRevision: bundle.project.revision,
      segmentId: "score-04",
      relationshipMode: "counterpoint",
    });

    expect(result).toMatchObject({
      changed: true,
      projectRevision: 2,
      visualScoreStatus: "draft",
      segment: {
        id: "score-04",
        revision: 2,
        relationshipMode: "counterpoint",
      },
      coverage: {
        valid: true,
        segmentCount: 6,
        gaps: 0,
        overlaps: 0,
      },
      affectedShotIds: ["shot-04"],
    });
    expect(result.protectedRecordIds).toContain("shot-04");

    const stored = repository.getProjectBundle(bundle.project.id);
    expect(stored?.audiovisual_contracts[0].status).toBe("draft");
    expect(
      stored?.visual_score_segments.every((segment) => segment.revision === 2),
    ).toBe(true);
  });

  it("rejects a stale editor and treats a repeated mode as a no-op", () => {
    const { bundle, service } = createService();

    const noOp = service.reviseRelationship({
      projectId: bundle.project.id,
      expectedProjectRevision: 1,
      segmentId: "score-04",
      relationshipMode: "mirror",
    });
    expect(noOp.changed).toBe(false);
    expect(noOp.projectRevision).toBe(1);

    service.reviseRelationship({
      projectId: bundle.project.id,
      expectedProjectRevision: 1,
      segmentId: "score-04",
      relationshipMode: "counterpoint",
    });
    expect(() =>
      service.reviseRelationship({
        projectId: bundle.project.id,
        expectedProjectRevision: 1,
        segmentId: "score-03",
        relationshipMode: "mirror",
      }),
    ).toThrowError(
      expect.objectContaining({ code: "project_revision_conflict" }),
    );
  });

  it("explicitly approves a revised score and reopens the generation gate", () => {
    const { bundle, repository, service } = createService();

    service.reviseRelationship({
      projectId: bundle.project.id,
      expectedProjectRevision: 1,
      segmentId: "score-04",
      relationshipMode: "counterpoint",
    });
    const approved = service.approveVisualScore({
      projectId: bundle.project.id,
      expectedProjectRevision: 2,
    });

    expect(approved).toEqual({
      changed: true,
      projectRevision: 3,
      visualScoreStatus: "approved",
      segmentCount: 6,
      approvedVisualStateCount: 3,
      generationGateReady: true,
    });
    expect(
      repository.getProjectBundle(bundle.project.id)?.audiovisual_contracts[0],
    ).toMatchObject({ status: "approved", revision: 3 });
  });

  it("treats approval of an already approved score as a no-op", () => {
    const { bundle, service } = createService();

    expect(
      service.approveVisualScore({
        projectId: bundle.project.id,
        expectedProjectRevision: 1,
      }),
    ).toMatchObject({
      changed: false,
      projectRevision: 1,
      visualScoreStatus: "approved",
      generationGateReady: true,
    });
  });
});

describe("Music analysis boundary revision workflow", () => {
  it("persists one human boundary correction without rewriting measured analysis", () => {
    const { bundle, repository, service } = createService();
    const rawAnalysis = structuredClone(bundle.music_analyses[0]);

    const result = service.reviseAnalysisBoundary({
      projectId: bundle.project.id,
      expectedProjectRevision: bundle.project.revision,
      revisionId: "analysis-revision-demo-v1",
      sectionId: "section-02",
      boundarySeconds: 25,
    });

    expect(result).toMatchObject({
      changed: true,
      projectRevision: 2,
      analysisRevision: {
        id: "analysis-revision-demo-v1",
        revision: 2,
      },
    });
    expect(result.analysisRevision.sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "section-02",
          endSeconds: 25,
          source: "user",
        }),
        expect.objectContaining({
          id: "section-03",
          startSeconds: 25,
          source: "user",
        }),
      ]),
    );
    expect(result.protectedRecordIds).toContain("shot-02");
    expect(result.invalidatedRecordIds).toContain("reading-city-memory-v1");

    const stored = repository.getProjectBundle(bundle.project.id);
    expect(stored?.music_analyses[0]).toEqual(rawAnalysis);
    expect(stored?.music_analysis_revisions[0]).toMatchObject({ revision: 2 });
  });

  it("rejects an invalid boundary, returns no-op changes, and protects against stale editors", () => {
    const { bundle, service } = createService();

    const noOp = service.reviseAnalysisBoundary({
      projectId: bundle.project.id,
      expectedProjectRevision: 1,
      revisionId: "analysis-revision-demo-v1",
      sectionId: "section-02",
      boundarySeconds: 26.099229,
    });
    expect(noOp).toMatchObject({ changed: false, projectRevision: 1 });

    expect(() =>
      service.reviseAnalysisBoundary({
        projectId: bundle.project.id,
        expectedProjectRevision: 1,
        revisionId: "analysis-revision-demo-v1",
        sectionId: "section-02",
        boundarySeconds: 58.700045,
      }),
    ).toThrowError(
      expect.objectContaining({ code: "analysis_boundary_invalid" }),
    );

    service.reviseAnalysisBoundary({
      projectId: bundle.project.id,
      expectedProjectRevision: 1,
      revisionId: "analysis-revision-demo-v1",
      sectionId: "section-02",
      boundarySeconds: 25,
    });
    expect(() =>
      service.reviseAnalysisBoundary({
        projectId: bundle.project.id,
        expectedProjectRevision: 1,
        revisionId: "analysis-revision-demo-v1",
        sectionId: "section-03",
        boundarySeconds: 50,
      }),
    ).toThrowError(
      expect.objectContaining({ code: "project_revision_conflict" }),
    );
  });
});

describe("Treatment reselection workflow", () => {
  it("refuses to replace the active direction after its Film Bible is locked", () => {
    const { bundle, service } = createService();

    expect(() =>
      service.reselectTreatment({
        projectId: bundle.project.id,
        expectedProjectRevision: bundle.project.revision,
        treatmentId: "treatment-submerged-organism",
        confirmed: true,
      }),
    ).toThrowError(
      expect.objectContaining({ code: "treatment_reselection_locked" }),
    );
  });

  it("selects a new treatment before direction lock without replacing downstream records", () => {
    const { bundle, repository, service } = createService();
    const unlocked = structuredClone(bundle);
    unlocked.project.revision += 1;
    unlocked.project.updated_at = "2026-08-01T12:55:00Z";
    unlocked.project.creative_state = "treatment_selected";
    unlocked.film_bibles[0].revision += 1;
    unlocked.film_bibles[0].updated_at = "2026-08-01T12:55:00Z";
    unlocked.film_bibles[0].status = "draft";
    repository.replaceProjectBundle(unlocked, bundle.project.revision);

    const result = service.reselectTreatment({
      projectId: bundle.project.id,
      expectedProjectRevision: 2,
      treatmentId: "treatment-submerged-organism",
      confirmed: true,
    });

    expect(result).toMatchObject({
      changed: true,
      projectRevision: 3,
      creativeState: "treatment_selected",
      directionBuildRequired: true,
      activeTreatment: {
        id: "treatment-submerged-organism",
        title: "Submerged Organism",
      },
    });
    expect(result.protectedRecordIds).toContain("shot-01");
    expect(result.invalidatedRecordIds).toContain("av-contract-city-v1");

    const stored = repository.getProjectBundle(bundle.project.id);
    expect(stored?.project).toMatchObject({
      revision: 3,
      active_treatment_id: "treatment-submerged-organism",
      active_assembly_run_id: null,
      creative_state: "treatment_selected",
    });
    expect(
      stored?.director_treatments.find(
        (treatment) => treatment.id === "treatment-recursive-architecture",
      ),
    ).toMatchObject({ status: "candidate", revision: 2 });
    expect(
      stored?.director_treatments.find(
        (treatment) => treatment.id === "treatment-submerged-organism",
      ),
    ).toMatchObject({ status: "selected", revision: 2 });
    expect(stored?.film_bibles[0]).toMatchObject({
      treatment_id: "treatment-recursive-architecture",
      status: "draft",
    });
  });
});

describe("Review decision workflow", () => {
  it("persists repair and lock decisions and can restart the walkthrough", () => {
    const { bundle, repository, service } = createService();

    const repaired = service.recordReviewAction({
      projectId: bundle.project.id,
      expectedProjectRevision: 1,
      action: "apply_repair",
    });
    expect(repaired).toMatchObject({
      changed: true,
      projectRevision: 2,
      workflowState: "repaired",
      recordedDecisionIds: [DEMO_REPAIR_DECISION_ID],
    });

    const locked = service.recordReviewAction({
      projectId: bundle.project.id,
      expectedProjectRevision: 2,
      action: "lock_take",
    });
    expect(locked).toMatchObject({
      projectRevision: 3,
      workflowState: "locked",
      recordedDecisionIds: [
        DEMO_REPAIR_DECISION_ID,
        DEMO_LOCK_DECISION_ID,
      ],
    });
    expect(
      demoReviewWorkflowState(repository.getProjectBundle(bundle.project.id)!),
    ).toBe("locked");

    const reset = service.recordReviewAction({
      projectId: bundle.project.id,
      expectedProjectRevision: 3,
      action: "reset",
    });
    expect(reset).toMatchObject({
      projectRevision: 4,
      workflowState: "diagnosed",
      recordedDecisionIds: [],
    });
  });

  it("requires repair before lock", () => {
    const { bundle, service } = createService();

    expect(() =>
      service.recordReviewAction({
        projectId: bundle.project.id,
        expectedProjectRevision: 1,
        action: "lock_take",
      }),
    ).toThrowError(ProjectWorkflowError);
  });
});

describe("Manual candidate Take workflow", () => {
  it("records a mechanical review before explicitly locking an imported candidate", () => {
    const { bundle, repository, service } = createService();
    addManualCandidate(repository, bundle);

    const reviewed = service.reviewCandidateTake({
      projectId: bundle.project.id,
      expectedProjectRevision: 1,
      takeId: "take-manual-candidate",
    });
    expect(reviewed).toMatchObject({
      changed: true,
      projectRevision: 2,
      take: {
        id: "take-manual-candidate",
        status: "needs_decision",
        locked: false,
      },
      review: {
        status: "complete",
        accepted: true,
        evidenceCount: 1,
      },
    });

    expect(() =>
      service.lockCandidateTake({
        projectId: bundle.project.id,
        expectedProjectRevision: 2,
        takeId: "take-manual-candidate",
        confirmed: false,
      }),
    ).toThrowError(
      expect.objectContaining({ code: "take_lock_confirmation_required" }),
    );

    const locked = service.lockCandidateTake({
      projectId: bundle.project.id,
      expectedProjectRevision: 2,
      takeId: "take-manual-candidate",
      confirmed: true,
    });
    expect(locked).toMatchObject({
      changed: true,
      projectRevision: 3,
      take: {
        id: "take-manual-candidate",
        status: "locked",
        locked: true,
      },
      decision: { decision: "accept", targetId: "take-manual-candidate" },
    });
    expect(
      repository
        .getProjectBundle(bundle.project.id)
        ?.takes.find((take) => take.id === "take-manual-candidate"),
    ).toMatchObject({ status: "locked", locked: true, revision: 3 });
  });

  it("does not lock a candidate until it has a completed accepting review", () => {
    const { bundle, repository, service } = createService();
    addManualCandidate(repository, bundle);

    expect(() =>
      service.lockCandidateTake({
        projectId: bundle.project.id,
        expectedProjectRevision: 1,
        takeId: "take-manual-candidate",
        confirmed: true,
      }),
    ).toThrowError(expect.objectContaining({ code: "take_lock_invalid" }));
  });
});
