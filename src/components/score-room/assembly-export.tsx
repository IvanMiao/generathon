"use client";

import { useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Download,
  Film,
  Layers3,
  LoaderCircle,
  RotateCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { AssemblySnapshot } from "@/lib/server/deterministic-assembly";

interface AssemblyExportProps {
  initialSnapshot: AssemblySnapshot | null;
  projectId: string;
}

const assemblyOperations = [
  { range: "00:00.000–00:09.500", operation: "Stretch", source: "Paper city / origin" },
  { range: "00:09.500–00:20.500", operation: "Stretch", source: "First breath" },
  { range: "00:20.500–00:31.500", operation: "Stretch", source: "Remembered return" },
  { range: "00:31.500–00:42.500", operation: "Hold", source: "Pressure counterpoint" },
  { range: "00:42.500–00:52.500", operation: "Stretch", source: "Creative mutation" },
  { range: "00:52.500–01:01.277", operation: "Hold", source: "Withheld release" },
] as const;

export function AssemblyExport({
  initialSnapshot,
  projectId,
}: AssemblyExportProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [isRendering, setIsRendering] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function renderAssembly() {
    setIsRendering(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/assembly`, {
        method: "POST",
      });
      const payload = (await response.json()) as {
        assembly?: AssemblySnapshot;
        error?: { message?: string };
      };
      if (!response.ok || !payload.assembly) {
        throw new Error(
          payload.error?.message ?? "The deterministic assembly failed.",
        );
      }
      setSnapshot(payload.assembly);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIsRendering(false);
    }
  }

  return (
    <Card className="mt-5 overflow-hidden rounded-2xl bg-card/70" aria-labelledby="assembly-export-title">
      <header className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between lg:p-6">
        <div>
          <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.1em] text-measured uppercase">
            <Film className="size-3.5" aria-hidden="true" />
            Final cut / local process
          </p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground" id="assembly-export-title">
            Deterministic assembly
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="success">0 model calls</Badge>
          <Button type="button" onClick={renderAssembly} disabled={isRendering}>
            {isRendering ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <RotateCw aria-hidden="true" />
            )}
            {isRendering
              ? "Rendering with FFmpeg…"
              : snapshot
                ? "Rebuild exact cut"
                : "Assemble final cut"}
          </Button>
        </div>
      </header>

      <div className="p-5 lg:p-6">
        {error ? (
          <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-red-300" role="alert">
            {error}
          </p>
        ) : null}

        {snapshot ? (
          <div>
            <div className="overflow-hidden rounded-xl border border-border bg-black">
              <video
                className="aspect-video w-full bg-black object-contain"
                key={snapshot.outputSha256}
                controls
                preload="metadata"
                src={`/api/demo/media/assembly?v=${snapshot.outputSha256.slice(0, 12)}`}
              >
                <track kind="captions" />
              </video>
            </div>
            <dl className="mt-4 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3">
              <div className="bg-background/55 p-4">
                <dt className="text-xs text-muted-foreground">Status</dt>
                <dd className="mt-1.5 flex items-center gap-2 text-sm font-medium text-measured">
                  <CheckCircle2 className="size-3.5" aria-hidden="true" />
                  Validated
                </dd>
              </div>
              <div className="bg-background/55 p-4">
                <dt className="text-xs text-muted-foreground">Duration</dt>
                <dd className="mt-1.5 font-mono text-sm text-foreground tabular-nums">
                  {snapshot.durationSeconds.toFixed(6)} s
                </dd>
              </div>
              <div className="bg-background/55 p-4">
                <dt className="text-xs text-muted-foreground">Drift</dt>
                <dd className="mt-1.5 font-mono text-sm text-foreground tabular-nums">
                  {snapshot.driftSeconds.toFixed(6)} s
                </dd>
              </div>
            </dl>
            <Button asChild variant="outline" className="mt-4">
              <a href="/api/demo/media/assembly" download>
                <Download aria-hidden="true" />
                Download H.264/AAC export
              </a>
            </Button>
          </div>
        ) : (
          <div className="grid min-h-56 place-items-center rounded-xl border border-dashed border-border bg-background/25 px-6 text-center">
            <div className="max-w-md">
              <span className="mx-auto grid size-11 place-items-center rounded-full border border-border bg-card text-muted-foreground">
                <Film className="size-5" aria-hidden="true" />
              </span>
              <strong className="mt-4 block text-base font-semibold text-foreground">
                No physical export yet
              </strong>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                The editorial plan is valid. Assemble the MP4 and provenance
                manifest without spending a generation call.
              </p>
            </div>
          </div>
        )}

        <Collapsible
          className="mt-4 rounded-xl border border-border bg-background/25"
          open={planOpen}
          onOpenChange={setPlanOpen}
        >
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="h-12 w-full justify-between rounded-xl px-4">
              <span className="flex items-center gap-2">
                <Layers3 className="size-4 text-highlight" aria-hidden="true" />
                Assembly plan · {assemblyOperations.length} operations
              </span>
              <ChevronDown
                className={cn(
                  "transition-transform duration-200",
                  planOpen && "rotate-180",
                )}
                aria-hidden="true"
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ol className="divide-y divide-border border-t border-border">
              {assemblyOperations.map((clip, index) => (
                <li className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3" key={clip.range}>
                  <span className="font-mono text-[9px] text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0">
                    <strong className="block truncate text-sm font-medium text-foreground">
                      {clip.source}
                    </strong>
                    <small className="mt-0.5 block font-mono text-[9px] text-muted-foreground tabular-nums">
                      {clip.range}
                    </small>
                  </span>
                  <Badge variant="outline">{clip.operation}</Badge>
                </li>
              ))}
            </ol>
          </CollapsibleContent>
        </Collapsible>

        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          Deterministic editorial decisions remain stable between runs. Exact
          bytes additionally depend on the same FFmpeg/x264 build and machine
          architecture.
        </p>
        <span className="sr-only" aria-live="polite">
          {isRendering
            ? "Assembly render in progress."
            : snapshot
              ? "Assembly ready."
              : "Assembly waiting."}
        </span>
      </div>
    </Card>
  );
}
