import {
  RelationshipModeSchema,
  type RelationshipMode,
} from "@/lib/domain/enums";
import type { Decision } from "@/lib/domain/production";
import type { ProjectBundle } from "@/lib/domain/project";
import { planRevisionImpact, validateRevision } from "@/lib/domain/revision";
import { parseProjectBundle } from "@/lib/domain/validation";
import {
  ProjectBundleNotFoundError,
  ProjectBundleRevisionConflictError,
  type ProjectRepository,
} from "@/lib/server/repositories/project-repository";

export const DEMO_REPAIR_DECISION_ID = "decision-demo-session-apply-repair";
export const DEMO_LOCK_DECISION_ID = "decision-demo-session-lock-take";

export type DemoReviewWorkflowState = "diagnosed" | "repaired" | "locked";

export type WorkflowErrorCode =
  | "project_not_found"
  | "project_revision_conflict"
  | "visual_score_segment_not_found"
  | "visual_score_locked"
  | "visual_score_revision_invalid"
  | "workflow_prerequisite_missing";

export class ProjectWorkflowError extends Error {
  constructor(
    readonly code: WorkflowErrorCode,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ProjectWorkflowError";
  }
}

interface ProjectWorkflowServiceOptions {
  now?: () => string;
}

interface WorkflowMutationBase {
  projectId: string;
  expectedProjectRevision: number;
}

export interface ReviseRelationshipInput extends WorkflowMutationBase {
  segmentId: string;
  relationshipMode: RelationshipMode;
}

export interface RecordReviewActionInput extends WorkflowMutationBase {
  action: "apply_repair" | "lock_take" | "reset";
}

function readWorkflowState(bundle: ProjectBundle): DemoReviewWorkflowState {
  const decisionIds = new Set(bundle.decisions.map((decision) => decision.id));
  if (decisionIds.has(DEMO_LOCK_DECISION_ID)) return "locked";
  if (decisionIds.has(DEMO_REPAIR_DECISION_ID)) return "repaired";
  return "diagnosed";
}

function advanceProjectRevision(bundle: ProjectBundle, now: string) {
  bundle.project.revision += 1;
  bundle.project.updated_at = now;
}

function decisionRecord(
  bundle: ProjectBundle,
  input: Pick<
    Decision,
    "id" | "target_type" | "target_id" | "decision" | "reason"
  >,
  now: string,
): Decision {
  return {
    schema_version: "1.0.0",
    id: input.id,
    project_id: bundle.project.id,
    revision: 1,
    created_at: now,
    updated_at: now,
    target_type: input.target_type,
    target_id: input.target_id,
    decision: input.decision,
    reason: input.reason,
    actor: "human",
    decided_at: now,
  };
}

export class ProjectWorkflowService {
  private readonly now: () => string;

  constructor(
    private readonly repository: ProjectRepository,
    options: ProjectWorkflowServiceOptions = {},
  ) {
    this.now = options.now ?? (() => new Date().toISOString());
  }

  reviseRelationship(input: ReviseRelationshipInput) {
    const relationshipMode = RelationshipModeSchema.parse(input.relationshipMode);
    const current = this.requireCurrentBundle(input);
    const segmentIndex = current.visual_score_segments.findIndex(
      (segment) => segment.id === input.segmentId,
    );
    if (segmentIndex < 0) {
      throw new ProjectWorkflowError(
        "visual_score_segment_not_found",
        `Visual Score segment '${input.segmentId}' does not exist in this project.`,
        404,
      );
    }

    const currentSegment = current.visual_score_segments[segmentIndex];
    const currentContract = current.audiovisual_contracts.find(
      (contract) => contract.id === currentSegment.audiovisual_contract_id,
    );
    if (!currentContract) {
      throw new ProjectWorkflowError(
        "visual_score_segment_not_found",
        "The Visual Score segment is not connected to an Audiovisual Contract.",
        422,
      );
    }
    if (currentContract.status === "locked") {
      throw new ProjectWorkflowError(
        "visual_score_locked",
        "The locked Visual Score must be explicitly duplicated before editing.",
        409,
      );
    }
    if (currentSegment.relationship_mode === relationshipMode) {
      return this.relationshipResult(current, input.segmentId, false);
    }

    const now = this.now();
    const next = structuredClone(current);
    next.visual_score_segments = next.visual_score_segments.map((segment) => ({
      ...segment,
      revision: segment.revision + 1,
      updated_at: now,
      relationship_mode:
        segment.id === input.segmentId
          ? relationshipMode
          : segment.relationship_mode,
    }));
    const nextContract = next.audiovisual_contracts.find(
      (contract) => contract.id === currentContract.id,
    );
    if (!nextContract) {
      throw new ProjectWorkflowError(
        "visual_score_segment_not_found",
        "The Audiovisual Contract disappeared during revision.",
        422,
      );
    }
    nextContract.status = "draft";
    nextContract.revision += 1;
    nextContract.updated_at = now;
    advanceProjectRevision(next, now);

    const revisionValidation = validateRevision({
      record_type: "visual_score",
      previous: current.visual_score_segments,
      next: next.visual_score_segments,
      previous_status: currentContract.status,
      next_status: nextContract.status,
      explicitly_reopened: true,
    });
    if (!revisionValidation.success) {
      throw new ProjectWorkflowError(
        "visual_score_revision_invalid",
        revisionValidation.issues.map((issue) => issue.message).join(" "),
        422,
      );
    }

    const saved = this.repository.replaceProjectBundle(
      parseProjectBundle(next),
      input.expectedProjectRevision,
    );
    return this.relationshipResult(saved, input.segmentId, true);
  }

  recordReviewAction(input: RecordReviewActionInput) {
    const current = this.requireCurrentBundle(input);
    const currentState = readWorkflowState(current);

    if (input.action === "apply_repair" && currentState !== "diagnosed") {
      return this.reviewResult(current, false);
    }
    if (input.action === "lock_take" && currentState === "locked") {
      return this.reviewResult(current, false);
    }
    if (input.action === "lock_take" && currentState !== "repaired") {
      throw new ProjectWorkflowError(
        "workflow_prerequisite_missing",
        "Apply and review the Editorial Repair before locking its take.",
        409,
      );
    }
    if (input.action === "reset" && currentState === "diagnosed") {
      return this.reviewResult(current, false);
    }

    const now = this.now();
    const next = structuredClone(current);
    if (input.action === "apply_repair") {
      const repair = next.repair_plans.find(
        (plan) => plan.id === "repair-shot-01-timing",
      );
      if (!repair) {
        throw new ProjectWorkflowError(
          "workflow_prerequisite_missing",
          "The demo Editorial Repair plan is unavailable.",
          422,
        );
      }
      next.decisions.push(
        decisionRecord(
          next,
          {
            id: DEMO_REPAIR_DECISION_ID,
            target_type: "repair",
            target_id: repair.id,
            decision: "editorial_repair",
            reason:
              "The walkthrough confirms that only timing failed, so the successful visual layer is preserved.",
          },
          now,
        ),
      );
    } else if (input.action === "lock_take") {
      const repairedTake = next.takes.find(
        (take) => take.id === next.demo_evidence.repaired_take_id,
      );
      if (!repairedTake) {
        throw new ProjectWorkflowError(
          "workflow_prerequisite_missing",
          "The repaired demo take is unavailable.",
          422,
        );
      }
      next.decisions.push(
        decisionRecord(
          next,
          {
            id: DEMO_LOCK_DECISION_ID,
            target_type: "take",
            target_id: repairedTake.id,
            decision: "accept",
            reason:
              "The repaired take preserves the locked visual direction and now obeys the score's suspension timing.",
          },
          now,
        ),
      );
    } else {
      next.decisions = next.decisions.filter(
        (decision) =>
          decision.id !== DEMO_REPAIR_DECISION_ID &&
          decision.id !== DEMO_LOCK_DECISION_ID,
      );
    }
    advanceProjectRevision(next, now);

    const saved = this.repository.replaceProjectBundle(
      parseProjectBundle(next),
      input.expectedProjectRevision,
    );
    return this.reviewResult(saved, true);
  }

  private requireCurrentBundle(input: WorkflowMutationBase) {
    const bundle = this.repository.getProjectBundle(input.projectId);
    if (!bundle) {
      throw new ProjectWorkflowError(
        "project_not_found",
        `Project '${input.projectId}' does not exist.`,
        404,
      );
    }
    if (bundle.project.revision !== input.expectedProjectRevision) {
      throw new ProjectWorkflowError(
        "project_revision_conflict",
        "The project changed in another workflow panel. Reload the latest revision before saving.",
        409,
      );
    }
    return bundle;
  }

  private relationshipResult(
    bundle: ProjectBundle,
    segmentId: string,
    changed: boolean,
  ) {
    const segment = bundle.visual_score_segments.find(
      (candidate) => candidate.id === segmentId,
    );
    if (!segment) {
      throw new ProjectWorkflowError(
        "visual_score_segment_not_found",
        `Visual Score segment '${segmentId}' does not exist in this project.`,
        404,
      );
    }
    const contract = bundle.audiovisual_contracts.find(
      (candidate) => candidate.id === segment.audiovisual_contract_id,
    );
    const impact = planRevisionImpact(bundle, "visual_score");
    const affectedShotIds = bundle.shot_specs
      .filter((shot) => shot.visual_score_segment_ids.includes(segmentId))
      .map((shot) => shot.id);

    return {
      changed,
      projectRevision: bundle.project.revision,
      visualScoreStatus: contract?.status ?? "draft",
      segment: {
        id: segment.id,
        revision: segment.revision,
        relationshipMode: segment.relationship_mode,
      },
      coverage: {
        valid: true,
        segmentCount: bundle.visual_score_segments.length,
        startSeconds: bundle.project.selected_audio_range.start_seconds,
        endSeconds: bundle.project.selected_audio_range.end_seconds,
        gaps: 0,
        overlaps: 0,
      },
      affectedShotIds,
      protectedRecordIds: impact.protected_record_ids,
    };
  }

  private reviewResult(bundle: ProjectBundle, changed: boolean) {
    const workflowState = readWorkflowState(bundle);
    const recordedDecisionIds = [
      DEMO_REPAIR_DECISION_ID,
      DEMO_LOCK_DECISION_ID,
    ].filter((id) => bundle.decisions.some((decision) => decision.id === id));

    return {
      changed,
      projectRevision: bundle.project.revision,
      workflowState,
      recordedDecisionIds,
    };
  }
}

export function demoReviewWorkflowState(bundle: ProjectBundle) {
  return readWorkflowState(bundle);
}

export function toWorkflowHttpError(error: unknown) {
  if (error instanceof ProjectWorkflowError) return error;
  if (error instanceof ProjectBundleNotFoundError) {
    return new ProjectWorkflowError(
      "project_not_found",
      "The project no longer exists.",
      404,
    );
  }
  if (error instanceof ProjectBundleRevisionConflictError) {
    return new ProjectWorkflowError(
      "project_revision_conflict",
      "The project changed while this edit was being saved. Reload and try again.",
      409,
    );
  }
  return null;
}
