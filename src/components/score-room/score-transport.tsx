"use client";

import type { CSSProperties } from "react";
import { AudioLines, Pause, Play } from "lucide-react";
import { formatTimestamp } from "@/components/score-room/score-room-format";
import { useScorePlayback } from "@/components/score-room/score-playback-context";
import { Button } from "@/components/ui/button";

interface ScoreTransportProps {
  selectedRangeLabel: string;
  title: string;
}

export function ScoreTransport({ selectedRangeLabel, title }: ScoreTransportProps) {
  const {
    currentTime,
    endSeconds,
    isPlaying,
    playbackError,
    seek,
    startSeconds,
    togglePlayback,
  } = useScorePlayback();
  const progress =
    endSeconds > startSeconds
      ? ((currentTime - startSeconds) / (endSeconds - startSeconds)) * 100
      : 0;
  const rangeStyle = {
    "--range-progress": `${Math.min(100, Math.max(0, progress))}%`,
  } as CSSProperties;

  return (
    <div className="grid min-h-[76px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-2xl border border-border bg-card/95 px-4 py-3 shadow-[0_20px_50px_-28px_rgba(0,0,0,0.9)] backdrop-blur-xl max-[680px]:grid-cols-[auto_minmax(0,1fr)] max-[680px]:gap-3">
      <Button
        type="button"
        size="icon"
        onClick={togglePlayback}
        aria-label={isPlaying ? "Pause score" : "Play selected score"}
        className="size-11"
      >
        {isPlaying ? (
          <Pause className="size-4 fill-current" aria-hidden="true" />
        ) : (
          <Play className="size-4 translate-x-px fill-current" aria-hidden="true" />
        )}
      </Button>
      <div className="grid min-w-0 grid-cols-[minmax(150px,0.35fr)_minmax(180px,1fr)] items-center gap-5 max-[780px]:grid-cols-1 max-[780px]:gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 truncate text-sm font-medium text-foreground">
            <AudioLines className="size-3.5 flex-none text-primary" aria-hidden="true" />
            {title}
          </p>
          <span className="mt-1 block truncate font-mono text-[8px] tracking-[0.06em] text-muted-foreground uppercase">
            Cut selection {selectedRangeLabel}
          </span>
        </div>
        <input
          aria-label="Score position"
          className="range-accent w-full cursor-pointer outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45"
          type="range"
          min={startSeconds}
          max={endSeconds}
          step="0.01"
          value={Math.min(currentTime, endSeconds)}
          onChange={(event) => seek(Number(event.currentTarget.value))}
          style={rangeStyle}
        />
      </div>
      <output className="font-mono text-[10px] text-muted-foreground tabular-nums max-[680px]:col-start-2 max-[680px]:justify-self-end" aria-live="off">
        {formatTimestamp(currentTime)} / {formatTimestamp(endSeconds)}
      </output>
      {playbackError ? (
        <p className="col-span-full text-sm text-destructive" role="alert">
          {playbackError}
        </p>
      ) : null}
    </div>
  );
}
