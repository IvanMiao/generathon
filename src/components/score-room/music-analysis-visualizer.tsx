"use client";

import { LazyMotion, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import type { MouseEvent } from "react";
import { Activity, AudioWaveform, CircleDot, Gauge } from "lucide-react";
import type { ScoreRoomProjection } from "@/components/score-room/score-room-data";
import { formatTimestamp } from "@/components/score-room/score-room-format";
import { useScorePlayback } from "@/components/score-room/score-playback-context";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const loadMotionFeatures = () =>
  import("@/components/score-room/motion-features").then(
    (module) => module.default,
  );

interface MusicAnalysisVisualizerProps {
  analysis: ScoreRoomProjection["measuredMusic"];
}

export function MusicAnalysisVisualizer({
  analysis,
}: MusicAnalysisVisualizerProps) {
  const { currentTime, endSeconds, isPlaying, seek, startSeconds } =
    useScorePlayback();
  const reduceMotion = useReducedMotion();
  const duration = endSeconds - startSeconds;
  const progress = Math.min(
    1,
    Math.max(0, (currentTime - startSeconds) / duration),
  );
  const cursorX = progress * 1000;
  const selectedStartX = analysis.selectedStartPercent * 10;
  const selectedEndX =
    (analysis.selectedStartPercent + analysis.selectedWidthPercent) * 10;
  const activeSection = analysis.sections.find(
    (section) =>
      progress * 100 >= section.startPercent &&
      progress * 100 <= section.startPercent + section.widthPercent,
  );

  function seekFromTimeline(event: MouseEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const nextProgress = (event.clientX - bounds.left) / bounds.width;
    seek(startSeconds + Math.min(1, Math.max(0, nextProgress)) * duration);
  }

  return (
    <Card className="overflow-hidden rounded-2xl bg-card/70">
      <figure>
        <header className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between lg:p-6">
          <div>
            <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.1em] text-measured uppercase">
              <AudioWaveform className="size-3.5" aria-hidden="true" />
              Signal map / complete track
            </p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
              Measured musical structure
            </h3>
          </div>
          <div className="flex items-center gap-4" aria-live="off">
            <Badge variant={isPlaying ? "default" : "outline"}>
              <CircleDot aria-hidden="true" />
              {isPlaying ? "Playing" : "Ready"}
            </Badge>
            <div className="text-right">
              <strong className="block font-mono text-sm font-medium text-foreground tabular-nums">
                {formatTimestamp(currentTime)}
              </strong>
              <small className="mt-1 block text-xs text-muted-foreground">
                {activeSection?.label ?? "Outside candidate section"}
              </small>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-3 divide-x divide-border border-b border-border bg-background/20">
          <div className="p-4">
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <Gauge className="size-3.5 text-measured" aria-hidden="true" />
              Tempo
            </span>
            <strong className="mt-1.5 block text-sm font-semibold text-foreground">
              {analysis.tempoLabel}
            </strong>
          </div>
          <div className="p-4">
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <Activity className="size-3.5 text-highlight" aria-hidden="true" />
              Events
            </span>
            <strong className="mt-1.5 block text-sm font-semibold text-foreground">
              {analysis.counts.events} measured
            </strong>
          </div>
          <div className="p-4">
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <CircleDot className="size-3.5 text-primary" aria-hidden="true" />
              Confidence
            </span>
            <strong className="mt-1.5 block text-sm font-semibold text-foreground">
              {analysis.confidencePercent}%
            </strong>
          </div>
        </div>

        <div className="p-4 sm:p-5 lg:p-6">
          <div className="mb-3 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[9px] tracking-[0.06em] text-muted-foreground uppercase" aria-hidden="true">
            <span className="before:mr-2 before:inline-block before:size-1.5 before:rounded-full before:bg-measured">Waveform</span>
            <span className="before:mr-2 before:inline-block before:size-1.5 before:rounded-full before:bg-primary">Energy</span>
            <span className="before:mr-2 before:inline-block before:size-1.5 before:rounded-full before:bg-highlight">Onsets</span>
            <span>Current cut · {analysis.selectedRangeLabel}</span>
          </div>

          <LazyMotion features={loadMotionFeatures} strict>
            <svg
              className="h-[238px] w-full cursor-crosshair rounded-xl border border-border bg-background/50"
              viewBox="0 0 1000 238"
              preserveAspectRatio="none"
              role="img"
              aria-labelledby="analysis-map-title analysis-map-description"
              onClick={seekFromTimeline}
            >
              <title id="analysis-map-title">Measured music analysis timeline</title>
              <desc id="analysis-map-description">
                Candidate sections, waveform, beat positions, onset density,
                energy, and measured events across {analysis.analyzedRangeLabel}.
                Select a point to seek the score.
              </desc>

              <g>
                {analysis.sections.map((section, index) => (
                  <rect
                    className={cn(
                      index % 2 === 1 ? "fill-white/[0.025]" : "fill-transparent",
                      activeSection?.id === section.id && "fill-primary/10",
                    )}
                    key={section.id}
                    x={section.startPercent * 10}
                    y="0"
                    width={section.widthPercent * 10}
                    height="238"
                  />
                ))}
              </g>

              <g>
                {analysis.beatPositions.map((position, index) => (
                  <line
                    className="stroke-border/70 stroke-[0.7]"
                    key={`${position}-${index}`}
                    x1={position * 10}
                    x2={position * 10}
                    y1="42"
                    y2="138"
                  />
                ))}
              </g>

              <m.path
                className="fill-measured/12 stroke-measured/75 stroke-[1.5]"
                d={analysis.waveformAreaPath}
                transform="translate(0 48)"
                initial={reduceMotion ? false : { opacity: 0, pathLength: 0 }}
                animate={{ opacity: 1, pathLength: 1 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />

              <g>
                {analysis.onsetDensity.map((bin, index) => (
                  <rect
                    className="fill-highlight/45"
                    key={index}
                    x={bin.positionPercent * 10 - 4.5}
                    y={151 - bin.intensity * 13}
                    width="9"
                    height={bin.intensity * 13}
                  />
                ))}
              </g>

              <m.path
                className="fill-primary/[0.07]"
                d={analysis.energyAreaPath}
                transform="translate(0 146) scale(1 0.98)"
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.35, delay: 0.1 }}
              />
              <m.polyline
                className="fill-none stroke-primary stroke-2"
                points={analysis.energyPolyline}
                transform="translate(0 146) scale(1 0.98)"
                initial={reduceMotion ? false : { opacity: 0, pathLength: 0 }}
                animate={{ opacity: 1, pathLength: 1 }}
                transition={{ duration: 0.7, ease: "easeOut" }}
              />

              <g>
                {analysis.events.map((event) => (
                  <line
                    className="stroke-highlight/60 stroke-[1.5] [stroke-dasharray:3_4]"
                    key={event.id}
                    x1={event.positionPercent * 10}
                    x2={event.positionPercent * 10}
                    y1="18"
                    y2="220"
                  />
                ))}
              </g>

              <g aria-hidden="true">
                {selectedStartX > 0 ? (
                  <rect className="fill-black/55" x="0" y="0" width={selectedStartX} height="238" />
                ) : null}
                {selectedEndX < 1000 ? (
                  <rect className="fill-black/55" x={selectedEndX} y="0" width={1000 - selectedEndX} height="238" />
                ) : null}
                <line className="stroke-highlight stroke-2" x1={selectedStartX} x2={selectedStartX} y1="0" y2="238" />
                <line className="stroke-highlight stroke-2" x1={selectedEndX} x2={selectedEndX} y1="0" y2="238" />
              </g>

              <m.line
                className="stroke-foreground stroke-2"
                x1={cursorX}
                x2={cursorX}
                y1="0"
                y2="238"
                animate={{ x1: cursorX, x2: cursorX }}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { duration: isPlaying ? 0.12 : 0.2, ease: "linear" }
                }
              />
            </svg>
          </LazyMotion>

          <ol className="mt-2 flex overflow-hidden rounded-xl border border-border">
            {analysis.sections.map((section, index) => (
              <li
                className="min-w-0 border-r border-border last:border-r-0"
                key={section.id}
                style={{ flexBasis: `${section.widthPercent}%` }}
              >
                <button
                  type="button"
                  className={cn(
                    "flex min-h-12 w-full cursor-pointer flex-col justify-center px-2 text-left outline-none transition-colors duration-200 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/45",
                    activeSection?.id === section.id && "bg-accent",
                  )}
                  onClick={() =>
                    seek(
                      startSeconds +
                        (section.startPercent / 100) * duration,
                    )
                  }
                  aria-label={`Seek to ${section.label}, ${section.rangeLabel}`}
                >
                  <span className="font-mono text-[8px] text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <strong className="truncate text-[10px] font-medium text-foreground">
                    {section.label}
                  </strong>
                </button>
              </li>
            ))}
          </ol>

          <figcaption className="mt-3 flex items-center justify-between gap-4 font-mono text-[9px] text-muted-foreground tabular-nums">
            <span>00:00</span>
            <span className="hidden text-center sm:block">
              {analysis.counts.waveform}-point waveform · {analysis.counts.beats} beats · {analysis.counts.onsets} onsets
            </span>
            <span>{formatTimestamp(endSeconds)}</span>
          </figcaption>
        </div>
      </figure>
    </Card>
  );
}
