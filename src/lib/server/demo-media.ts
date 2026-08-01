import path from "node:path";

export const DEMO_MEDIA_ASSETS = {
  score: {
    relativePath: "exports/original-melodic-electronica-120s.mp3",
    mimeType: "audio/mpeg",
  },
  "failed-take": {
    relativePath: "artifacts/step0/gemini-omni-smoke.mp4",
    mimeType: "video/mp4",
  },
  "repaired-take": {
    relativePath: "artifacts/demo/gemini-omni-smoke-repaired.mp4",
    mimeType: "video/mp4",
  },
  assembly: {
    relativePath: "exports/impossible-city-deterministic-120s-v1.mp4",
    mimeType: "video/mp4",
  },
} as const;

export type DemoMediaAssetId = keyof typeof DEMO_MEDIA_ASSETS;

export interface ByteRange {
  start: number;
  end: number;
}

export function resolveDemoMediaAsset(
  assetId: string,
  rootDir = process.cwd(),
) {
  if (!(assetId in DEMO_MEDIA_ASSETS)) return null;

  const id = assetId as DemoMediaAssetId;
  const asset = DEMO_MEDIA_ASSETS[id];
  return {
    id,
    mimeType: asset.mimeType,
    path: path.resolve(rootDir, asset.relativePath),
  };
}

export function parseByteRange(
  rangeHeader: string | null,
  fileSize: number,
): ByteRange | null {
  if (!rangeHeader) return null;
  if (!Number.isSafeInteger(fileSize) || fileSize <= 0) return null;

  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) return null;

  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) return null;

  if (!rawStart) {
    const suffixLength = Number(rawEnd);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return null;
    return {
      start: Math.max(0, fileSize - suffixLength),
      end: fileSize - 1,
    };
  }

  const start = Number(rawStart);
  const requestedEnd = rawEnd ? Number(rawEnd) : fileSize - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(requestedEnd) ||
    start < 0 ||
    start >= fileSize ||
    requestedEnd < start
  ) {
    return null;
  }

  return { start, end: Math.min(requestedEnd, fileSize - 1) };
}
