import Link from "next/link";
import {
  ArrowDown,
  ArrowUpRight,
  AudioLines,
  CircleCheck,
  Clapperboard,
  Cpu,
  LockKeyhole,
  Play,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Waves,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { readCapabilities } from "@/lib/server/capabilities";
import { ensureRuntimeReady } from "@/lib/server/runtime";

export const dynamic = "force-dynamic";

const creativeStages = [
  { index: "01", stage: "Listen", note: "Measure the score", state: "complete" },
  { index: "02", stage: "Interpret", note: "Find dramatic intent", state: "complete" },
  { index: "03", stage: "Direct", note: "Lock the visual world", state: "active" },
  { index: "04", stage: "Score", note: "Map image to music", state: "queued" },
  { index: "05", stage: "Generate", note: "Render final candidates", state: "guarded" },
  { index: "06", stage: "Review", note: "Repair with evidence", state: "queued" },
] as const;

const waveformHeights = [
  26, 38, 48, 64, 42, 74, 56, 34, 68, 88, 58, 44, 72, 96, 62, 38, 54, 80,
  66, 46, 76, 90, 60, 36, 52, 82, 70, 42, 58, 76, 50, 30, 44, 64, 86, 56,
] as const;

const scoreSegments = [
  { label: "Arrival", mode: "Mirror", width: "w-[15%]" },
  { label: "Recall", mode: "Suspension", width: "w-[18%]" },
  { label: "Drift", mode: "Counterpoint", width: "w-[19%]" },
  { label: "Rupture", mode: "Mirror", width: "w-[17%]" },
  { label: "Return", mode: "Motif", width: "w-[16%]" },
  { label: "Afterimage", mode: "Suspension", width: "w-[15%]" },
] as const;

const providerLabels = {
  gemini: "Gemini",
  openai: "OpenAI",
  open_weight_on_modal: "LTX / Modal",
} as const;

function sentenceCase(value: string) {
  return value.replaceAll("_", " ");
}

export default function Home() {
  const runtime = ensureRuntimeReady();
  const capabilities = readCapabilities();
  const track = capabilities.audio_analysis.demo_track;
  const policy = capabilities.generation_policy;

  return (
    <main className="relative min-h-dvh overflow-hidden bg-background text-foreground">
      <div className="signal-grid pointer-events-none absolute inset-x-0 top-0 h-[760px] opacity-45" />
      <div className="pointer-events-none absolute top-[-240px] right-[-180px] size-[640px] rounded-full bg-primary/[0.08] blur-[140px]" />

      <header className="relative z-10 mx-auto flex h-20 max-w-[1480px] items-center justify-between px-5 sm:px-8 lg:px-12">
        <Link
          href="/"
          className="group flex min-h-11 items-center gap-3 rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          aria-label="The Director Who Does Not Exist, home"
        >
          <span className="grid size-9 place-items-center rounded-full border border-primary/30 bg-primary/10 text-primary transition-colors duration-200 group-hover:bg-primary group-hover:text-primary-foreground">
            <AudioLines className="size-4" aria-hidden="true" />
          </span>
          <span className="leading-tight">
            <strong className="block font-display text-[15px] font-normal tracking-wide text-foreground">
              The Director Who Does Not Exist
            </strong>
            <small className="font-mono text-[9px] tracking-[0.16em] text-muted-foreground uppercase">
              Score-to-cinema system
            </small>
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <Badge variant="success" className="hidden sm:inline-flex">
            <span className="size-1.5 rounded-full bg-emerald-300" aria-hidden="true" />
            Local core ready
          </Badge>
          <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
            <Link href="/projects/demo">
              Open workspace
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </header>

      <section className="relative z-10 mx-auto grid max-w-[1480px] gap-14 px-5 pt-16 pb-20 sm:px-8 sm:pt-24 lg:grid-cols-[minmax(0,0.9fr)_minmax(560px,1.1fr)] lg:items-center lg:gap-16 lg:px-12 lg:pt-28 lg:pb-28">
        <div className="max-w-3xl">
          <div className="mb-7 flex items-center gap-3 font-mono text-[10px] tracking-[0.16em] text-highlight uppercase">
            <span className="h-px w-8 bg-highlight/70" aria-hidden="true" />
            AI direction, led by the score
          </div>
          <h1 className="max-w-[10ch] font-display text-[clamp(4rem,9vw,8.7rem)] leading-[0.82] font-normal tracking-[-0.065em] text-balance">
            Music deserves
            <span className="block translate-x-[0.18em] pt-[0.08em] text-muted-foreground italic">
              direction.
            </span>
          </h1>
          <p className="mt-9 max-w-[58ch] text-base leading-7 text-muted-foreground sm:text-lg">
            Read the structure of a score, shape a coherent visual world, and
            generate only the shots that belong to the film—not a pile of clips
            hoping to become one.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="group sm:min-w-48">
              <Link href="/projects/demo">
                <Play className="fill-current" aria-hidden="true" />
                Enter the Score Room
                <ArrowUpRight className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="lg" className="justify-start sm:justify-center">
              <a href="#workflow">
                See how it works
                <ArrowDown aria-hidden="true" />
              </a>
            </Button>
          </div>

          <dl className="mt-12 grid max-w-2xl grid-cols-3 border-y border-border/80 py-5">
            <div>
              <dt className="font-mono text-[9px] tracking-[0.13em] text-muted-foreground uppercase">
                Score
              </dt>
              <dd className="mt-1.5 text-sm font-medium tabular-nums">
                {track.measured_tempo_bpm.toFixed(1)} BPM
              </dd>
            </div>
            <div className="border-l border-border pl-5">
              <dt className="font-mono text-[9px] tracking-[0.13em] text-muted-foreground uppercase">
                Duration
              </dt>
              <dd className="mt-1.5 text-sm font-medium tabular-nums">
                {track.duration_seconds.toFixed(1)} sec
              </dd>
            </div>
            <div className="border-l border-border pl-5">
              <dt className="font-mono text-[9px] tracking-[0.13em] text-muted-foreground uppercase">
                Structure
              </dt>
              <dd className="mt-1.5 text-sm font-medium tabular-nums">
                {track.candidate_boundaries_seconds.length - 1} sections
              </dd>
            </div>
          </dl>
        </div>

        <div className="relative lg:translate-y-8">
          <div className="absolute -inset-8 rounded-full bg-primary/[0.07] blur-3xl" aria-hidden="true" />
          <Card className="relative overflow-hidden border-white/[0.09] bg-[#11100f]/95 shadow-[0_50px_140px_-60px_rgba(0,0,0,1)]">
            <div className="flex h-12 items-center justify-between border-b border-border px-4 sm:px-5">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-primary" />
                <span className="size-2 rounded-full bg-highlight/70" />
                <span className="size-2 rounded-full bg-measured/70" />
              </div>
              <span className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground uppercase">
                Score Room / Project 001
              </span>
              <Badge variant="outline" className="hidden sm:inline-flex">
                <CircleCheck aria-hidden="true" />
                Direction locked
              </Badge>
            </div>

            <div className="grid min-h-[420px] sm:grid-cols-[150px_minmax(0,1fr)]">
              <aside className="hidden border-r border-border bg-black/10 p-4 sm:block">
                <p className="font-mono text-[8px] tracking-[0.15em] text-muted-foreground uppercase">
                  Workflow
                </p>
                <ol className="mt-5 space-y-1">
                  {creativeStages.slice(0, 5).map((stage) => (
                    <li
                      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-xs ${
                        stage.state === "active"
                          ? "bg-primary/12 text-foreground"
                          : "text-muted-foreground"
                      }`}
                      key={stage.stage}
                    >
                      <span
                        className={`size-1.5 rounded-full ${
                          stage.state === "active" ? "bg-primary" : "bg-border"
                        }`}
                      />
                      {stage.stage}
                    </li>
                  ))}
                </ol>
              </aside>

              <div className="min-w-0 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-[9px] tracking-[0.13em] text-primary uppercase">
                      Visual score / 04
                    </p>
                    <h2 className="mt-1.5 font-display text-2xl font-normal tracking-tight">
                      An Incorrect Memory of the City
                    </h2>
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                    00:41.8 / 02:00.0
                  </span>
                </div>

                <div
                  className="relative mt-7 flex h-32 items-center gap-[3px] overflow-hidden border-y border-border/80 py-4"
                  role="img"
                  aria-label="Audio waveform preview with the playhead at 21.4 seconds"
                >
                  {waveformHeights.map((height, index) => (
                    <i
                      className={`min-w-0 flex-1 rounded-full ${
                        index < 14 ? "bg-primary/80" : "bg-muted-foreground/35"
                      }`}
                      key={`${height}-${index}`}
                      style={{ height: `${height}%` }}
                    />
                  ))}
                  <span className="absolute inset-y-3 left-[39%] w-px bg-foreground shadow-[0_0_14px_rgba(255,255,255,0.6)]" aria-hidden="true" />
                </div>

                <div className="mt-5">
                  <div className="mb-2 flex justify-between font-mono text-[8px] tracking-[0.1em] text-muted-foreground uppercase">
                    <span>00:00</span>
                    <span>Image / music relationship</span>
                    <span>02:00.0</span>
                  </div>
                  <div className="flex h-20 gap-1">
                    {scoreSegments.map((segment, index) => (
                      <div
                        className={`${segment.width} relative overflow-hidden rounded-md border border-border/80 bg-muted/70 p-2 ${
                          index === 2 ? "border-primary/50 bg-primary/12" : ""
                        }`}
                        key={segment.label}
                      >
                        <span className="font-mono text-[8px] text-muted-foreground tabular-nums">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <strong className="absolute right-2 bottom-2 left-2 truncate text-[10px] font-medium">
                          {segment.mode}
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-3 divide-x divide-border rounded-xl border border-border bg-black/15 py-3">
                  <div className="px-3">
                    <span className="block font-mono text-[8px] tracking-wide text-muted-foreground uppercase">State</span>
                    <strong className="mt-1 block truncate text-xs font-medium">City remembers</strong>
                  </div>
                  <div className="px-3">
                    <span className="block font-mono text-[8px] tracking-wide text-muted-foreground uppercase">Camera</span>
                    <strong className="mt-1 block truncate text-xs font-medium">Slow orbital drift</strong>
                  </div>
                  <div className="px-3">
                    <span className="block font-mono text-[8px] tracking-wide text-muted-foreground uppercase">Shot</span>
                    <strong className="mt-1 block truncate text-xs font-medium">03 / locked</strong>
                  </div>
                </div>
              </div>
            </div>
          </Card>
          <Badge className="absolute -right-2 -bottom-4 hidden border border-highlight/25 bg-highlight text-black shadow-xl sm:inline-flex">
            <Sparkles aria-hidden="true" />
            6 final-cut shots, zero speculative renders
          </Badge>
        </div>
      </section>

      <section id="workflow" className="relative z-10 border-y border-border bg-card/40">
        <div className="mx-auto max-w-[1480px] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
          <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
            <div>
              <p className="font-mono text-[10px] tracking-[0.16em] text-primary uppercase">
                A directorial workflow
              </p>
              <h2 className="mt-4 max-w-[12ch] font-display text-5xl leading-[0.95] font-normal tracking-[-0.045em] sm:text-6xl">
                Decide the film before rendering it.
              </h2>
            </div>
            <p className="max-w-[60ch] self-end text-base leading-7 text-muted-foreground lg:justify-self-end">
              Each decision leaves an explicit trail—from measured musical
              evidence to visual intent, locked shots, and reviewable output.
              Generation is the last step, never the creative strategy.
            </p>
          </div>

          <ol className="mt-14 grid border-t border-l border-border sm:grid-cols-2 lg:grid-cols-3">
            {creativeStages.map((item) => (
              <li
                className="group min-h-48 border-r border-b border-border p-5 transition-colors duration-200 hover:bg-accent/60 sm:p-6"
                key={item.stage}
              >
                <div className="flex items-center justify-between font-mono text-[9px] tracking-[0.12em] uppercase">
                  <span className="text-muted-foreground">{item.index}</span>
                  <span className={item.state === "guarded" ? "text-highlight" : "text-muted-foreground"}>
                    {item.state}
                  </span>
                </div>
                <h3 className="mt-14 font-display text-3xl font-normal tracking-tight transition-transform duration-200 group-hover:translate-x-1">
                  {item.stage}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">{item.note}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="relative z-10 mx-auto grid max-w-[1480px] gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20 lg:px-12 lg:py-28">
        <div>
          <p className="font-mono text-[10px] tracking-[0.16em] text-measured uppercase">
            Production discipline
          </p>
          <h2 className="mt-4 max-w-[12ch] font-display text-5xl leading-[0.96] font-normal tracking-[-0.045em] sm:text-6xl">
            Creative freedom, with a control plane.
          </h2>
          <p className="mt-6 max-w-[52ch] leading-7 text-muted-foreground">
            Local-first analysis, protected revisions, and a hard generation
            gate keep the process explainable—and the GPU budget intentional.
          </p>
        </div>

        <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2">
          <div className="bg-card p-6 sm:p-7">
            <ScanLine className="size-5 text-measured" aria-hidden="true" />
            <p className="mt-10 font-mono text-[9px] tracking-[0.14em] text-muted-foreground uppercase">Measured locally</p>
            <strong className="mt-2 block text-lg font-medium">{track.candidate_boundaries_seconds.length - 1} candidate sections</strong>
            <span className="mt-2 block text-sm leading-6 text-muted-foreground">Signal facts stay separate from directorial interpretation.</span>
          </div>
          <div className="bg-card p-6 sm:p-7">
            <LockKeyhole className="size-5 text-highlight" aria-hidden="true" />
            <p className="mt-10 font-mono text-[9px] tracking-[0.14em] text-muted-foreground uppercase">Generation gate</p>
            <strong className="mt-2 block text-lg font-medium">{policy.observed_calls_from_this_step_0_session} / {policy.daily_video_generation_limit} calls used</strong>
            <span className="mt-2 block text-sm leading-6 text-muted-foreground">Only approved final-cut candidates can reach a video provider.</span>
          </div>
          <div className="bg-card p-6 sm:p-7">
            <Cpu className="size-5 text-primary" aria-hidden="true" />
            <p className="mt-10 font-mono text-[9px] tracking-[0.14em] text-muted-foreground uppercase">Runtime</p>
            <strong className="mt-2 block text-lg font-medium capitalize">{runtime.environment} / schema {runtime.schema_version}</strong>
            <span className="mt-2 block text-sm leading-6 text-muted-foreground">Next.js orchestrates; Python and Modal execute specialist work.</span>
          </div>
          <div className="bg-card p-6 sm:p-7">
            <ShieldCheck className="size-5 text-measured" aria-hidden="true" />
            <p className="mt-10 font-mono text-[9px] tracking-[0.14em] text-muted-foreground uppercase">Capability status</p>
            <strong className="mt-2 block text-lg font-medium capitalize">{sentenceCase(capabilities.status)}</strong>
            <span className="mt-2 block text-sm leading-6 text-muted-foreground">{capabilities.provider_allowlist.map((provider) => providerLabels[provider]).join(" · ")}</span>
          </div>
        </div>
      </section>

      <section className="relative z-10 border-t border-border">
        <div className="mx-auto flex max-w-[1480px] flex-col items-start justify-between gap-8 px-5 py-12 sm:px-8 md:flex-row md:items-center lg:px-12">
          <div className="flex items-center gap-4">
            <span className="grid size-11 place-items-center rounded-full border border-primary/30 bg-primary/10 text-primary">
              <Clapperboard className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-display text-2xl font-normal">The score is ready.</h2>
              <p className="mt-1 text-sm text-muted-foreground">Take the director&apos;s chair.</p>
            </div>
          </div>
          <Button asChild size="lg">
            <Link href="/projects/demo">
              Open the working demo
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </section>

      <footer className="relative z-10 border-t border-border/70 px-5 py-7 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[1480px] flex-col gap-3 font-mono text-[9px] tracking-[0.11em] text-muted-foreground uppercase sm:flex-row sm:items-center sm:justify-between">
          <span>The Director Who Does Not Exist</span>
          <span className="flex items-center gap-2">
            <Waves className="size-3.5" aria-hidden="true" />
            Listen first / generate last
          </span>
        </div>
      </footer>
    </main>
  );
}
