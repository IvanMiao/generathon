# Step 2 — Frozen contracts, validators, and fixtures

## Outcome

Step 2 is complete. `ProjectBundle` contract version `1.0.0` is the canonical
product-state boundary for the Next.js control plane and future uv/Modal workers.
Zod is the runtime source of truth; TypeScript types are inferred from the same
schemas, and the complete structural contract is available as JSON Schema at
`GET /api/contracts/project-bundle`.

## Frozen records

The bundle includes versioned contracts for:

1. `Project`
2. `AudioAsset`
3. `MusicAnalysis`
4. `MusicAnalysisRevision`
5. `MusicReading`
6. `DirectorTreatment`
7. `FilmBible`
8. `AudiovisualContract`
9. `VisualScoreSegment`
10. `VisualState`
11. `ShotSpec`
12. `Artifact`
13. `Take`
14. `ReviewReport` and `Evidence`
15. `RepairPlan`
16. `Decision`
17. `ProviderCapabilities` and `ProviderRun`
18. `AssemblyRun`

The core PRD enums are frozen exactly as documented: creation mode, relationship
mode, review dimension, failure class, and decision. Lifecycle, provider, repair,
artifact, and production-state enums are also explicit rather than free-form.

## Deterministic invariants

Validation occurs in two layers:

- Zod rejects structural drift, missing required fields, unknown fields, invalid
  enum values, invalid hashes, and malformed timestamps.
- Cross-record validation rejects broken references, duplicate IDs, foreign
  project ownership, out-of-range timestamps, unordered/overlapping sections,
  Visual Score gaps or overlaps, incomplete shot-to-score coverage, unapproved
  visual-state usage, unlocked assembly takes, duration drift, and incomplete demo
  evidence.

The full Visual Score must contain five to seven segments, cover the selected
audio range without a gap, and use at least two relationship modes. Each ShotSpec
must contain musical, narrative, and visual functions and must be covered by its
referenced score segments.

## Revision and lock policy

- `MusicAnalysis` is immutable. Corrections create or revise a
  `MusicAnalysisRevision`.
- Approved `MusicReading`, `FilmBible`, and Visual Score records require an
  explicit reopen before revision.
- Locked `FilmBible`, `VisualState`, `ShotSpec`, and `Take` records cannot be
  patched or replaced.
- Revisions preserve record/project identity and increase revision numbers by
  exactly one.
- Revision impact planning separates dependent unlocked records to invalidate
  from locked records that must remain protected.

## Fixtures

The canonical fixture is
`fixtures/projects/impossible-city-demo.v1.json`. It contains:

- a rights-cleared selected score and measured analysis;
- one editable analysis revision and separate Music Reading;
- three structurally distinct Director Treatments;
- one locked Film Bible and approved Audiovisual Contract;
- six Visual Score segments using all four relationship modes;
- three anchor Visual States and six complete ShotSpecs;
- one beautiful-but-wrong take, a timing-only repair, and a locked repaired take;
- one human-approved Creative Mutation;
- provider capabilities/run provenance and a complete validated fallback cut.

Focused invalid fixtures cover Visual Score gaps, overlaps, out-of-range events,
missing ShotSpec functions, and mutation of a locked Film Bible.

## Change rule

Any field or enum change now requires all four actions:

1. increment the affected contract version;
2. update the Zod schema and inferred consumers;
3. update the valid and relevant invalid fixtures;
4. update validator/revision tests before UI or provider code consumes it.

No model call is part of contract validation or fixture loading. Step 2 used zero
video generations.
