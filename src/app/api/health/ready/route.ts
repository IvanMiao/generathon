import { errorResponse, jsonResponse } from "@/lib/server/http";
import { ensureRuntimeReady } from "@/lib/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  try {
    const runtimeSnapshot = ensureRuntimeReady();
    return jsonResponse({
      status: runtimeSnapshot.status,
      database: runtimeSnapshot.database,
      artifact_store: runtimeSnapshot.artifact_store,
      environment: runtimeSnapshot.environment,
      schema_version: runtimeSnapshot.schema_version,
    });
  } catch {
    return errorResponse(
      "runtime_not_ready",
      "The local database or artifact store is unavailable.",
      503,
    );
  }
}
