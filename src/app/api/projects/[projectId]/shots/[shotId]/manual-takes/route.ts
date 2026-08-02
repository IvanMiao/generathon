import * as z from "zod";
import { IdSchema } from "@/lib/domain/shared";
import { errorResponse, jsonResponse } from "@/lib/server/http";
import {
  isManualTakeImportError,
  ManualTakeImportService,
  MAX_MANUAL_TAKE_BYTES,
} from "@/lib/server/manual-take-import";
import {
  ProjectBundleNotFoundError,
  ProjectBundleRevisionConflictError,
  ProjectRepository,
} from "@/lib/server/repositories/project-repository";
import { ensureRuntimeReady } from "@/lib/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ExpectedRevisionSchema = z.coerce.number().int().positive();

interface RouteContext {
  params: Promise<{ projectId: string; shotId: string }>;
}

function isUploadFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File;
}

export async function POST(request: Request, context: RouteContext) {
  const paramsResult = z
    .strictObject({ projectId: IdSchema, shotId: IdSchema })
    .safeParse(await context.params);
  if (!paramsResult.success) {
    return errorResponse(
      "manual_take_path_invalid",
      "The project or ShotSpec identifier is invalid.",
      400,
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse(
      "manual_take_request_invalid",
      "Submit a multipart form with the current project revision and an MP4 file.",
      400,
    );
  }
  const expectedProjectRevision = ExpectedRevisionSchema.safeParse(
    formData.get("expectedProjectRevision"),
  );
  const file = formData.get("file");
  if (!expectedProjectRevision.success || !isUploadFile(file)) {
    return errorResponse(
      "manual_take_request_invalid",
      "Include the current project revision and an MP4 file.",
      400,
    );
  }
  if (file.size > MAX_MANUAL_TAKE_BYTES) {
    return errorResponse(
      "manual_take_file_invalid",
      "The imported video exceeds the 512 MB limit.",
      413,
    );
  }

  try {
    const runtimeSnapshot = ensureRuntimeReady();
    const bytes = new Uint8Array(await file.arrayBuffer());
    const service = new ManualTakeImportService(
      new ProjectRepository(runtimeSnapshot.databasePath),
      {
        rootDir: runtimeSnapshot.rootDir,
        uploadsDir: runtimeSnapshot.uploadsDir,
      },
    );
    return jsonResponse(
      service.importManualTake({
        projectId: paramsResult.data.projectId,
        expectedProjectRevision: expectedProjectRevision.data,
        shotSpecId: paramsResult.data.shotId,
        fileName: file.name,
        mimeType: file.type,
        bytes,
      }),
      201,
    );
  } catch (error) {
    if (isManualTakeImportError(error)) {
      return errorResponse(error.code, error.message, error.status);
    }
    if (error instanceof ProjectBundleNotFoundError) {
      return errorResponse("project_not_found", "Project not found.", 404);
    }
    if (error instanceof ProjectBundleRevisionConflictError) {
      return errorResponse(
        "project_revision_conflict",
        "This project changed. Refresh before importing another Take.",
        409,
      );
    }
    console.error("Manual Take import failed.", error);
    return errorResponse(
      "manual_take_import_failed",
      "The manual Take could not be imported.",
      500,
    );
  }
}
