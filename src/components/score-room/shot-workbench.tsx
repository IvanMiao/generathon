"use client";

import { useState } from "react";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Clapperboard,
  Film,
  LockKeyhole,
  WandSparkles,
} from "lucide-react";
import type { ScoreRoomProjection } from "@/components/score-room/score-room-data";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type Shot = ScoreRoomProjection["shots"][number];

interface ShotWorkbenchProps {
  shots: Shot[];
}

export function ShotWorkbench({ shots }: ShotWorkbenchProps) {
  const [selectedShotId, setSelectedShotId] = useState(shots[0].id);
  const selectedShot =
    shots.find((shot) => shot.id === selectedShotId) ?? shots[0];

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
                  onClick={() => setSelectedShotId(shot.id)}
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
        </div>
      </Card>
    </div>
  );
}
