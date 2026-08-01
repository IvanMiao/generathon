import type { Metadata } from "next";
import { ScoreRoom } from "@/components/score-room/score-room";
import { createScoreRoomProjection } from "@/components/score-room/score-room-data";
import type { WorkspaceView } from "@/components/score-room/workspace-navigation";
import { readDemoMusicAnalysis } from "@/lib/server/demo-music-analysis";
import { readDemoAssemblySnapshot } from "@/lib/server/deterministic-assembly";
import { importCanonicalProjectBundle } from "@/lib/server/fixtures/canonical-project";
import { ProjectRepository } from "@/lib/server/repositories/project-repository";
import { ensureRuntimeReady } from "@/lib/server/runtime";

export const metadata: Metadata = {
  title: "Score Room — An Incorrect Memory of the City",
  description:
    "A fixture-first Visual Score for the Generathon impossible-city demo.",
};

export const dynamic = "force-dynamic";

const DEMO_PROJECT_ID = "project-impossible-city";
const workspaceViews = new Set<WorkspaceView>([
  "listen",
  "direction",
  "visual-world",
  "score",
  "shots",
  "review",
]);

interface DemoScoreRoomPageProps {
  searchParams: Promise<{ view?: string }>;
}

export default async function DemoScoreRoomPage({
  searchParams,
}: DemoScoreRoomPageProps) {
  const requestedView = (await searchParams).view;
  const initialView = workspaceViews.has(requestedView as WorkspaceView)
    ? (requestedView as WorkspaceView)
    : "score";
  const runtime = ensureRuntimeReady();
  const repository = new ProjectRepository(runtime.databasePath);
  const bundle =
    repository.getProjectBundle(DEMO_PROJECT_ID) ??
    importCanonicalProjectBundle(repository, runtime.rootDir);
  const scoreRoom = createScoreRoomProjection(
    bundle,
    readDemoMusicAnalysis(runtime.rootDir) ?? undefined,
  );

  return (
    <ScoreRoom
      scoreRoom={scoreRoom}
      assemblySnapshot={readDemoAssemblySnapshot(runtime.rootDir)}
      initialView={initialView}
    />
  );
}
