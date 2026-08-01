import { randomUUID } from "node:crypto";
import type { ApiErrorResponse } from "@/lib/contracts/system";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

export function jsonResponse<T>(body: T, status = 200): Response {
  return Response.json(body, {
    status,
    headers: NO_STORE_HEADERS,
  });
}

export function errorResponse(code: string, message: string, status: number): Response {
  const body: ApiErrorResponse = {
    error: {
      code,
      message,
      request_id: randomUUID(),
    },
  };
  return jsonResponse(body, status);
}
