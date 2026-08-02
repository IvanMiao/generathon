import { describe, expect, it } from "vitest";
import impossibleCityFixture from "../../../fixtures/projects/impossible-city-demo.v1.json";
import { ProjectBundleSchema } from "@/lib/domain/project";
import { resolveManualTakeMedia } from "@/lib/server/take-media";

const bundle = ProjectBundleSchema.parse(impossibleCityFixture);

describe("manual Take media access", () => {
  it("resolves only a recorded manual video artifact inside the workspace", () => {
    expect(
      resolveManualTakeMedia(bundle, "take-shot-05-mutation", "/repo"),
    ).toMatchObject({
      mimeType: "video/mp4",
      path: "/repo/fixtures/media/shot-04-mutation.mp4",
    });
  });

  it("does not expose unrelated Take artifacts or paths outside the workspace", () => {
    expect(resolveManualTakeMedia(bundle, "take-shot-02-fallback", "/repo")).toBeNull();

    const unsafe = structuredClone(bundle);
    const artifact = unsafe.artifacts.find(
      (candidate) => candidate.id === "artifact-shot-04-mutation",
    );
    if (!artifact) throw new Error("Fixture artifact is missing.");
    artifact.relative_path = "../.env";
    expect(resolveManualTakeMedia(unsafe, "take-shot-05-mutation", "/repo")).toBeNull();
  });
});
