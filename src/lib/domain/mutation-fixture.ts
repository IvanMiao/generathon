import * as z from "zod";
import { FIXTURE_SCHEMA_VERSION } from "@/lib/domain/enums";
import { IdSchema, NonEmptyStringSchema } from "@/lib/domain/shared";

const JsonPointerSchema = z.string().startsWith("/");

const ReplaceMutationSchema = z.strictObject({
  op: z.literal("replace"),
  path: JsonPointerSchema,
  value: z.json(),
});

const RemoveMutationSchema = z.strictObject({
  op: z.literal("remove"),
  path: JsonPointerSchema,
});

export const InvalidFixtureSchema = z.strictObject({
  fixture_schema_version: z.literal(FIXTURE_SCHEMA_VERSION),
  fixture_id: IdSchema,
  description: NonEmptyStringSchema,
  base_fixture: NonEmptyStringSchema,
  validator: z.enum(["project", "revision"]),
  revision_record_type: z.enum([
    "music_analysis",
    "music_analysis_revision",
    "music_reading",
    "film_bible",
    "visual_score",
    "visual_state",
    "shot_spec",
    "take",
  ]).nullable(),
  record_id: IdSchema.nullable(),
  explicitly_reopened: z.boolean(),
  mutations: z.array(z.discriminatedUnion("op", [ReplaceMutationSchema, RemoveMutationSchema])).min(1),
  expected_issue_codes: z.array(NonEmptyStringSchema).min(1),
});

export type InvalidFixture = z.infer<typeof InvalidFixtureSchema>;

function decodePointerSegment(segment: string) {
  return segment.replaceAll("~1", "/").replaceAll("~0", "~");
}

function resolveParent(document: unknown, pointer: string) {
  const segments = pointer.slice(1).split("/").map(decodePointerSegment);
  const finalSegment = segments.pop();
  if (!finalSegment) {
    throw new Error(`Mutation path '${pointer}' cannot target the document root.`);
  }

  let parent: unknown = document;
  for (const segment of segments) {
    if (Array.isArray(parent)) {
      parent = parent[Number(segment)];
    } else if (typeof parent === "object" && parent !== null) {
      parent = (parent as Record<string, unknown>)[segment];
    } else {
      throw new Error(`Mutation path '${pointer}' does not exist.`);
    }
  }
  return { parent, finalSegment };
}

export function applyFixtureMutations(
  baseDocument: unknown,
  mutations: InvalidFixture["mutations"],
): unknown {
  const document: unknown = structuredClone(baseDocument);

  for (const mutation of mutations) {
    const { parent, finalSegment } = resolveParent(document, mutation.path);
    if (Array.isArray(parent)) {
      const index = Number(finalSegment);
      if (!Number.isInteger(index) || index < 0 || index >= parent.length) {
        throw new Error(`Mutation path '${mutation.path}' has an invalid array index.`);
      }
      if (mutation.op === "remove") parent.splice(index, 1);
      else parent[index] = mutation.value;
    } else if (typeof parent === "object" && parent !== null) {
      if (!(finalSegment in parent)) {
        throw new Error(`Mutation path '${mutation.path}' does not exist.`);
      }
      if (mutation.op === "remove") delete (parent as Record<string, unknown>)[finalSegment];
      else (parent as Record<string, unknown>)[finalSegment] = mutation.value;
    } else {
      throw new Error(`Mutation path '${mutation.path}' does not resolve to a container.`);
    }
  }

  return document;
}
