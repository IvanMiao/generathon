"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Clapperboard,
  FileVideo,
  Film,
  LockKeyhole,
  LoaderCircle,
  Upload,
  WandSparkles,
} from "lucide-react";
import { CandidateTakeReview } from "@/components/score-room/candidate-take-review";
import type { ScoreRoomProjection } from "@/components/score-room/score-room-data";
import { useWorkflowSnapshot } from "@/components/score-room/workflow-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type Shot = ScoreRoomProjection["shots"][number];

interface ShotWorkbenchProps {
  shots: Shot[];
}

interface ManualTakeImportResponse {
  projectRevision: number;
  take: { id: string; shotSpecId: string };
  media: {
    durationSeconds: number;
    video: { codec: string; width: number; height: number; frameRate: string };
    audio: { present: boolean };
  };
}

function responseError(response: Response) {
  return response
    .json()
    .then((body: { error?: { message?: string } }) =>
      body.error?.message ?? "The manual Take could not be imported.",
    )
    .catch(() => "The manual Take could not be imported.");
}

export function ShotWorkbench({ shots }: ShotWorkbenchProps) {
  const router = useRouter();
  const { projectId, projectRevision, updateSnapshot } = useWorkflowSnapshot();
  const [selectedShotId, setSelectedShotId] = useState(shots[0].id);
  const fileInput = useRef<HTMLInputElement>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const selectedShot =
    shots.find((shot) => shot.id === selectedShotId) ?? shots[0];

  function selectShot(shotId: string) {
    setSelectedShotId(shotId);
    if (fileInput.current) fileInput.current.value = "";
    setSelectedFileName(null);
    setFeedback(null);
    setError(null);
  }

  function importManualTake() {
    const file = fileInput.current?.files?.[0];
    if (!file || !selectedShot) return;

    setFeedback(null);
    setError(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("expectedProjectRevision", String(projectRevision));
        formData.set("file", file);
        const response = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/shots/${encodeURIComponent(selectedShot.id)}/manual-takes`,
          { method: "POST", body: formData },
        );
        if (!response.ok) throw new Error(await responseError(response));

        const result = (await response.json()) as ManualTakeImportResponse;
        updateSnapshot({ projectRevision: result.projectRevision });
        if (fileInput.current) fileInput.current.value = "";
        setSelectedFileName(null);
        setFeedback(
          `Candidate ${result.take.id} imported: ${result.media.durationSeconds.toFixed(3)}s · ${result.media.video.codec} · ${result.media.video.width}×${result.media.video.height} · ${result.media.video.frameRate} fps${result.media.audio.present ? " · audio present" : " · silent"}.`,
        );
        router.refresh();
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "The manual Take could not be imported.",
        );
      }
    });
  }

  if (!selectedShot) return null;

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden rounded-2xl bg-card/70">
        <div className="flex min-h-12 items-center justify-between gap-4 border-b border-border px-5">
          <span className="font-mono text-[10px] tracking-[0.08em] text-muted-foreground uppercase">
            Rough cut / {shots.length} shots
          </span>
          <Badge variant="success">
            <LockKeyhole aria-hidden="true" />
            All locked
          </Badge>
        </div>
        <ol className="flex overflow-x-auto" aria-label="Shot list">
          {shots.map((shot) => {
            const isSelected = shot.id === selectedShot.id;
            return (
              <li className="min-w-36 flex-1" key={shot.id}>
                <button
                  type="button"
                  aria-pressed={isSelected}
                  className={cn(
                    "flex h-24 w-full cursor-pointer flex-col justify-between border-r border-border bg-background/25 p-4 text-left outline-none transition-colors duration-200 hover:bg-accent focus-visible:z-10 focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/45",
                    isSelected && "bg-accent shadow-[inset_0_-3px_0_var(--primary)]",
                  )}
                  onClick={() => selectShot(shot.id)}
                >
                  <span className="flex items-center justify-between font-mono text-[9px] text-muted-foreground">
                    {shot.number}
                    {isSelected ? <span className="text-primary">Selected</span> : null}
                  </span>
                  <span>
                    <strong className="block text-sm font-medium text-foreground">
                      {shot.title}
                    </strong>
                    <time className="mt-1 block font-mono text-[9px] text-muted-foreground tabular-nums">
                      {shot.rangeLabel}
                    </time>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </Card>

      <Card className="rounded-2xl bg-card/70">
        <header className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between lg:p-6">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{selectedShot.title}</Badge>
              <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                {selectedShot.rangeLabel}
              </span>
            </div>
            <h3 className="mt-3 text-xl font-semibold tracking-tight text-foreground">
              Executable shot direction
            </h3>
          </div>
          <Badge variant="success">
            <CheckCircle2 aria-hidden="true" />
            {selectedShot.statusLabel}
          </Badge>
        </header>

        <div className="p-5 lg:p-6">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-background/35 px-4 py-3 text-sm text-foreground">
            <span>{selectedShot.startState.name}</span>
            <ArrowRight className="size-4 text-primary" aria-hidden="true" />
            <span>{selectedShot.endState.name}</span>
          </div>

          <Tabs defaultValue="direction" className="mt-5">
            <TabsList>
              <TabsTrigger value="direction">Direction</TabsTrigger>
              <TabsTrigger value="functions">Functions</TabsTrigger>
            </TabsList>

            <TabsContent value="direction">
              <dl className="grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3">
                <div className="bg-background/55 p-4">
                  <dt className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Camera className="size-3.5 text-measured" aria-hidden="true" />
                    Camera
                  </dt>
                  <dd className="mt-2 text-sm leading-6 text-foreground/90">
                    {selectedShot.camera}
                  </dd>
                </div>
                <div className="bg-background/55 p-4">
                  <dt className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Clapperboard className="size-3.5 text-highlight" aria-hidden="true" />
                    Action
                  </dt>
                  <dd className="mt-2 text-sm leading-6 text-foreground/90">
                    {selectedShot.action}
                  </dd>
                </div>
                <div className="bg-background/55 p-4">
                  <dt className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Film className="size-3.5 text-primary" aria-hidden="true" />
                    Transition
                  </dt>
                  <dd className="mt-2 text-sm leading-6 text-foreground/90">
                    {selectedShot.transition}
                  </dd>
                </div>
              </dl>
            </TabsContent>

            <TabsContent value="functions">
              <dl className="grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3">
                {[
                  ["Musical", selectedShot.musicalFunction],
                  ["Narrative", selectedShot.narrativeFunction],
                  ["Visual", selectedShot.visualFunction],
                ].map(([label, value]) => (
                  <div className="bg-background/55 p-4" key={label}>
                    <dt className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <WandSparkles className="size-3.5 text-primary" aria-hidden="true" />
                      {label} function
                    </dt>
                    <dd className="mt-2 text-sm leading-6 text-foreground/90">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </TabsContent>
          </Tabs>

          <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>Execution provider</span>
            <Badge variant="outline">{selectedShot.preferredProvider}</Badge>
          </footer>

          <section
            className="mt-5 rounded-xl border border-primary/20 bg-primary/[0.035] p-4"
            aria-labelledby="manual-take-import-title"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.1em] text-primary uppercase">
                  <Upload className="size-3.5" aria-hidden="true" />
                  Provider-neutral handoff
                </p>
                <h4 className="mt-2 text-base font-semibold text-foreground" id="manual-take-import-title">
                  Import a manually generated Take
                </h4>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Attach an MP4 exported from any approved tool. It is mechanically checked for a timed H.264 stream, stored as a candidate, and never changes this locked ShotSpec.
                </p>
              </div>
              <Badge variant="outline">
                <FileVideo aria-hidden="true" />
                {selectedShot.manualTakeCount} manual Take{selectedShot.manualTakeCount === 1 ? "" : "s"}
              </Badge>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="grid min-w-0 flex-1 gap-2 text-sm font-medium text-foreground" htmlFor="manual-take-file">
                MP4 file <span className="font-normal text-muted-foreground">H.264 · up to 512 MB</span>
                <input
                  accept="video/mp4,.mp4"
                  className="block h-11 w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground file:mr-3 file:cursor-pointer file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-[3px] focus-visible:ring-ring/45"
                  id="manual-take-file"
                  ref={fileInput}
                  type="file"
                  onChange={(event) => {
                    setSelectedFileName(event.target.files?.[0]?.name ?? null);
                    setFeedback(null);
                    setError(null);
                  }}
                />
              </label>
              <Button
                disabled={!selectedFileName || isPending}
                onClick={importManualTake}
                type="button"
              >
                {isPending ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : (
                  <Upload aria-hidden="true" />
                )}
                Import candidate
              </Button>
            </div>

            {feedback ? (
              <p className="mt-4 rounded-lg border border-measured/20 bg-measured/[0.05] px-3 py-2 text-xs leading-5 text-measured" aria-live="polite">
                {feedback}
              </p>
            ) : null}
            {error ? (
              <p className="mt-4 rounded-lg border border-destructive/25 bg-destructive/[0.06] px-3 py-2 text-xs leading-5 text-destructive" aria-live="polite">
                {error}
              </p>
            ) : null}
          </section>

          <CandidateTakeReview takes={selectedShot.manualTakes} />
        </div>
      </Card>
    </div>
  );
}
