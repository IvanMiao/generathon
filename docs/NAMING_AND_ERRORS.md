# Naming and error conventions

## Canonical product language

Demo-visible UI, JSON fields, enum values, database columns, and user-facing
errors use English. Planning notes may be bilingual. Product concepts keep the
PRD's exact names: `MusicAnalysis`, `MusicReading`, `DirectorTreatment`,
`FilmBible`, `AudiovisualContract`, `VisualScoreSegment`, `VisualState`,
`ShotSpec`, `Take`, `ReviewReport`, `RepairPlan`, and `ProviderRun`.

Use:

- `camelCase` for TypeScript values and functions;
- `PascalCase` for TypeScript types and React components;
- `snake_case` for JSON enum values and SQLite columns;
- kebab-case for URL path segments;
- seconds from the selected track's start for persisted media timestamps;
- ISO 8601 UTC strings for wall-clock timestamps.

Provider names are stable product IDs: `gemini`, `openai`, and
`open_weight_on_modal`. A provider's model name is configuration, never an enum
or domain identifier.

## Errors

Route Handler failures return:

```json
{
  "error": {
    "code": "capability_document_invalid",
    "message": "The checked capability document could not be read.",
    "request_id": "uuid"
  }
}
```

Codes are stable `snake_case` identifiers. Messages explain the failed user or
system action without leaking file paths, credentials, provider payloads, or stack
traces. Unexpected exceptions are logged only at the server boundary and are
converted to a safe error contract. Validation errors should identify the domain
record and violated invariant; they must not rewrite the user's creative intent.

Health semantics:

- liveness answers when the Next process can serve requests;
- readiness answers only when SQLite and required local stores are available;
- external AI providers do not affect local readiness.
