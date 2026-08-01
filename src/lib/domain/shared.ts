import * as z from "zod";
import { CONTRACT_SCHEMA_VERSION } from "@/lib/domain/enums";

export const IdSchema = z.string().trim().min(1).max(160);
export const NonEmptyStringSchema = z.string().trim().min(1);
export const IsoDateTimeSchema = z.iso.datetime({ offset: true });
export const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
export const ConfidenceSchema = z.number().min(0).max(1);
export const SecondsSchema = z.number().finite().min(0);
export const RevisionSchema = z.number().int().positive();

export const TimeRangeSchema = z.strictObject({
  start_seconds: SecondsSchema,
  end_seconds: SecondsSchema,
});

export const VersionedRecordFields = {
  schema_version: z.literal(CONTRACT_SCHEMA_VERSION),
  id: IdSchema,
  project_id: IdSchema,
  revision: RevisionSchema,
  created_at: IsoDateTimeSchema,
  updated_at: IsoDateTimeSchema,
};

export const TimedEvidenceSchema = z.strictObject({
  time_seconds: SecondsSchema,
  description: NonEmptyStringSchema,
  confidence: ConfidenceSchema,
});

export type TimeRange = z.infer<typeof TimeRangeSchema>;
