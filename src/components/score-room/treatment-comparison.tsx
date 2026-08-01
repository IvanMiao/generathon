"use client";

import { useState } from "react";
import { CheckCircle2, Eye, LockKeyhole } from "lucide-react";
import type { ScoreRoomProjection } from "@/components/score-room/score-room-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Treatment = ScoreRoomProjection["treatments"][number];

interface TreatmentComparisonProps {
  treatments: Treatment[];
}

export function TreatmentComparison({ treatments }: TreatmentComparisonProps) {
  const activeTreatment = treatments.find((treatment) => treatment.selected);
  const [previewTreatmentId, setPreviewTreatmentId] = useState(
    activeTreatment?.id ?? treatments[0]?.id,
  );
  const previewTreatment =
    treatments.find((treatment) => treatment.id === previewTreatmentId) ??
    treatments[0];

  if (!previewTreatment) return null;

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
            Active cut protected
          </Badge>
        </div>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Choosing a card changes the downstream direction preview. It never
          rewrites the Film Bible or locked cut without an explicit new revision.
        </p>
      </header>

      <div className="p-5 lg:p-6">
        <div className="grid gap-3 lg:grid-cols-3" role="list" aria-label="Director Treatments">
          {treatments.map((treatment) => {
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
                  onClick={() => setPreviewTreatmentId(treatment.id)}
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
      </div>
    </Card>
  );
}
