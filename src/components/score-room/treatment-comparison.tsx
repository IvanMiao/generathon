"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Eye,
  LoaderCircle,
  LockKeyhole,
  Save,
} from "lucide-react";
import type { ScoreRoomProjection } from "@/components/score-room/score-room-data";
import { useWorkflowSnapshot } from "@/components/score-room/workflow-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Treatment = ScoreRoomProjection["treatments"][number];

interface TreatmentComparisonProps {
  treatments: Treatment[];
  directionSelection: ScoreRoomProjection["directionSelection"];
}

interface TreatmentSelectionResponse {
  changed: boolean;
  projectRevision: number;
  creativeState: string;
  activeTreatment: { id: string; title: string };
  directionBuildRequired: boolean;
  invalidatedRecordIds: string[];
  protectedRecordIds: string[];
}

async function responseError(response: Response) {
  try {
    const body = (await response.json()) as {
      error?: { message?: string };
    };
    return body.error?.message ?? "The Director Treatment could not be selected.";
  } catch {
    return "The Director Treatment could not be selected.";
  }
}

export function TreatmentComparison({
  treatments,
  directionSelection,
}: TreatmentComparisonProps) {
  const router = useRouter();
  const { projectId, projectRevision, updateSnapshot } = useWorkflowSnapshot();
  const [treatmentCards, setTreatmentCards] = useState(treatments);
  const activeTreatment = treatmentCards.find((treatment) => treatment.selected);
  const [previewTreatmentId, setPreviewTreatmentId] = useState(
    activeTreatment?.id ?? treatments[0]?.id,
  );
  const [confirmationTreatmentId, setConfirmationTreatmentId] = useState<
    string | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const previewTreatment =
    treatmentCards.find((treatment) => treatment.id === previewTreatmentId) ??
    treatmentCards[0];

  if (!previewTreatment) return null;

  const selectionIsBlocked = !directionSelection.canReselect;
  const selectionAwaitingConfirmation =
    confirmationTreatmentId === previewTreatment.id && !previewTreatment.selected;

  function previewDirection(treatmentId: string) {
    setPreviewTreatmentId(treatmentId);
    setConfirmationTreatmentId(null);
    setError(null);
  }

  function confirmSelection() {
    if (selectionIsBlocked || previewTreatment.selected) return;

    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/treatments/${encodeURIComponent(previewTreatment.id)}/selection`,
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

        const result = (await response.json()) as TreatmentSelectionResponse;
        setTreatmentCards((current) =>
          current.map((treatment) => {
            const selected = treatment.id === result.activeTreatment.id;
            if (selected === treatment.selected) return treatment;
            return {
              ...treatment,
              selected,
              status: selected ? "selected" : "candidate",
              statusLabel: selected ? "Selected" : "Candidate",
            };
          }),
        );
        updateSnapshot({ projectRevision: result.projectRevision });
        router.refresh();
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "The Director Treatment could not be selected.",
        );
      }
    });
  }

  return (
    <Card className="rounded-2xl border-primary/25 bg-card/70">
      <header className="flex flex-col gap-3 border-b border-border p-5 lg:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] tracking-[0.1em] text-primary uppercase">
              Treatment comparison
            </p>
            <h3 className="mt-2 text-xl font-semibold text-foreground">
              Preview a different directorial consequence
            </h3>
          </div>
          <Badge variant="outline">
            <LockKeyhole aria-hidden="true" />
            {selectionIsBlocked ? "Active cut protected" : "Direction editable"}
          </Badge>
        </div>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Choosing a card changes the downstream direction preview. A confirmed
          selection clears the active assembly and requires a new Film Bible; it
          never rewrites the existing protected cut.
        </p>
      </header>

      <div className="p-5 lg:p-6">
        <div className="grid gap-3 lg:grid-cols-3" role="list" aria-label="Director Treatments">
          {treatmentCards.map((treatment) => {
            const isPreviewed = treatment.id === previewTreatment.id;
            return (
              <article
                className={cn(
                  "rounded-xl border bg-background/35 p-4 transition-colors",
                  isPreviewed
                    ? "border-primary/50 bg-primary/[0.055]"
                    : "border-border",
                )}
                key={treatment.id}
                role="listitem"
              >
                <div className="flex items-start justify-between gap-3">
                  <h4 className="font-semibold text-foreground">
                    {treatment.title}
                  </h4>
                  {treatment.selected ? (
                    <Badge variant="success">
                      <CheckCircle2 aria-hidden="true" />
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="outline">Candidate</Badge>
                  )}
                </div>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">
                  {treatment.proposition}
                </p>
                <Button
                  className="mt-4 w-full"
                  type="button"
                  variant={isPreviewed ? "secondary" : "outline"}
                  onClick={() => previewDirection(treatment.id)}
                >
                  <Eye aria-hidden="true" />
                  {isPreviewed ? "Previewing direction" : "Preview direction"}
                </Button>
              </article>
            );
          })}
        </div>

        <section className="mt-5 overflow-hidden rounded-xl border border-border" aria-live="polite">
          <div className="border-b border-border bg-background/45 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Badge>{previewTreatment.selected ? "Locked direction" : "Alternative preview"}</Badge>
                <h4 className="mt-3 font-display text-3xl font-normal tracking-tight text-foreground">
                  {previewTreatment.title}
                </h4>
              </div>
              <span className="font-mono text-[10px] text-muted-foreground uppercase">
                Downstream preview
              </span>
            </div>
            <p className="mt-4 max-w-4xl text-base leading-7 text-foreground/90">
              {previewTreatment.proposition}
            </p>
          </div>

          <dl className="grid gap-px bg-border md:grid-cols-3">
            {[
              ["Structure", previewTreatment.structuralStrategy],
              ["Visual world", previewTreatment.visualWorld],
              ["Music relationship", previewTreatment.musicInterpretation],
            ].map(([label, value]) => (
              <div className="bg-background/55 p-4" key={label}>
                <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                <dd className="mt-2 text-sm leading-6 text-foreground/90">{value}</dd>
              </div>
            ))}
          </dl>

          <ol className="grid gap-px border-t border-border bg-border md:grid-cols-2">
            {previewTreatment.narrativePath.map((beat) => (
              <li className="bg-card/70 p-4" key={beat.id}>
                <time className="font-mono text-[10px] text-measured tabular-nums">
                  {beat.rangeLabel}
                </time>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {beat.description}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {previewTreatment.selected ? (
          <p className="mt-4 rounded-lg border border-measured/20 bg-measured/[0.05] px-4 py-3 text-sm text-measured">
            This is the active direction. Preview an alternative before changing it.
          </p>
        ) : selectionIsBlocked ? (
          <p className="mt-4 rounded-lg border border-border bg-background/40 px-4 py-3 text-sm leading-6 text-muted-foreground">
            {directionSelection.lockedMessage}
          </p>
        ) : selectionAwaitingConfirmation ? (
          <div className="mt-4 rounded-xl border border-primary/30 bg-primary/[0.06] p-4">
            <p className="text-sm font-medium text-foreground">
              Select “{previewTreatment.title}” as the new working direction?
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              The active assembly will be cleared. Existing downstream records remain as protected historical evidence and a new Film Bible is required before production can continue.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button disabled={isPending} onClick={confirmSelection} type="button">
                {isPending ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : (
                  <Save aria-hidden="true" />
                )}
                Confirm new direction
              </Button>
              <Button
                disabled={isPending}
                onClick={() => setConfirmationTreatmentId(null)}
                type="button"
                variant="ghost"
              >
                Keep current direction
              </Button>
            </div>
          </div>
        ) : (
          <Button
            className="mt-4"
            onClick={() => setConfirmationTreatmentId(previewTreatment.id)}
            type="button"
          >
            <Save aria-hidden="true" />
            Select as new direction
          </Button>
        )}

        {error ? (
          <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-red-300" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
