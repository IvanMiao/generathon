"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  FileCheck2,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  X,
} from "lucide-react";
import type { ScoreRoomProjection } from "@/components/score-room/score-room-data";
import { useWorkflowSnapshot } from "@/components/score-room/workflow-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type ManualTake = ScoreRoomProjection["shots"][number]["manualTakes"][number];

interface CandidateTakeReviewProps {
  takes: ManualTake[];
}

interface CandidateTakeWorkflowResponse {
  projectRevision: number;
  take: {
    id: string;
    status: ManualTake["status"];
    locked: boolean;
    revision: number;
  };
  review: {
    id: string;
    status: string;
    accepted: boolean;
    summary: string;
  } | null;
  decision: { decision: "accept"; targetId: string } | null;
}

function responseError(response: Response) {
  return response
    .json()
    .then((body: { error?: { message?: string } }) =>
      body.error?.message ?? "The candidate Take could not be updated.",
    )
    .catch(() => "The candidate Take could not be updated.");
}

function statusVariant(take: ManualTake) {
  return take.locked ? "success" : "outline";
}

export function CandidateTakeReview({ takes }: CandidateTakeReviewProps) {
  const router = useRouter();
  const { projectId, projectRevision, updateSnapshot } = useWorkflowSnapshot();
  const [confirmationTakeId, setConfirmationTakeId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function applyResult(result: CandidateTakeWorkflowResponse) {
    updateSnapshot({ projectRevision: result.projectRevision });
    router.refresh();
  }

  function reviewTake(takeId: string) {
    setConfirmationTakeId(null);
    setFeedback(null);
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/takes/${encodeURIComponent(takeId)}/review`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ expectedProjectRevision: projectRevision }),
          },
        );
        if (!response.ok) throw new Error(await responseError(response));

        const result = (await response.json()) as CandidateTakeWorkflowResponse;
        applyResult(result);
        setFeedback("Mechanical review recorded. Preview the Take before making the lock decision.");
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "The candidate Take could not be reviewed.",
        );
      }
    });
  }

  function lockTake(takeId: string) {
    setFeedback(null);
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/takes/${encodeURIComponent(takeId)}/lock`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              expectedProjectRevision: projectRevision,
              confirmed: true,
            }),
          },
        );
        if (!response.ok) throw new Error(await responseError(response));

        const result = (await response.json()) as CandidateTakeWorkflowResponse;
        applyResult(result);
        setConfirmationTakeId(null);
        setFeedback("Take locked. It is now eligible for a future AssemblyRun selection.");
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "The candidate Take could not be locked.",
        );
      }
    });
  }

  if (takes.length === 0) return null;

  return (
    <section className="mt-5 space-y-4" aria-labelledby="candidate-take-review-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] tracking-[0.1em] text-highlight uppercase">
            Candidate review
          </p>
          <h4 className="mt-2 text-base font-semibold text-foreground" id="candidate-take-review-title">
            Preview, review, then lock deliberately
          </h4>
        </div>
        <Badge variant="outline">{takes.length} imported Take{takes.length === 1 ? "" : "s"}</Badge>
      </div>

      {takes.map((take) => {
        const awaitingConfirmation = confirmationTakeId === take.id;
        return (
          <article className="overflow-hidden rounded-xl border border-border bg-background/30" key={take.id}>
            <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(260px,0.7fr)] lg:p-5">
              <div>
                <div className="overflow-hidden rounded-lg border border-border bg-black">
                  <video
                    className="aspect-video w-full bg-black object-contain"
                    controls
                    muted
                    playsInline
                    preload="metadata"
                    src={take.mediaSrc}
                  />
                </div>
                <p className="mt-2 font-mono text-[10px] text-muted-foreground">
                  SHA-256 {take.sha256.slice(0, 12)} · revision {take.revision}
                </p>
              </div>

              <div className="flex flex-col items-start">
                <Badge variant={statusVariant(take)}>
                  {take.locked ? <LockKeyhole aria-hidden="true" /> : <FileCheck2 aria-hidden="true" />}
                  {take.statusLabel}
                </Badge>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">
                  {take.review
                    ? take.review.summary
                    : "No ReviewReport exists yet. Record the mechanical admission before considering this candidate for the cut."}
                </p>

                {take.locked ? (
                  <p className="mt-4 flex items-center gap-2 rounded-lg border border-measured/20 bg-measured/[0.05] px-3 py-2 text-xs leading-5 text-measured">
                    <CheckCircle2 className="size-3.5" aria-hidden="true" />
                    Explicitly accepted and protected from further mutation.
                  </p>
                ) : take.status === "candidate" ? (
                  <Button className="mt-5" disabled={isPending} onClick={() => reviewTake(take.id)} type="button">
                    {isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}
                    Record mechanical review
                  </Button>
                ) : awaitingConfirmation ? (
                  <div className="mt-5 w-full rounded-xl border border-primary/30 bg-primary/[0.06] p-3">
                    <p className="text-sm font-medium text-foreground">
                      Lock this accepted Take for future assembly?
                    </p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      Locking is an explicit editorial decision and prevents future mutation.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button disabled={isPending} onClick={() => lockTake(take.id)} size="sm" type="button">
                        {isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />}
                        Confirm lock
                      </Button>
                      <Button disabled={isPending} onClick={() => setConfirmationTakeId(null)} size="sm" type="button" variant="outline">
                        <X aria-hidden="true" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button className="mt-5" disabled={isPending || !take.review?.accepted} onClick={() => setConfirmationTakeId(take.id)} type="button">
                    <LockKeyhole aria-hidden="true" />
                    Lock reviewed candidate
                  </Button>
                )}
              </div>
            </div>
          </article>
        );
      })}

      {feedback ? (
        <p className="rounded-lg border border-measured/20 bg-measured/[0.05] px-3 py-2 text-xs leading-5 text-measured" aria-live="polite">
          {feedback}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-destructive/25 bg-destructive/[0.06] px-3 py-2 text-xs leading-5 text-destructive" aria-live="polite">
          {error}
        </p>
      ) : null}
    </section>
  );
}
