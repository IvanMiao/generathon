import type { TimeRange } from "@/lib/domain/shared";

export function formatDomainLabel(value: string): string {
  const spaced = value.replaceAll("_", " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function formatTimestamp(seconds: number): string {
  const totalTenths = Math.round(seconds * 10);
  const minutes = Math.floor(totalTenths / 600);
  const secondsWithinMinute = totalTenths % 600;
  const wholeSeconds = Math.floor(secondsWithinMinute / 10);
  const tenths = secondsWithinMinute % 10;
  const base = `${String(minutes).padStart(2, "0")}:${String(wholeSeconds).padStart(2, "0")}`;

  return tenths === 0 ? base : `${base}.${tenths}`;
}

export function formatTimeRange(range: TimeRange): string {
  return `${formatTimestamp(range.start_seconds)}–${formatTimestamp(range.end_seconds)}`;
}
