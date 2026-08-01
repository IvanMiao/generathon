import { createHash } from "node:crypto";
import {
  FilmBibleSchema,
  ShotSpecSchema,
  VisualScoreSegmentSchema,
  VisualStateSchema,
  type FilmBible,
  type ShotSpec,
  type VisualScoreSegment,
  type VisualState,
} from "@/lib/domain/direction";
import type { ProviderId } from "@/lib/domain/enums";
import {
  ProviderCapabilitiesSchema,
  type ProviderCapabilities,
} from "@/lib/domain/production";
import type { TimeRange } from "@/lib/domain/shared";

export const MINIMUM_COMPLEX_PROMPT_CHARACTERS = 600;
export const REQUIRED_PROMPT_SECTIONS = [
  "SHOT INTENT",
  "VISUAL CONTINUITY",
  "TIME-CODED ACTION",
  "CAMERA",
  "LIGHT AND COLOR",
  "MATERIAL AND PHYSICS",
  "EXCLUSIONS",
  "EDITORIAL USE",
] as const;

export type RequiredPromptSection = (typeof REQUIRED_PROMPT_SECTIONS)[number];

interface SharedProviderPayload {
  prompt: string;
  duration_seconds: number;
  reference_artifact_ids: string[];
}

export type ProviderGenerationPayload =
  | (SharedProviderPayload & {
      provider: "gemini";
      response_format: { type: "video"; aspect_ratio: "16:9" };
    })
  | (SharedProviderPayload & {
      provider: "openai";
      seconds: number;
      size: "1280x720";
      input_reference_artifact_id: string | null;
    })
  | (SharedProviderPayload & {
      provider: "open_weight_on_modal";
      operation: "image_to_video" | "keyframe_interpolation";
      start_reference_artifact_id: string;
      end_reference_artifact_id: string;
      resolution: "1280x720";
    });

export interface ProviderGenerationTask {
  task_version: "1.0.0";
  provider: ProviderId;
  operation:
    | "video_generation"
    | "image_to_video"
    | "keyframe_interpolation";
  shot_spec_id: string;
  prompt: string;
  prompt_sha256: string;
  duration_seconds: number;
  aspect_ratio: "16:9";
  intended_score_range: TimeRange;
  visual_score_segment_ids: string[];
  start_visual_state_id: string;
  end_visual_state_id: string;
  reference_artifact_ids: string[];
  expected_filename: string;
  import_target: { shot_spec_id: string };
  payload: ProviderGenerationPayload;
}

export interface CompileProviderGenerationTaskInput {
  provider: ProviderId;
  shotSpec: ShotSpec;
  filmBible: FilmBible;
  visualStates: VisualState[];
  visualScoreSegments: VisualScoreSegment[];
  providerCapabilities?: ProviderCapabilities;
  aspectRatio: "16:9";
  editorial?: {
    previousShotId?: string | null;
    nextShotId?: string | null;
    usableHandleSeconds?: number;
    minimumSpeed?: number;
    maximumSpeed?: number;
  };
}

export type GenerationTaskCompilationErrorCode =
  | "generation_capabilities_missing"
  | "generation_capabilities_mismatch"
  | "generation_operation_unsupported"
  | "generation_duration_unsupported"
  | "generation_references_unsupported"
  | "generation_direction_relationship_invalid"
  | "generation_score_segment_missing"
  | "generation_visual_state_missing";

export class GenerationTaskCompilationError extends Error {
  readonly code: GenerationTaskCompilationErrorCode;

  constructor(code: GenerationTaskCompilationErrorCode, message: string) {
    super(message);
    this.name = "GenerationTaskCompilationError";
    this.code = code;
  }
}

export function sha256Text(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function seconds(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, "");
}

function rangeLabel(range: TimeRange) {
  return `${seconds(range.start_seconds)}–${seconds(range.end_seconds)}s`;
}

function sentenceList(values: string[]) {
  return values.length > 0 ? values.join("; ") : "None specified.";
}

function section(title: RequiredPromptSection, body: string) {
  return `# ${title}\n\n${body.trim()}`;
}

function compilePrompt(input: {
  shot: ShotSpec;
  bible: FilmBible;
  startState: VisualState;
  endState: VisualState;
  score: VisualScoreSegment[];
  editorial: NonNullable<CompileProviderGenerationTaskInput["editorial"]>;
}) {
  const { shot, bible, startState, endState, score, editorial } = input;
  const duration = shot.range.end_seconds - shot.range.start_seconds;
  const firstPhaseEnd = Math.min(2, duration * 0.25);
  const mainPhaseEnd = Math.max(firstPhaseEnd, duration * 0.8);
  const relationshipDescription = score
    .map(
      (segment) =>
        `${rangeLabel(segment.range)} uses ${segment.relationship_mode}: ${segment.transition_strategy}`,
    )
    .join(" ");
  const evidenceDescription = score
    .flatMap((segment) => segment.music_evidence)
    .map(
      (evidence) =>
        `${seconds(evidence.time_seconds)}s ${evidence.kind} (${evidence.description})`,
    )
    .join("; ");
  const handleSeconds = editorial.usableHandleSeconds ?? 0.5;
  const minimumSpeed = editorial.minimumSpeed ?? 0.95;
  const maximumSpeed = editorial.maximumSpeed ?? 1.05;

  return [
    section(
      "SHOT INTENT",
      `Final-cut candidate ${shot.id} occupies the exact master-score range ${rangeLabel(shot.range)}. Musical function: ${shot.musical_function} Narrative function: ${shot.narrative_function} Visual function: ${shot.visual_function} ${relationshipDescription} This motion belongs here because the approved action—${shot.action}—performs those functions without turning the score into beat-by-beat animation.`,
    ),
    section(
      "VISUAL CONTINUITY",
      `Bind the approved start state “${startState.name}”: ${startState.world_state} ${startState.subject_state} Composition: ${startState.composition} End in the approved state “${endState.name}”: ${endState.world_state} ${endState.subject_state} Composition: ${endState.composition} The world remains: ${bible.world_ontology} Keep the recurring subjects and objects unchanged: ${sentenceList([...bible.subjects, ...bible.objects])} Preserve the Film Bible invariants: ${sentenceList(bible.invariants)} Maintain stable scale, spatial logic, material identity, palette, texture, and continuity into adjacent shots.`,
    ),
    section(
      "TIME-CODED ACTION",
      `[0–${seconds(firstPhaseEnd)}s] Establish the exact start state with stable geometry and enough clean frames for an editorial in-handle. [${seconds(firstPhaseEnd)}–${seconds(mainPhaseEnd)}s] Perform one primary action only: ${shot.action} The environment may respond only through the approved transition strategy: ${shot.transition} [${seconds(mainPhaseEnd)}–${seconds(duration)}s] Settle completely into the exact end state and preserve a usable out-handle. Approved musical evidence is ${evidenceDescription}; treat it as an editorial alignment marker, never as permission to add competing events or generated audio.`,
    ),
    section(
      "CAMERA",
      `Shot camera instruction: ${shot.camera} Begin from the approved camera state: ${startState.camera} End at: ${endState.camera} Obey every Film Bible camera rule: ${sentenceList(bible.camera_rules)} Use one unbroken, stabilized shot at the established almost-human camera height and distance, with restrained rectilinear lens character, controlled acceleration, stable focus behavior, coherent depth of field, and no unmotivated reframing. Camera motion supports the ${score.map((segment) => segment.relationship_mode).join(" / ")} relationship and must not mechanically mirror each beat.`,
    ),
    section(
      "LIGHT AND COLOR",
      `Start lighting: ${startState.light} End lighting: ${endState.light} Preserve the motivated Film Bible sources: ${sentenceList(bible.light_rules)} Dominant palette: ${sentenceList(bible.palette.dominant)} Accent allocation: ${sentenceList(bible.palette.accent)} Forbidden colors: ${sentenceList(bible.palette.forbidden)} Keep controlled exposure, soft highlight roll-off, readable shadow detail, restrained contrast, and consistent volumetric conditions. Any color transition must arise only from the stated end-state light and must not introduce a second visual event.`,
    ),
    section(
      "MATERIAL AND PHYSICS",
      `Start material at macro and micro scale: ${startState.material} End material: ${endState.material} The only approved material vocabulary is ${sentenceList(bible.materials)} Preserve contact, weight, inertia, surface texture, translucency, and atmospheric continuity. Transformation laws: ${sentenceList(bible.transformation_rules)} Motion priority: ${shot.provider_strategy.motion_priority} Any physically impossible behavior is intentional only where named by those rules; it must remain internally consistent, materially continuous, and free of arbitrary particles or geometry drift.`,
    ),
    section(
      "EXCLUSIONS",
      `Exclude every Film Bible prohibition: ${sentenceList([...bible.forbidden_elements, ...bible.palette.forbidden])} Also exclude people or faces unless explicitly present, readable typography, logos, dialogue, generated music, extra subjects, collage, generic cyberpunk ornament, arbitrary space imagery, excessive motion, scene cuts, unstable geometry, material drift, camera shake, style changes, flicker, morphing details, mechanical door parts, and decorative particles. Do not violate these acceptance criteria: ${sentenceList(shot.acceptance_criteria)}`,
    ),
    section(
      "EDITORIAL USE",
      `This output is expected to enter the final-cut candidate pool at master range ${rangeLabel(shot.range)}. Supply at least ${seconds(handleSeconds)}s of stable usable in/out handles. Native generated audio must be discarded; the untouched source score is restored only during deterministic assembly. Allowed correction is limited to trim, hold, or speed between ${minimumSpeed.toFixed(2)}× and ${maximumSpeed.toFixed(2)}×. Previous shot: ${editorial.previousShotId ?? "project opening"}. Next shot: ${editorial.nextShotId ?? "project ending"}. Intended transition: ${shot.transition} If the result cannot satisfy the locked direction, use this fallback without broadening the prompt: ${shot.provider_strategy.fallback_strategy}`,
    ),
  ].join("\n\n");
}

function operationFor(
  provider: ProviderId,
  startStateId: string,
  endStateId: string,
): ProviderGenerationTask["operation"] {
  if (provider !== "open_weight_on_modal") return "video_generation";
  return startStateId === endStateId
    ? "image_to_video"
    : "keyframe_interpolation";
}

function buildPayload(
  provider: ProviderId,
  operation: ProviderGenerationTask["operation"],
  prompt: string,
  duration: number,
  references: string[],
  startReference: string,
  endReference: string,
): ProviderGenerationPayload {
  const shared = {
    prompt,
    duration_seconds: duration,
    reference_artifact_ids: references,
  };
  if (provider === "gemini") {
    return {
      ...shared,
      provider,
      response_format: { type: "video", aspect_ratio: "16:9" },
    };
  }
  if (provider === "openai") {
    return {
      ...shared,
      provider,
      seconds: duration,
      size: "1280x720",
      input_reference_artifact_id: references[0] ?? null,
    };
  }
  if (operation === "video_generation") {
    throw new GenerationTaskCompilationError(
      "generation_operation_unsupported",
      "The Modal task requires image-to-video or keyframe-interpolation input.",
    );
  }
  return {
    ...shared,
    provider,
    operation,
    start_reference_artifact_id: startReference,
    end_reference_artifact_id: endReference,
    resolution: "1280x720",
  };
}

export function compileProviderGenerationTask(
  input: CompileProviderGenerationTaskInput,
): ProviderGenerationTask {
  const shot = ShotSpecSchema.parse(input.shotSpec);
  const bible = FilmBibleSchema.parse(input.filmBible);
  const states = VisualStateSchema.array().parse(input.visualStates);
  const score = VisualScoreSegmentSchema.array().parse(input.visualScoreSegments);
  if (!input.providerCapabilities) {
    throw new GenerationTaskCompilationError(
      "generation_capabilities_missing",
      `Checked provider capabilities are required before compiling a ${input.provider} task.`,
    );
  }
  const capabilities = ProviderCapabilitiesSchema.parse(
    input.providerCapabilities,
  );
  if (capabilities.provider !== input.provider) {
    throw new GenerationTaskCompilationError(
      "generation_capabilities_mismatch",
      "The checked provider capabilities do not match the requested provider.",
    );
  }

  const startState = states.find(
    (state) => state.id === shot.start_visual_state_id,
  );
  const endState = states.find((state) => state.id === shot.end_visual_state_id);
  if (!startState || !endState) {
    throw new GenerationTaskCompilationError(
      "generation_visual_state_missing",
      "The ShotSpec start and end Visual States must both be available before task compilation.",
    );
  }
  if (
    startState.film_bible_id !== bible.id ||
    endState.film_bible_id !== bible.id
  ) {
    throw new GenerationTaskCompilationError(
      "generation_direction_relationship_invalid",
      "The ShotSpec Visual States must belong to the supplied Film Bible.",
    );
  }

  const relatedScore = shot.visual_score_segment_ids.map((segmentId) =>
    score.find((segment) => segment.id === segmentId),
  );
  if (relatedScore.some((segment) => segment === undefined)) {
    throw new GenerationTaskCompilationError(
      "generation_score_segment_missing",
      "Every Visual Score segment referenced by the ShotSpec is required for task compilation.",
    );
  }
  const validatedScore = relatedScore as VisualScoreSegment[];
  const operation = operationFor(
    input.provider,
    startState.id,
    endState.id,
  );
  if (!capabilities.supported_operations.includes(operation)) {
    throw new GenerationTaskCompilationError(
      "generation_operation_unsupported",
      `The checked ${input.provider} capabilities do not support ${operation}.`,
    );
  }

  const duration = shot.range.end_seconds - shot.range.start_seconds;
  if (
    duration < capabilities.duration_seconds.minimum ||
    duration > capabilities.duration_seconds.maximum
  ) {
    throw new GenerationTaskCompilationError(
      "generation_duration_unsupported",
      `The ${seconds(duration)}s ShotSpec duration is outside the checked provider range.`,
    );
  }

  const references = [
    ...new Set([
      ...shot.references.map((reference) => reference.artifact_id),
      ...startState.reference_artifact_ids,
      ...endState.reference_artifact_ids,
    ]),
  ];
  if (references.length > capabilities.maximum_reference_images) {
    throw new GenerationTaskCompilationError(
      "generation_references_unsupported",
      `The task requires ${references.length} image references but the checked provider accepts at most ${capabilities.maximum_reference_images}.`,
    );
  }

  const prompt = compilePrompt({
    shot,
    bible,
    startState,
    endState,
    score: validatedScore,
    editorial: input.editorial ?? {},
  });
  const promptSha256 = sha256Text(prompt);
  const safeShotId = shot.id.replaceAll(/[^a-zA-Z0-9_-]/g, "-");
  const payload = buildPayload(
    input.provider,
    operation,
    prompt,
    duration,
    references,
    startState.reference_artifact_ids[0],
    endState.reference_artifact_ids[0],
  );

  return {
    task_version: "1.0.0",
    provider: input.provider,
    operation,
    shot_spec_id: shot.id,
    prompt,
    prompt_sha256: promptSha256,
    duration_seconds: duration,
    aspect_ratio: input.aspectRatio,
    intended_score_range: { ...shot.range },
    visual_score_segment_ids: [...shot.visual_score_segment_ids],
    start_visual_state_id: startState.id,
    end_visual_state_id: endState.id,
    reference_artifact_ids: references,
    expected_filename: `${safeShotId}-${input.provider}-r${shot.revision}.mp4`,
    import_target: { shot_spec_id: shot.id },
    payload,
  };
}
