import * as z from "zod";
import {
  ApprovalStatusSchema,
  CandidateStatusSchema,
  ProviderIdSchema,
  ReferenceControlSchema,
  RelationshipModeSchema,
  ShotStatusSchema,
  VisualStateStatusSchema,
} from "@/lib/domain/enums";
import {
  ConfidenceSchema,
  IdSchema,
  NonEmptyStringSchema,
  TimeRangeSchema,
  VersionedRecordFields,
} from "@/lib/domain/shared";

export const DirectorTreatmentSchema = z.strictObject({
  ...VersionedRecordFields,
  music_reading_id: IdSchema,
  title: NonEmptyStringSchema,
  status: CandidateStatusSchema,
  proposition: NonEmptyStringSchema,
  structural_strategy: NonEmptyStringSchema,
  narrative_path: z.array(
    z.strictObject({
      id: IdSchema,
      range: TimeRangeSchema,
      description: NonEmptyStringSchema,
    }),
  ).min(2),
  visual_world: NonEmptyStringSchema,
  music_interpretation: NonEmptyStringSchema,
  directorial_risks: z.array(NonEmptyStringSchema).min(1),
  rationale: NonEmptyStringSchema,
});

export const FilmBibleSchema = z.strictObject({
  ...VersionedRecordFields,
  treatment_id: IdSchema,
  status: ApprovalStatusSchema,
  theme: NonEmptyStringSchema,
  world_ontology: NonEmptyStringSchema,
  subjects: z.array(NonEmptyStringSchema),
  objects: z.array(NonEmptyStringSchema).min(1),
  materials: z.array(NonEmptyStringSchema).min(1),
  palette: z.strictObject({
    dominant: z.array(NonEmptyStringSchema).min(1),
    accent: z.array(NonEmptyStringSchema),
    forbidden: z.array(NonEmptyStringSchema),
  }),
  light_rules: z.array(NonEmptyStringSchema).min(1),
  camera_rules: z.array(NonEmptyStringSchema).min(1),
  transformation_rules: z.array(NonEmptyStringSchema).min(1),
  montage_rules: z.array(NonEmptyStringSchema).min(1),
  invariants: z.array(NonEmptyStringSchema).min(1),
  forbidden_elements: z.array(NonEmptyStringSchema),
});

export const AudiovisualContractSchema = z.strictObject({
  ...VersionedRecordFields,
  music_reading_id: IdSchema,
  film_bible_id: IdSchema,
  status: ApprovalStatusSchema,
  principles: z.array(
    z.strictObject({
      id: IdSchema,
      relationship_mode: RelationshipModeSchema,
      applies_to: NonEmptyStringSchema,
      rationale: NonEmptyStringSchema,
    }),
  ).min(2),
  forbidden_relationships: z.array(NonEmptyStringSchema),
  timing_tolerance_seconds: z.number().positive().max(1),
});

const MusicEvidenceSchema = z.strictObject({
  kind: z.enum(["section", "event", "recurrence", "intentional_non_event"]),
  time_seconds: z.number().nonnegative(),
  description: NonEmptyStringSchema,
});

export const VisualScoreSegmentSchema = z.strictObject({
  ...VersionedRecordFields,
  audiovisual_contract_id: IdSchema,
  range: TimeRangeSchema,
  music_evidence: z.array(MusicEvidenceSchema).min(1),
  narrative_state: NonEmptyStringSchema,
  visual_state_description: NonEmptyStringSchema,
  relationship_mode: RelationshipModeSchema,
  transition_strategy: NonEmptyStringSchema,
  confidence: ConfidenceSchema,
  visual_state_ids: z.array(IdSchema).min(1),
});

export const VisualStateSchema = z.strictObject({
  ...VersionedRecordFields,
  film_bible_id: IdSchema,
  status: VisualStateStatusSchema,
  name: NonEmptyStringSchema,
  world_state: NonEmptyStringSchema,
  subject_state: NonEmptyStringSchema,
  composition: NonEmptyStringSchema,
  material: NonEmptyStringSchema,
  light: NonEmptyStringSchema,
  camera: NonEmptyStringSchema,
  reference_artifact_ids: z.array(IdSchema).min(1),
});

const ControlledReferenceSchema = z.strictObject({
  artifact_id: IdSchema,
  controls: z.array(ReferenceControlSchema).min(1),
});

export const ShotSpecSchema = z.strictObject({
  ...VersionedRecordFields,
  status: ShotStatusSchema,
  range: TimeRangeSchema,
  visual_score_segment_ids: z.array(IdSchema).min(1),
  musical_function: NonEmptyStringSchema,
  narrative_function: NonEmptyStringSchema,
  visual_function: NonEmptyStringSchema,
  start_visual_state_id: IdSchema,
  end_visual_state_id: IdSchema,
  camera: NonEmptyStringSchema,
  action: NonEmptyStringSchema,
  transition: NonEmptyStringSchema,
  references: z.array(ControlledReferenceSchema).min(1),
  provider_strategy: z.strictObject({
    preferred_provider: ProviderIdSchema.nullable(),
    fallback_strategy: NonEmptyStringSchema,
    motion_priority: NonEmptyStringSchema,
  }),
  acceptance_criteria: z.array(NonEmptyStringSchema).min(1),
});

export type DirectorTreatment = z.infer<typeof DirectorTreatmentSchema>;
export type FilmBible = z.infer<typeof FilmBibleSchema>;
export type AudiovisualContract = z.infer<typeof AudiovisualContractSchema>;
export type VisualScoreSegment = z.infer<typeof VisualScoreSegmentSchema>;
export type VisualState = z.infer<typeof VisualStateSchema>;
export type ShotSpec = z.infer<typeof ShotSpecSchema>;
