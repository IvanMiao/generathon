# Step 4 — Manual Take import

Status: the provider-neutral MP4 import and mechanical media-report boundary is
complete as of 2026-08-02. It is the guaranteed offline path when a video
provider is unavailable or an editor creates a Take in another approved tool.

## Product flow

1. Open **Shots** in `/projects/demo` and select a locked ShotSpec.
2. Under **Provider-neutral handoff**, choose an MP4 with an H.264 video stream
   (512 MB maximum) and select **Import candidate**.
3. The server saves a new candidate Take and reports duration, codec, geometry,
   frame rate, and whether audio is present. The ShotSpec remains locked and
   unchanged.

The endpoint is:

```text
POST /api/projects/:projectId/shots/:shotId/manual-takes
multipart/form-data:
  expectedProjectRevision: positive integer
  file: MP4
```

It returns `201` with the new project revision, artifact identity/hash, candidate
Take identity, and the mechanical media report. A stale revision returns `409`
with `project_revision_conflict`; the client refreshes server data after a
successful import.

## Boundary and safeguards

- Only `.mp4`, `video/mp4`, or `application/mp4` uploads are accepted; empty
  files and files larger than 512 MB are rejected before they are stored.
- The browser-suitable baseline is a positive-duration H.264 video stream with
  positive dimensions and a frame rate. `ffprobe` performs this check before the
  temporary file is promoted.
- The client filename never becomes a storage path. Files use a generated name
  below `uploads/<project-id>/`; path traversal and upload roots outside the
  workspace are rejected.
- Every imported file receives a SHA-256 `Artifact` with `import` provenance.
  The new `Take` has `source: manual`, `status: candidate`, and `locked: false`.
- The repository replaces the ProjectBundle only when
  `expectedProjectRevision` is still current. If persistence loses that race,
  the imported file is removed rather than leaving an unrecorded asset.

## Candidate review and lock

The Shot workspace now displays every reviewable imported manual Take through a
project-scoped, byte-range media route:

```text
GET /api/projects/:projectId/takes/:takeId/media
```

The route resolves the Take's recorded `Artifact` from the ProjectBundle and
only serves an in-workspace `video/mp4` path; it never accepts a browser-supplied
file path.

Review and locking keep separate mutations:

```text
POST /api/projects/:projectId/takes/:takeId/review
POST /api/projects/:projectId/takes/:takeId/lock
```

`review` moves an imported manual Take from `candidate` to `needs_decision` and
records a complete accepting mechanical `ReviewReport` based on the previous
H.264 admission check. It is not an artistic approval. `lock` requires that
report and `{ confirmed: true }`; it adds a human `accept` Decision, moves the
Take to `locked`, and prevents subsequent mutation through the revision rules.

Manual import therefore never implicitly approves material for the final cut.
Timeline selection and AssemblyRun creation remain the next distinct boundary.

## Verification

`src/lib/server/manual-take-import.test.ts` covers successful import, unsafe
file/stale-revision rejection, and invalid media-probe rejection.
`src/lib/application/workflow/project-workflow.test.ts` covers the candidate
review/confirmation/lock state machine, while `src/lib/server/take-media.test.ts`
checks that the media resolver cannot escape the workspace. The full repository
verification remains `npm run check`.
