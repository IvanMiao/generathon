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

const ApprovalRequestSchema = z.strictObject({
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
      "The Visual Score approval request must be valid JSON.",
      400,
    );
  }
  const bodyResult = ApprovalRequestSchema.safeParse(requestBody);
  if (!bodyResult.success) {
    return errorResponse(
      "workflow_request_invalid",
      "Include the current project revision before approving the Visual Score.",
      400,
    );
  }

  try {
    const runtimeSnapshot = ensureRuntimeReady();
    const service = new ProjectWorkflowService(
      new ProjectRepository(runtimeSnapshot.databasePath),
    );
    return jsonResponse(
      service.approveVisualScore({
        projectId: paramsResult.data.projectId,
        expectedProjectRevision: bodyResult.data.expectedProjectRevision,
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
    console.error("Visual Score approval failed.", error);
    return errorResponse(
      "workflow_save_failed",
      "The Visual Score could not be approved.",
      500,
    );
  }
}
