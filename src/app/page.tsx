import { readCapabilities } from "@/lib/server/capabilities";
import { ensureRuntimeReady } from "@/lib/server/runtime";

export const dynamic = "force-dynamic";

const creativeStages = [
  ["01", "Listen", "active"],
  ["02", "Interpret", "queued"],
  ["03", "Direct", "queued"],
  ["04", "Score", "queued"],
  ["05", "Generate", "guarded"],
  ["06", "Review", "queued"],
] as const;

const providerLabels = {
  gemini: "Gemini",
  openai: "OpenAI · transition",
  open_weight_on_modal: "LTX · Modal",
} as const;

function sentenceCase(value: string) {
  return value.replaceAll("_", " ");
}

export default function Home() {
  const runtime = ensureRuntimeReady();
  const capabilities = readCapabilities();
  const track = capabilities.audio_analysis.demo_track;
  const policy = capabilities.generation_policy;
  const observedCalls = policy.observed_calls_from_this_step_0_session;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">The Director Who Does Not Exist</p>
          <p className="subtitle">Score-to-cinema direction system</p>
        </div>
        <div className="status" role="status">
          <span aria-hidden="true" />
          Local core ready
        </div>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <p className="hero-index">Project 001 / Listen First</p>
        <h1 id="hero-title">
          Give a score
          <span>a director.</span>
        </h1>
        <p className="hero-copy">
          Measure the music. Choose an interpretation. Lock a visual world.
          Generate only the shots that belong to the film.
        </p>
      </section>

      <section className="stage-grid" aria-label="Creative workflow">
        {creativeStages.map(([index, stage, state]) => (
          <article className={`stage stage-${state}`} key={stage}>
            <div>
              <span>{index}</span>
              <span>{state}</span>
            </div>
            <h2>{stage}</h2>
          </article>
        ))}
      </section>

      <section className="score-strip" aria-labelledby="score-title">
        <div className="section-heading">
          <p className="eyebrow">Selected score</p>
          <h2 id="score-title">Original melodic electronica</h2>
        </div>
        <div className="score-data">
          <div className="pulse" aria-hidden="true">
            {Array.from({ length: 32 }, (_, index) => (
              <i key={index} />
            ))}
          </div>
          <dl>
            <div>
              <dt>Duration</dt>
              <dd>{track.duration_seconds.toFixed(1)} s</dd>
            </div>
            <div>
              <dt>Measured pulse</dt>
              <dd>{track.measured_tempo_bpm.toFixed(1)} BPM</dd>
            </div>
            <div>
              <dt>Candidate sections</dt>
              <dd>{track.candidate_boundaries_seconds.length - 1}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="foundation" aria-labelledby="foundation-title">
        <div className="section-heading">
          <p className="eyebrow">Step 1 / foundation</p>
          <h2 id="foundation-title">One control plane. Two execution lanes.</h2>
        </div>

        <div className="lane-grid">
          <article>
            <p>01 / Control plane</p>
            <h3>Next.js</h3>
            <span>UI · Route Handlers · SQLite · orchestration</span>
          </article>
          <article>
            <p>02 / Local analysis</p>
            <h3>uv / Python</h3>
            <span>MIR · provider probes · reproducible scripts</span>
          </article>
          <article>
            <p>03 / Heavy generation</p>
            <h3>Modal</h3>
            <span>LTX worker · FFmpeg · GPU-isolated runtime</span>
          </article>
        </div>
      </section>

      <section className="system-panel" aria-labelledby="system-title">
        <div className="section-heading">
          <p className="eyebrow">Verified state</p>
          <h2 id="system-title">Production guardrails</h2>
        </div>
        <div>
          <dl className="system-facts">
            <div>
              <dt>Runtime</dt>
              <dd>{runtime.environment} / schema {runtime.schema_version}</dd>
            </div>
            <div>
              <dt>Capability gate</dt>
              <dd>{sentenceCase(capabilities.status)}</dd>
            </div>
            <div>
              <dt>Video attempts</dt>
              <dd>{observedCalls} recorded here / {policy.daily_video_generation_limit} daily cap</dd>
            </div>
            <div>
              <dt>Generation rule</dt>
              <dd>Final-cut candidates only</dd>
            </div>
          </dl>

          <ul className="provider-list" aria-label="Allowed providers">
            {capabilities.provider_allowlist.map((provider) => (
              <li key={provider}>
                <span>{providerLabels[provider]}</span>
                <span>{provider === "open_weight_on_modal" ? "deployment pending" : "verified"}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
