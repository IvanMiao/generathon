import { describe, expect, it } from "vitest";
import {
  DeterministicAssemblyPlanSchema,
  buildAssemblyFilter,
  buildFfmpegArguments,
  readDemoAssemblyPlan,
  validateAssemblyPlan,
  type DeterministicAssemblyPlan,
} from "@/lib/server/deterministic-assembly";

describe("deterministic assembly plan", () => {
  it("covers the selected score with locked contiguous clips", () => {
    const plan = readDemoAssemblyPlan();

    expect(plan.clips).toHaveLength(6);
    expect(plan.clips.every((clip) => clip.locked)).toBe(true);
    expect(() => validateAssemblyPlan(plan)).not.toThrow();
  });

  it("rejects unlocked media and timeline gaps", () => {
    const plan = readDemoAssemblyPlan();
    const unlocked = structuredClone(plan) as unknown as Record<string, unknown>;
    (unlocked.clips as Array<Record<string, unknown>>)[0].locked = false;
    expect(DeterministicAssemblyPlanSchema.safeParse(unlocked).success).toBe(false);

    const gapped = structuredClone(plan);
    gapped.clips[1].timeline_range.start_seconds += 0.25;
    expect(() =>
      validateAssemblyPlan(gapped as DeterministicAssemblyPlan),
    ).toThrow(/gap or overlap/);
  });

  it("maps only assembled picture and the trimmed original score", () => {
    const plan = readDemoAssemblyPlan();
    const filter = buildAssemblyFilter(plan);
    const args = buildFfmpegArguments(plan, process.cwd(), "/tmp/output.mp4");

    expect(filter).toContain("[0:a]atrim=start=0:end=120.024");
    expect(filter).toContain("concat=n=6:v=1:a=0[vout]");
    expect(args).toContain("[aout]");
    expect(args).not.toContain("1:a");
    expect(args).toContain("+bitexact");
  });
});
