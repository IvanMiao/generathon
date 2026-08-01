import * as z from "zod";
import { IdSchema } from "@/lib/domain/shared";
import {
  readDemoAssemblySnapshot,
  runDemoAssembly,
} from "@/lib/server/deterministic-assembly";
import { errorResponse, jsonResponse } from "@/lib/server/http";
import { ensureRuntimeReady } from "@/lib/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEMO_PROJECT_ID = "project-impossible-city";

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

async function readProjectId(context: RouteContext) {
  return z
    .strictObject({ projectId: IdSchema })
    .safeParse(await context.params);
}

export async function GET(_request: Request, context: RouteContext) {
  const params = await readProjectId(context);
  if (!params.success || params.data.projectId !== DEMO_PROJECT_ID) {
    return errorResponse("assembly_project_not_found", "Project not found.", 404);
  }

  try {
    const runtimeSnapshot = ensureRuntimeReady();
    return jsonResponse({
      assembly: readDemoAssemblySnapshot(runtimeSnapshot.rootDir),
    });
  } catch (error) {
    console.error("Assembly status read failed.", error);
    return errorResponse(
      "assembly_status_failed",
      "The assembly status could not be read.",
      500,
    );
  }
}

export async function POST(_request: Request, context: RouteContext) {
  const params = await readProjectId(context);
  if (!params.success || params.data.projectId !== DEMO_PROJECT_ID) {
    return errorResponse("assembly_project_not_found", "Project not found.", 404);
  }

  try {
    const runtimeSnapshot = ensureRuntimeReady();
    return jsonResponse({
      assembly: runDemoAssembly(runtimeSnapshot.rootDir),
    });
  } catch (error) {
    console.error("Deterministic assembly failed.", error);
    return errorResponse(
      "assembly_render_failed",
      error instanceof Error
        ? error.message
        : "The deterministic assembly could not be rendered.",
      500,
    );
  }
}
