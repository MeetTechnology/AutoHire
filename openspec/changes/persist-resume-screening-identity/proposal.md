## Why

Experts enter **Passport Full Name** and **Email** on `/apply/resume` as screening credentials, but today those values only live in browser `localStorage` drafts and are never sent on resume upload confirmation—so they cannot be audited, reconciled with invitations, or reused downstream. Persisting them on the server closes that gap for compliance and operations.

## What Changes

- Add **two nullable columns** on `Application` (for example screening passport full name and screening contact email) populated when the expert confirms their first resume upload from the resume step.
- Extend the **resume confirm** JSON contract and Zod schema so the client sends trimmed passport name and a validated email on the same request as file metadata (**BREAKING** for any out-of-repo caller that omits these fields).
- Update **application service** logic that runs on resume confirm to write these fields together with the existing resume file and status updates (single coherent server-side operation).
- Update the **resume page client** to include the two values in `confirmResumeUpload` and keep local draft behavior only as UX convenience (optional: still clear draft after success).
- Ship a **Prisma migration** plus `prisma generate`; document `bun run db:migrate` for environments applying schema.

## Capabilities

### New Capabilities

- `resume-screening-identity`: Server-side persistence and API validation for passport full name and contact email declared on the resume upload step, stored per application as screening credentials.

### Modified Capabilities

- _(none)_ — Existing tracked capability `apply-entry-appearance` in `openspec/specs/` concerns background visuals, not resume identity persistence.

## Impact

- **Database**: `Application` table gains two string columns (nullable for existing rows).
- **API**: `POST /api/applications/:applicationId/resume` (confirm) request body gains required fields for new uploads once implemented; clients must send them.
- **Code**: `prisma/schema.prisma`, new migration under `prisma/migrations/`, `src/features/application/schemas.ts`, `src/features/application/client.ts`, `src/app/(public)/apply/resume/page.tsx`, `src/lib/application/service.ts` (`createResumeUploadRecord` and related Prisma update helpers), possible Prisma types in `src/lib/data/store.ts` if used for snapshots.
- **Tests**: Extend or add route/service tests and any Vitest covering schema parsing.
