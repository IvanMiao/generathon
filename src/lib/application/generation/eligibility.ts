import type {
  FilmBible,
  ShotSpec,
  VisualScoreSegment,
  VisualState,
} from "@/lib/domain/direction";
import {
  MINIMUM_COMPLEX_PROMPT_CHARACTERS,
  REQUIRED_PROMPT_SECTIONS,
  sha256Text,
  type ProviderGenerationTask,
} from "@/lib/application/generation/provider-task";

export type VisualScoreApprovalStatus = "draft" | "approved" | "locked";

export type GenerationEligibilityIssueCode =
  | "generation_film_bible_not_locked"
  | "generation_visual_score_not_approved"
  | "generation_score_segment_missing"
  | "generation_visual_state_missing"
  | "generation_visual_state_not_approved"
  | "generation_shot_spec_not_locked"
  | "generation_shot_functions_incomplete"
  | "generation_task_shot_mismatch"
  | "generation_prompt_too_short"
  | "generation_prompt_section_missing"
  | "generation_prompt_placeholder_present"
  | "generation_prompt_not_reviewed"
  | "generation_prompt_file_required"
  | "generation_prompt_checksum_mismatch"
  | "generation_final_candidate_unconfirmed"
  | "generation_quota_invalid"
  | "generation_quota_exhausted";

export interface GenerationEligibilityIssue {
  code: GenerationEligibilityIssueCode;
  path: string;
  message: string;
}

export interface GenerationEligibilityInput {
  filmBible: FilmBible;
  visualScoreStatus: VisualScoreApprovalStatus;
  visualScoreSegments: VisualScoreSegment[];
  visualStates: VisualState[];
  shotSpec: ShotSpec;
  task: ProviderGenerationTask;
  promptReview: {
    reviewed: boolean;
    promptFileSha256: string | null;
    finalCutCandidateConfirmed: boolean;
  };
  quota: {
    dailyLimit: number;
    used: number;
    reserved: number;
  };
}

export type GenerationEligibilityResult =
  | { eligible: true; issues: [] }
  | { eligible: false; issues: GenerationEligibilityIssue[] };

function addIssue(
  issues: GenerationEligibilityIssue[],
  code: GenerationEligibilityIssueCode,
  path: string,
  message: string,
) {
  issues.push({ code, path, message });
}

function isFilled(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function missingPromptSections(prompt: string) {
  return REQUIRED_PROMPT_SECTIONS.filter((section, sectionIndex) => {
    const marker = `# ${section}`;
    const start = prompt.indexOf(marker);
    if (start < 0) return true;
    const nextMarker = REQUIRED_PROMPT_SECTIONS[sectionIndex + 1];
    const end = nextMarker ? prompt.indexOf(`# ${nextMarker}`, start + marker.length) : prompt.length;
    if (end < 0) return true;
    return prompt.slice(start + marker.length, end).trim().length === 0;
  });
}

export function evaluateGenerationEligibility(
  input: GenerationEligibilityInput,
): GenerationEligibilityResult {
  const issues: GenerationEligibilityIssue[] = [];

  if (input.filmBible.status !== "locked") {
    addIssue(
      issues,
      "generation_film_bible_not_locked",
      "filmBible.status",
      "Lock the Film Bible before spending a video generation call.",
    );
  }
  if (
    input.visualScoreStatus !== "approved" &&
    input.visualScoreStatus !== "locked"
  ) {
    addIssue(
      issues,
      "generation_visual_score_not_approved",
      "visualScoreStatus",
      "Approve the Visual Score before compiling a final-render candidate.",
    );
  }

  const availableScoreIds = new Set(
    input.visualScoreSegments.map((segment) => segment.id),
  );
  const missingScoreIds = input.shotSpec.visual_score_segment_ids.filter(
    (segmentId) => !availableScoreIds.has(segmentId),
  );
  if (missingScoreIds.length > 0) {
    addIssue(
      issues,
      "generation_score_segment_missing",
      "shotSpec.visual_score_segment_ids",
      `The ShotSpec references unavailable Visual Score segments: ${missingScoreIds.join(", ")}.`,
    );
  }

  const requiredStateIds = new Set([
    input.shotSpec.start_visual_state_id,
    input.shotSpec.end_visual_state_id,
  ]);
  for (const stateId of requiredStateIds) {
    const state = input.visualStates.find((candidate) => candidate.id === stateId);
    if (!state) {
      addIssue(
        issues,
        "generation_visual_state_missing",
        "visualStates",
        `The required Visual State '${stateId}' is unavailable.`,
      );
    } else if (state.status !== "approved" && state.status !== "locked") {
      addIssue(
        issues,
        "generation_visual_state_not_approved",
        `visualStates.${stateId}.status`,
        `Approve or lock Visual State '${stateId}' before video generation.`,
      );
    }
  }

  if (input.shotSpec.status !== "locked") {
    addIssue(
      issues,
      "generation_shot_spec_not_locked",
      "shotSpec.status",
      "Lock the ShotSpec before spending a video generation call.",
    );
  }
  if (
    !isFilled(input.shotSpec.musical_function) ||
    !isFilled(input.shotSpec.narrative_function) ||
    !isFilled(input.shotSpec.visual_function)
  ) {
    addIssue(
      issues,
      "generation_shot_functions_incomplete",
      "shotSpec",
      "The ShotSpec must state complete musical, narrative, and visual functions.",
    );
  }
  if (input.task.shot_spec_id !== input.shotSpec.id) {
    addIssue(
      issues,
      "generation_task_shot_mismatch",
      "task.shot_spec_id",
      "The compiled provider task does not belong to this locked ShotSpec.",
    );
  }

  if (input.task.prompt.length < MINIMUM_COMPLEX_PROMPT_CHARACTERS) {
    addIssue(
      issues,
      "generation_prompt_too_short",
      "task.prompt",
      `The reviewed video prompt must contain at least ${MINIMUM_COMPLEX_PROMPT_CHARACTERS} characters.`,
    );
  }
  const missingSections = missingPromptSections(input.task.prompt);
  if (missingSections.length > 0) {
    addIssue(
      issues,
      "generation_prompt_section_missing",
      "task.prompt",
      `Complete every required prompt section before generation: ${missingSections.join(", ")}.`,
    );
  }
  if (
    input.task.prompt.includes("{{") ||
    input.task.prompt.includes("}}") ||
    input.task.prompt.includes("REPLACE_ME")
  ) {
    addIssue(
      issues,
      "generation_prompt_placeholder_present",
      "task.prompt",
      "Replace every prompt-template placeholder before video generation.",
    );
  }
  if (!input.promptReview.reviewed) {
    addIssue(
      issues,
      "generation_prompt_not_reviewed",
      "promptReview.reviewed",
      "A human must review the complete prompt before video generation.",
    );
  }

  const actualPromptSha256 = sha256Text(input.task.prompt);
  if (!input.promptReview.promptFileSha256) {
    addIssue(
      issues,
      "generation_prompt_file_required",
      "promptReview.promptFileSha256",
      "Store the reviewed complex prompt in a file and record its checksum before generation.",
    );
  } else if (
    input.promptReview.promptFileSha256 !== actualPromptSha256 ||
    input.task.prompt_sha256 !== actualPromptSha256
  ) {
    addIssue(
      issues,
      "generation_prompt_checksum_mismatch",
      "promptReview.promptFileSha256",
      "The reviewed prompt-file checksum does not match the compiled provider task.",
    );
  }
  if (!input.promptReview.finalCutCandidateConfirmed) {
    addIssue(
      issues,
      "generation_final_candidate_unconfirmed",
      "promptReview.finalCutCandidateConfirmed",
      "Confirm that this output has a realistic intended use in the final cut.",
    );
  }

  const quotaValues = [
    input.quota.dailyLimit,
    input.quota.used,
    input.quota.reserved,
  ];
  if (
    !quotaValues.every(Number.isInteger) ||
    input.quota.dailyLimit <= 0 ||
    input.quota.used < 0 ||
    input.quota.reserved < 0
  ) {
    addIssue(
      issues,
      "generation_quota_invalid",
      "quota",
      "The daily video-generation quota ledger contains invalid values.",
    );
  } else if (
    input.quota.used + input.quota.reserved >= input.quota.dailyLimit
  ) {
    addIssue(
      issues,
      "generation_quota_exhausted",
      "quota",
      "The daily video-generation quota is exhausted; use a fallback or wait for the next quota window.",
    );
  }

  return issues.length === 0
    ? { eligible: true, issues: [] }
    : { eligible: false, issues };
}
