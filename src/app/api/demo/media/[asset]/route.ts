import { readFile, stat } from "node:fs/promises";
import {
  parseByteRange,
  resolveDemoMediaAsset,
} from "@/lib/server/demo-media";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ asset: string }>;
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
  const { asset: assetId } = await context.params;
  const asset = resolveDemoMediaAsset(assetId);
  if (!asset) return new Response("Demo media asset not found.", { status: 404 });

  let fileSize: number;
  try {
    fileSize = (await stat(asset.path)).size;
  } catch {
    return new Response("Demo media has not been prepared locally.", {
      status: 404,
    });
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
