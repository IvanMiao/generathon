"use client";

import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface ScorePlaybackContextValue {
  currentTime: number;
  endSeconds: number;
  isPlaying: boolean;
  playbackError: string | null;
  seek: (timeSeconds: number) => void;
  startSeconds: number;
  togglePlayback: () => Promise<void>;
}

const ScorePlaybackContext = createContext<ScorePlaybackContextValue | null>(
  null,
);

interface ScorePlaybackProviderProps {
  children: ReactNode;
  endSeconds: number;
  src: string;
  startSeconds: number;
}

export function ScorePlaybackProvider({
  children,
  endSeconds,
  src,
  startSeconds,
}: ScorePlaybackProviderProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(startSeconds);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  function seek(nextTime: number) {
    const boundedTime = Math.min(endSeconds, Math.max(startSeconds, nextTime));
    const audio = audioRef.current;
    if (audio) audio.currentTime = boundedTime;
    setCurrentTime(boundedTime);
  }

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;

    setPlaybackError(null);
    if (!audio.paused) {
      audio.pause();
      return;
    }

    if (audio.currentTime < startSeconds || audio.currentTime >= endSeconds) {
      seek(startSeconds);
    }

    try {
      await audio.play();
    } catch (error) {
      setPlaybackError(
        error instanceof Error ? error.message : "The score could not be played.",
      );
    }
  }

  function handleTimeUpdate() {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.currentTime >= endSeconds) {
      audio.pause();
      seek(startSeconds);
      return;
    }

    setCurrentTime(Math.max(startSeconds, audio.currentTime));
  }

  return (
    <ScorePlaybackContext.Provider
      value={{
        currentTime,
        endSeconds,
        isPlaying,
        playbackError,
        seek,
        startSeconds,
        togglePlayback,
      }}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={() => seek(startSeconds)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
      />
      {children}
    </ScorePlaybackContext.Provider>
  );
}

export function useScorePlayback() {
  const context = useContext(ScorePlaybackContext);
  if (!context) {
    throw new Error("Score playback requires ScorePlaybackProvider.");
  }
  return context;
}
