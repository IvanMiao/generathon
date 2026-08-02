import * as z from "zod";
import {
  ProjectWorkflowService,
  toWorkflowHttpError,
} from "@/lib/application/workflow/project-workflow";
import { IdSchema } from "@/lib/domain/shared";
import { errorResponse, jsonResponse } from "@/lib/server/http";
import { ProjectRepository } from "@/lib/server/repositories/project-repository";
import { ensureRuntimeReady } from "@/lib/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LockCandidateTakeRequestSchema = z.strictObject({
  expectedProjectRevision: z.number().int().positive(),
  confirmed: z.literal(true),
});

interface RouteContext {
  params: Promise<{ projectId: string; takeId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const paramsResult = z
    .strictObject({ projectId: IdSchema, takeId: IdSchema })
    .safeParse(await context.params);
  if (!paramsResult.success) {
    return errorResponse(
      "workflow_path_invalid",
      "The project or Take identifier is invalid.",
      400,
    );
  }

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch {
    return errorResponse(
      "workflow_request_invalid",
      "Explicitly confirm the reviewed candidate and include the current project revision.",
      400,
    );
  }
  const bodyResult = LockCandidateTakeRequestSchema.safeParse(requestBody);
  if (!bodyResult.success) {
    return errorResponse(
      "workflow_request_invalid",
      "Explicitly confirm the reviewed candidate and include the current project revision.",
      400,
    );
  }

  try {
    const runtimeSnapshot = ensureRuntimeReady();
    const service = new ProjectWorkflowService(
      new ProjectRepository(runtimeSnapshot.databasePath),
    );
    return jsonResponse(
      service.lockCandidateTake({ ...paramsResult.data, ...bodyResult.data }),
    );
  } catch (error) {
    const workflowError = toWorkflowHttpError(error);
    if (workflowError) {
      return errorResponse(
        workflowError.code,
        workflowError.message,
        workflowError.status,
      );
    }
    console.error("Candidate Take lock failed.", error);
    return errorResponse(
      "workflow_save_failed",
      "The candidate Take could not be locked.",
      500,
    );
  }
}
