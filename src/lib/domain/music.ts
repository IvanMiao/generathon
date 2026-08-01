import * as z from "zod";
import { ApprovalStatusSchema } from "@/lib/domain/enums";
import {
  ConfidenceSchema,
  IdSchema,
  NonEmptyStringSchema,
  SecondsSchema,
  Sha256Schema,
  TimeRangeSchema,
  VersionedRecordFields,
} from "@/lib/domain/shared";

export const AudioAssetSchema = z.strictObject({
  ...VersionedRecordFields,
  artifact_id: IdSchema,
  working_title: NonEmptyStringSchema,
  sha256: Sha256Schema,
  duration_seconds: SecondsSchema.positive(),
  format: NonEmptyStringSchema,
  sample_rate_hz: z.number().int().positive(),
  channels: z.number().int().positive(),
  selected_range: TimeRangeSchema,
  source: NonEmptyStringSchema,
  rights_declaration: NonEmptyStringSchema,
  public_demo_permission: z.boolean(),
});

const SignalPointSchema = z.strictObject({
  time_seconds: SecondsSchema,
  value: z.number().finite(),
});

const CandidateSectionSchema = z.strictObject({
  id: IdSchema,
  range: TimeRangeSchema,
  label: NonEmptyStringSchema,
  confidence: ConfidenceSchema,
});

const MeasuredEventSchema = z.strictObject({
  id: IdSchema,
  time_seconds: SecondsSchema,
  kind: z.enum(["beat", "onset", "energy_peak", "spectral_change", "boundary"]),
  strength: z.number().finite(),
  confidence: ConfidenceSchema,
});

export const MusicAnalysisSchema = z.strictObject({
  ...VersionedRecordFields,
  audio_asset_id: IdSchema,
  method: z.strictObject({
    engine: NonEmptyStringSchema,
    engine_version: NonEmptyStringSchema,
    parameters_hash: Sha256Schema,
  }),
  analyzed_range: TimeRangeSchema,
  waveform: z.array(SignalPointSchema).min(2),
  energy_envelope: z.array(SignalPointSchema).min(2),
  tempo_bpm: z.number().positive(),
  beats_seconds: z.array(SecondsSchema),
  onsets_seconds: z.array(SecondsSchema),
  spectral_centroid_mean_hz: z.number().nonnegative(),
  candidate_sections: z.array(CandidateSectionSchema).min(1),
  events: z.array(MeasuredEventSchema),
  confidence: ConfidenceSchema,
});

const RevisedSectionSchema = z.strictObject({
  id: IdSchema,
  range: TimeRangeSchema,
  label: NonEmptyStringSchema,
  source: z.enum(["measured", "user"]),
});

const EventDecisionSchema = z.strictObject({
  event_id: IdSchema,
  decision: z.enum(["keep", "suppress", "shift"]),
  shifted_time_seconds: SecondsSchema.nullable(),
  rationale: NonEmptyStringSchema,
});

export const MusicAnalysisRevisionSchema = z.strictObject({
  ...VersionedRecordFields,
  base_analysis_id: IdSchema,
  selected_range: TimeRangeSchema,
  sections: z.array(RevisedSectionSchema).min(1),
  event_decisions: z.array(EventDecisionSchema),
  note: NonEmptyStringSchema,
});

const ReadingSectionSchema = z.strictObject({
  id: IdSchema,
  range: TimeRangeSchema,
  label: NonEmptyStringSchema,
  structural_role: NonEmptyStringSchema,
  tension: z.enum(["low", "rising", "high", "releasing", "suspended"]),
  narrative_possibility: NonEmptyStringSchema,
  evidence_event_ids: z.array(IdSchema),
  confidence: ConfidenceSchema,
});

const IntentionalNonEventSchema = z.strictObject({
  range: TimeRangeSchema,
  rationale: NonEmptyStringSchema,
});

export const MusicReadingSchema = z.strictObject({
  ...VersionedRecordFields,
  based_on_analysis_revision_id: IdSchema,
  status: ApprovalStatusSchema,
  summary: NonEmptyStringSchema,
  emotional_arc: NonEmptyStringSchema,
  recurrence_motifs: z.array(NonEmptyStringSchema).min(1),
  sections: z.array(ReadingSectionSchema).min(1),
  significant_events: z.array(
    z.strictObject({
      time_seconds: SecondsSchema,
      interpretation: NonEmptyStringSchema,
      evidence_event_ids: z.array(IdSchema),
      confidence: ConfidenceSchema,
    }),
  ),
  intentional_non_events: z.array(IntentionalNonEventSchema),
  assumptions: z.array(NonEmptyStringSchema),
});

export type AudioAsset = z.infer<typeof AudioAssetSchema>;
export type MusicAnalysis = z.infer<typeof MusicAnalysisSchema>;
export type MusicAnalysisRevision = z.infer<typeof MusicAnalysisRevisionSchema>;
export type MusicReading = z.infer<typeof MusicReadingSchema>;
