import type { Metadata } from "next";
import { DirectionBuildPending } from "@/components/score-room/direction-build-pending";
import { ScoreRoom } from "@/components/score-room/score-room";
import { createScoreRoomProjection } from "@/components/score-room/score-room-data";
import type { WorkspaceView } from "@/components/score-room/workspace-navigation";
import { readDemoMusicAnalysis } from "@/lib/server/demo-music-analysis";
import { readDemoAssemblySnapshot } from "@/lib/server/deterministic-assembly";
import { resolveCanonicalProjectBundle } from "@/lib/server/fixtures/canonical-project";
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
  const bundle = resolveCanonicalProjectBundle(
    repository,
    DEMO_PROJECT_ID,
    runtime.rootDir,
  );
  const activeTreatment = bundle.project.active_treatment_id
    ? bundle.director_treatments.find(
        (treatment) => treatment.id === bundle.project.active_treatment_id,
      )
    : undefined;
  const activeFilmBible = activeTreatment
    ? bundle.film_bibles.find(
        (filmBible) => filmBible.treatment_id === activeTreatment.id,
      )
    : undefined;
  if (activeTreatment && !activeFilmBible) {
    return (
      <DirectionBuildPending
        projectRevision={bundle.project.revision}
        projectTitle={bundle.project.title}
        treatmentTitle={activeTreatment.title}
      />
    );
  }
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
