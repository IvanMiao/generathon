"use client";

import { useState, useTransition } from "react";
import {
  GitCompareArrows,
  LoaderCircle,
  Save,
  ShieldCheck,
} from "lucide-react";
import type { ScoreRoomProjection } from "@/components/score-room/score-room-data";
import { formatTimestamp } from "@/components/score-room/score-room-format";
import { useWorkflowSnapshot } from "@/components/score-room/workflow-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type AnalysisRevision = ScoreRoomProjection["analysisRevision"];

interface AnalysisBoundaryRevisionResponse {
  changed: boolean;
  projectRevision: number;
  analysisRevision: {
    id: string;
    revision: number;
    note: string;
    sections: Array<{
      id: string;
      label: string;
      startSeconds: number;
      endSeconds: number;
      source: "measured" | "user";
    }>;
  };
  invalidatedRecordIds: string[];
  protectedRecordIds: string[];
}

interface RevisionImpact {
  invalidatedCount: number;
  protectedCount: number;
}

function responseError(response: Response) {
  return response
    .json()
    .then((body: { error?: { message?: string } }) =>
      body.error?.message ?? "The section-boundary revision could not be saved.",
    )
    .catch(() => "The section-boundary revision could not be saved.");
}

export function AnalysisRevisionWorkbench({
  analysisRevision,
}: {
  analysisRevision: AnalysisRevision;
}) {
  const { projectId, projectRevision, updateSnapshot } = useWorkflowSnapshot();
  const [sections, setSections] = useState(analysisRevision.sections);
  const [revision, setRevision] = useState(analysisRevision.revision);
  const [note, setNote] = useState(analysisRevision.note);
  const [selectedSectionId, setSelectedSectionId] = useState(
    analysisRevision.sections[0]?.id ?? "",
  );
  const [boundaryValue, setBoundaryValue] = useState(
    () => String(analysisRevision.sections[0]?.endSeconds ?? ""),
  );
  const [impact, setImpact] = useState<RevisionImpact | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const boundaryOptions = sections.slice(0, -1).map((left, index) => ({
    left,
    right: sections[index + 1],
  }));
  const selectedBoundary =
    boundaryOptions.find((option) => option.left.id === selectedSectionId) ??
    boundaryOptions[0];
  const boundarySeconds = Number(boundaryValue);
  const isInsideAdjacentSections =
    Boolean(selectedBoundary) &&
    Number.isFinite(boundarySeconds) &&
    boundarySeconds > (selectedBoundary?.left.startSeconds ?? 0) + 0.001 &&
    boundarySeconds < (selectedBoundary?.right.endSeconds ?? 0) - 0.001;
  const isChanged =
    Boolean(selectedBoundary) &&
    Math.abs(boundarySeconds - (selectedBoundary?.left.endSeconds ?? 0)) > 0.0005;

  function selectBoundary(sectionId: string) {
    const option = boundaryOptions.find((candidate) => candidate.left.id === sectionId);
    if (!option) return;

    setSelectedSectionId(sectionId);
    setBoundaryValue(String(option.left.endSeconds));
    setFeedback(null);
    setError(null);
  }

  function saveBoundary() {
    if (!selectedBoundary || !isInsideAdjacentSections) return;

    setFeedback(null);
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/music-analysis-revisions/${encodeURIComponent(analysisRevision.id)}/boundaries/${encodeURIComponent(selectedBoundary.left.id)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              expectedProjectRevision: projectRevision,
              boundarySeconds,
            }),
          },
        );
        if (!response.ok) throw new Error(await responseError(response));

        const result = (await response.json()) as AnalysisBoundaryRevisionResponse;
        setSections(
          result.analysisRevision.sections.map((section) => ({
            ...section,
            rangeLabel: `${formatTimestamp(section.startSeconds)}–${formatTimestamp(section.endSeconds)}`,
            sourceLabel: section.source === "user" ? "User" : "Measured",
          })),
        );
        setRevision(result.analysisRevision.revision);
        setNote(result.analysisRevision.note);
        setBoundaryValue(String(boundarySeconds));
        setImpact({
          invalidatedCount: result.invalidatedRecordIds.length,
          protectedCount: result.protectedRecordIds.length,
        });
        updateSnapshot({ projectRevision: result.projectRevision });
        setFeedback(
          result.changed
            ? `Revision v${result.analysisRevision.revision} saved. The raw MusicAnalysis remains unchanged.`
            : "This shared boundary is already saved.",
        );
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "The section-boundary revision could not be saved.",
        );
      }
    });
  }

  if (!selectedBoundary) return null;

  return (
    <Card className="mt-5 overflow-hidden rounded-2xl bg-card/70">
      <header className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between lg:p-6">
        <div>
          <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.1em] text-measured uppercase">
            <GitCompareArrows className="size-3.5" aria-hidden="true" />
            Human correction layer
          </p>
          <h3 className="mt-2 text-xl font-semibold text-foreground">
            Refine a measured section boundary
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Adjust one shared boundary at a time. The immutable signal analysis stays visible above; this creates a sequential MusicAnalysisRevision for directorial use.
          </p>
        </div>
        <Badge variant="outline">Revision {revision}</Badge>
      </header>

      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(270px,0.8fr)] lg:p-6">
        <div className="space-y-4">
          <label className="grid gap-2 text-sm font-medium text-foreground">
            Shared boundary
            <Select value={selectedBoundary.left.id} onValueChange={selectBoundary}>
              <SelectTrigger className="h-11 w-full bg-background/60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {boundaryOptions.map((option) => (
                  <SelectItem key={option.left.id} value={option.left.id}>
                    {option.left.label} → {option.right.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="grid gap-2 text-sm font-medium text-foreground" htmlFor="analysis-boundary-seconds">
            Boundary time <span className="font-mono text-xs font-normal text-muted-foreground">seconds from the track start</span>
            <input
              className="h-11 rounded-lg border border-input bg-background/60 px-3 font-mono text-sm tabular-nums outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/45"
              id="analysis-boundary-seconds"
              inputMode="decimal"
              max={selectedBoundary.right.endSeconds - 0.001}
              min={selectedBoundary.left.startSeconds + 0.001}
              onChange={(event) => setBoundaryValue(event.target.value)}
              step="0.001"
              type="number"
              value={boundaryValue}
            />
          </label>

          <p className="rounded-lg border border-border bg-background/35 px-3 py-2 font-mono text-[10px] leading-5 text-muted-foreground tabular-nums">
            Valid between {formatTimestamp(selectedBoundary.left.startSeconds)} and {formatTimestamp(selectedBoundary.right.endSeconds)}. Both adjacent ranges move together, so the correction remains continuous.
          </p>

          <Button
            className="min-h-11"
            disabled={!isChanged || !isInsideAdjacentSections || isPending}
            onClick={saveBoundary}
            type="button"
          >
            {isPending ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <Save aria-hidden="true" />
            )}
            Save boundary revision
          </Button>
          {!isInsideAdjacentSections ? (
            <p className="text-xs leading-5 text-destructive">
              Keep the boundary strictly inside the two adjacent sections.
            </p>
          ) : null}
        </div>

        <aside className="rounded-xl border border-measured/20 bg-measured/[0.04] p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ShieldCheck className="size-4 text-measured" aria-hidden="true" />
            Revision safeguards
          </p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{note}</p>
          <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-measured/15 pt-4 text-xs">
            <div>
              <dt className="text-muted-foreground">Raw analysis</dt>
              <dd className="mt-1 font-medium text-measured">Immutable</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Project revision</dt>
              <dd className="mt-1 font-mono font-medium text-foreground">v{projectRevision}</dd>
            </div>
            {impact ? (
              <>
                <div>
                  <dt className="text-muted-foreground">Unlocked follow-up</dt>
                  <dd className="mt-1 font-medium text-foreground">{impact.invalidatedCount} records</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Locked protection</dt>
                  <dd className="mt-1 font-medium text-measured">{impact.protectedCount} records</dd>
                </div>
              </>
            ) : null}
          </dl>
        </aside>
      </div>

      {feedback ? (
        <p className="border-t border-measured/20 bg-measured/[0.06] px-5 py-3 text-sm text-measured" role="status">
          {feedback}
        </p>
      ) : null}
      {error ? (
        <p className="border-t border-destructive/30 bg-destructive/10 px-5 py-3 text-sm text-red-300" role="alert">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
