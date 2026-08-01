export const SERVICE_NAME = "generathon-web" as const;

import type { ProviderId } from "@/lib/domain/enums";

export type { ProviderId } from "@/lib/domain/enums";

export interface LiveResponse {
  status: "ok";
  service: typeof SERVICE_NAME;
  timestamp: string;
}

export interface ReadyResponse {
  status: "ready";
  database: "ready";
  artifact_store: "ready";
  environment: string;
  schema_version: number;
}

export interface CapabilityResponse {
  schema_version: string;
  status: string;
  provider_allowlist: ProviderId[];
  generation_policy: {
    daily_video_generation_limit: number;
    observed_calls_from_this_step_0_session: number;
    rule: string;
  };
  step_0_exit_criteria: Record<string, string>;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    request_id: string;
  };
}
