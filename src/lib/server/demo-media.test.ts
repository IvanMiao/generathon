import { describe, expect, it } from "vitest";
import {
  parseByteRange,
  resolveDemoMediaAsset,
} from "@/lib/server/demo-media";

describe("demo media allowlist", () => {
  it("resolves known assets without accepting arbitrary paths", () => {
    expect(resolveDemoMediaAsset("score", "/repo")).toMatchObject({
      id: "score",
      mimeType: "audio/mpeg",
      path: "/repo/exports/original-melodic-electronica-120s.mp3",
    });
    expect(resolveDemoMediaAsset("../../.env", "/repo")).toBeNull();
  });
});

describe("HTTP byte ranges", () => {
  it("parses bounded, open-ended, and suffix requests", () => {
    expect(parseByteRange("bytes=10-19", 100)).toEqual({ start: 10, end: 19 });
    expect(parseByteRange("bytes=90-", 100)).toEqual({ start: 90, end: 99 });
    expect(parseByteRange("bytes=-12", 100)).toEqual({ start: 88, end: 99 });
    expect(parseByteRange("bytes=90-200", 100)).toEqual({ start: 90, end: 99 });
  });

  it("rejects malformed or unsatisfiable requests", () => {
    expect(parseByteRange("items=0-1", 100)).toBeNull();
    expect(parseByteRange("bytes=100-101", 100)).toBeNull();
    expect(parseByteRange("bytes=20-10", 100)).toBeNull();
    expect(parseByteRange("bytes=-0", 100)).toBeNull();
  });
});
