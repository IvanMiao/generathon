import * as z from "zod";
import {
  ActorSchema,
  ArtifactKindSchema,
  AssemblyStatusSchema,
  DecisionKindSchema,
  FailureClassSchema,
  LifecycleStatusSchema,
  ProviderIdSchema,
  ProviderOperationSchema,
  ProviderRunStatusSchema,
  RepairLayerSchema,
  RepairStatusSchema,
  ReviewDimensionSchema,
  ReviewStatusSchema,
  TakeStatusSchema,
} from "@/lib/domain/enums";
import {
  ConfidenceSchema,
  IdSchema,
  IsoDateTimeSchema,
  NonEmptyStringSchema,
  SecondsSchema,
  Sha256Schema,
  TimeRangeSchema,
  VersionedRecordFields,
} from "@/lib/domain/shared";

export const ArtifactSchema = z.strictObject({
  ...VersionedRecordFields,
  kind: ArtifactKindSchema,
  relative_path: NonEmptyStringSchema,
  sha256: Sha256Schema,
  mime_type: NonEmptyStringSchema,
  provenance: z.strictObject({
    source: z.enum(["import", "local_process", "provider", "assembly"]),
    provider_run_id: IdSchema.nullable(),
    parent_artifact_ids: z.array(IdSchema),
  }),
});

export const TakeSchema = z.strictObject({
  ...VersionedRecordFields,
  shot_spec_id: IdSchema,
  artifact_id: IdSchema,
  source: z.enum(["manual", "generated", "editorial_repair", "fallback"]),
  provider: ProviderIdSchema.nullable(),
  prompt_version: NonEmptyStringSchema.nullable(),
  reference_versions: z.array(
    z.strictObject({
      artifact_id: IdSchema,
      revision: z.number().int().positive(),
    }),
  ),
  generation_settings: z.record(z.string(), z.json()),
  cost_usd: z.number().nonnegative(),
  status: TakeStatusSchema,
  locked: z.boolean(),
});

export const EvidenceSchema = z.strictObject({
  id: IdSchema,
  dimension: ReviewDimensionSchema,
  range: TimeRangeSchema,
  finding: NonEmptyStringSchema,
  source: z.enum(["local_measurement", "gemini", "human"]),
  confidence: ConfidenceSchema,
});

export const ReviewReportSchema = z.strictObject({
  ...VersionedRecordFields,
  take_id: IdSchema,
  status: ReviewStatusSchema,
  failure_classes: z.array(FailureClassSchema).min(1),
  evidence: z.array(EvidenceSchema).min(1),
  summary: NonEmptyStringSchema,
});

export const RepairPlanSchema = z.strictObject({
  ...VersionedRecordFields,
  take_id: IdSchema,
  review_report_id: IdSchema,
  selected_layer: RepairLayerSchema,
  operation: NonEmptyStringSchema,
  proposed_patch: NonEmptyStringSchema,
  preserved_fields: z.array(NonEmptyStringSchema).min(1),
  expected_effect: NonEmptyStringSchema,
  evidence_ids: z.array(IdSchema).min(1),
  estimated_cost_usd: z.number().nonnegative(),
  status: RepairStatusSchema,
});

export const DecisionSchema = z.strictObject({
  ...VersionedRecordFields,
  target_type: z.enum(["treatment", "film_bible", "visual_score", "visual_state", "shot", "take", "repair"]),
  target_id: IdSchema,
  decision: DecisionKindSchema,
  reason: NonEmptyStringSchema,
  actor: ActorSchema,
  decided_at: IsoDateTimeSchema,
});

export const ProviderCapabilitiesSchema = z.strictObject({
  ...VersionedRecordFields,
  provider: ProviderIdSchema,
  lifecycle_status: LifecycleStatusSchema,
  supported_operations: z.array(ProviderOperationSchema).min(1),
  duration_seconds: z.strictObject({
    minimum: SecondsSchema,
    maximum: SecondsSchema,
  }),
  reference_inputs: z.array(z.enum(["text", "image", "video", "audio"])),
  maximum_reference_images: z.number().int().nonnegative(),
  supports_first_last_frames: z.boolean(),
  supports_editing: z.boolean(),
  supports_extension: z.boolean(),
  supports_audio_output: z.boolean(),
  resolutions: z.array(NonEmptyStringSchema).min(1),
  estimated_cost_usd: z.strictObject({
    minimum: z.number().nonnegative(),
    maximum: z.number().nonnegative(),
  }).nullable(),
});

export const ProviderRunSchema = z.strictObject({
  ...VersionedRecordFields,
  shot_spec_id: IdSchema,
  provider: ProviderIdSchema,
  model: NonEmptyStringSchema,
  model_version: NonEmptyStringSchema,
  operation: ProviderOperationSchema,
  status: ProviderRunStatusSchema,
  external_id: z.string().nullable(),
  submitted_at: IsoDateTimeSchema.nullable(),
  completed_at: IsoDateTimeSchema.nullable(),
  cost_usd: z.number().nonnegative(),
  failure_class: FailureClassSchema.nullable(),
  output_artifact_ids: z.array(IdSchema),
  prompt_sha256: Sha256Schema,
});

const TimelineOperationSchema = z.strictObject({
  kind: z.enum(["trim", "hold", "cut", "speed", "transition"]),
  value: z.number().finite(),
  rationale: NonEmptyStringSchema,
});

export const AssemblyRunSchema = z.strictObject({
  ...VersionedRecordFields,
  audio_asset_id: IdSchema,
  selected_range: TimeRangeSchema,
  clips: z.array(
    z.strictObject({
      take_id: IdSchema,
      timeline_range: TimeRangeSchema,
      source_range: TimeRangeSchema,
      operations: z.array(TimelineOperationSchema),
    }),
  ).min(1),
  output_artifact_id: IdSchema,
  validation: z.strictObject({
    output_duration_seconds: SecondsSchema,
    expected_duration_seconds: SecondsSchema,
    drift_seconds: z.number().finite(),
    audio_present: z.boolean(),
    codec: NonEmptyStringSchema,
    black_frame_ratio: z.number().min(0).max(1),
    frozen_frame_ratio: z.number().min(0).max(1),
  }),
  status: AssemblyStatusSchema,
});

export type Artifact = z.infer<typeof ArtifactSchema>;
export type Take = z.infer<typeof TakeSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;
export type ReviewReport = z.infer<typeof ReviewReportSchema>;
export type RepairPlan = z.infer<typeof RepairPlanSchema>;
export type Decision = z.infer<typeof DecisionSchema>;
export type ProviderCapabilities = z.infer<typeof ProviderCapabilitiesSchema>;
export type ProviderRun = z.infer<typeof ProviderRunSchema>;
export type AssemblyRun = z.infer<typeof AssemblyRunSchema>;
