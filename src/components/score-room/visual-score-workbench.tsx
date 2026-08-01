"use client";

import { useState, useTransition } from "react";
import {
  CheckCircle2,
  ChevronDown,
  GitCompareArrows,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  Music2,
  Save,
  ShieldCheck,
} from "lucide-react";
import type { ScoreRoomProjection } from "@/components/score-room/score-room-data";
import { useWorkflowSnapshot } from "@/components/score-room/workflow-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { RelationshipMode } from "@/lib/domain/enums";

type ScoreSegment = ScoreRoomProjection["scoreSegments"][number];
type Shot = ScoreRoomProjection["shots"][number];

interface VisualScoreWorkbenchProps {
  segments: ScoreSegment[];
  shots: Shot[];
}

interface RelationshipRevisionResponse {
  changed: boolean;
  projectRevision: number;
  visualScoreStatus: "draft" | "approved" | "locked";
  segment: {
    id: string;
    revision: number;
    relationshipMode: RelationshipMode;
  };
  coverage: {
    valid: boolean;
    segmentCount: number;
    startSeconds: number;
    endSeconds: number;
    gaps: number;
    overlaps: number;
  };
  affectedShotIds: string[];
  protectedRecordIds: string[];
}

const relationshipOptions: Array<{
  value: RelationshipMode;
  label: string;
  description: string;
}> = [
  {
    value: "mirror",
    label: "Mirror",
    description: "Image follows the direction and timing of the music.",
  },
  {
    value: "counterpoint",
    label: "Counterpoint",
    description: "Image deliberately resists the musical movement.",
  },
  {
    value: "suspension",
    label: "Suspension",
    description: "Image holds through change or answers after a delay.",
  },
  {
    value: "motif_binding",
    label: "Motif binding",
    description: "A recurring sound remains bound to one visual motif.",
  },
];

const relationshipTone: Record<RelationshipMode, string> = {
  mirror: "border-t-measured text-measured",
  counterpoint: "border-t-primary text-primary",
  suspension: "border-t-violet-400 text-violet-300",
  motif_binding: "border-t-highlight text-highlight",
};

function relationshipCopy(mode: RelationshipMode) {
  return relationshipOptions.find((option) => option.value === mode)!;
}

async function responseError(response: Response) {
  try {
    const body = (await response.json()) as {
      error?: { message?: string };
    };
    return body.error?.message ?? "The workflow mutation failed.";
  } catch {
    return "The workflow mutation failed.";
  }
}

export function VisualScoreWorkbench({
  segments,
  shots,
}: VisualScoreWorkbenchProps) {
  const {
    projectId,
    projectRevision,
    visualScoreStatus,
    updateSnapshot,
  } = useWorkflowSnapshot();
  const initialSegment = segments[3] ?? segments[0];
  const [scoreSegments, setScoreSegments] = useState(segments);
  const [selectedSegmentId, setSelectedSegmentId] = useState(initialSegment.id);
  const [selectedMode, setSelectedMode] = useState<RelationshipMode>(
    initialSegment.relationshipMode,
  );
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [coverage, setCoverage] = useState({
    valid: true,
    segmentCount: segments.length,
    gaps: 0,
    overlaps: 0,
  });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const selectedSegment =
    scoreSegments.find((segment) => segment.id === selectedSegmentId) ??
    scoreSegments[0];
  const selectedShot = shots.find((shot) =>
    shot.visualScoreSegmentIds.includes(selectedSegment.id),
  );
  const timelineDuration = scoreSegments.reduce(
    (total, segment) => total + segment.durationSeconds,
    0,
  );
  const hasChanges = selectedMode !== selectedSegment.relationshipMode;

  function selectSegment(segment: ScoreSegment) {
    setSelectedSegmentId(segment.id);
    setSelectedMode(segment.relationshipMode);
    setDetailsOpen(false);
    setFeedback(null);
    setError(null);
  }

  function saveRelationship() {
    setError(null);
    setFeedback(null);
    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/visual-score/${encodeURIComponent(selectedSegment.id)}/relationship`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              expectedProjectRevision: projectRevision,
              relationshipMode: selectedMode,
            }),
          },
        );
        if (!response.ok) throw new Error(await responseError(response));

        const result = (await response.json()) as RelationshipRevisionResponse;
        const copy = relationshipCopy(result.segment.relationshipMode);
        setScoreSegments((current) =>
          current.map((segment) =>
            segment.id === result.segment.id
              ? {
                  ...segment,
                  revision: result.segment.revision,
                  relationshipMode: result.segment.relationshipMode,
                  relationshipLabel: copy.label,
                  relationshipDescription: copy.description,
                }
              : {
                  ...segment,
                  revision: segment.revision + (result.changed ? 1 : 0),
                },
          ),
        );
        setCoverage(result.coverage);
        updateSnapshot({
          projectRevision: result.projectRevision,
          visualScoreStatus: result.visualScoreStatus,
        });
        setFeedback(
          result.changed
            ? `Revision saved. ${result.affectedShotIds.length} linked shot remains protected.`
            : "This relationship is already saved.",
        );
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "The Visual Score revision could not be saved.",
        );
      }
    });
  }

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden rounded-2xl bg-card/70">
        <div className="flex min-h-12 items-center justify-between gap-4 border-b border-border px-4 font-mono text-[10px] tracking-[0.08em] text-muted-foreground uppercase sm:px-5">
          <span>00:00</span>
          <span className="hidden items-center gap-2 sm:flex">
            <CheckCircle2 className="size-3.5 text-measured" aria-hidden="true" />
            Full coverage · revision {projectRevision}
          </span>
          <span>01:01.3</span>
        </div>

        <div className="overflow-x-auto" role="region" aria-label="Visual score timeline">
          <ol className="flex min-w-[720px]">
            {scoreSegments.map((segment) => {
              const isSelected = segment.id === selectedSegment.id;
              return (
                <li
                  className="min-w-[108px]"
                  key={segment.id}
                  style={{
                    flexBasis: `${(segment.durationSeconds / timelineDuration) * 100}%`,
                  }}
                >
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    className={cn(
                      "group relative flex h-28 w-full cursor-pointer flex-col items-start justify-between border-t-2 border-r border-border bg-background/25 p-4 text-left outline-none transition-colors duration-200 hover:bg-accent focus-visible:z-10 focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/55",
                      relationshipTone[segment.relationshipMode],
                      isSelected && "bg-accent shadow-[inset_0_-3px_0_var(--primary)]",
                    )}
                    onClick={() => selectSegment(segment)}
                  >
                    <span className="flex w-full items-center justify-between font-mono text-[9px] text-muted-foreground tabular-nums">
                      {segment.number}
                      {isSelected ? <span className="text-primary">Editing</span> : null}
                    </span>
                    <span>
                      <strong className="block text-sm font-medium text-current">
                        {segment.relationshipLabel}
                      </strong>
                      <time className="mt-1 block font-mono text-[9px] text-muted-foreground tabular-nums">
                        {segment.rangeLabel}
                      </time>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </Card>

      <Card className="rounded-2xl bg-card/70">
        <header className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between lg:p-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">Segment {selectedSegment.number}</Badge>
              <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                {selectedSegment.rangeLabel}
              </span>
            </div>
            <h3 className="mt-3 text-xl font-semibold tracking-tight text-foreground">
              Shape its relationship to the score
            </h3>
          </div>
          <Badge variant={visualScoreStatus === "draft" ? "default" : "success"}>
            {visualScoreStatus === "draft" ? (
              <Layers3 aria-hidden="true" />
            ) : (
              <ShieldCheck aria-hidden="true" />
            )}
            Visual Score {visualScoreStatus}
          </Badge>
        </header>

        <div className="p-5 lg:p-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="grid gap-2 sm:grid-cols-[220px_minmax(0,1fr)] sm:items-end sm:gap-4">
              <label className="space-y-2" htmlFor="relationship-mode">
                <span className="block text-sm font-medium text-foreground">
                  Audiovisual relationship
                </span>
                <Select
                  value={selectedMode}
                  disabled={isPending || visualScoreStatus === "locked"}
                  onValueChange={(value) =>
                    setSelectedMode(value as RelationshipMode)
                  }
                >
                  <SelectTrigger id="relationship-mode">
                    <SelectValue>
                      {relationshipCopy(selectedMode).label}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {relationshipOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <p className="rounded-xl border border-border bg-background/35 px-4 py-3 text-sm leading-6 text-muted-foreground">
                {relationshipCopy(selectedMode).description}
              </p>
            </div>
            <Button
              type="button"
              className="min-w-44"
              disabled={
                isPending ||
                visualScoreStatus === "locked" ||
                !hasChanges
              }
              onClick={saveRelationship}
            >
              {isPending ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : (
                <Save aria-hidden="true" />
              )}
              {isPending ? "Saving revision…" : "Save relationship"}
            </Button>
          </div>

          <div className="mt-5 grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3">
            <div className="bg-background/60 p-4">
              <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Music2 className="size-3.5 text-measured" aria-hidden="true" />
                Narrative state
              </span>
              <p className="mt-2 text-sm leading-6 text-foreground/90">
                {selectedSegment.narrativeState}
              </p>
            </div>
            <div className="bg-background/60 p-4">
              <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Layers3 className="size-3.5 text-highlight" aria-hidden="true" />
                Visual state
              </span>
              <p className="mt-2 text-sm leading-6 text-foreground/90">
                {selectedSegment.visualStateDescription}
              </p>
            </div>
            <div className="bg-background/60 p-4">
              <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <GitCompareArrows className="size-3.5 text-primary" aria-hidden="true" />
                Transition
              </span>
              <p className="mt-2 text-sm leading-6 text-foreground/90">
                {selectedSegment.transitionStrategy}
              </p>
            </div>
          </div>

          <Collapsible
            className="mt-5 rounded-xl border border-border bg-background/25"
            open={detailsOpen}
            onOpenChange={setDetailsOpen}
          >
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="h-12 w-full justify-between rounded-xl px-4 text-sm"
              >
                <span className="flex items-center gap-2">
                  <LockKeyhole className="size-4 text-measured" aria-hidden="true" />
                  Evidence and linked shot
                  <Badge variant="outline" className="ml-1">
                    {selectedSegment.musicEvidence.length} cues
                  </Badge>
                </span>
                <ChevronDown
                  className={cn(
                    "transition-transform duration-200",
                    detailsOpen && "rotate-180",
                  )}
                  aria-hidden="true"
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="border-t border-border p-4 sm:p-5">
              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <h4 className="text-sm font-semibold text-foreground">
                    Timestamped music evidence
                  </h4>
                  <ol className="mt-3 space-y-2">
                    {selectedSegment.musicEvidence.map((evidence) => (
                      <li
                        className="rounded-lg border border-border bg-card/60 p-3"
                        key={`${evidence.kind}-${evidence.time_seconds}`}
                      >
                        <span className="font-mono text-[10px] text-measured tabular-nums">
                          {evidence.timeLabel} · {evidence.kindLabel}
                        </span>
                        <p className="mt-1.5 text-sm leading-5 text-muted-foreground">
                          {evidence.description}
                        </p>
                      </li>
                    ))}
                  </ol>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-foreground">
                    Protected execution
                  </h4>
                  {selectedShot ? (
                    <div className="mt-3 rounded-xl border border-measured/20 bg-measured/[0.04] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <strong className="text-base font-semibold text-foreground">
                            {selectedShot.title}
                          </strong>
                          <p className="mt-1 font-mono text-[10px] text-muted-foreground tabular-nums">
                            {selectedShot.rangeLabel}
                          </p>
                        </div>
                        <Badge variant="success">
                          <LockKeyhole aria-hidden="true" />
                          {selectedShot.statusLabel}
                        </Badge>
                      </div>
                      <p className="mt-4 text-sm leading-6 text-muted-foreground">
                        {selectedShot.musicalFunction}
                      </p>
                      <p className="mt-3 border-t border-measured/15 pt-3 text-xs leading-5 text-measured">
                        The locked ShotSpec is never silently rewritten by a
                        score revision.
                      </p>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">
                      No ShotSpec is linked to this segment.
                    </p>
                  )}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="size-3.5 text-measured" aria-hidden="true" />
              {coverage.valid ? "Full score coverage" : "Coverage needs repair"}
            </span>
            <span className="font-mono text-[10px] tabular-nums">
              {coverage.segmentCount} segments · {coverage.gaps} gaps · {coverage.overlaps} overlaps · {selectedSegment.confidencePercent}% confidence
            </span>
          </div>

          {feedback ? (
            <p className="mt-4 rounded-lg border border-measured/20 bg-measured/[0.06] px-4 py-3 text-sm text-measured" role="status">
              {feedback}
            </p>
          ) : null}
          {error ? (
            <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-red-300" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
