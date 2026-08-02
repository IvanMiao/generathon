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
  | "analysis_revision_not_found"
  | "analysis_section_not_found"
  | "analysis_boundary_invalid"
  | "analysis_revision_invalid"
  | "treatment_not_found"
  | "treatment_reselection_invalid"
  | "treatment_reselection_locked"
  | "treatment_reselection_confirmation_required"
  | "visual_score_segment_not_found"
  | "visual_score_locked"
  | "visual_score_revision_invalid"
  | "visual_score_approval_invalid"
  | "take_not_found"
  | "take_review_invalid"
  | "take_lock_invalid"
  | "take_lock_confirmation_required"
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

export interface ReviseAnalysisBoundaryInput extends WorkflowMutationBase {
  revisionId: string;
  sectionId: string;
  boundarySeconds: number;
}

export interface ReselectTreatmentInput extends WorkflowMutationBase {
  treatmentId: string;
  confirmed: boolean;
}

export type ApproveVisualScoreInput = WorkflowMutationBase;

export interface RecordReviewActionInput extends WorkflowMutationBase {
  action: "apply_repair" | "lock_take" | "reset";
}

export interface ReviewCandidateTakeInput extends WorkflowMutationBase {
  takeId: string;
}

export interface LockCandidateTakeInput extends ReviewCandidateTakeInput {
  confirmed: boolean;
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

  reviseAnalysisBoundary(input: ReviseAnalysisBoundaryInput) {
    const current = this.requireCurrentBundle(input);
    const revisionIndex = current.music_analysis_revisions.findIndex(
      (revision) => revision.id === input.revisionId,
    );
    if (revisionIndex < 0) {
      throw new ProjectWorkflowError(
        "analysis_revision_not_found",
        `Music Analysis revision '${input.revisionId}' does not exist in this project.`,
        404,
      );
    }

    const currentRevision = current.music_analysis_revisions[revisionIndex];
    const sectionIndex = currentRevision.sections.findIndex(
      (section) => section.id === input.sectionId,
    );
    if (sectionIndex < 0 || sectionIndex === currentRevision.sections.length - 1) {
      throw new ProjectWorkflowError(
        "analysis_section_not_found",
        "Choose a section with a following section to revise their shared boundary.",
        404,
      );
    }

    const leftSection = currentRevision.sections[sectionIndex];
    const rightSection = currentRevision.sections[sectionIndex + 1];
    const boundarySeconds = input.boundarySeconds;
    if (
      !Number.isFinite(boundarySeconds) ||
      boundarySeconds <= leftSection.range.start_seconds + 0.001 ||
      boundarySeconds >= rightSection.range.end_seconds - 0.001
    ) {
      throw new ProjectWorkflowError(
        "analysis_boundary_invalid",
        `The shared boundary must stay between ${leftSection.range.start_seconds.toFixed(3)} and ${rightSection.range.end_seconds.toFixed(3)} seconds.`,
        422,
      );
    }
    if (
      Math.abs(leftSection.range.end_seconds - boundarySeconds) <= 0.0005 &&
      Math.abs(rightSection.range.start_seconds - boundarySeconds) <= 0.0005
    ) {
      return this.analysisRevisionResult(current, input.revisionId, false);
    }

    const now = this.now();
    const next = structuredClone(current);
    const nextRevision = next.music_analysis_revisions[revisionIndex];
    nextRevision.revision += 1;
    nextRevision.updated_at = now;
    nextRevision.note = `Human boundary correction between ${leftSection.label} and ${rightSection.label} at ${boundarySeconds.toFixed(3)} seconds.`;
    nextRevision.sections = nextRevision.sections.map((section, index) => {
      if (index === sectionIndex) {
        return {
          ...section,
          range: { ...section.range, end_seconds: boundarySeconds },
          source: "user",
        };
      }
      if (index === sectionIndex + 1) {
        return {
          ...section,
          range: { ...section.range, start_seconds: boundarySeconds },
          source: "user",
        };
      }
      return section;
    });
    advanceProjectRevision(next, now);

    const revisionValidation = validateRevision({
      record_type: "music_analysis_revision",
      previous: currentRevision,
      next: nextRevision,
    });
    if (!revisionValidation.success) {
      throw new ProjectWorkflowError(
        "analysis_revision_invalid",
        revisionValidation.issues.map((issue) => issue.message).join(" "),
        422,
      );
    }

    const saved = this.repository.replaceProjectBundle(
      parseProjectBundle(next),
      input.expectedProjectRevision,
    );
    return this.analysisRevisionResult(saved, input.revisionId, true);
  }

  reselectTreatment(input: ReselectTreatmentInput) {
    const current = this.requireCurrentBundle(input);
    const activeTreatment = current.project.active_treatment_id
      ? current.director_treatments.find(
          (treatment) => treatment.id === current.project.active_treatment_id,
        )
      : undefined;
    if (!activeTreatment) {
      throw new ProjectWorkflowError(
        "workflow_prerequisite_missing",
        "Select an initial Director Treatment before changing direction.",
        409,
      );
    }
    const nextTreatment = current.director_treatments.find(
      (treatment) => treatment.id === input.treatmentId,
    );
    if (!nextTreatment) {
      throw new ProjectWorkflowError(
        "treatment_not_found",
        `Director Treatment '${input.treatmentId}' does not exist in this project.`,
        404,
      );
    }
    if (nextTreatment.id === activeTreatment.id) {
      return this.treatmentReselectionResult(current, false);
    }
    if (!input.confirmed) {
      throw new ProjectWorkflowError(
        "treatment_reselection_confirmation_required",
        "Confirm the new direction before replacing the selected Director Treatment.",
        422,
      );
    }
    if (
      nextTreatment.status !== "candidate" ||
      nextTreatment.music_reading_id !== activeTreatment.music_reading_id
    ) {
      throw new ProjectWorkflowError(
        "treatment_reselection_invalid",
        "Choose a candidate Treatment generated from the active Music Reading.",
        422,
      );
    }

    const activeFilmBible = current.film_bibles.find(
      (filmBible) => filmBible.treatment_id === activeTreatment.id,
    );
    if (activeFilmBible?.status === "locked") {
      throw new ProjectWorkflowError(
        "treatment_reselection_locked",
        "The active Film Bible is locked. Preserve this cut and start a new direction revision instead.",
        409,
      );
    }

    const now = this.now();
    const next = structuredClone(current);
    next.director_treatments = next.director_treatments.map((treatment) => {
      if (treatment.id === activeTreatment.id) {
        return {
          ...treatment,
          revision: treatment.revision + 1,
          updated_at: now,
          status: "candidate",
        };
      }
      if (treatment.id === nextTreatment.id) {
        return {
          ...treatment,
          revision: treatment.revision + 1,
          updated_at: now,
          status: "selected",
        };
      }
      return treatment;
    });
    next.project.active_treatment_id = nextTreatment.id;
    next.project.active_assembly_run_id = null;
    next.project.creative_state = "treatment_selected";
    advanceProjectRevision(next, now);

    const saved = this.repository.replaceProjectBundle(
      parseProjectBundle(next),
      input.expectedProjectRevision,
    );
    return this.treatmentReselectionResult(saved, true);
  }

  approveVisualScore(input: ApproveVisualScoreInput) {
    const current = this.requireCurrentBundle(input);
    const selectedTreatment = current.director_treatments.find(
      (treatment) => treatment.id === current.project.active_treatment_id,
    );
    const filmBible = current.film_bibles.find(
      (bible) => bible.treatment_id === selectedTreatment?.id,
    );
    const currentContract = current.audiovisual_contracts.find(
      (contract) => contract.film_bible_id === filmBible?.id,
    );
    if (!currentContract) {
      throw new ProjectWorkflowError(
        "visual_score_approval_invalid",
        "The active direction has no Audiovisual Contract to approve.",
        422,
      );
    }
    if (currentContract.status === "locked") {
      throw new ProjectWorkflowError(
        "visual_score_locked",
        "The Visual Score is already locked and cannot change approval state.",
        409,
      );
    }
    if (currentContract.status === "approved") {
      return this.approvalResult(current, currentContract.id, false);
    }

    const scoreSegments = current.visual_score_segments.filter(
      (segment) =>
        segment.audiovisual_contract_id === currentContract.id,
    );
    const referencedStateIds = new Set(
      scoreSegments.flatMap((segment) => segment.visual_state_ids),
    );
    const unavailableStateIds = [...referencedStateIds].filter((stateId) => {
      const state = current.visual_states.find(
        (candidate) => candidate.id === stateId,
      );
      return !state || (state.status !== "approved" && state.status !== "locked");
    });
    if (scoreSegments.length < 5 || unavailableStateIds.length > 0) {
      throw new ProjectWorkflowError(
        "visual_score_approval_invalid",
        unavailableStateIds.length > 0
          ? `Approve every referenced Visual State first: ${unavailableStateIds.join(", ")}.`
          : "A complete five-to-seven-segment Visual Score is required before approval.",
        422,
      );
    }

    const now = this.now();
    const next = structuredClone(current);
    const nextContract = next.audiovisual_contracts.find(
      (contract) => contract.id === currentContract.id,
    );
    if (!nextContract) {
      throw new ProjectWorkflowError(
        "visual_score_approval_invalid",
        "The Audiovisual Contract disappeared during approval.",
        422,
      );
    }
    nextContract.status = "approved";
    nextContract.revision += 1;
    nextContract.updated_at = now;
    if (
      [
        "draft",
        "audio_analyzed",
        "music_reading_ready",
        "treatment_selected",
        "direction_locked",
      ].includes(next.project.creative_state)
    ) {
      next.project.creative_state = "score_approved";
    }
    advanceProjectRevision(next, now);

    const saved = this.repository.replaceProjectBundle(
      parseProjectBundle(next),
      input.expectedProjectRevision,
    );
    return this.approvalResult(saved, currentContract.id, true);
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

  reviewCandidateTake(input: ReviewCandidateTakeInput) {
    const current = this.requireCurrentBundle(input);
    const currentTake = this.requireImportedManualTake(current, input.takeId);
    if (currentTake.locked || currentTake.status === "needs_decision") {
      return this.candidateTakeResult(current, input.takeId, false);
    }
    if (currentTake.status !== "candidate") {
      throw new ProjectWorkflowError(
        "take_review_invalid",
        "Only an unlocked candidate Take can enter mechanical review.",
        409,
      );
    }

    const shot = current.shot_specs.find(
      (candidate) => candidate.id === currentTake.shot_spec_id,
    );
    const artifact = current.artifacts.find(
      (candidate) => candidate.id === currentTake.artifact_id,
    );
    if (!shot || !artifact || artifact.kind !== "video" || artifact.mime_type !== "video/mp4") {
      throw new ProjectWorkflowError(
        "take_review_invalid",
        "The candidate Take must reference an imported MP4 video artifact.",
        422,
      );
    }

    const now = this.now();
    const next = structuredClone(current);
    const takeIndex = next.takes.findIndex((take) => take.id === input.takeId);
    const nextTake = next.takes[takeIndex];
    nextTake.status = "needs_decision";
    nextTake.revision += 1;
    nextTake.updated_at = now;
    const reportId = `review-${nextTake.id}-mechanical-v${nextTake.revision}`;
    next.review_reports.push({
      schema_version: "1.0.0",
      id: reportId,
      project_id: next.project.id,
      revision: 1,
      created_at: now,
      updated_at: now,
      take_id: nextTake.id,
      status: "complete",
      failure_classes: ["accept"],
      evidence: [
        {
          id: `evidence-${nextTake.id}-mechanical-v${nextTake.revision}`,
          dimension: "mechanical",
          range: shot.range,
          finding:
            "Imported MP4 passed the recorded H.264 media admission check; artistic acceptance remains an explicit human decision.",
          source: "local_measurement",
          confidence: 1,
        },
      ],
      summary:
        "Mechanical admission passed. Preview the imported candidate, then explicitly accept and lock it only if it serves the intended cut.",
    });
    advanceProjectRevision(next, now);

    const revisionValidation = validateRevision({
      record_type: "take",
      previous: currentTake,
      next: nextTake,
    });
    if (!revisionValidation.success) {
      throw new ProjectWorkflowError(
        "take_review_invalid",
        revisionValidation.issues.map((issue) => issue.message).join(" "),
        422,
      );
    }

    const saved = this.repository.replaceProjectBundle(
      parseProjectBundle(next),
      input.expectedProjectRevision,
    );
    return this.candidateTakeResult(saved, input.takeId, true);
  }

  lockCandidateTake(input: LockCandidateTakeInput) {
    const current = this.requireCurrentBundle(input);
    const currentTake = this.requireImportedManualTake(current, input.takeId);
    if (currentTake.locked) {
      return this.candidateTakeResult(current, input.takeId, false);
    }
    if (!input.confirmed) {
      throw new ProjectWorkflowError(
        "take_lock_confirmation_required",
        "Confirm that this reviewed Take should become a locked final-cut candidate.",
        422,
      );
    }
    const acceptingReview = current.review_reports
      .toReversed()
      .find(
        (review) =>
          review.take_id === currentTake.id &&
          review.status === "complete" &&
          review.failure_classes.length === 1 &&
          review.failure_classes[0] === "accept",
      );
    if (currentTake.status !== "needs_decision" || !acceptingReview) {
      throw new ProjectWorkflowError(
        "take_lock_invalid",
        "Complete an accepting mechanical review before locking this candidate Take.",
        409,
      );
    }

    const now = this.now();
    const next = structuredClone(current);
    const takeIndex = next.takes.findIndex((take) => take.id === input.takeId);
    const nextTake = next.takes[takeIndex];
    nextTake.status = "locked";
    nextTake.locked = true;
    nextTake.revision += 1;
    nextTake.updated_at = now;
    next.decisions.push(
      decisionRecord(
        next,
        {
          id: `decision-${nextTake.id}-accept-v${nextTake.revision}`,
          target_type: "take",
          target_id: nextTake.id,
          decision: "accept",
          reason:
            "The mechanical report is complete and a human explicitly accepted this imported Take for the locked candidate pool.",
        },
        now,
      ),
    );
    advanceProjectRevision(next, now);

    const revisionValidation = validateRevision({
      record_type: "take",
      previous: currentTake,
      next: nextTake,
    });
    if (!revisionValidation.success) {
      throw new ProjectWorkflowError(
        "take_lock_invalid",
        revisionValidation.issues.map((issue) => issue.message).join(" "),
        422,
      );
    }

    const saved = this.repository.replaceProjectBundle(
      parseProjectBundle(next),
      input.expectedProjectRevision,
    );
    return this.candidateTakeResult(saved, input.takeId, true);
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

  private requireImportedManualTake(bundle: ProjectBundle, takeId: string) {
    const take = bundle.takes.find((candidate) => candidate.id === takeId);
    if (!take) {
      throw new ProjectWorkflowError(
        "take_not_found",
        `Take '${takeId}' does not exist in this project.`,
        404,
      );
    }
    if (take.source !== "manual") {
      throw new ProjectWorkflowError(
        "take_review_invalid",
        "This workflow only reviews manually imported candidate Takes.",
        422,
      );
    }
    return take;
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

  private analysisRevisionResult(
    bundle: ProjectBundle,
    revisionId: string,
    changed: boolean,
  ) {
    const analysisRevision = bundle.music_analysis_revisions.find(
      (candidate) => candidate.id === revisionId,
    );
    if (!analysisRevision) {
      throw new ProjectWorkflowError(
        "analysis_revision_not_found",
        `Music Analysis revision '${revisionId}' does not exist in this project.`,
        404,
      );
    }
    const impact = planRevisionImpact(bundle, "audio_range");

    return {
      changed,
      projectRevision: bundle.project.revision,
      analysisRevision: {
        id: analysisRevision.id,
        revision: analysisRevision.revision,
        note: analysisRevision.note,
        sections: analysisRevision.sections.map((section) => ({
          id: section.id,
          label: section.label,
          startSeconds: section.range.start_seconds,
          endSeconds: section.range.end_seconds,
          source: section.source,
        })),
      },
      invalidatedRecordIds: impact.invalidated_record_ids.filter(
        (recordId) => recordId !== analysisRevision.id,
      ),
      protectedRecordIds: impact.protected_record_ids,
    };
  }

  private treatmentReselectionResult(bundle: ProjectBundle, changed: boolean) {
    const activeTreatment = bundle.project.active_treatment_id
      ? bundle.director_treatments.find(
          (treatment) => treatment.id === bundle.project.active_treatment_id,
        )
      : undefined;
    if (!activeTreatment) {
      throw new ProjectWorkflowError(
        "workflow_prerequisite_missing",
        "The project no longer has an active Director Treatment.",
        422,
      );
    }
    const hasActiveFilmBible = bundle.film_bibles.some(
      (filmBible) => filmBible.treatment_id === activeTreatment.id,
    );
    const impact = planRevisionImpact(bundle, "music_reading");

    return {
      changed,
      projectRevision: bundle.project.revision,
      creativeState: bundle.project.creative_state,
      activeTreatment: {
        id: activeTreatment.id,
        title: activeTreatment.title,
      },
      directionBuildRequired: !hasActiveFilmBible,
      invalidatedRecordIds: impact.invalidated_record_ids,
      protectedRecordIds: impact.protected_record_ids,
    };
  }

  private approvalResult(
    bundle: ProjectBundle,
    contractId: string,
    changed: boolean,
  ) {
    const contract = bundle.audiovisual_contracts.find(
      (candidate) => candidate.id === contractId,
    );
    const segments = bundle.visual_score_segments.filter(
      (segment) => segment.audiovisual_contract_id === contractId,
    );
    const referencedStateIds = new Set(
      segments.flatMap((segment) => segment.visual_state_ids),
    );

    return {
      changed,
      projectRevision: bundle.project.revision,
      visualScoreStatus: contract?.status ?? "draft",
      segmentCount: segments.length,
      approvedVisualStateCount: [...referencedStateIds].filter((stateId) => {
        const state = bundle.visual_states.find(
          (candidate) => candidate.id === stateId,
        );
        return state?.status === "approved" || state?.status === "locked";
      }).length,
      generationGateReady:
        contract?.status === "approved" || contract?.status === "locked",
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

  private candidateTakeResult(
    bundle: ProjectBundle,
    takeId: string,
    changed: boolean,
  ) {
    const take = this.requireImportedManualTake(bundle, takeId);
    const review = bundle.review_reports
      .toReversed()
      .find((candidate) => candidate.take_id === take.id);
    const decision = bundle.decisions
      .toReversed()
      .find(
        (candidate) =>
          candidate.target_type === "take" &&
          candidate.target_id === take.id &&
          candidate.decision === "accept",
      );

    return {
      changed,
      projectRevision: bundle.project.revision,
      take: {
        id: take.id,
        status: take.status,
        locked: take.locked,
        revision: take.revision,
      },
      review: review
        ? {
            id: review.id,
            status: review.status,
            accepted:
              review.failure_classes.length === 1 &&
              review.failure_classes[0] === "accept",
            evidenceCount: review.evidence.length,
            summary: review.summary,
          }
        : null,
      decision: decision
        ? {
            id: decision.id,
            decision: decision.decision,
            targetId: decision.target_id,
          }
        : null,
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
