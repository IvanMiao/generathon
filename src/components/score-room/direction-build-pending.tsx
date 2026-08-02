import Link from "next/link";
import { ArrowLeft, Compass, LockKeyhole, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface DirectionBuildPendingProps {
  projectRevision: number;
  projectTitle: string;
  treatmentTitle: string;
}

export function DirectionBuildPending({
  projectRevision,
  projectTitle,
  treatmentTitle,
}: DirectionBuildPendingProps) {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-5 py-12 text-foreground">
      <Card className="w-full max-w-2xl overflow-hidden rounded-2xl border-primary/25 bg-card/75">
        <div className="border-b border-border p-6 sm:p-8">
          <Badge variant="outline">
            <Compass aria-hidden="true" />
            Direction selected · project v{projectRevision}
          </Badge>
          <h1 className="mt-5 font-display text-4xl leading-tight tracking-[-0.04em] text-foreground">
            {treatmentTitle}
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            is now the working Treatment for {projectTitle}. Its Film Bible has
            not been compiled yet, so no existing Visual Score, shot, or final
            assembly is carried into this direction.
          </p>
        </div>

        <div className="space-y-4 p-6 sm:p-8">
          <div className="rounded-xl border border-primary/20 bg-primary/[0.05] p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Sparkles className="size-4 text-primary" aria-hidden="true" />
              Next production step
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Compile and approve a new Film Bible, then create a new
              Audiovisual Contract and Visual Score before generating or
              importing any take.
            </p>
          </div>
          <div className="rounded-xl border border-measured/20 bg-measured/[0.04] p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <LockKeyhole className="size-4 text-measured" aria-hidden="true" />
              Previous cut protected
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Locked records from the previous direction remain historical
              evidence. They were not overwritten or attached to this newly
              selected Treatment.
            </p>
          </div>
          <Link
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/45"
            href="/"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Return to project overview
          </Link>
        </div>
      </Card>
    </main>
  );
}
