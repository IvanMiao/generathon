import type { ProjectBundle } from "@/lib/domain/project";
import type { RelationshipMode } from "@/lib/domain/enums";
import type { MusicAnalysis } from "@/lib/domain/music";
import {
  formatDomainLabel,
  formatTimeRange,
  formatTimestamp,
} from "@/components/score-room/score-room-format";
import {
  compileProviderGenerationTask,
  evaluateGenerationEligibility,
} from "@/lib/application/generation";
import { demoReviewWorkflowState } from "@/lib/application/workflow/project-workflow";

const relationshipCopy: Record<
  RelationshipMode,
  { label: string; description: string }
> = {
  mirror: {
    label: "Mirror",
    description: "Image follows the direction and timing of the music.",
  },
  counterpoint: {
    label: "Counterpoint",
    description: "Image deliberately resists the musical movement.",
  },
  suspension: {
    label: "Suspension",
    description: "Image holds through change or answers after a delay.",
  },
  motif_binding: {
    label: "Motif binding",
    description: "A recurring sound remains bound to one visual motif.",
  },
};

function mustFind<T>(
  values: readonly T[],
  predicate: (value: T) => boolean,
  label: string,
): T {
  const value = values.find(predicate);

  if (!value) {
    throw new Error(`Score Room fixture is missing ${label}.`);
  }

  return value;
}

export { formatDomainLabel, formatTimeRange, formatTimestamp };

export function createScoreRoomProjection(
  bundle: ProjectBundle,
  measuredAnalysisOverride?: MusicAnalysis,
) {
  const { project } = bundle;
  const audio = mustFind(
    bundle.audio_assets,
    (candidate) => candidate.id === project.selected_audio_asset_id,
    "the selected audio asset",
  );
  const recordedAnalysis = mustFind(
    bundle.music_analyses,
    (candidate) => candidate.audio_asset_id === audio.id,
    "a measured music analysis",
  );
  const analysis = measuredAnalysisOverride ?? recordedAnalysis;
  if (analysis.audio_asset_id !== audio.id) {
    throw new Error("Measured MusicAnalysis does not belong to the selected audio asset.");
  }
  const analysisRevision = mustFind(
    bundle.music_analysis_revisions,
    (candidate) => candidate.base_analysis_id === recordedAnalysis.id,
    "the active analysis revision",
  );
  const reading = mustFind(
    bundle.music_readings,
    (candidate) =>
      candidate.based_on_analysis_revision_id === analysisRevision.id,
    "the interpreted music reading",
  );
  const selectedTreatment = mustFind(
    bundle.director_treatments,
    (candidate) => candidate.id === project.active_treatment_id,
    "the active director treatment",
  );
  const filmBible = mustFind(
    bundle.film_bibles,
    (candidate) => candidate.treatment_id === selectedTreatment.id,
    "the selected treatment's Film Bible",
  );
  const audiovisualContract = mustFind(
    bundle.audiovisual_contracts,
    (candidate) =>
      candidate.film_bible_id === filmBible.id &&
      candidate.music_reading_id === reading.id,
    "the approved audiovisual contract",
  );

  const selectedRange = project.selected_audio_range;
  const duration = selectedRange.end_seconds - selectedRange.start_seconds;
  const analysisRange = analysis.analyzed_range;
  const analysisDuration =
    analysisRange.end_seconds - analysisRange.start_seconds;
  if (
    analysisRange.start_seconds > selectedRange.start_seconds + 0.001 ||
    analysisRange.end_seconds < selectedRange.end_seconds - 0.001
  ) {
    throw new Error("Measured MusicAnalysis does not contain the selected project range.");
  }
  const visualStateById = new Map(
    bundle.visual_states.map((state) => [state.id, state]),
  );
  const artifactById = new Map(
    bundle.artifacts.map((artifact) => [artifact.id, artifact]),
  );

  const scoreSegments = bundle.visual_score_segments
    .filter(
      (segment) => segment.audiovisual_contract_id === audiovisualContract.id,
    )
    .toSorted((left, right) => left.range.start_seconds - right.range.start_seconds)
    .map((segment, index) => {
      const relationship = relationshipCopy[segment.relationship_mode];

      return {
        id: segment.id,
        revision: segment.revision,
        number: String(index + 1).padStart(2, "0"),
        range: segment.range,
        rangeLabel: formatTimeRange(segment.range),
        durationSeconds: segment.range.end_seconds - segment.range.start_seconds,
        relationshipMode: segment.relationship_mode,
        relationshipLabel: relationship.label,
        relationshipDescription: relationship.description,
        narrativeState: segment.narrative_state,
        visualStateDescription: segment.visual_state_description,
        transitionStrategy: segment.transition_strategy,
        confidencePercent: Math.round(segment.confidence * 100),
        musicEvidence: segment.music_evidence.map((evidence) => ({
          ...evidence,
          kindLabel: formatDomainLabel(evidence.kind),
          timeLabel: formatTimestamp(evidence.time_seconds),
        })),
        visualStates: segment.visual_state_ids.map((stateId) => {
          const state = visualStateById.get(stateId);
          if (!state) {
            throw new Error(
              `Score Room fixture is missing visual state ${stateId}.`,
            );
          }
          return { id: state.id, name: state.name };
        }),
      };
    });

  const maximumEnergy = Math.max(
    ...analysis.energy_envelope.map((point) => point.value),
    Number.EPSILON,
  );
  const energyPoints = analysis.energy_envelope.map((point) => ({
    x:
      ((point.time_seconds - analysisRange.start_seconds) / analysisDuration) *
      1000,
    y: 88 - (point.value / maximumEnergy) * 72,
  }));
  const energyPolyline = energyPoints
    .map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(" ");
  const energyAreaPath = energyPoints.length
    ? `M 0 88 L ${energyPoints.map((point) => `${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" L ")} L 1000 88 Z`
    : "";
  const maximumWaveform = Math.max(
    ...analysis.waveform.map((point) => Math.abs(point.value)),
    Number.EPSILON,
  );
  const waveformPoints = analysis.waveform.map((point) => ({
    x:
      ((point.time_seconds - analysisRange.start_seconds) / analysisDuration) *
      1000,
    amplitude: (Math.abs(point.value) / maximumWaveform) * 36,
  }));
  const waveformAreaPath = waveformPoints.length
    ? [
        `M ${waveformPoints[0].x.toFixed(2)} ${(48 - waveformPoints[0].amplitude).toFixed(2)}`,
        ...waveformPoints
          .slice(1)
          .map(
            (point) =>
              `L ${point.x.toFixed(2)} ${(48 - point.amplitude).toFixed(2)}`,
          ),
        ...waveformPoints
          .toReversed()
          .map(
            (point) =>
              `L ${point.x.toFixed(2)} ${(48 + point.amplitude).toFixed(2)}`,
          ),
        "Z",
      ].join(" ")
    : "";
  const onsetBinCount = 96;
  const onsetBins = Array.from({ length: onsetBinCount }, () => 0);
  analysis.onsets_seconds.forEach((timeSeconds) => {
    const normalized =
      (timeSeconds - analysisRange.start_seconds) / analysisDuration;
    const index = Math.min(
      onsetBinCount - 1,
      Math.max(0, Math.floor(normalized * onsetBinCount)),
    );
    onsetBins[index] += 1;
  });
  const maximumOnsetDensity = Math.max(...onsetBins, 1);
  const onsetDensity = onsetBins.map((count, index) => ({
    positionPercent: ((index + 0.5) / onsetBinCount) * 100,
    intensity: count / maximumOnsetDensity,
  }));

  const manualTakeCountByShotId = new Map<string, number>();
  const reviewableManualTakesByShotId = new Map<
    string,
    Array<{
      id: string;
      status: "candidate" | "needs_decision" | "locked";
      statusLabel: string;
      locked: boolean;
      revision: number;
      mediaSrc: string;
      sha256: string;
      review: {
        id: string;
        status: string;
        accepted: boolean;
        summary: string;
      } | null;
    }>
  >();
  for (const take of bundle.takes) {
    if (take.source !== "manual") continue;
    manualTakeCountByShotId.set(
      take.shot_spec_id,
      (manualTakeCountByShotId.get(take.shot_spec_id) ?? 0) + 1,
    );
    if (
      take.status !== "candidate" &&
      take.status !== "needs_decision" &&
      take.status !== "locked"
    ) {
      continue;
    }
    const artifact = artifactById.get(take.artifact_id);
    if (!artifact || artifact.kind !== "video" || artifact.mime_type !== "video/mp4") {
      continue;
    }
    const review = bundle.review_reports
      .toReversed()
      .find((report) => report.take_id === take.id);
    const takes = reviewableManualTakesByShotId.get(take.shot_spec_id) ?? [];
    takes.push({
      id: take.id,
      status: take.status,
      statusLabel: formatDomainLabel(take.status),
      locked: take.locked,
      revision: take.revision,
      mediaSrc: `/api/projects/${encodeURIComponent(project.id)}/takes/${encodeURIComponent(take.id)}/media`,
      sha256: artifact.sha256,
      review: review
        ? {
            id: review.id,
            status: formatDomainLabel(review.status),
            accepted:
              review.failure_classes.length === 1 &&
              review.failure_classes[0] === "accept",
            summary: review.summary,
          }
        : null,
    });
    reviewableManualTakesByShotId.set(take.shot_spec_id, takes);
  }

  const shots = bundle.shot_specs
    .toSorted((left, right) => left.range.start_seconds - right.range.start_seconds)
    .map((shot, index) => {
      const startState = visualStateById.get(shot.start_visual_state_id);
      const endState = visualStateById.get(shot.end_visual_state_id);

      if (!startState || !endState) {
        throw new Error(`Score Room fixture has an unresolved state for ${shot.id}.`);
      }

      return {
        id: shot.id,
        number: String(index + 1).padStart(2, "0"),
        title: `Shot ${String(index + 1).padStart(2, "0")}`,
        status: shot.status,
        statusLabel: formatDomainLabel(shot.status),
        visualScoreSegmentIds: shot.visual_score_segment_ids,
        range: shot.range,
        rangeLabel: formatTimeRange(shot.range),
        musicalFunction: shot.musical_function,
        narrativeFunction: shot.narrative_function,
        visualFunction: shot.visual_function,
        startState: { id: startState.id, name: startState.name },
        endState: { id: endState.id, name: endState.name },
        camera: shot.camera,
        action: shot.action,
        transition: shot.transition,
        preferredProvider: shot.provider_strategy.preferred_provider
          ? formatDomainLabel(shot.provider_strategy.preferred_provider)
          : "Manual / deterministic",
        acceptanceCriteria: shot.acceptance_criteria,
        manualTakeCount: manualTakeCountByShotId.get(shot.id) ?? 0,
        manualTakes: reviewableManualTakesByShotId.get(shot.id) ?? [],
      };
    });

  const failedTake = mustFind(
    bundle.takes,
    (take) => take.id === bundle.demo_evidence.failed_take_id,
    "the failed demo take",
  );
  const repairedTake = mustFind(
    bundle.takes,
    (take) => take.id === bundle.demo_evidence.repaired_take_id,
    "the repaired demo take",
  );
  const failedReview = mustFind(
    bundle.review_reports,
    (review) => review.take_id === failedTake.id,
    "the failed take review",
  );
  const repairedReview = mustFind(
    bundle.review_reports,
    (review) => review.take_id === repairedTake.id,
    "the repaired take review",
  );
  const repairPlan = mustFind(
    bundle.repair_plans,
    (plan) => plan.take_id === failedTake.id,
    "the timing repair plan",
  );
  const repairDecision = mustFind(
    bundle.decisions,
    (decision) => decision.target_id === repairPlan.id,
    "the repair decision",
  );
  const failedShot = mustFind(
    bundle.shot_specs,
    (shot) => shot.id === failedTake.shot_spec_id,
    "the failed take ShotSpec",
  );
  const geminiCapabilities = mustFind(
    bundle.provider_capabilities,
    (capabilities) => capabilities.provider === "gemini",
    "Gemini provider capabilities",
  );
  const generationTask = compileProviderGenerationTask({
    provider: "gemini",
    shotSpec: failedShot,
    filmBible,
    visualStates: bundle.visual_states,
    visualScoreSegments: bundle.visual_score_segments,
    providerCapabilities: geminiCapabilities,
    aspectRatio: project.aspect_ratio,
  });
  const usedVideoCalls = bundle.provider_runs.filter(
    (run) => run.operation === "video_generation",
  ).length;
  const generationEligibility = evaluateGenerationEligibility({
    filmBible,
    visualScoreStatus: audiovisualContract.status,
    visualScoreSegments: bundle.visual_score_segments,
    visualStates: bundle.visual_states,
    shotSpec: failedShot,
    task: generationTask,
    promptReview: {
      reviewed: true,
      promptFileSha256: generationTask.prompt_sha256,
      finalCutCandidateConfirmed: true,
    },
    quota: {
      dailyLimit: project.daily_video_generation_limit,
      used: usedVideoCalls,
      reserved: 0,
    },
  });

  function projectEvidence(evidence: (typeof failedReview.evidence)[number]) {
    return {
      id: evidence.id,
      rangeLabel: formatTimeRange(evidence.range),
      dimensionLabel: formatDomainLabel(evidence.dimension),
      finding: evidence.finding,
      confidencePercent: Math.round(evidence.confidence * 100),
      sourceLabel: formatDomainLabel(evidence.source),
    };
  }

  const activeAssembly = mustFind(
    bundle.assembly_runs,
    (assembly) => assembly.id === project.active_assembly_run_id,
    "the active assembly",
  );

  return {
    fixture: {
      id: bundle.fixture_id,
      schemaVersion: bundle.fixture_schema_version,
      description: bundle.fixture_description,
    },
    project: {
      id: project.id,
      revision: project.revision,
      title: project.title,
      creationMode: project.creation_mode,
      creationModeLabel: formatDomainLabel(project.creation_mode),
      creativeState: project.creative_state,
      creativeStateLabel: formatDomainLabel(project.creative_state),
      selectedRange,
      selectedRangeLabel: formatTimeRange(selectedRange),
      durationSeconds: duration,
      durationLabel: `${duration.toFixed(3)} seconds`,
      audioDurationSeconds: audio.duration_seconds,
      audioDurationLabel: `${audio.duration_seconds.toFixed(3)} seconds`,
      audioTitle: audio.working_title,
      aspectRatio: project.aspect_ratio,
      rightsCleared: audio.public_demo_permission,
    },
    measuredMusic: {
      kind: "measured" as const,
      analysisId: analysis.id,
      source: `${analysis.method.engine} ${analysis.method.engine_version}`,
      sourceDescription: measuredAnalysisOverride
        ? "Measured locally from the complete ElevenLabs score"
        : "Deterministic recorded fixture fallback — run npm run demo:analyze",
      isRuntimeMeasurement: Boolean(measuredAnalysisOverride),
      analyzedRangeLabel: formatTimeRange(analysis.analyzed_range),
      analyzedDurationSeconds: analysisDuration,
      selectedRangeLabel: formatTimeRange(selectedRange),
      selectedStartPercent:
        ((selectedRange.start_seconds - analysisRange.start_seconds) /
          analysisDuration) *
        100,
      selectedWidthPercent: (duration / analysisDuration) * 100,
      tempoLabel: `${analysis.tempo_bpm.toFixed(1)} BPM`,
      spectralCentroidLabel: `${Math.round(analysis.spectral_centroid_mean_hz).toLocaleString("en-US")} Hz`,
      confidencePercent: Math.round(analysis.confidence * 100),
      waveformAreaPath,
      energyPolyline,
      energyAreaPath,
      beatPositions: analysis.beats_seconds.map(
        (timeSeconds) =>
          ((timeSeconds - analysisRange.start_seconds) / analysisDuration) *
          100,
      ),
      onsetDensity,
      counts: {
        waveform: analysis.waveform.length,
        energy: analysis.energy_envelope.length,
        beats: analysis.beats_seconds.length,
        onsets: analysis.onsets_seconds.length,
        sections: analysis.candidate_sections.length,
        events: analysis.events.length,
      },
      sections: analysis.candidate_sections.map((section) => {
        const startPercent =
          ((section.range.start_seconds - analysisRange.start_seconds) /
            analysisDuration) *
          100;
        const endPercent =
          ((section.range.end_seconds - analysisRange.start_seconds) /
            analysisDuration) *
          100;
        return {
          id: section.id,
          label: section.label,
          rangeLabel: formatTimeRange(section.range),
          confidencePercent: Math.round(section.confidence * 100),
          startPercent,
          widthPercent: endPercent - startPercent,
        };
      }),
      events: analysis.events.map((event) => ({
        id: event.id,
        kind: event.kind,
        kindLabel: formatDomainLabel(event.kind),
        timeLabel: formatTimestamp(event.time_seconds),
        strengthPercent: Math.round(event.strength * 100),
        confidencePercent: Math.round(event.confidence * 100),
        positionPercent:
          ((event.time_seconds - analysisRange.start_seconds) /
            analysisDuration) *
          100,
      })),
      notableEvents: analysis.events
        .toSorted((left, right) => right.strength - left.strength)
        .slice(0, 12)
        .toSorted((left, right) => left.time_seconds - right.time_seconds)
        .map((event) => ({
          id: event.id,
          kind: event.kind,
          kindLabel: formatDomainLabel(event.kind),
          timeLabel: formatTimestamp(event.time_seconds),
          strengthPercent: Math.round(event.strength * 100),
        })),
    },
    analysisRevision: {
      id: analysisRevision.id,
      revision: analysisRevision.revision,
      note: analysisRevision.note,
      selectedRangeLabel: formatTimeRange(analysisRevision.selected_range),
      sections: analysisRevision.sections.map((section) => ({
        id: section.id,
        label: section.label,
        startSeconds: section.range.start_seconds,
        endSeconds: section.range.end_seconds,
        rangeLabel: formatTimeRange(section.range),
        source: section.source,
        sourceLabel: formatDomainLabel(section.source),
      })),
    },
    interpretedMusic: {
      kind: "interpreted" as const,
      readingId: reading.id,
      source: "Approved Music Reading",
      sourceDescription: "Editable directorial interpretation",
      status: reading.status,
      statusLabel: formatDomainLabel(reading.status),
      summary: reading.summary,
      emotionalArc: reading.emotional_arc,
      recurrenceMotifs: reading.recurrence_motifs,
      assumptions: reading.assumptions,
      sections: reading.sections.map((section) => ({
        id: section.id,
        label: section.label,
        rangeLabel: formatTimeRange(section.range),
        structuralRole: section.structural_role,
        tension: section.tension,
        tensionLabel: formatDomainLabel(section.tension),
        narrativePossibility: section.narrative_possibility,
        confidencePercent: Math.round(section.confidence * 100),
      })),
      intentionalNonEvents: reading.intentional_non_events.map((event) => ({
        rangeLabel: formatTimeRange(event.range),
        rationale: event.rationale,
      })),
    },
    treatments: bundle.director_treatments
      .filter((treatment) => treatment.music_reading_id === reading.id)
      .map((treatment) => ({
        id: treatment.id,
        title: treatment.title,
        status: treatment.status,
        statusLabel: formatDomainLabel(treatment.status),
        selected: treatment.id === selectedTreatment.id,
        proposition: treatment.proposition,
        structuralStrategy: treatment.structural_strategy,
        narrativePath: treatment.narrative_path.map((beat) => ({
          id: beat.id,
          rangeLabel: formatTimeRange(beat.range),
          description: beat.description,
        })),
        visualWorld: treatment.visual_world,
        musicInterpretation: treatment.music_interpretation,
        rationale: treatment.rationale,
        risks: treatment.directorial_risks,
      })),
    selectedTreatment: {
      id: selectedTreatment.id,
      title: selectedTreatment.title,
    },
    directionSelection: {
      activeFilmBibleStatus: filmBible.status,
      canReselect: filmBible.status !== "locked",
      lockedMessage:
        filmBible.status === "locked"
          ? "The active Film Bible is locked, so this completed cut remains a protected preview only."
          : "Selecting an alternative clears the active assembly and requires a new Film Bible before production continues.",
    },
    filmBible: {
      id: filmBible.id,
      status: filmBible.status,
      statusLabel: formatDomainLabel(filmBible.status),
      isLocked: filmBible.status === "locked",
      theme: filmBible.theme,
      worldOntology: filmBible.world_ontology,
      materials: filmBible.materials,
      palette: filmBible.palette,
      lightRules: filmBible.light_rules,
      cameraRules: filmBible.camera_rules,
      transformationRules: filmBible.transformation_rules,
      montageRules: filmBible.montage_rules,
      invariants: filmBible.invariants,
      forbiddenElements: filmBible.forbidden_elements,
    },
    audiovisualContract: {
      id: audiovisualContract.id,
      status: audiovisualContract.status,
      statusLabel: formatDomainLabel(audiovisualContract.status),
      timingToleranceLabel: `±${audiovisualContract.timing_tolerance_seconds.toFixed(2)} s`,
      principles: audiovisualContract.principles.map((principle) => ({
        id: principle.id,
        relationshipMode: principle.relationship_mode,
        relationshipLabel: relationshipCopy[principle.relationship_mode].label,
        appliesTo: principle.applies_to,
        rationale: principle.rationale,
      })),
      forbiddenRelationships: audiovisualContract.forbidden_relationships,
    },
    visualStates: bundle.visual_states.map((state, index) => {
      const reference = state.reference_artifact_ids
        .map((id) => artifactById.get(id))
        .find((artifact) => artifact?.kind === "image");
      if (!reference) {
        throw new Error(
          `Score Room fixture is missing an image reference for visual state ${state.id}.`,
        );
      }
      if (!reference.relative_path.startsWith("public/")) {
        throw new Error(
          `Visual State reference ${reference.id} must be served from public/.`,
        );
      }

      return {
        id: state.id,
        number: String(index + 1).padStart(2, "0"),
        status: state.status,
        statusLabel: formatDomainLabel(state.status),
        name: state.name,
        worldState: state.world_state,
        subjectState: state.subject_state,
        composition: state.composition,
        material: state.material,
        light: state.light,
        camera: state.camera,
        imageSrc: `/${reference.relative_path.slice("public/".length)}`,
        imageAlt: `${state.name}: ${state.composition}`,
        referenceSha256: reference.sha256,
        referenceSource: formatDomainLabel(reference.provenance.source),
      };
    }),
    scoreSegments,
    timelineColumns: scoreSegments
      .map((segment) => `${segment.durationSeconds.toFixed(3)}fr`)
      .join(" "),
    shots,
    reviewDemo: {
      workflowState: demoReviewWorkflowState(bundle),
      failedTakeId: failedTake.id,
      repairedTakeId: repairedTake.id,
      failedSummary: failedReview.summary,
      repairedSummary: repairedReview.summary,
      failedEvidence: failedReview.evidence.map(projectEvidence),
      repairedEvidence: repairedReview.evidence.map(projectEvidence),
      repairLayerLabel: formatDomainLabel(repairPlan.selected_layer),
      repairOperation: repairPlan.operation,
      preservedFields: repairPlan.preserved_fields,
      decisionLabel: formatDomainLabel(repairDecision.decision),
      generationEligible: generationEligibility.eligible,
      generationIssues: generationEligibility.issues,
      compiledPromptCharacters: generationTask.prompt.length,
      compiledPromptSha256: generationTask.prompt_sha256,
      quotaLimit: project.daily_video_generation_limit,
      quotaRemaining: project.daily_video_generation_limit - usedVideoCalls,
    },
    provenance: {
      audioSource: audio.source,
      audioRightsCleared: audio.public_demo_permission,
      analysisEngine: `${analysis.method.engine} ${analysis.method.engine_version}`,
      directionSource: "Recorded fixture compiler",
      promptSha256: generationTask.prompt_sha256,
      recordedProviderRuns: bundle.provider_runs.length,
      assemblyStatus: formatDomainLabel(activeAssembly.status),
      assemblyDriftLabel: `${activeAssembly.validation.drift_seconds.toFixed(3)} s`,
    },
  };
}

export type ScoreRoomProjection = ReturnType<typeof createScoreRoomProjection>;
