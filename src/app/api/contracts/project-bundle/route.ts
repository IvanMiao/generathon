import { PROJECT_BUNDLE_JSON_SCHEMA } from "@/lib/domain/json-schema";

export const runtime = "nodejs";
export const dynamic = "force-static";

export function GET() {
  return Response.json(PROJECT_BUNDLE_JSON_SCHEMA, {
    headers: {
      "Cache-Control": "public, max-age=3600, immutable",
    },
  });
}
