import * as z from "zod";
import {
  ProjectWorkflowService,
  toWorkflowHttpError,
} from "@/lib/application/workflow/project-workflow";
import { IdSchema, SecondsSchema } from "@/lib/domain/shared";
import { errorResponse, jsonResponse } from "@/lib/server/http";
import { ProjectRepository } from "@/lib/server/repositories/project-repository";
import { ensureRuntimeReady } from "@/lib/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AnalysisBoundaryRevisionRequestSchema = z.strictObject({
  expectedProjectRevision: z.number().int().positive(),
  boundarySeconds: SecondsSchema,
});

interface RouteContext {
  params: Promise<{ projectId: string; revisionId: string; sectionId: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  const paramsResult = z
    .strictObject({
      projectId: IdSchema,
      revisionId: IdSchema,
      sectionId: IdSchema,
    })
    .safeParse(await context.params);
  if (!paramsResult.success) {
    return errorResponse(
      "workflow_path_invalid",
      "The project, analysis revision, or section identifier is invalid.",
      400,
    );
  }

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch {
    return errorResponse(
      "workflow_request_invalid",
      "The section-boundary revision request must be valid JSON.",
      400,
    );
  }
  const bodyResult = AnalysisBoundaryRevisionRequestSchema.safeParse(requestBody);
  if (!bodyResult.success) {
    return errorResponse(
      "workflow_request_invalid",
      "Choose a valid boundary time and include the current project revision.",
      400,
    );
  }

  try {
    const runtimeSnapshot = ensureRuntimeReady();
    const service = new ProjectWorkflowService(
      new ProjectRepository(runtimeSnapshot.databasePath),
    );
    return jsonResponse(
      service.reviseAnalysisBoundary({
        ...paramsResult.data,
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
    console.error("Music Analysis boundary revision failed.", error);
    return errorResponse(
      "workflow_save_failed",
      "The section boundary could not be saved.",
      500,
    );
  }
}
