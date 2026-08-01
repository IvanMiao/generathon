import * as z from "zod";
import {
  CreationModeSchema,
  FIXTURE_SCHEMA_VERSION,
  ProjectCreativeStateSchema,
} from "@/lib/domain/enums";
import {
  AudiovisualContractSchema,
  DirectorTreatmentSchema,
  FilmBibleSchema,
  ShotSpecSchema,
  VisualScoreSegmentSchema,
  VisualStateSchema,
} from "@/lib/domain/direction";
import {
  AudioAssetSchema,
  MusicAnalysisRevisionSchema,
  MusicAnalysisSchema,
  MusicReadingSchema,
} from "@/lib/domain/music";
import {
  ArtifactSchema,
  AssemblyRunSchema,
  DecisionSchema,
  ProviderCapabilitiesSchema,
  ProviderRunSchema,
  RepairPlanSchema,
  ReviewReportSchema,
  TakeSchema,
} from "@/lib/domain/production";
import {
  IdSchema,
  NonEmptyStringSchema,
  TimeRangeSchema,
  VersionedRecordFields,
} from "@/lib/domain/shared";

export const ProjectSchema = z.strictObject({
  ...VersionedRecordFields,
  title: NonEmptyStringSchema,
  creation_mode: CreationModeSchema,
  creative_state: ProjectCreativeStateSchema,
  selected_audio_asset_id: IdSchema,
  selected_audio_range: TimeRangeSchema,
  aspect_ratio: z.literal("16:9"),
  target_duration_seconds: z.number().positive(),
  daily_video_generation_limit: z.number().int().positive().max(10),
  active_treatment_id: IdSchema.nullable(),
  active_assembly_run_id: IdSchema.nullable(),
});

export const ProjectBundleSchema = z.strictObject({
  fixture_schema_version: z.literal(FIXTURE_SCHEMA_VERSION),
  fixture_id: IdSchema,
  fixture_description: NonEmptyStringSchema,
  project: ProjectSchema,
  artifacts: z.array(ArtifactSchema).min(1),
  audio_assets: z.array(AudioAssetSchema).min(1),
  music_analyses: z.array(MusicAnalysisSchema).min(1),
  music_analysis_revisions: z.array(MusicAnalysisRevisionSchema).min(1),
  music_readings: z.array(MusicReadingSchema).min(1),
  director_treatments: z.array(DirectorTreatmentSchema).min(2),
  film_bibles: z.array(FilmBibleSchema).min(1),
  audiovisual_contracts: z.array(AudiovisualContractSchema).min(1),
  visual_states: z.array(VisualStateSchema).min(3),
  visual_score_segments: z.array(VisualScoreSegmentSchema).min(5).max(7),
  shot_specs: z.array(ShotSpecSchema).min(5).max(7),
  takes: z.array(TakeSchema).min(1),
  review_reports: z.array(ReviewReportSchema),
  repair_plans: z.array(RepairPlanSchema),
  decisions: z.array(DecisionSchema),
  provider_capabilities: z.array(ProviderCapabilitiesSchema).min(1),
  provider_runs: z.array(ProviderRunSchema),
  assembly_runs: z.array(AssemblyRunSchema).min(1),
  demo_evidence: z.strictObject({
    failed_take_id: IdSchema,
    repaired_take_id: IdSchema,
    creative_mutation_decision_id: IdSchema,
    fallback_assembly_run_id: IdSchema,
  }),
}).meta({
  title: "Generathon ProjectBundle v1",
  description: "Frozen score-to-cinema control-plane and worker-boundary contract.",
});

export type Project = z.infer<typeof ProjectSchema>;
export type ProjectBundle = z.infer<typeof ProjectBundleSchema>;
