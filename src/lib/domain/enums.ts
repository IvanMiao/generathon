import * as z from "zod";

export const CONTRACT_SCHEMA_VERSION = "1.0.0" as const;
export const FIXTURE_SCHEMA_VERSION = "1.0.0" as const;

export const CreationModeSchema = z.enum(["listen_first", "direct_first"]);
export const RelationshipModeSchema = z.enum([
  "mirror",
  "counterpoint",
  "suspension",
  "motif_binding",
]);
export const ReviewDimensionSchema = z.enum([
  "mechanical",
  "musical",
  "narrative",
  "visual",
  "creative",
]);
export const FailureClassSchema = z.enum([
  "mechanical_fail",
  "timing_fail",
  "relationship_fail",
  "narrative_fail",
  "visual_drift",
  "continuity_fail",
  "capability_fail",
  "low_confidence_human_review",
  "creative_mutation_candidate",
  "accept",
]);
export const DecisionKindSchema = z.enum([
  "accept",
  "editorial_repair",
  "regenerate",
  "split",
  "use_fallback",
  "creative_mutation",
  "reject",
  "human_review",
]);
export const ProjectCreativeStateSchema = z.enum([
  "draft",
  "audio_analyzed",
  "music_reading_ready",
  "treatment_selected",
  "direction_locked",
  "score_approved",
  "in_production",
  "rough_cut",
  "final_locked",
]);
export const ApprovalStatusSchema = z.enum(["draft", "approved", "locked"]);
export const CandidateStatusSchema = z.enum(["candidate", "selected", "rejected"]);
export const VisualStateStatusSchema = z.enum(["candidate", "approved", "locked"]);
export const ShotStatusSchema = z.enum([
  "draft",
  "ready",
  "generating",
  "waiting_for_manual_generation",
  "reviewing",
  "needs_decision",
  "locked",
  "repairing",
  "split",
  "fallback",
  "removed",
]);
export const ArtifactKindSchema = z.enum([
  "audio",
  "image",
  "video",
  "contact_sheet",
  "proxy",
  "export",
  "manifest",
]);
export const ProviderIdSchema = z.enum([
  "gemini",
  "openai",
  "open_weight_on_modal",
]);
export const ProviderOperationSchema = z.enum([
  "structured_text",
  "image_generation",
  "video_generation",
  "video_review",
  "audio_to_video",
  "image_to_video",
  "keyframe_interpolation",
  "retake",
]);
export const ProviderRunStatusSchema = z.enum([
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);
export const LifecycleStatusSchema = z.enum([
  "primary",
  "transition_only",
  "deployment_pending",
]);
export const TakeStatusSchema = z.enum([
  "candidate",
  "reviewing",
  "needs_decision",
  "locked",
  "rejected",
  "fallback",
  "creative_mutation",
]);
export const ReviewStatusSchema = z.enum(["pending", "complete", "human_review"]);
export const RepairStatusSchema = z.enum([
  "proposed",
  "approved",
  "applied",
  "rejected",
]);
export const AssemblyStatusSchema = z.enum([
  "draft",
  "assembling",
  "validated",
  "failed",
]);
export const ReferenceControlSchema = z.enum([
  "style",
  "subject",
  "material",
  "composition",
  "motion",
  "start_state",
  "end_state",
]);
export const RepairLayerSchema = z.enum([
  "metadata",
  "editorial_timing",
  "visual_state",
  "camera",
  "action",
  "material",
  "transformation",
  "provider",
  "visual_score",
]);
export const ActorSchema = z.enum(["human", "agent"]);

export type CreationMode = z.infer<typeof CreationModeSchema>;
export type RelationshipMode = z.infer<typeof RelationshipModeSchema>;
export type ReviewDimension = z.infer<typeof ReviewDimensionSchema>;
export type FailureClass = z.infer<typeof FailureClassSchema>;
export type DecisionKind = z.infer<typeof DecisionKindSchema>;
export type ProviderId = z.infer<typeof ProviderIdSchema>;
