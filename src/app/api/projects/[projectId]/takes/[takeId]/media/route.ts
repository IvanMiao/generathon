import { readFile, stat } from "node:fs/promises";
import * as z from "zod";
import { IdSchema } from "@/lib/domain/shared";
import { parseByteRange } from "@/lib/server/demo-media";
import { errorResponse } from "@/lib/server/http";
import { ProjectRepository } from "@/lib/server/repositories/project-repository";
import { ensureRuntimeReady } from "@/lib/server/runtime";
import { resolveManualTakeMedia } from "@/lib/server/take-media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ projectId: string; takeId: string }>;
}

function responseHeaders(mimeType: string, contentLength: number) {
  return {
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=0, must-revalidate",
    "Content-Length": String(contentLength),
    "Content-Type": mimeType,
  };
}

export async function GET(request: Request, context: RouteContext) {
  const paramsResult = z
    .strictObject({ projectId: IdSchema, takeId: IdSchema })
    .safeParse(await context.params);
  if (!paramsResult.success) {
    return errorResponse("take_media_path_invalid", "The project or Take identifier is invalid.", 400);
  }

  const runtimeSnapshot = ensureRuntimeReady();
  const bundle = new ProjectRepository(runtimeSnapshot.databasePath).getProjectBundle(
    paramsResult.data.projectId,
  );
  if (!bundle) return errorResponse("project_not_found", "Project not found.", 404);

  const asset = resolveManualTakeMedia(
    bundle,
    paramsResult.data.takeId,
    runtimeSnapshot.rootDir,
  );
  if (!asset) return errorResponse("take_media_not_found", "Take media not found.", 404);

  let fileSize: number;
  try {
    fileSize = (await stat(asset.path)).size;
  } catch {
    return errorResponse("take_media_not_found", "Take media is not stored locally.", 404);
  }

  const requestedRange = request.headers.get("range");
  const range = parseByteRange(requestedRange, fileSize);
  if (requestedRange && !range) {
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${fileSize}` },
    });
  }

  const file = await readFile(asset.path);
  if (!range) {
    return new Response(new Uint8Array(file), {
      headers: responseHeaders(asset.mimeType, fileSize),
    });
  }
  const body = new Uint8Array(
    file.buffer,
    file.byteOffset + range.start,
    range.end - range.start + 1,
  );
  return new Response(body, {
    status: 206,
    headers: {
      ...responseHeaders(asset.mimeType, body.byteLength),
      "Content-Range": `bytes ${range.start}-${range.end}/${fileSize}`,
    },
  });
}
