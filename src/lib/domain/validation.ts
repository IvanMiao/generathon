import type { ZodIssue } from "zod";
import type { TimeRange } from "@/lib/domain/shared";
import { ProjectBundleSchema, type ProjectBundle } from "@/lib/domain/project";

const TIME_TOLERANCE_SECONDS = 0.001;

export type DomainValidationCode =
  | "contract_invalid"
  | "duplicate_id"
  | "project_reference_mismatch"
  | "missing_reference"
  | "invalid_time_range"
  | "timestamp_out_of_range"
  | "sections_not_ordered"
  | "sections_overlap"
  | "visual_score_gap"
  | "visual_score_overlap"
  | "visual_score_not_ordered"
  | "shot_not_covered_by_score"
  | "visual_state_not_approved"
  | "assembly_gap"
  | "assembly_overlap"
  | "assembly_uses_unlocked_take"
  | "assembly_duration_drift"
  | "demo_evidence_invalid"
  | "treatments_not_structurally_distinct"
  | "insufficient_relationship_modes"
  | "selected_range_duration_invalid";

export interface DomainValidationIssue {
  code: DomainValidationCode | string;
  path: string;
  message: string;
}

export type ProjectValidationResult =
  | { success: true; data: ProjectBundle; issues: [] }
  | { success: false; data?: undefined; issues: DomainValidationIssue[] };

export class DomainValidationError extends Error {
  readonly issues: DomainValidationIssue[];

  constructor(issues: DomainValidationIssue[]) {
    super(issues[0]?.message ?? "The project contract is invalid.");
    this.name = "DomainValidationError";
    this.issues = issues;
  }
}

function zodIssueToDomainIssue(issue: ZodIssue): DomainValidationIssue {
  const path = issue.path.map(String).join(".") || "$";
  return {
    code: "contract_invalid",
    path,
    message: `Contract validation failed at ${path}: ${issue.message}`,
  };
}

function near(left: number, right: number) {
  return Math.abs(left - right) <= TIME_TOLERANCE_SECONDS;
}

function containsTime(range: TimeRange, value: number) {
  return (
    value >= range.start_seconds - TIME_TOLERANCE_SECONDS &&
    value <= range.end_seconds + TIME_TOLERANCE_SECONDS
  );
}

function containsRange(container: TimeRange, candidate: TimeRange) {
  return (
    containsTime(container, candidate.start_seconds) &&
    containsTime(container, candidate.end_seconds)
  );
}

function rangesIntersect(left: TimeRange, right: TimeRange) {
  return (
    left.start_seconds < right.end_seconds - TIME_TOLERANCE_SECONDS &&
    right.start_seconds < left.end_seconds - TIME_TOLERANCE_SECONDS
  );
}

function sameRange(left: TimeRange, right: TimeRange) {
  return near(left.start_seconds, right.start_seconds) && near(left.end_seconds, right.end_seconds);
}

function issue(
  issues: DomainValidationIssue[],
  code: DomainValidationCode,
  path: string,
  message: string,
) {
  issues.push({ code, path, message });
}

function validateRange(
  issues: DomainValidationIssue[],
  range: TimeRange,
  selectedRange: TimeRange,
  path: string,
) {
  if (range.end_seconds <= range.start_seconds) {
    issue(
      issues,
      "invalid_time_range",
      path,
      "The end time must be greater than the start time.",
    );
  }
  if (!containsRange(selectedRange, range)) {
    issue(
      issues,
      "timestamp_out_of_range",
      path,
      "The time range must stay inside the selected audio range.",
    );
  }
}

function validateOrderedRanges(
  issues: DomainValidationIssue[],
  ranges: Array<{ range: TimeRange }>,
  selectedRange: TimeRange,
  path: string,
  options: {
    requireFullCoverage: boolean;
    notOrderedCode: DomainValidationCode;
    overlapCode: DomainValidationCode;
    gapCode?: DomainValidationCode;
  },
) {
  ranges.forEach((item, index) => {
    validateRange(issues, item.range, selectedRange, `${path}.${index}.range`);
  });

  if (ranges.length === 0) return;

  if (
    options.requireFullCoverage &&
    !near(ranges[0].range.start_seconds, selectedRange.start_seconds)
  ) {
    issue(
      issues,
      options.gapCode ?? "visual_score_gap",
      `${path}.0.range.start_seconds`,
      "Coverage must begin at the selected audio range start.",
    );
  }

  for (let index = 1; index < ranges.length; index += 1) {
    const previous = ranges[index - 1].range;
    const current = ranges[index].range;

    if (current.start_seconds < previous.start_seconds - TIME_TOLERANCE_SECONDS) {
      issue(
        issues,
        options.notOrderedCode,
        `${path}.${index}.range.start_seconds`,
        "Ranges must remain in chronological order.",
      );
    }
    if (current.start_seconds < previous.end_seconds - TIME_TOLERANCE_SECONDS) {
      issue(
        issues,
        options.overlapCode,
        `${path}.${index}.range.start_seconds`,
        "This range overlaps the previous range.",
      );
    }
    if (
      options.requireFullCoverage &&
      current.start_seconds > previous.end_seconds + TIME_TOLERANCE_SECONDS
    ) {
      issue(
        issues,
        options.gapCode ?? "visual_score_gap",
        `${path}.${index}.range.start_seconds`,
        "A gap exists after the previous range.",
      );
    }
  }

  const finalRange = ranges[ranges.length - 1].range;
  if (options.requireFullCoverage && !near(finalRange.end_seconds, selectedRange.end_seconds)) {
    issue(
      issues,
      options.gapCode ?? "visual_score_gap",
      `${path}.${ranges.length - 1}.range.end_seconds`,
      "Coverage must end at the selected audio range end.",
    );
  }
}

function validateUniqueIds(bundle: ProjectBundle, issues: DomainValidationIssue[]) {
  const collections = [
    ["artifacts", bundle.artifacts],
    ["audio_assets", bundle.audio_assets],
    ["music_analyses", bundle.music_analyses],
    ["music_analysis_revisions", bundle.music_analysis_revisions],
    ["music_readings", bundle.music_readings],
    ["director_treatments", bundle.director_treatments],
    ["film_bibles", bundle.film_bibles],
    ["audiovisual_contracts", bundle.audiovisual_contracts],
    ["visual_states", bundle.visual_states],
    ["visual_score_segments", bundle.visual_score_segments],
    ["shot_specs", bundle.shot_specs],
    ["takes", bundle.takes],
    ["review_reports", bundle.review_reports],
    ["repair_plans", bundle.repair_plans],
    ["decisions", bundle.decisions],
    ["provider_capabilities", bundle.provider_capabilities],
    ["provider_runs", bundle.provider_runs],
    ["assembly_runs", bundle.assembly_runs],
  ] as const;
  const seen = new Map<string, string>();

  for (const [collectionName, records] of collections) {
    records.forEach((record, index) => {
      const existingPath = seen.get(record.id);
      const currentPath = `${collectionName}.${index}.id`;
      if (existingPath) {
        issue(
          issues,
          "duplicate_id",
          currentPath,
          `Record ID '${record.id}' is already used at ${existingPath}.`,
        );
      } else {
        seen.set(record.id, currentPath);
      }
    });
  }
}

function validateProjectOwnership(bundle: ProjectBundle, issues: DomainValidationIssue[]) {
  if (bundle.project.project_id !== bundle.project.id) {
    issue(
      issues,
      "project_reference_mismatch",
      "project.project_id",
      "The root Project record must own itself.",
    );
  }
  const collections = [
    bundle.artifacts,
    bundle.audio_assets,
    bundle.music_analyses,
    bundle.music_analysis_revisions,
    bundle.music_readings,
    bundle.director_treatments,
    bundle.film_bibles,
    bundle.audiovisual_contracts,
    bundle.visual_states,
    bundle.visual_score_segments,
    bundle.shot_specs,
    bundle.takes,
    bundle.review_reports,
    bundle.repair_plans,
    bundle.decisions,
    bundle.provider_capabilities,
    bundle.provider_runs,
    bundle.assembly_runs,
  ];

  collections.forEach((records) => {
    records.forEach((record) => {
      if (record.project_id !== bundle.project.id) {
        issue(
          issues,
          "project_reference_mismatch",
          `${record.id}.project_id`,
          `Record '${record.id}' must belong to project '${bundle.project.id}'.`,
        );
      }
    });
  });
}

function validateReferences(bundle: ProjectBundle, issues: DomainValidationIssue[]) {
  const artifacts = new Map(bundle.artifacts.map((record) => [record.id, record]));
  const audioAssets = new Map(bundle.audio_assets.map((record) => [record.id, record]));
  const analyses = new Map(bundle.music_analyses.map((record) => [record.id, record]));
  const analysisRevisions = new Map(
    bundle.music_analysis_revisions.map((record) => [record.id, record]),
  );
  const readings = new Map(bundle.music_readings.map((record) => [record.id, record]));
  const treatments = new Map(bundle.director_treatments.map((record) => [record.id, record]));
  const filmBibles = new Map(bundle.film_bibles.map((record) => [record.id, record]));
  const contracts = new Map(bundle.audiovisual_contracts.map((record) => [record.id, record]));
  const visualStates = new Map(bundle.visual_states.map((record) => [record.id, record]));
  const scoreSegments = new Map(bundle.visual_score_segments.map((record) => [record.id, record]));
  const shots = new Map(bundle.shot_specs.map((record) => [record.id, record]));
  const takes = new Map(bundle.takes.map((record) => [record.id, record]));
  const reviews = new Map(bundle.review_reports.map((record) => [record.id, record]));
  const repairs = new Map(bundle.repair_plans.map((record) => [record.id, record]));
  const decisions = new Map(bundle.decisions.map((record) => [record.id, record]));
  const providerRuns = new Map(bundle.provider_runs.map((record) => [record.id, record]));
  const assemblies = new Map(bundle.assembly_runs.map((record) => [record.id, record]));
  const measuredEventIds = new Set(
    bundle.music_analyses.flatMap((analysis) => analysis.events.map((event) => event.id)),
  );
  const providerIds = new Set(
    bundle.provider_capabilities.map((capability) => capability.provider),
  );

  function requireReference(
    map: ReadonlyMap<string, unknown>,
    id: string,
    path: string,
    label: string,
  ) {
    if (!map.has(id)) {
      issue(
        issues,
        "missing_reference",
        path,
        `${label} '${id}' does not exist in this project bundle.`,
      );
    }
  }

  requireReference(
    audioAssets,
    bundle.project.selected_audio_asset_id,
    "project.selected_audio_asset_id",
    "Audio asset",
  );
  if (bundle.project.active_treatment_id) {
    requireReference(
      treatments,
      bundle.project.active_treatment_id,
      "project.active_treatment_id",
      "Director treatment",
    );
    const activeTreatment = treatments.get(bundle.project.active_treatment_id);
    if (activeTreatment && activeTreatment.status !== "selected") {
      issue(
        issues,
        "project_reference_mismatch",
        "project.active_treatment_id",
        "The active Director Treatment must have selected status.",
      );
    }
  }
  if (bundle.project.active_assembly_run_id) {
    requireReference(
      assemblies,
      bundle.project.active_assembly_run_id,
      "project.active_assembly_run_id",
      "Assembly run",
    );
  }

  bundle.audio_assets.forEach((audio, index) => {
    requireReference(artifacts, audio.artifact_id, `audio_assets.${index}.artifact_id`, "Artifact");
  });
  bundle.artifacts.forEach((artifact, index) => {
    if (artifact.provenance.provider_run_id) {
      requireReference(
        providerRuns,
        artifact.provenance.provider_run_id,
        `artifacts.${index}.provenance.provider_run_id`,
        "Provider run",
      );
    }
    artifact.provenance.parent_artifact_ids.forEach((artifactId, parentIndex) => {
      requireReference(
        artifacts,
        artifactId,
        `artifacts.${index}.provenance.parent_artifact_ids.${parentIndex}`,
        "Parent artifact",
      );
    });
  });
  bundle.music_analyses.forEach((analysis, index) => {
    requireReference(
      audioAssets,
      analysis.audio_asset_id,
      `music_analyses.${index}.audio_asset_id`,
      "Audio asset",
    );
  });
  bundle.music_analysis_revisions.forEach((revision, index) => {
    requireReference(
      analyses,
      revision.base_analysis_id,
      `music_analysis_revisions.${index}.base_analysis_id`,
      "Music analysis",
    );
    revision.event_decisions.forEach((decision, decisionIndex) => {
      if (!measuredEventIds.has(decision.event_id)) {
        issue(
          issues,
          "missing_reference",
          `music_analysis_revisions.${index}.event_decisions.${decisionIndex}.event_id`,
          `Measured event '${decision.event_id}' does not exist in the base analysis.`,
        );
      }
      if (
        (decision.decision === "shift") !==
        (decision.shifted_time_seconds !== null)
      ) {
        issue(
          issues,
          "project_reference_mismatch",
          `music_analysis_revisions.${index}.event_decisions.${decisionIndex}.shifted_time_seconds`,
          "A shifted time is required only when the event decision is 'shift'.",
        );
      }
    });
  });
  bundle.music_readings.forEach((reading, index) => {
    requireReference(
      analysisRevisions,
      reading.based_on_analysis_revision_id,
      `music_readings.${index}.based_on_analysis_revision_id`,
      "Music analysis revision",
    );
    reading.sections.forEach((section, sectionIndex) => {
      section.evidence_event_ids.forEach((eventId, eventIndex) => {
        if (!measuredEventIds.has(eventId)) {
          issue(
            issues,
            "missing_reference",
            `music_readings.${index}.sections.${sectionIndex}.evidence_event_ids.${eventIndex}`,
            `Measured event '${eventId}' does not exist.`,
          );
        }
      });
    });
  });
  bundle.director_treatments.forEach((treatment, index) => {
    requireReference(
      readings,
      treatment.music_reading_id,
      `director_treatments.${index}.music_reading_id`,
      "Music reading",
    );
  });
  bundle.film_bibles.forEach((bible, index) => {
    requireReference(
      treatments,
      bible.treatment_id,
      `film_bibles.${index}.treatment_id`,
      "Director treatment",
    );
  });
  bundle.audiovisual_contracts.forEach((contract, index) => {
    requireReference(
      readings,
      contract.music_reading_id,
      `audiovisual_contracts.${index}.music_reading_id`,
      "Music reading",
    );
    requireReference(
      filmBibles,
      contract.film_bible_id,
      `audiovisual_contracts.${index}.film_bible_id`,
      "Film bible",
    );
  });
  bundle.visual_states.forEach((state, index) => {
    requireReference(
      filmBibles,
      state.film_bible_id,
      `visual_states.${index}.film_bible_id`,
      "Film bible",
    );
    state.reference_artifact_ids.forEach((artifactId, referenceIndex) => {
      requireReference(
        artifacts,
        artifactId,
        `visual_states.${index}.reference_artifact_ids.${referenceIndex}`,
        "Artifact",
      );
    });
  });
  bundle.visual_score_segments.forEach((segment, index) => {
    requireReference(
      contracts,
      segment.audiovisual_contract_id,
      `visual_score_segments.${index}.audiovisual_contract_id`,
      "Audiovisual contract",
    );
    segment.visual_state_ids.forEach((stateId, stateIndex) => {
      requireReference(
        visualStates,
        stateId,
        `visual_score_segments.${index}.visual_state_ids.${stateIndex}`,
        "Visual state",
      );
    });
  });
  bundle.shot_specs.forEach((shot, index) => {
    shot.visual_score_segment_ids.forEach((segmentId, segmentIndex) => {
      requireReference(
        scoreSegments,
        segmentId,
        `shot_specs.${index}.visual_score_segment_ids.${segmentIndex}`,
        "Visual score segment",
      );
    });
    for (const [field, stateId] of [
      ["start_visual_state_id", shot.start_visual_state_id],
      ["end_visual_state_id", shot.end_visual_state_id],
    ] as const) {
      requireReference(visualStates, stateId, `shot_specs.${index}.${field}`, "Visual state");
      const visualState = visualStates.get(stateId);
      if (
        shot.status !== "draft" &&
        visualState &&
        visualState.status === "candidate"
      ) {
        issue(
          issues,
          "visual_state_not_approved",
          `shot_specs.${index}.${field}`,
          `Production shot '${shot.id}' may only reference approved or locked visual states.`,
        );
      }
    }
    shot.references.forEach((reference, referenceIndex) => {
      requireReference(
        artifacts,
        reference.artifact_id,
        `shot_specs.${index}.references.${referenceIndex}.artifact_id`,
        "Artifact",
      );
    });
  });
  bundle.takes.forEach((take, index) => {
    requireReference(shots, take.shot_spec_id, `takes.${index}.shot_spec_id`, "Shot spec");
    requireReference(artifacts, take.artifact_id, `takes.${index}.artifact_id`, "Artifact");
    take.reference_versions.forEach((reference, referenceIndex) => {
      requireReference(
        artifacts,
        reference.artifact_id,
        `takes.${index}.reference_versions.${referenceIndex}.artifact_id`,
        "Artifact",
      );
    });
  });
  bundle.review_reports.forEach((review, index) => {
    requireReference(takes, review.take_id, `review_reports.${index}.take_id`, "Take");
  });
  bundle.repair_plans.forEach((repair, index) => {
    requireReference(takes, repair.take_id, `repair_plans.${index}.take_id`, "Take");
    requireReference(
      reviews,
      repair.review_report_id,
      `repair_plans.${index}.review_report_id`,
      "Review report",
    );
    const review = reviews.get(repair.review_report_id);
    const evidenceIds = new Set(review?.evidence.map((evidence) => evidence.id));
    repair.evidence_ids.forEach((evidenceId, evidenceIndex) => {
      if (!evidenceIds.has(evidenceId)) {
        issue(
          issues,
          "missing_reference",
          `repair_plans.${index}.evidence_ids.${evidenceIndex}`,
          `Review evidence '${evidenceId}' does not exist in the linked report.`,
        );
      }
    });
  });
  bundle.provider_runs.forEach((run, index) => {
    requireReference(shots, run.shot_spec_id, `provider_runs.${index}.shot_spec_id`, "Shot spec");
    run.output_artifact_ids.forEach((artifactId, artifactIndex) => {
      requireReference(
        artifacts,
        artifactId,
        `provider_runs.${index}.output_artifact_ids.${artifactIndex}`,
        "Artifact",
      );
    });
    if (!providerIds.has(run.provider)) {
      issue(
        issues,
        "missing_reference",
        `provider_runs.${index}.provider`,
        `Provider capability '${run.provider}' does not exist in this project bundle.`,
      );
    }
  });
  bundle.provider_capabilities.forEach((capability, index) => {
    if (capability.duration_seconds.minimum > capability.duration_seconds.maximum) {
      issue(
        issues,
        "invalid_time_range",
        `provider_capabilities.${index}.duration_seconds`,
        "Provider minimum duration cannot exceed its maximum duration.",
      );
    }
    if (
      capability.estimated_cost_usd &&
      capability.estimated_cost_usd.minimum > capability.estimated_cost_usd.maximum
    ) {
      issue(
        issues,
        "project_reference_mismatch",
        `provider_capabilities.${index}.estimated_cost_usd`,
        "Provider minimum cost cannot exceed its maximum cost.",
      );
    }
  });
  bundle.decisions.forEach((decision, index) => {
    const targets: Record<typeof decision.target_type, ReadonlyMap<string, unknown>> = {
      treatment: treatments,
      film_bible: filmBibles,
      visual_score: scoreSegments,
      visual_state: visualStates,
      shot: shots,
      take: takes,
      repair: repairs,
    };
    requireReference(
      targets[decision.target_type],
      decision.target_id,
      `decisions.${index}.target_id`,
      "Decision target",
    );
  });
  bundle.assembly_runs.forEach((assembly, index) => {
    requireReference(
      audioAssets,
      assembly.audio_asset_id,
      `assembly_runs.${index}.audio_asset_id`,
      "Audio asset",
    );
    requireReference(
      artifacts,
      assembly.output_artifact_id,
      `assembly_runs.${index}.output_artifact_id`,
      "Artifact",
    );
    assembly.clips.forEach((clip, clipIndex) => {
      requireReference(
        takes,
        clip.take_id,
        `assembly_runs.${index}.clips.${clipIndex}.take_id`,
        "Take",
      );
    });
  });

  requireReference(
    takes,
    bundle.demo_evidence.failed_take_id,
    "demo_evidence.failed_take_id",
    "Failed take",
  );
  requireReference(
    takes,
    bundle.demo_evidence.repaired_take_id,
    "demo_evidence.repaired_take_id",
    "Repaired take",
  );
  requireReference(
    decisions,
    bundle.demo_evidence.creative_mutation_decision_id,
    "demo_evidence.creative_mutation_decision_id",
    "Creative mutation decision",
  );
  requireReference(
    assemblies,
    bundle.demo_evidence.fallback_assembly_run_id,
    "demo_evidence.fallback_assembly_run_id",
    "Fallback assembly run",
  );
}

function validateTimeModel(bundle: ProjectBundle, issues: DomainValidationIssue[]) {
  const audio = bundle.audio_assets.find(
    (asset) => asset.id === bundle.project.selected_audio_asset_id,
  );
  if (!audio) return;

  const selectedRange = audio.selected_range;
  validateRange(
    issues,
    selectedRange,
    { start_seconds: 0, end_seconds: audio.duration_seconds },
    "audio_assets.selected_range",
  );
  if (!sameRange(bundle.project.selected_audio_range, selectedRange)) {
    issue(
      issues,
      "project_reference_mismatch",
      "project.selected_audio_range",
      "The project and selected audio asset must use the same selected range.",
    );
  }
  const selectedDuration = selectedRange.end_seconds - selectedRange.start_seconds;
  if (selectedDuration < 45 || selectedDuration > 75) {
    issue(
      issues,
      "selected_range_duration_invalid",
      "project.selected_audio_range",
      "The MVP selected audio range must be between 45 and 75 seconds.",
    );
  }
  if (!near(bundle.project.target_duration_seconds, selectedDuration)) {
    issue(
      issues,
      "project_reference_mismatch",
      "project.target_duration_seconds",
      "The target duration must match the selected audio range duration.",
    );
  }

  bundle.music_analyses.forEach((analysis, analysisIndex) => {
    validateRange(
      issues,
      analysis.analyzed_range,
      selectedRange,
      `music_analyses.${analysisIndex}.analyzed_range`,
    );
    for (const [field, timestamps] of [
      ["beats_seconds", analysis.beats_seconds],
      ["onsets_seconds", analysis.onsets_seconds],
    ] as const) {
      timestamps.forEach((timestamp, index) => {
        if (!containsTime(selectedRange, timestamp)) {
          issue(
            issues,
            "timestamp_out_of_range",
            `music_analyses.${analysisIndex}.${field}.${index}`,
            "Measured timestamps must stay inside the selected audio range.",
          );
        }
      });
    }
    for (const [field, points] of [
      ["waveform", analysis.waveform],
      ["energy_envelope", analysis.energy_envelope],
      ["events", analysis.events],
    ] as const) {
      points.forEach((point, index) => {
        if (!containsTime(selectedRange, point.time_seconds)) {
          issue(
            issues,
            "timestamp_out_of_range",
            `music_analyses.${analysisIndex}.${field}.${index}.time_seconds`,
            "Measured timestamps must stay inside the selected audio range.",
          );
        }
      });
    }
    validateOrderedRanges(
      issues,
      analysis.candidate_sections,
      selectedRange,
      `music_analyses.${analysisIndex}.candidate_sections`,
      {
        requireFullCoverage: false,
        notOrderedCode: "sections_not_ordered",
        overlapCode: "sections_overlap",
      },
    );
  });

  bundle.music_analysis_revisions.forEach((revision, index) => {
    validateRange(
      issues,
      revision.selected_range,
      selectedRange,
      `music_analysis_revisions.${index}.selected_range`,
    );
    validateOrderedRanges(
      issues,
      revision.sections,
      selectedRange,
      `music_analysis_revisions.${index}.sections`,
      {
        requireFullCoverage: false,
        notOrderedCode: "sections_not_ordered",
        overlapCode: "sections_overlap",
      },
    );
  });

  bundle.music_readings.forEach((reading, index) => {
    validateOrderedRanges(
      issues,
      reading.sections,
      selectedRange,
      `music_readings.${index}.sections`,
      {
        requireFullCoverage: false,
        notOrderedCode: "sections_not_ordered",
        overlapCode: "sections_overlap",
      },
    );
    reading.significant_events.forEach((event, eventIndex) => {
      if (!containsTime(selectedRange, event.time_seconds)) {
        issue(
          issues,
          "timestamp_out_of_range",
          `music_readings.${index}.significant_events.${eventIndex}.time_seconds`,
          "Interpreted events must stay inside the selected audio range.",
        );
      }
    });
    reading.intentional_non_events.forEach((event, eventIndex) => {
      validateRange(
        issues,
        event.range,
        selectedRange,
        `music_readings.${index}.intentional_non_events.${eventIndex}.range`,
      );
    });
  });

  bundle.director_treatments.forEach((treatment, index) => {
    treatment.narrative_path.forEach((beat, beatIndex) => {
      validateRange(
        issues,
        beat.range,
        selectedRange,
        `director_treatments.${index}.narrative_path.${beatIndex}.range`,
      );
    });
  });

  validateOrderedRanges(
    issues,
    bundle.visual_score_segments,
    selectedRange,
    "visual_score_segments",
    {
      requireFullCoverage: true,
      notOrderedCode: "visual_score_not_ordered",
      overlapCode: "visual_score_overlap",
      gapCode: "visual_score_gap",
    },
  );

  const scoreById = new Map(
    bundle.visual_score_segments.map((segment) => [segment.id, segment]),
  );
  bundle.shot_specs.forEach((shot, index) => {
    validateRange(issues, shot.range, selectedRange, `shot_specs.${index}.range`);
    const mappedSegments = shot.visual_score_segment_ids
      .map((segmentId) => scoreById.get(segmentId))
      .filter((segment) => segment !== undefined);
    const mappedRanges = mappedSegments
      .filter((segment) => rangesIntersect(segment.range, shot.range))
      .map((segment) => segment.range)
      .toSorted((left, right) => left.start_seconds - right.start_seconds);
    let coveredUntil = shot.range.start_seconds;
    for (const range of mappedRanges) {
      if (range.start_seconds > coveredUntil + TIME_TOLERANCE_SECONDS) break;
      coveredUntil = Math.max(coveredUntil, range.end_seconds);
      if (coveredUntil >= shot.range.end_seconds - TIME_TOLERANCE_SECONDS) break;
    }
    if (coveredUntil < shot.range.end_seconds - TIME_TOLERANCE_SECONDS) {
      issue(
        issues,
        "shot_not_covered_by_score",
        `shot_specs.${index}.visual_score_segment_ids`,
        `Shot '${shot.id}' must be fully covered by its referenced Visual Score segments.`,
      );
    }
  });

  bundle.visual_score_segments.forEach((segment, index) => {
    segment.music_evidence.forEach((evidence, evidenceIndex) => {
      if (!containsTime(segment.range, evidence.time_seconds)) {
        issue(
          issues,
          "timestamp_out_of_range",
          `visual_score_segments.${index}.music_evidence.${evidenceIndex}.time_seconds`,
          "Visual Score evidence must fall inside its segment range.",
        );
      }
    });
  });

  const shotsById = new Map(bundle.shot_specs.map((shot) => [shot.id, shot]));
  bundle.review_reports.forEach((review, reviewIndex) => {
    const take = bundle.takes.find((candidate) => candidate.id === review.take_id);
    const shot = take ? shotsById.get(take.shot_spec_id) : undefined;
    if (!shot) return;
    if (
      review.failure_classes.includes("accept") &&
      review.failure_classes.length > 1
    ) {
      issue(
        issues,
        "project_reference_mismatch",
        `review_reports.${reviewIndex}.failure_classes`,
        "An accepted review cannot also contain a failure class.",
      );
    }
    review.evidence.forEach((evidence, evidenceIndex) => {
      if (!containsRange(shot.range, evidence.range)) {
        issue(
          issues,
          "timestamp_out_of_range",
          `review_reports.${reviewIndex}.evidence.${evidenceIndex}.range`,
          "Review evidence must remain inside the reviewed shot range.",
        );
      }
    });
  });

  const takes = new Map(bundle.takes.map((take) => [take.id, take]));
  const timingTolerance =
    bundle.audiovisual_contracts[0]?.timing_tolerance_seconds ?? TIME_TOLERANCE_SECONDS;
  bundle.assembly_runs.forEach((assembly, index) => {
    if (!sameRange(assembly.selected_range, selectedRange)) {
      issue(
        issues,
        "project_reference_mismatch",
        `assembly_runs.${index}.selected_range`,
        "Assembly must use the project's selected audio range.",
      );
    }
    validateOrderedRanges(
      issues,
      assembly.clips.map((clip) => ({ range: clip.timeline_range })),
      selectedRange,
      `assembly_runs.${index}.clips`,
      {
        requireFullCoverage: true,
        notOrderedCode: "sections_not_ordered",
        overlapCode: "assembly_overlap",
        gapCode: "assembly_gap",
      },
    );
    assembly.clips.forEach((clip, clipIndex) => {
      const take = takes.get(clip.take_id);
      if (take && !take.locked) {
        issue(
          issues,
          "assembly_uses_unlocked_take",
          `assembly_runs.${index}.clips.${clipIndex}.take_id`,
          `Assembly may only use locked takes; '${take.id}' is not locked.`,
        );
      }
    });
    const expectedDuration = selectedRange.end_seconds - selectedRange.start_seconds;
    if (
      Math.abs(assembly.validation.output_duration_seconds - expectedDuration) >
        timingTolerance ||
      Math.abs(assembly.validation.expected_duration_seconds - expectedDuration) >
        TIME_TOLERANCE_SECONDS ||
      Math.abs(assembly.validation.drift_seconds) > timingTolerance
    ) {
      issue(
        issues,
        "assembly_duration_drift",
        `assembly_runs.${index}.validation`,
        "Assembly duration drift exceeds the approved audiovisual timing tolerance.",
      );
    }
  });
}

function validateDemoEvidence(bundle: ProjectBundle, issues: DomainValidationIssue[]) {
  const treatments = new Set(
    bundle.director_treatments.map((treatment) => treatment.structural_strategy),
  );
  if (treatments.size !== bundle.director_treatments.length) {
    issue(
      issues,
      "treatments_not_structurally_distinct",
      "director_treatments",
      "Each Director Treatment must use a materially distinct structural strategy.",
    );
  }
  if (
    new Set(bundle.visual_score_segments.map((segment) => segment.relationship_mode)).size < 2
  ) {
    issue(
      issues,
      "insufficient_relationship_modes",
      "visual_score_segments",
      "The Visual Score must use at least two distinct audiovisual relationship modes.",
    );
  }

  const failedTake = bundle.takes.find((take) => take.id === bundle.demo_evidence.failed_take_id);
  const failedReview = bundle.review_reports.find((review) => review.take_id === failedTake?.id);
  if (!failedTake || !failedReview || failedReview.failure_classes.includes("accept")) {
    issue(
      issues,
      "demo_evidence_invalid",
      "demo_evidence.failed_take_id",
      "The failed demo take must have a non-accept ReviewReport.",
    );
  }

  const repairedTake = bundle.takes.find(
    (take) => take.id === bundle.demo_evidence.repaired_take_id,
  );
  if (!repairedTake || !repairedTake.locked) {
    issue(
      issues,
      "demo_evidence_invalid",
      "demo_evidence.repaired_take_id",
      "The repaired demo take must exist and be locked.",
    );
  }

  const mutationDecision = bundle.decisions.find(
    (decision) => decision.id === bundle.demo_evidence.creative_mutation_decision_id,
  );
  if (!mutationDecision || mutationDecision.decision !== "creative_mutation") {
    issue(
      issues,
      "demo_evidence_invalid",
      "demo_evidence.creative_mutation_decision_id",
      "The mutation evidence must reference a Creative Mutation decision.",
    );
  }

  const fallbackAssembly = bundle.assembly_runs.find(
    (assembly) => assembly.id === bundle.demo_evidence.fallback_assembly_run_id,
  );
  if (!fallbackAssembly || fallbackAssembly.status !== "validated") {
    issue(
      issues,
      "demo_evidence_invalid",
      "demo_evidence.fallback_assembly_run_id",
      "The fallback assembly must exist and be validated.",
    );
  }
}

function validateParsedProjectBundle(bundle: ProjectBundle): DomainValidationIssue[] {
  const issues: DomainValidationIssue[] = [];
  validateUniqueIds(bundle, issues);
  validateProjectOwnership(bundle, issues);
  validateReferences(bundle, issues);
  validateTimeModel(bundle, issues);
  validateDemoEvidence(bundle, issues);
  return issues;
}

export function validateProjectBundle(input: unknown): ProjectValidationResult {
  const parsed = ProjectBundleSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      issues: parsed.error.issues.map(zodIssueToDomainIssue),
    };
  }

  const issues = validateParsedProjectBundle(parsed.data);
  if (issues.length > 0) {
    return { success: false, issues };
  }
  return { success: true, data: parsed.data, issues: [] };
}

export function parseProjectBundle(input: unknown): ProjectBundle {
  const result = validateProjectBundle(input);
  if (!result.success) {
    throw new DomainValidationError(result.issues);
  }
  return result.data;
}
