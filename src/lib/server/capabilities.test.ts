import { describe, expect, it } from "vitest";
import { readCapabilities, toCapabilityResponse } from "@/lib/server/capabilities";

describe("capability document", () => {
  it("loads the checked Step 0 evidence and exposes only the API contract", () => {
    const document = readCapabilities();
    const response = toCapabilityResponse(document);

    expect(response.schema_version).toBe("1.2");
    expect(response.provider_allowlist).toEqual([
      "gemini",
      "openai",
      "open_weight_on_modal",
    ]);
    expect(response.generation_policy.daily_video_generation_limit).toBe(10);
    expect(response.step_0_exit_criteria.overall).toBe("pass_proceed_to_step_1");
    expect(response).not.toHaveProperty("gemini");
  });
});
