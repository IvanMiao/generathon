import { SERVICE_NAME, type LiveResponse } from "@/lib/contracts/system";
import { jsonResponse } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const response: LiveResponse = {
    status: "ok",
    service: SERVICE_NAME,
    timestamp: new Date().toISOString(),
  };
  return jsonResponse(response);
}
