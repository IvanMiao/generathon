# Step 3 — Web vertical slice

Status: complete as of 2026-08-02.

The four post-contract workstreams now meet in one fixture-first Web workflow at
`/projects/demo`. The route is server-rendered from a canonical project persisted
through `ProjectRepository`; it does not call a model or fetch the app's own API.

## Available now

- homepage entry into the working Score Room;
- complete 120.024-second playback of the rights-cleared score through an
  allowlisted, byte-range-capable local media route;
- real deterministic full-track Music Analysis with the complete 120.024-second
  score selected, plus a separate editable Music Reading for the same range;
- a constrained shared-boundary editor that persists a sequential
  `MusicAnalysisRevision` without rewriting the raw MusicAnalysis, reports
  unlocked follow-up records, and keeps locked dependents protected;
- three structurally distinct Treatments, a downstream-direction comparison,
  and confirmation-backed reselection before direction lock; the locked active
  Film Bible remains protected;
- three approved real provider-derived keyframes, six full-coverage Visual Score segments, and six locked
  ShotSpecs with musical, narrative, and visual functions;
- an editable relationship mode for every Visual Score segment; saving creates
  a sequential score/project revision, reopens the score as draft, reruns full
  bundle coverage validation, and reports protected locked dependents;
- an explicit Visual Score approval action that requires valid coverage and
  approved linked Visual States before reopening the generation gate;
- a focused ShotSpec inspector linked directly from each score segment;
- a recorded failed-take preview with timestamped evidence;
- an interactive Editorial Repair → compare → lock walkthrough whose human
  decisions are persisted in the ProjectBundle and restored after reload;
- optimistic project-revision checks that reject stale panels with a stable 409
  error rather than overwriting newer creative decisions;
- a provider-neutral Gemini task compiled from the locked direction, displayed
  through a generation gate summary without submitting it;
- quota visibility and a disabled regeneration path for the timing-only failure;
- concise rights, measurement, direction, and assembly provenance;
- deterministic FFmpeg preparation of the 9.241542-second repaired comparison clip;
- deterministic six-clip H.264/AAC assembly from verified local inputs, with
  stretch/hold operations, restored original audio, duration/stream validation,
  playable Web preview, and a SHA-256 provenance manifest.

Prepare the local comparison media, then run the app:

```bash
npm run demo:analyze
npm run demo:prepare-media
npm run demo:assemble
npm run dev
```

No video model is called by any of these commands. Analysis runs locally through
the uv worker; preparation transforms an existing recorded Gemini candidate;
assembly uses verified existing takes and writes ignored outputs under `exports/`.

## Remaining Step 3 work

None. The Score Room now keeps raw measurement, MusicAnalysisRevision,
Treatment selection, locked direction, review, and deterministic assembly as
separate persisted layers.

The next vertical slice is the real-project integration gate. Real model
integration remains behind the now-persisted offline direction, review, and
deterministic export paths.
