import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyFixtureMutations,
  InvalidFixtureSchema,
} from "@/lib/domain/mutation-fixture";
import { validateProjectBundle } from "@/lib/domain/validation";

function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(path.join(process.cwd(), relativePath), "utf8"));
}

const invalidFixtureFiles = [
  "visual-score-gap.json",
  "visual-score-overlap.json",
  "out-of-range-event.json",
  "missing-shot-function.json",
] as const;

describe("invalid project fixtures", () => {
  it.each(invalidFixtureFiles)("rejects %s with its stable issue code", (filename) => {
    const fixture = InvalidFixtureSchema.parse(
      readJson(path.join("fixtures", "invalid", filename)),
    );
    const mutated = applyFixtureMutations(
      readJson(fixture.base_fixture),
      fixture.mutations,
    );
    const result = validateProjectBundle(mutated);

    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected invalid project fixture.");
    const codes = result.issues.map((issue) => issue.code);
    expect(codes).toEqual(expect.arrayContaining(fixture.expected_issue_codes));
    expect(result.issues.every((issue) => issue.message.length > 20)).toBe(true);
  });
});
