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
