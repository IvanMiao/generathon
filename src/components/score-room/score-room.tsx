import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import {
  AudioLines,
  CheckCircle2,
  ChevronDown,
  Home,
  LockKeyhole,
  Music2,
  Radio,
  ShieldCheck,
  Sparkles,
  Waves,
} from "lucide-react";
import { AssemblyExport } from "@/components/score-room/assembly-export";
import { MusicAnalysisVisualizer } from "@/components/score-room/music-analysis-visualizer";
import { ReviewRepairDemo } from "@/components/score-room/review-repair-demo";
import type { ScoreRoomProjection } from "@/components/score-room/score-room-data";
import { ScorePlaybackProvider } from "@/components/score-room/score-playback-context";
import { ScoreTransport } from "@/components/score-room/score-transport";
import { ShotWorkbench } from "@/components/score-room/shot-workbench";
import { TreatmentComparison } from "@/components/score-room/treatment-comparison";
import { VisualScoreWorkbench } from "@/components/score-room/visual-score-workbench";
import { WorkflowProvider } from "@/components/score-room/workflow-context";
import {
  WorkspaceNavigation,
  WorkspaceNavigationProvider,
  WorkspacePanel,
  type WorkspaceView,
} from "@/components/score-room/workspace-navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { AssemblySnapshot } from "@/lib/server/deterministic-assembly";

type ScoreRoomProps = {
  scoreRoom: ScoreRoomProjection;
};

type ScoreRoomPageProps = ScoreRoomProps & {
  assemblySnapshot: AssemblySnapshot | null;
  initialView?: WorkspaceView;
};

type ViewHeaderProps = {
  description: string;
  id: string;
  index: string;
  status?: string;
  title: string;
  topic: string;
};

function ViewHeader({
  description,
  id,
  index,
  status,
  title,
  topic,
}: ViewHeaderProps) {
  return (
    <header className="mb-5 flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.1em] text-primary uppercase">
          <span className="text-muted-foreground">{index}</span>
          {topic}
        </p>
        <h2 className="mt-2 text-[clamp(1.75rem,3vw,2.5rem)] leading-tight font-semibold tracking-[-0.035em] text-foreground" id={id} tabIndex={-1}>
          {title}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
          {description}
        </p>
      </div>
      {status ? (
        <Badge variant="outline" className="mb-1">
          <CheckCircle2 aria-hidden="true" />
          {status}
        </Badge>
      ) : null}
    </header>
  );
}

function Disclosure({
  children,
  label,
  meta,
}: {
  children: ReactNode;
  label: string;
  meta?: string;
}) {
  return (
    <details className="group rounded-xl border border-border bg-background/25">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 px-4 text-sm font-medium text-foreground outline-none transition-colors duration-200 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/45 [&::-webkit-details-marker]:hidden">
        <span>{label}</span>
        <span className="flex items-center gap-3">
          {meta ? (
            <span className="hidden font-mono text-[9px] text-muted-foreground sm:inline">
              {meta}
            </span>
          ) : null}
          <ChevronDown className="size-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
        </span>
      </summary>
      <div className="border-t border-border p-4 sm:p-5">{children}</div>
    </details>
  );
}

function ListeningSection({ scoreRoom }: ScoreRoomProps) {
  const { measuredMusic, interpretedMusic } = scoreRoom;

  return (
    <section aria-labelledby="listening-title">
      <ViewHeader
        index="01"
        id="listening-title"
        topic="Listen first"
        title="Hear the structure before directing it"
        description="The signal map is the primary object. Interpretation stays separate and opens only when you need its narrative reading."
        status={`${measuredMusic.confidencePercent}% measured confidence`}
      />

      <MusicAnalysisVisualizer analysis={measuredMusic} />

      <Card className="mt-5 rounded-2xl bg-card/70">
        <header className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between lg:p-6">
          <div>
            <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.1em] text-highlight uppercase">
              <Music2 className="size-3.5" aria-hidden="true" />
              Director&apos;s reading
            </p>
            <h3 className="mt-2 text-lg font-semibold text-foreground">
              What the evidence could mean
            </h3>
          </div>
          <Badge variant="outline">{interpretedMusic.statusLabel}</Badge>
        </header>
        <div className="p-5 lg:p-6">
          <blockquote className="max-w-4xl border-l-2 border-highlight pl-4 font-display text-xl leading-8 text-foreground/90 italic">
            {interpretedMusic.summary}
          </blockquote>
          <p className="mt-4 max-w-4xl text-sm leading-6 text-muted-foreground">
            {interpretedMusic.emotionalArc}
          </p>

          <div className="mt-5 space-y-3">
            <Disclosure
              label="Interpretive structure"
              meta={`${interpretedMusic.sections.length} sections`}
            >
              <ol className="divide-y divide-border">
                {interpretedMusic.sections.map((section) => (
                  <li className="grid gap-2 py-4 first:pt-0 last:pb-0 sm:grid-cols-[140px_minmax(0,1fr)]" key={section.id}>
                    <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                      {section.rangeLabel}
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-sm font-semibold text-foreground">
                          {section.label}
                        </strong>
                        <Badge variant="outline">{section.tensionLabel}</Badge>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {section.narrativePossibility}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </Disclosure>

            <Disclosure
              label="Measured events"
              meta={`${measuredMusic.notableEvents.length} notable events`}
            >
              <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {measuredMusic.notableEvents.map((event) => (
                  <li className="rounded-lg border border-border bg-card/60 p-3" key={event.id}>
                    <span className="font-mono text-[10px] text-measured tabular-nums">
                      {event.timeLabel}
                    </span>
                    <p className="mt-1.5 text-sm text-foreground">
                      {event.kindLabel}
                    </p>
                    <small className="mt-1 block text-xs text-muted-foreground">
                      {event.strengthPercent}% strength
                    </small>
                  </li>
                ))}
              </ol>
            </Disclosure>
          </div>
        </div>
      </Card>
    </section>
  );
}

function TreatmentsSection({ scoreRoom }: ScoreRoomProps) {
  const { treatments, filmBible, audiovisualContract } = scoreRoom;

  return (
    <section aria-labelledby="treatments-title">
      <ViewHeader
        index="02"
        id="treatments-title"
        topic="Direction"
        title="One visual world, deliberately chosen"
        description="The approved treatment is the working direction. Alternatives and production laws remain available without competing for attention."
        status={`${filmBible.statusLabel} Film Bible`}
      />

      <TreatmentComparison treatments={treatments} />

      <Card className="mt-5 rounded-2xl bg-card/70">
        <header className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between lg:p-6">
          <div>
            <p className="font-mono text-[10px] tracking-[0.1em] text-measured uppercase">
              Production laws
            </p>
            <h3 className="mt-2 text-xl font-semibold text-foreground">Film Bible</h3>
          </div>
          <Badge variant="success">
            <LockKeyhole aria-hidden="true" />
            Revision protected
          </Badge>
        </header>
        <div className="p-5 lg:p-6">
          <p className="max-w-4xl text-base leading-7 text-foreground/90">
            {filmBible.theme}
          </p>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">
            {filmBible.worldOntology}
          </p>

          <div className="mt-5 space-y-3">
            <Disclosure label="Locked visual and camera laws" meta={`${filmBible.cameraRules.length + filmBible.invariants.length} rules`}>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h4 className="text-sm font-semibold text-foreground">Camera laws</h4>
                  <ul className="mt-3 space-y-2">
                    {filmBible.cameraRules.map((rule) => (
                      <li className="flex gap-2 text-sm leading-6 text-muted-foreground" key={rule}>
                        <CheckCircle2 className="mt-1 size-3.5 flex-none text-measured" aria-hidden="true" />
                        {rule}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">Invariants</h4>
                  <ul className="mt-3 space-y-2">
                    {filmBible.invariants.map((rule) => (
                      <li className="flex gap-2 text-sm leading-6 text-muted-foreground" key={rule}>
                        <ShieldCheck className="mt-1 size-3.5 flex-none text-highlight" aria-hidden="true" />
                        {rule}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Disclosure>

            <Disclosure label="Audiovisual contract" meta={`Timing ${audiovisualContract.timingToleranceLabel}`}>
              <ul className="space-y-3">
                {audiovisualContract.principles.map((principle) => (
                  <li className="rounded-lg border border-border bg-card/60 p-4" key={principle.id}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{principle.relationshipLabel}</Badge>
                      <strong className="text-sm font-medium text-foreground">
                        {principle.appliesTo}
                      </strong>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {principle.rationale}
                    </p>
                  </li>
                ))}
              </ul>
            </Disclosure>
          </div>
        </div>
      </Card>
    </section>
  );
}

function VisualStatesSection({ scoreRoom }: ScoreRoomProps) {
  return (
    <section aria-labelledby="visual-states-title">
      <ViewHeader
        index="03"
        id="visual-states-title"
        topic="Visual world"
        title="Three anchor states hold continuity"
        description="Each state is a production checkpoint. The sequence stays visible; detailed construction rules open only when needed."
        status={`${scoreRoom.visualStates.length} approved states`}
      />

      <ol className="grid gap-4 lg:grid-cols-3">
        {scoreRoom.visualStates.map((state) => (
          <li key={state.id}>
            <Card className="h-full overflow-hidden rounded-2xl bg-card/70">
              <div className="relative h-40 overflow-hidden bg-black">
                <Image
                  alt={state.imageAlt}
                  className="object-cover"
                  fill
                  sizes="(min-width: 1024px) 33vw, 100vw"
                  src={state.imageSrc}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10" />
                <span className="absolute top-4 left-4 font-mono text-[10px] tracking-[0.1em] text-white/80">
                  STATE {state.number}
                </span>
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-foreground">{state.name}</h3>
                  <Badge variant="outline">{state.statusLabel}</Badge>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {state.worldState}
                </p>
                <p className="mt-3 font-mono text-[9px] tracking-[0.06em] text-muted-foreground uppercase">
                  {state.referenceSource} · SHA {state.referenceSha256.slice(0, 12)}
                </p>
                <details className="group mt-4 border-t border-border pt-3">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-medium text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45 [&::-webkit-details-marker]:hidden">
                    Construction rules
                    <ChevronDown className="size-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <dl className="space-y-3 pb-1 pt-2">
                    {[
                      ["Composition", state.composition],
                      ["Material", state.material],
                      ["Light", state.light],
                      ["Camera", state.camera],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-xs text-muted-foreground">{label}</dt>
                        <dd className="mt-1 text-sm leading-5 text-foreground/85">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              </div>
            </Card>
          </li>
        ))}
      </ol>
    </section>
  );
}

function VisualScoreSection({ scoreRoom }: ScoreRoomProps) {
  return (
    <section aria-labelledby="visual-score-title">
      <ViewHeader
        index="04"
        id="visual-score-title"
        topic="Relationship editor"
        title="Visual Score"
        description="Select one segment, choose its relationship to the music, and save one explicit revision. Supporting evidence stays attached to that selection."
        status={`${scoreRoom.scoreSegments.length} contiguous segments`}
      />
      <VisualScoreWorkbench
        segments={scoreRoom.scoreSegments}
        shots={scoreRoom.shots}
      />
    </section>
  );
}

function ShotsSection({ scoreRoom }: ScoreRoomProps) {
  return (
    <section aria-labelledby="shots-title">
      <ViewHeader
        index="05"
        id="shots-title"
        topic="Shot direction"
        title="Turn the score into executable shots"
        description="Choose a shot in the rough cut, then inspect only its direction or its dramatic functions."
        status={`${scoreRoom.shots.length} locked shots`}
      />
      <ShotWorkbench shots={scoreRoom.shots} />
    </section>
  );
}

function ReviewSection({ scoreRoom, assemblySnapshot }: ScoreRoomPageProps) {
  const { provenance, reviewDemo } = scoreRoom;

  return (
    <section aria-labelledby="review-title">
      <ViewHeader
        index="06"
        id="review-title"
        topic="Review and repair"
        title="Make one evidence-backed take decision"
        description="Compare the failed and repaired take, apply the cheapest valid repair, then assemble the final cut."
        status="Decision workflow ready"
      />

      <ReviewRepairDemo review={reviewDemo} />
      <AssemblyExport
        initialSnapshot={assemblySnapshot}
        projectId={scoreRoom.project.id}
      />

      <div className="mt-5">
        <Disclosure label="Production provenance" meta="4 verified sources">
          <dl className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Audio", provenance.audioSource],
              ["Measurement", provenance.analysisEngine],
              ["Direction", provenance.directionSource],
              ["Assembly", assemblySnapshot ? "Validated export" : provenance.assemblyStatus],
            ].map(([label, value]) => (
              <div className="bg-card p-4" key={label}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-2 text-sm font-medium text-foreground">{value}</dd>
              </div>
            ))}
          </dl>
        </Disclosure>
      </div>
    </section>
  );
}

export function ScoreRoom({
  scoreRoom,
  assemblySnapshot,
  initialView = "score",
}: ScoreRoomPageProps) {
  const { project, fixture, filmBible, scoreSegments, shots } = scoreRoom;

  return (
    <WorkflowProvider
      projectId={project.id}
      initialProjectRevision={project.revision}
      initialVisualScoreStatus={scoreRoom.audiovisualContract.status}
    >
      <ScorePlaybackProvider
        src="/api/demo/media/score"
        startSeconds={0}
        endSeconds={project.audioDurationSeconds}
      >
        <WorkspaceNavigationProvider initialView={initialView}>
          <a
            className="fixed top-3 left-3 z-50 -translate-y-24 rounded-lg bg-foreground px-4 py-3 text-sm font-semibold text-background transition-transform focus:translate-y-0"
            href="#score-room-content"
          >
            Skip to Score Room content
          </a>

          <div className="grid h-dvh grid-rows-[64px_minmax(0,1fr)] overflow-hidden bg-background text-foreground">
            <header className="z-20 grid grid-cols-[264px_minmax(0,1fr)] items-center border-b border-border bg-background/90 px-4 backdrop-blur-xl max-[900px]:grid-cols-[minmax(0,1fr)_auto] max-[900px]:gap-4">
              <Link
                className="group flex min-h-11 min-w-0 items-center gap-3 rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45"
                href="/"
              >
                <span className="grid size-8 flex-none place-items-center rounded-full border border-primary/30 bg-primary/10 text-primary transition-colors duration-200 group-hover:bg-primary group-hover:text-primary-foreground">
                  <AudioLines className="size-3.5" aria-hidden="true" />
                </span>
                <span className="min-w-0 leading-tight">
                  <strong className="block truncate font-display text-sm font-normal text-foreground">
                    The Director Who Does Not Exist
                  </strong>
                  <small className="font-mono text-[8px] tracking-[0.15em] text-muted-foreground uppercase">
                    Score Room
                  </small>
                </span>
              </Link>

              <div className="flex min-w-0 items-center justify-between gap-5">
                <p className="flex min-w-0 items-center gap-2.5 font-mono text-[9px] tracking-[0.08em] text-muted-foreground uppercase max-[900px]:hidden">
                  <Home className="size-3.5" aria-hidden="true" />
                  <span>Project 001</span>
                  <span className="text-border" aria-hidden="true">/</span>
                  <strong className="truncate font-medium text-foreground/75">
                    {project.title}
                  </strong>
                </p>

                <Badge variant="success" className="ml-auto max-[520px]:px-2">
                  <Radio className="size-3" aria-hidden="true" />
                  <span className="max-[520px]:hidden">Offline fixture</span>
                  v{fixture.schemaVersion}
                </Badge>
              </div>
            </header>

            <div className="grid min-h-0 grid-cols-[264px_minmax(0,1fr)] max-[900px]:grid-cols-1 max-[900px]:grid-rows-[auto_minmax(0,1fr)]">
              <aside className="flex min-h-0 flex-col overflow-y-auto border-r border-border bg-card/35 max-[900px]:block max-[900px]:overflow-visible max-[900px]:border-r-0">
                <div className="border-b border-border p-5 max-[900px]:px-4 max-[900px]:py-3">
                  <p className="flex items-center gap-2 font-mono text-[9px] tracking-[0.1em] text-primary uppercase max-[680px]:hidden">
                    <Sparkles className="size-3" aria-hidden="true" />
                    {project.creationModeLabel}
                  </p>
                  <h1 className="mt-2.5 font-display text-[27px] leading-none font-normal tracking-[-0.035em] text-foreground max-[900px]:m-0 max-[900px]:truncate max-[900px]:text-xl" id="score-room-title">
                    {project.title}
                  </h1>
                  <p className="mt-3 flex items-center gap-2 truncate text-xs text-muted-foreground max-[900px]:hidden">
                    <Waves className="size-3.5 flex-none text-measured" aria-hidden="true" />
                    {project.audioTitle}
                  </p>
                </div>

                <WorkspaceNavigation />

                <div className="mt-auto border-t border-border p-5 max-[900px]:hidden" aria-label="Project status">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-xs font-medium text-foreground/85">
                      <LockKeyhole className="size-3.5 text-measured" aria-hidden="true" />
                      {filmBible.statusLabel} direction
                    </span>
                    <span className="font-mono text-[9px] text-muted-foreground">6/6</span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full w-full rounded-full bg-measured" />
                  </div>
                  <p className="mt-3 font-mono text-[8px] tracking-[0.07em] text-muted-foreground uppercase">
                    {scoreSegments.length} segments · {shots.length} locked shots
                  </p>
                </div>
              </aside>

              <main className="min-h-0 overflow-y-auto [scrollbar-gutter:stable]" id="score-room-content" tabIndex={-1}>
                <div className="mx-auto w-full max-w-[1180px] px-5 pb-16 max-[680px]:px-3.5">
                  <div className="sticky top-0 z-10 bg-gradient-to-b from-background from-78% to-transparent py-4 max-[680px]:py-3">
                    <ScoreTransport
                      title={project.audioTitle}
                      selectedRangeLabel={project.selectedRangeLabel}
                    />
                  </div>

                  <div className="py-4 sm:py-6">
                    <WorkspacePanel view="listen">
                      <ListeningSection scoreRoom={scoreRoom} />
                    </WorkspacePanel>
                    <WorkspacePanel view="direction">
                      <TreatmentsSection scoreRoom={scoreRoom} />
                    </WorkspacePanel>
                    <WorkspacePanel view="visual-world">
                      <VisualStatesSection scoreRoom={scoreRoom} />
                    </WorkspacePanel>
                    <WorkspacePanel view="score">
                      <VisualScoreSection scoreRoom={scoreRoom} />
                    </WorkspacePanel>
                    <WorkspacePanel view="shots">
                      <ShotsSection scoreRoom={scoreRoom} />
                    </WorkspacePanel>
                    <WorkspacePanel view="review">
                      <ReviewSection
                        scoreRoom={scoreRoom}
                        assemblySnapshot={assemblySnapshot}
                      />
                    </WorkspacePanel>
                  </div>
                </div>
              </main>
            </div>
          </div>
        </WorkspaceNavigationProvider>
      </ScorePlaybackProvider>
    </WorkflowProvider>
  );
}
