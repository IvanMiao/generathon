"use client";

import { useState, useTransition } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  LoaderCircle,
  LockKeyhole,
  RotateCcw,
  Scissors,
  ShieldCheck,
} from "lucide-react";
import type { ScoreRoomProjection } from "@/components/score-room/score-room-data";
import { useWorkflowSnapshot } from "@/components/score-room/workflow-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ReviewDemo = ScoreRoomProjection["reviewDemo"];

interface ReviewRepairDemoProps {
  review: ReviewDemo;
}

interface ReviewDecisionResponse {
  changed: boolean;
  projectRevision: number;
  workflowState: "diagnosed" | "repaired" | "locked";
  recordedDecisionIds: string[];
}

async function responseError(response: Response) {
  try {
    const body = (await response.json()) as {
      error?: { message?: string };
    };
    return body.error?.message ?? "The review decision failed.";
  } catch {
    return "The review decision failed.";
  }
}

export function ReviewRepairDemo({ review }: ReviewRepairDemoProps) {
  const {
    projectId,
    projectRevision,
    visualScoreStatus,
    updateSnapshot,
  } = useWorkflowSnapshot();
  const [workflowState, setWorkflowState] = useState(review.workflowState);
  const [selectedTake, setSelectedTake] = useState<"failed" | "repaired">(
    review.workflowState === "diagnosed" ? "failed" : "repaired",
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const showingRepair = selectedTake === "repaired";
  const evidence = showingRepair
    ? review.repairedEvidence
    : review.failedEvidence;
  const summary = showingRepair
    ? review.repairedSummary
    : review.failedSummary;
  const generationEligible =
    review.generationEligible && visualScoreStatus !== "draft";

  function recordAction(action: "apply_repair" | "lock_take" | "reset") {
    setError(null);
    setFeedback(null);
    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/review/decision`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action,
              expectedProjectRevision: projectRevision,
            }),
          },
        );
        if (!response.ok) throw new Error(await responseError(response));

        const result = (await response.json()) as ReviewDecisionResponse;
        setWorkflowState(result.workflowState);
        setSelectedTake(
          result.workflowState === "diagnosed" ? "failed" : "repaired",
        );
        updateSnapshot({ projectRevision: result.projectRevision });
        setFeedback(
          result.changed
            ? `Decision persisted in project revision ${result.projectRevision}.`
            : "This decision is already recorded.",
        );
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "The review decision could not be saved.",
        );
      }
    });
  }

  const statusLabel =
    workflowState === "locked"
      ? "Take locked"
      : workflowState === "repaired"
        ? "Repair persisted"
        : "Needs decision";

  const primaryLabel =
    workflowState === "locked"
      ? "Locked in rough cut"
      : workflowState === "repaired"
        ? "Lock repaired take"
        : "Apply editorial repair";

  return (
    <Card className="overflow-hidden rounded-2xl bg-card/70">
      <header className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between lg:p-6">
        <div>
          <p className="font-mono text-[10px] tracking-[0.1em] text-primary uppercase">
            Recorded production sample
          </p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
            {showingRepair ? "Repaired take" : "Beautiful, but wrong"}
          </h3>
        </div>
        <Badge variant={workflowState === "locked" ? "success" : "outline"}>
          {workflowState === "locked" ? (
            <LockKeyhole aria-hidden="true" />
          ) : (
            <AlertTriangle aria-hidden="true" />
          )}
          {statusLabel}
        </Badge>
      </header>

      <div className="p-5 lg:p-6">
        <Tabs
          value={selectedTake}
          onValueChange={(value) =>
            setSelectedTake(value as "failed" | "repaired")
          }
        >
          <TabsList aria-label="Take comparison">
            <TabsTrigger value="failed">Failed take</TabsTrigger>
            <TabsTrigger value="repaired">Repaired take</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="mt-4 overflow-hidden rounded-xl border border-border bg-black">
          <video
            className="aspect-video w-full bg-black object-contain"
            key={showingRepair ? "repaired" : "failed"}
            controls
            muted
            playsInline
            preload="metadata"
            src={
              showingRepair
                ? "/api/demo/media/repaired-take"
                : "/api/demo/media/failed-take"
            }
          >
            <track kind="captions" />
          </video>
          <p className="border-t border-border bg-card/80 px-4 py-2.5 text-xs text-muted-foreground">
            Generated audio muted · master score restored in assembly
          </p>
        </div>

        <blockquote className="mt-5 border-l-2 border-primary pl-4 text-base leading-7 text-foreground/90">
          {summary}
        </blockquote>

        <ol className="mt-5 grid gap-3 md:grid-cols-2">
          {evidence.map((item) => (
            <li className="rounded-xl border border-border bg-background/35 p-4" key={item.id}>
              <span className="font-mono text-[10px] text-primary tabular-nums">
                {item.rangeLabel} · {item.dimensionLabel}
              </span>
              <p className="mt-2 text-sm leading-6 text-foreground/90">
                {item.finding}
              </p>
              <small className="mt-3 block text-xs text-muted-foreground">
                {item.confidencePercent}% confidence · {item.sourceLabel}
              </small>
            </li>
          ))}
        </ol>

        <div className="mt-5 rounded-2xl border border-highlight/20 bg-highlight/[0.045] p-4 sm:p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <span className="flex items-center gap-2 text-xs font-medium text-highlight">
                <Scissors className="size-4" aria-hidden="true" />
                Selected repair · {review.repairLayerLabel}
              </span>
              <p className="mt-2 text-sm leading-6 text-foreground/90">
                {review.repairOperation}
              </p>
              <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <DollarSign className="size-3.5 text-measured" aria-hidden="true" />
                {review.preservedFields.length} locked properties preserved ·
                zero model cost
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              {workflowState === "locked" ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => recordAction("reset")}
                >
                  <RotateCcw aria-hidden="true" />
                  Restart walkthrough
                </Button>
              ) : null}
              <Button
                type="button"
                className="min-w-48"
                disabled={isPending || workflowState === "locked"}
                onClick={() =>
                  recordAction(
                    workflowState === "diagnosed"
                      ? "apply_repair"
                      : "lock_take",
                  )
                }
              >
                {isPending ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : workflowState === "repaired" ? (
                  <LockKeyhole aria-hidden="true" />
                ) : (
                  <Scissors aria-hidden="true" />
                )}
                {isPending ? "Saving decision…" : primaryLabel}
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 rounded-xl border border-border bg-background/25 p-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            {generationEligible ? (
              <CheckCircle2 className="size-4 text-measured" aria-hidden="true" />
            ) : (
              <ShieldCheck className="size-4 text-highlight" aria-hidden="true" />
            )}
            {generationEligible
              ? "Generation gate ready"
              : "Generation gate blocked"}
          </span>
          <span className="text-xs text-muted-foreground">
            {review.quotaRemaining}/{review.quotaLimit} daily calls remain ·
            editorial repair preferred
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
  );
}
