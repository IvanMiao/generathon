import { readCapabilities, toCapabilityResponse } from "@/lib/server/capabilities";
import { errorResponse, jsonResponse } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  try {
    return jsonResponse(toCapabilityResponse(readCapabilities()));
  } catch {
    return errorResponse(
      "capability_document_invalid",
      "The checked capability document could not be read.",
      500,
    );
  }
}
