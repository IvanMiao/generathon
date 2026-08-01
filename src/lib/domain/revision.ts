import type {
  FilmBible,
  ShotSpec,
  VisualState,
  VisualScoreSegment,
} from "@/lib/domain/direction";
import type {
  MusicAnalysis,
  MusicAnalysisRevision,
  MusicReading,
} from "@/lib/domain/music";
import type { ProjectBundle } from "@/lib/domain/project";
import type { Take } from "@/lib/domain/production";
import type { DomainValidationIssue } from "@/lib/domain/validation";

interface RevisionOptions {
  explicitly_reopened?: boolean;
}

type RevisionRequest =
  | ({
      record_type: "music_analysis";
      previous: MusicAnalysis;
      next: MusicAnalysis;
    } & RevisionOptions)
  | ({
      record_type: "music_analysis_revision";
      previous: MusicAnalysisRevision;
      next: MusicAnalysisRevision;
    } & RevisionOptions)
  | ({
      record_type: "music_reading";
      previous: MusicReading;
      next: MusicReading;
    } & RevisionOptions)
  | ({
      record_type: "film_bible";
      previous: FilmBible;
      next: FilmBible;
    } & RevisionOptions)
  | ({
      record_type: "visual_score";
      previous: VisualScoreSegment[];
      next: VisualScoreSegment[];
      previous_status: "draft" | "approved" | "locked";
      next_status: "draft" | "approved" | "locked";
    } & RevisionOptions)
  | ({
      record_type: "visual_state";
      previous: VisualState;
      next: VisualState;
    } & RevisionOptions)
  | ({
      record_type: "shot_spec";
      previous: ShotSpec;
      next: ShotSpec;
    } & RevisionOptions)
  | ({
      record_type: "take";
      previous: Take;
      next: Take;
    } & RevisionOptions);

export interface RevisionValidationResult {
  success: boolean;
  issues: DomainValidationIssue[];
}

function sameValue(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function addIssue(
  issues: DomainValidationIssue[],
  code: string,
  path: string,
  message: string,
) {
  issues.push({ code, path, message });
}

function validateStableIdentity(
  issues: DomainValidationIssue[],
  previous: { id: string; project_id: string; revision: number },
  next: { id: string; project_id: string; revision: number },
  path: string,
) {
  if (previous.id !== next.id || previous.project_id !== next.project_id) {
    addIssue(
      issues,
      "revision_identity_changed",
      path,
      "A revision must preserve the record and project identity.",
    );
  }
  if (next.revision !== previous.revision + 1) {
    addIssue(
      issues,
      "revision_sequence_invalid",
      `${path}.revision`,
      `The next revision must be ${previous.revision + 1}.`,
    );
  }
}

function validateEditableApprovalRecord(
  issues: DomainValidationIssue[],
  recordType: "music_reading" | "film_bible",
  previous: MusicReading | FilmBible,
  next: MusicReading | FilmBible,
  explicitlyReopened: boolean,
) {
  if (sameValue(previous, next)) return;

  if (previous.status === "locked") {
    addIssue(
      issues,
      "locked_record_mutation",
      recordType,
      `Locked ${recordType.replaceAll("_", " ")} fields cannot be patched.`,
    );
    return;
  }
  if (previous.status === "approved" && !explicitlyReopened) {
    addIssue(
      issues,
      "approved_record_requires_reopen",
      recordType,
      `The approved ${recordType.replaceAll("_", " ")} must be explicitly reopened before revision.`,
    );
    return;
  }
  if (previous.status === "approved" && next.status !== "draft") {
    addIssue(
      issues,
      "reopened_status_invalid",
      `${recordType}.status`,
      `A reopened ${recordType.replaceAll("_", " ")} revision must return to draft status.`,
    );
  }
  validateStableIdentity(issues, previous, next, recordType);
}

function validateVisualScoreRevision(
  request: Extract<RevisionRequest, { record_type: "visual_score" }>,
) {
  const issues: DomainValidationIssue[] = [];
  if (sameValue(request.previous, request.next)) return issues;

  if (request.previous_status === "locked") {
    addIssue(
      issues,
      "locked_record_mutation",
      "visual_score",
      "A locked Visual Score cannot be patched.",
    );
    return issues;
  }
  if (request.previous_status === "approved" && !request.explicitly_reopened) {
    addIssue(
      issues,
      "approved_score_requires_reopen",
      "visual_score",
      "The approved Visual Score must be explicitly reopened before revision.",
    );
    return issues;
  }
  if (request.previous_status === "approved" && request.next_status !== "draft") {
    addIssue(
      issues,
      "reopened_status_invalid",
      "visual_score.status",
      "A reopened Visual Score revision must return to draft status.",
    );
  }

  const previousById = new Map(request.previous.map((segment) => [segment.id, segment]));
  request.next.forEach((segment, index) => {
    const previous = previousById.get(segment.id);
    if (previous) {
      validateStableIdentity(issues, previous, segment, `visual_score.${index}`);
    } else if (segment.revision !== 1) {
      addIssue(
        issues,
        "revision_sequence_invalid",
        `visual_score.${index}.revision`,
        "A newly introduced Visual Score segment must begin at revision 1.",
      );
    }
  });
  return issues;
}

function validateLockableRecord(
  issues: DomainValidationIssue[],
  recordType: "visual_state" | "shot_spec" | "take",
  previous: VisualState | ShotSpec | Take,
  next: VisualState | ShotSpec | Take,
  locked: boolean,
) {
  if (sameValue(previous, next)) return;
  if (locked) {
    addIssue(
      issues,
      "locked_record_mutation",
      recordType,
      `Locked ${recordType.replaceAll("_", " ")} fields cannot be replaced or patched.`,
    );
    return;
  }
  validateStableIdentity(issues, previous, next, recordType);
}

export function validateRevision(request: RevisionRequest): RevisionValidationResult {
  const issues: DomainValidationIssue[] = [];
  const explicitlyReopened = request.explicitly_reopened ?? false;

  switch (request.record_type) {
    case "music_analysis":
      if (!sameValue(request.previous, request.next)) {
        addIssue(
          issues,
          "measured_analysis_immutable",
          "music_analysis",
          "Measured music analysis is immutable; create a MusicAnalysisRevision instead.",
        );
      }
      break;
    case "music_analysis_revision":
      if (!sameValue(request.previous, request.next)) {
        validateStableIdentity(
          issues,
          request.previous,
          request.next,
          "music_analysis_revision",
        );
        if (request.previous.base_analysis_id !== request.next.base_analysis_id) {
          addIssue(
            issues,
            "base_analysis_changed",
            "music_analysis_revision.base_analysis_id",
            "A MusicAnalysisRevision cannot switch its immutable base analysis.",
          );
        }
      }
      break;
    case "music_reading":
      validateEditableApprovalRecord(
        issues,
        "music_reading",
        request.previous,
        request.next,
        explicitlyReopened,
      );
      break;
    case "film_bible":
      validateEditableApprovalRecord(
        issues,
        "film_bible",
        request.previous,
        request.next,
        explicitlyReopened,
      );
      break;
    case "visual_score":
      issues.push(...validateVisualScoreRevision(request));
      break;
    case "visual_state":
      validateLockableRecord(
        issues,
        "visual_state",
        request.previous,
        request.next,
        request.previous.status === "locked",
      );
      break;
    case "shot_spec":
      validateLockableRecord(
        issues,
        "shot_spec",
        request.previous,
        request.next,
        request.previous.status === "locked",
      );
      break;
    case "take":
      validateLockableRecord(
        issues,
        "take",
        request.previous,
        request.next,
        request.previous.locked,
      );
      break;
  }

  return { success: issues.length === 0, issues };
}

export type RevisionImpactScope =
  | "audio_range"
  | "music_reading"
  | "film_bible"
  | "visual_score";

export interface RevisionImpact {
  invalidated_record_ids: string[];
  protected_record_ids: string[];
}

export function planRevisionImpact(
  bundle: ProjectBundle,
  scope: RevisionImpactScope,
): RevisionImpact {
  const invalidated = new Set<string>();
  const protectedRecords = new Set<string>();

  function classify(id: string, locked: boolean) {
    if (locked) protectedRecords.add(id);
    else invalidated.add(id);
  }

  const includeDirection = scope === "audio_range" || scope === "music_reading";
  const includeVisualWorld = includeDirection || scope === "film_bible";
  const includeShots = includeVisualWorld || scope === "visual_score";

  if (scope === "audio_range") {
    bundle.music_analysis_revisions.forEach((record) => invalidated.add(record.id));
    bundle.music_readings.forEach((record) => classify(record.id, record.status === "locked"));
  }

  if (includeDirection) {
    bundle.director_treatments.forEach((record) => invalidated.add(record.id));
    bundle.film_bibles.forEach((record) => classify(record.id, record.status === "locked"));
  }

  if (includeVisualWorld) {
    bundle.audiovisual_contracts.forEach((record) =>
      classify(record.id, record.status === "locked"),
    );
    bundle.visual_states.forEach((record) => classify(record.id, record.status === "locked"));
    bundle.visual_score_segments.forEach((record) => invalidated.add(record.id));
  }

  if (includeShots) {
    bundle.shot_specs.forEach((record) => classify(record.id, record.status === "locked"));
    bundle.takes.forEach((record) => classify(record.id, record.locked));
    bundle.review_reports.forEach((record) => invalidated.add(record.id));
    bundle.repair_plans.forEach((record) => invalidated.add(record.id));
    bundle.provider_runs.forEach((record) => invalidated.add(record.id));
    bundle.assembly_runs.forEach((record) => invalidated.add(record.id));
  }

  protectedRecords.forEach((id) => invalidated.delete(id));
  return {
    invalidated_record_ids: [...invalidated].toSorted(),
    protected_record_ids: [...protectedRecords].toSorted(),
  };
}
