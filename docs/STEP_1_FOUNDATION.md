# Step 1 — Application foundation

## Outcome

The temporary FastAPI plus Vite scaffold was replaced with one Next.js App Router
control plane. The product now has one local web process, one root package, and no
browser-to-own-API request waterfall on initial render.

## Implemented

- Server-rendered foundation page with the score-to-cinema workflow and verified
  Step 0 state.
- Node-only Route Handlers for liveness, readiness, and capability inspection.
- Runtime initialization for `data/`, `artifacts/`, `uploads/`, and `exports/`.
- Node built-in SQLite with a versioned first migration for projects, artifacts,
  and provider runs.
- Runtime and capability contract tests.
- Root commands for web/Python linting, type checking, tests, builds, and local
  development.
- Secret-free environment template, stable naming rules, and safe error shape.

The checked demo track remains local and ignored. No music or video was uploaded,
and Step 1 performed zero video-generation calls.

## Runtime boundary

```text
Next.js / Node 24
  ├─ product state and UI
  ├─ SQLite and artifact metadata
  ├─ health, mutations, and task polling
  └─ launches or calls compute workers

uv / Python 3.14                 Modal / Python 3.12 + CUDA
  ├─ librosa MIR                   ├─ LTX-2.3 candidate
  ├─ FFmpeg/provider tooling       ├─ heavy FFmpeg work
  └─ local deterministic jobs      └─ persisted asynchronous runs
```

Python is therefore retained only where its music/media/model ecosystem is an
advantage. It is not a second API server.

## Exit criteria

- A clean application start can create storage directories and migrate SQLite.
- Server Components and Route Handlers share the same validated server modules.
- Generated assets, database files, caches, and credentials remain ignored.
- The complete foundation is exercised with `npm run check`.
