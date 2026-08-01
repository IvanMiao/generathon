import * as z from "zod";
import { ProjectWorkflowService, toWorkflowHttpError } from "@/lib/application/workflow/project-workflow";
import { IdSchema } from "@/lib/domain/shared";
import { errorResponse, jsonResponse } from "@/lib/server/http";
import { ProjectRepository } from "@/lib/server/repositories/project-repository";
import { ensureRuntimeReady } from "@/lib/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ReviewDecisionRequestSchema = z.strictObject({
  action: z.enum(["apply_repair", "lock_take", "reset"]),
  expectedProjectRevision: z.number().int().positive(),
});

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const paramsResult = z
    .strictObject({ projectId: IdSchema })
    .safeParse(await context.params);
  if (!paramsResult.success) {
    return errorResponse(
      "workflow_path_invalid",
      "The project identifier is invalid.",
      400,
    );
  }

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch {
    return errorResponse(
      "workflow_request_invalid",
      "The review decision request must be valid JSON.",
      400,
    );
  }
  const bodyResult = ReviewDecisionRequestSchema.safeParse(requestBody);
  if (!bodyResult.success) {
    return errorResponse(
      "workflow_request_invalid",
      "Choose a valid review action and include the current project revision.",
      400,
    );
  }

  try {
    const runtimeSnapshot = ensureRuntimeReady();
    const service = new ProjectWorkflowService(
      new ProjectRepository(runtimeSnapshot.databasePath),
    );
    return jsonResponse(
      service.recordReviewAction({
        projectId: paramsResult.data.projectId,
        ...bodyResult.data,
      }),
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
    console.error("Review decision persistence failed.", error);
    return errorResponse(
      "workflow_save_failed",
      "The review decision could not be saved.",
      500,
    );
  }
}
