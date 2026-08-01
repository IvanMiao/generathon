# The Director Who Does Not Exist

A score-to-cinema directing system for strongly stylized music shorts. It reads a
selected electronic track, proposes distinct directorial interpretations, locks a
coherent visual world, compiles shots, and spends scarce video generations only
on credible final-cut candidates.

## Current state

Step 0 capability and rights gates are complete. Step 1 establishes the local
control plane, Step 2 freezes the first domain contract and offline fixture, and
Step 3 now has a playable Web vertical slice at `/projects/demo`:

```text
Next.js App Router
  ├─ Server Components and Route Handlers
  ├─ Node SQLite and local artifact state
  ├─ uv/Python MIR and provider scripts
  └─ future Modal Python GPU worker
```

There is no FastAPI service and no separate Vite application. Python remains
because `librosa` and the future Modal/CUDA worker are the right compute tools;
it is not the product's web runtime.

## Setup

Requirements: Node.js 24.15+, npm 11+, uv, Python 3.14, FFmpeg, and ffprobe.

```bash
npm install
uv sync
cp .env.example .env
npm run demo:analyze
npm run demo:prepare-media
npm run demo:assemble
npm run dev
```

Open <http://localhost:3000>. Startup creates ignored `data/`, `artifacts/`,
`uploads/`, and `exports/` directories and migrates
`data/generathon.sqlite3`. The rights-cleared demo music already lives under
`exports/` in the working copy and remains ignored.

When the canonical demo fixture advances, startup upgrades only the known demo
record. The 120-second fixture migration replaces the obsolete 61-second demo;
later edits made against the current fixture revision are preserved on reload.

## Commands

```bash
npm run dev        # local Next.js server
npm run demo:analyze # deterministic full-track MusicAnalysis; no model call
npm run demo:prepare-media # deterministic local repair preview; no model call
npm run demo:assemble # locked-take H.264/AAC export + manifest; no model call
npm run lint       # ESLint plus repo-local uv/ruff
npm run typecheck  # strict TypeScript
npm run test       # Vitest plus the Python music-worker suite
npm run build      # production Next.js build
npm run check      # all of the above verification
```

`uv` uses the repository's `.venv` and `.uv-cache` through `uv.toml`; no project
environment or cache is intentionally placed under `/tmp`.

## Local endpoints

- `GET /api/health/live` — process liveness, no storage dependency
- `GET /api/health/ready` — SQLite and artifact-store readiness
- `GET /api/capabilities` — safe subset of checked Step 0 capabilities
- `GET /api/contracts/project-bundle` — frozen ProjectBundle v1 JSON Schema
- `GET /api/demo/media/:asset` — allowlisted local score/take streaming with byte ranges
- `GET|POST /api/projects/:projectId/assembly` — inspect or rebuild the deterministic local export
- `PATCH /api/projects/:projectId/visual-score/:segmentId/relationship` — validated score revision
- `POST /api/projects/:projectId/visual-score/approval` — approve a valid full-range score and reopen generation
- `POST /api/projects/:projectId/review/decision` — persisted repair/lock walkthrough decision

The page itself reads server modules directly. These endpoints are for probes,
future worker integration, and external consumers—not a client-side rendering
waterfall.

## Generation policy

Video calls are capped at ten per day. A call is allowed only after its Visual
State, ShotSpec, musical range, and complex prompt are locked and the result has a
realistic chance of entering the final cut. Run the provider guard only with its
explicit final-candidate confirmation; ordinary UI and test commands never call a
video model.

See [PRD.md](./PRD.md), [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md),
[docs/STEP_0_CAPABILITY_GATE.md](./docs/STEP_0_CAPABILITY_GATE.md), and
[docs/STEP_1_FOUNDATION.md](./docs/STEP_1_FOUNDATION.md). Step 2 contracts and
fixture rules are recorded in [docs/STEP_2_CONTRACTS.md](./docs/STEP_2_CONTRACTS.md).
The current offline workflow and its remaining integration work are recorded in
[docs/STEP_3_VERTICAL_SLICE.md](./docs/STEP_3_VERTICAL_SLICE.md).
