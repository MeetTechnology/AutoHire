## Context

The resume step (`/apply/resume`) collects **Passport Full Name** and **Email** in React state and persists them only to `localStorage` via `draft-storage`. The confirm endpoint (`POST /api/applications/:applicationId/resume`) validates `resumeConfirmSchema` (file metadata + `objectKey`) and `createResumeUploadRecord` creates a `ResumeFile` and bumps `Application.applicationStatus` to `CV_UPLOADED` without touching identity text. `Application` in Prisma has no columns for these declarations today.

## Goals / Non-Goals

**Goals:**

- Persist the two applicant-declared values on the **Application** row at the same lifecycle moment as the first successful resume confirm (screening credentials for that application).
- Validate on the server: non-empty trimmed passport full name; syntactically valid email (Zod `email()` or equivalent).
- Keep **memory runtime** (`getRuntimeMode() === "memory"`) behavior aligned with Prisma: extend `ApplicationRecord`, `updateApplication`, and any snapshot mapping so tests and local sample flows still work.

**Non-Goals:**

- Changing `ExpertInvitation.email` semantics or auto-syncing the two values to the invitation record.
- Using these fields to drive auth or session identity.
- Encrypting at rest in this change (follow existing DB security posture; document PII sensitivity only).
- Replacing CV-derived names in `ResumeAnalysisResult.extractedFields`.

## Decisions

1. **Store on `Application`, not `ResumeFile`**  
   **Rationale:** Screening credentials describe the applicant’s declaration for the whole application, not a specific file version; re-uploads may keep the same identity without duplicating per `ResumeFile`.  
   **Alternative considered:** JSON column on `Application` — rejected as harder to query and index later.

2. **Column names: `screeningPassportFullName` and `screeningContactEmail` (both `String?`)**  
   **Rationale:** Clear intent, distinct from `ExpertInvitation.email`. Nullable supports existing rows and migrations without backfill. New confirms **require** both in the API schema so every new upload path supplies values.  
   **Alternative considered:** `NOT NULL` with placeholder — rejected to avoid fake data for historical rows.

3. **Extend `resumeConfirmSchema` and `confirmResumeUpload` client body**  
   **Rationale:** Single round-trip with file confirm matches current UX and avoids a second race-prone endpoint.  
   **Trade-off:** **BREAKING** for any client that calls confirm without the new fields; this repo only has the one caller to update.

4. **Write fields inside `createResumeUploadRecord` (or immediately adjacent in the same service function)**  
   **Rationale:** Keeps “resume confirmed” side effects in one place. Merge the new fields into the existing `updateApplication` call that sets `CV_UPLOADED` to avoid two updates.  
   **Alternative considered:** Prisma interactive transaction — optional improvement if partial failure becomes an issue; current sequential Prisma calls are acceptable for MVP if documented.

5. **Prisma migration**  
   Follow standard workflow: edit `schema.prisma`, run `bun run db:migrate` / `prisma migrate dev --name ...` per [Prisma migrate docs](https://github.com/prisma/prisma/blob/main/packages/migrate/README.md) (Context7: `npx prisma migrate dev --name <description>`), then `prisma generate`.

6. **Event payload**  
   Extend `RESUME_CONFIRMED` event with non-sensitive metadata only (for example field lengths or a boolean “identityCaptured”); avoid logging raw email or full name in `ApplicationEventLog`.

## Risks / Trade-offs

- **[Risk] PII in database** → Mitigation: treat like other personal data; restrict admin access; do not echo into client logs.  
- **[Risk] Drift between `localStorage` draft and server** → Mitigation: server values are source of truth after confirm; optional follow-up to hydrate draft from snapshot if API exposes fields later.  
- **[Risk] Memory store / E2E** → Mitigation: update in-memory `ApplicationRecord` seeds and types in `store.ts` in the same change.

## Migration Plan

1. Deploy migration adding nullable columns (no data loss).  
2. Deploy application code that **requires** the two fields on confirm — after deploy, older cached frontends may fail until refresh; acceptable for controlled invite flow or coordinate release.  
3. Rollback: revert app code first (confirm accepts old body only if you temporarily keep fields optional—out of scope unless product asks); DB columns can remain unused.

## Open Questions

- Should a **subsequent** resume re-upload be allowed to **change** these credentials, or should the first non-null values be frozen? (Default in implementation: **overwrite on each confirm** unless product decides otherwise—document in code comment if frozen.)
