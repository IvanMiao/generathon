import { readFileSync } from "node:fs";
import path from "node:path";
import type {
  CapabilityResponse,
  ProviderId,
} from "@/lib/contracts/system";

interface CapabilityDocument extends CapabilityResponse {
  audio_analysis: {
    demo_track: {
      working_title: string;
      duration_seconds: number;
      measured_tempo_bpm: number;
      candidate_boundaries_seconds: number[];
    };
  };
  open_weight_modal: {
    status: string;
    candidate: string;
  };
}

const PROVIDERS = new Set<ProviderId>([
  "gemini",
  "openai",
  "open_weight_on_modal",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function assertCapabilityDocument(value: unknown): asserts value is CapabilityDocument {
  if (!isRecord(value)) {
    throw new Error("Capability document must be an object.");
  }

  if (typeof value.schema_version !== "string" || typeof value.status !== "string") {
    throw new Error("Capability document is missing its schema version or status.");
  }

  if (
    !Array.isArray(value.provider_allowlist) ||
    !value.provider_allowlist.every(
      (provider) => typeof provider === "string" && PROVIDERS.has(provider as ProviderId),
    )
  ) {
    throw new Error("Capability document contains an unsupported provider.");
  }

  if (
    !isRecord(value.generation_policy) ||
    typeof value.generation_policy.daily_video_generation_limit !== "number" ||
    typeof value.generation_policy.observed_calls_from_this_step_0_session !== "number" ||
    typeof value.generation_policy.rule !== "string"
  ) {
    throw new Error("Capability document has an invalid generation policy.");
  }

  if (
    !isRecord(value.step_0_exit_criteria) ||
    !Object.values(value.step_0_exit_criteria).every((result) => typeof result === "string") ||
    !isRecord(value.audio_analysis)
  ) {
    throw new Error("Capability document is missing Step 0 evidence.");
  }

  const demoTrack = value.audio_analysis.demo_track;
  if (
    !isRecord(demoTrack) ||
    typeof demoTrack.working_title !== "string" ||
    typeof demoTrack.duration_seconds !== "number" ||
    typeof demoTrack.measured_tempo_bpm !== "number" ||
    !Array.isArray(demoTrack.candidate_boundaries_seconds) ||
    !demoTrack.candidate_boundaries_seconds.every(
      (boundary) => typeof boundary === "number",
    )
  ) {
    throw new Error("Capability document has invalid demo-track evidence.");
  }

  if (
    !isRecord(value.open_weight_modal) ||
    typeof value.open_weight_modal.status !== "string" ||
    typeof value.open_weight_modal.candidate !== "string"
  ) {
    throw new Error("Capability document is missing the Modal route.");
  }
}

export function readCapabilities(rootDir = process.cwd()): CapabilityDocument {
  const documentPath = path.join(rootDir, "config", "capabilities.json");
  const value: unknown = JSON.parse(readFileSync(documentPath, "utf8"));
  assertCapabilityDocument(value);
  return value;
}

export function toCapabilityResponse(document: CapabilityDocument): CapabilityResponse {
  return {
    schema_version: document.schema_version,
    status: document.status,
    provider_allowlist: document.provider_allowlist,
    generation_policy: {
      daily_video_generation_limit:
        document.generation_policy.daily_video_generation_limit,
      observed_calls_from_this_step_0_session:
        document.generation_policy.observed_calls_from_this_step_0_session,
      rule: document.generation_policy.rule,
    },
    step_0_exit_criteria: document.step_0_exit_criteria,
  };
}
