# Servio documentation

This folder contains project-facing documentation that should not be imported by the application.

## Contents

- [Project review](PROJECT_REVIEW.md) — current codebase status and recommended follow-up work.

## Documentation location

The existing documents in `src/routes/docs/` are preserved. For a Next.js project, application code belongs in `app/` and `src/`, while project documents are easier to find and keep out of route-related source trees when they live in this top-level `docs/` folder.

Move documents here gradually when it is convenient; do not move generated or runtime files into this folder.
