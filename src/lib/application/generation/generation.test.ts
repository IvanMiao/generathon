import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  compileProviderGenerationTask,
  evaluateGenerationEligibility,
  REQUIRED_PROMPT_SECTIONS,
  type GenerationEligibilityInput,
} from "@/lib/application/generation";
import type { ShotSpec } from "@/lib/domain/direction";
import { parseProjectBundle } from "@/lib/domain/validation";

function readBundle() {
  return parseProjectBundle(
    JSON.parse(
      readFileSync(
        path.join(
          process.cwd(),
          "fixtures",
          "projects",
          "impossible-city-demo.v1.json",
        ),
        "utf8",
      ),
    ),
  );
}

function createGenerationContext(): GenerationEligibilityInput {
  const bundle = readBundle();
  const shotSpec = bundle.shot_specs[0];
  const task = compileProviderGenerationTask({
    provider: "gemini",
    shotSpec,
    filmBible: bundle.film_bibles[0],
    visualStates: bundle.visual_states,
    visualScoreSegments: bundle.visual_score_segments,
    providerCapabilities: bundle.provider_capabilities.find(
      (capabilities) => capabilities.provider === "gemini",
    ),
    aspectRatio: bundle.project.aspect_ratio,
  });

  return {
    filmBible: bundle.film_bibles[0],
    visualScoreStatus: "approved",
    visualScoreSegments: bundle.visual_score_segments,
    visualStates: bundle.visual_states,
    shotSpec,
    task,
    promptReview: {
      reviewed: true,
      promptFileSha256: task.prompt_sha256,
      finalCutCandidateConfirmed: true,
    },
    quota: {
      dailyLimit: bundle.project.daily_video_generation_limit,
      used: bundle.provider_runs.length,
      reserved: 0,
    },
  };
}

function issueCodes(input: GenerationEligibilityInput) {
  return evaluateGenerationEligibility(input).issues.map((issue) => issue.code);
}

describe("ShotSpec provider task compiler", () => {
  it("compiles a stable, complex Gemini task from canonical direction records", () => {
    const input = createGenerationContext();

    expect(input.task.provider).toBe("gemini");
    expect(input.task.operation).toBe("video_generation");
    expect(input.task.prompt.length).toBeGreaterThanOrEqual(600);
    expect(input.task.prompt_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(input.task.reference_artifact_ids).toEqual(["artifact-state-origin"]);
    for (const section of REQUIRED_PROMPT_SECTIONS) {
      expect(input.task.prompt).toContain(`# ${section}`);
    }
    expect(input.task.payload).toMatchObject({
      provider: "gemini",
      response_format: { type: "video", aspect_ratio: "16:9" },
    });
  });
});

describe("generation eligibility guard", () => {
  it("accepts the complete locked fixture candidate", () => {
    expect(evaluateGenerationEligibility(createGenerationContext())).toEqual({
      eligible: true,
      issues: [],
    });
  });

  it("rejects direction that is not locked", () => {
    const input = createGenerationContext();
    input.filmBible = { ...input.filmBible, status: "approved" };

    expect(issueCodes(input)).toContain("generation_film_bible_not_locked");
  });

  it("rejects a Visual Score that is not approved", () => {
    const input = createGenerationContext();
    input.visualScoreStatus = "draft";

    expect(issueCodes(input)).toContain("generation_visual_score_not_approved");
  });

  it("rejects candidate Visual States", () => {
    const input = createGenerationContext();
    input.visualStates = input.visualStates.map((state) =>
      state.id === input.shotSpec.start_visual_state_id
        ? { ...state, status: "candidate" }
        : state,
    );

    expect(issueCodes(input)).toContain("generation_visual_state_not_approved");
  });

  it("rejects an unlocked ShotSpec", () => {
    const input = createGenerationContext();
    input.shotSpec = { ...input.shotSpec, status: "ready" };

    expect(issueCodes(input)).toContain("generation_shot_spec_not_locked");
  });

  it("rejects a ShotSpec missing all three creative functions", () => {
    const input = createGenerationContext();
    input.shotSpec = {
      ...input.shotSpec,
      musical_function: " ",
      narrative_function: " ",
      visual_function: " ",
    } as ShotSpec;

    expect(issueCodes(input)).toContain("generation_shot_functions_incomplete");
  });

  it("rejects an exhausted daily quota", () => {
    const input = createGenerationContext();
    input.quota.used = input.quota.dailyLimit;

    expect(issueCodes(input)).toContain("generation_quota_exhausted");
  });

  it("preserves the existing complex-prompt and final-candidate guards", () => {
    const input = createGenerationContext();
    input.task = { ...input.task, prompt: "# SHOT INTENT\nToo short." };
    input.promptReview = {
      reviewed: false,
      promptFileSha256: null,
      finalCutCandidateConfirmed: false,
    };

    expect(issueCodes(input)).toEqual(
      expect.arrayContaining([
        "generation_prompt_too_short",
        "generation_prompt_section_missing",
        "generation_prompt_not_reviewed",
        "generation_prompt_file_required",
        "generation_final_candidate_unconfirmed",
      ]),
    );
  });
});
