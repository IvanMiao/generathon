import { readFileSync } from "node:fs";
import path from "node:path";
import * as z from "zod";
import { describe, expect, it } from "vitest";
import { PROJECT_BUNDLE_JSON_SCHEMA } from "@/lib/domain/json-schema";
import { ProjectBundleSchema } from "@/lib/domain/project";
import { parseProjectBundle } from "@/lib/domain/validation";

function readFixture() {
  const fixturePath = path.join(
    process.cwd(),
    "fixtures",
    "projects",
    "impossible-city-demo.v1.json",
  );
  return JSON.parse(readFileSync(fixturePath, "utf8")) as unknown;
}

describe("ProjectBundle contract", () => {
  it("parses the complete offline score-to-cinema fixture", () => {
    const bundle = parseProjectBundle(readFixture());

    expect(bundle.fixture_schema_version).toBe("1.0.0");
    expect(bundle.director_treatments).toHaveLength(3);
    expect(bundle.visual_states).toHaveLength(3);
    expect(bundle.visual_score_segments).toHaveLength(6);
    expect(bundle.shot_specs).toHaveLength(6);
    expect(new Set(bundle.visual_score_segments.map((segment) => segment.relationship_mode))).toEqual(
      new Set(["mirror", "counterpoint", "suspension", "motif_binding"]),
    );
  });

  it("can expose the frozen structural contract as JSON Schema", () => {
    const jsonSchema = z.toJSONSchema(ProjectBundleSchema, {
      target: "draft-2020-12",
    });

    expect(jsonSchema.type).toBe("object");
    expect(jsonSchema.properties).toHaveProperty("visual_score_segments");
    expect(jsonSchema.properties).toHaveProperty("shot_specs");
    expect(PROJECT_BUNDLE_JSON_SCHEMA.$id).toBe(
      "https://generathon.local/schemas/project-bundle/1.0.0",
    );
  });
});
