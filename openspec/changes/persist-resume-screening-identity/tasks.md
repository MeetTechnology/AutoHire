## 1. Schema and migration

- [x] 1.1 Add `screeningPassportFullName` and `screeningContactEmail` (`String?`) to `Application` in `prisma/schema.prisma`
- [x] 1.2 Generate and apply a Prisma migration (`bun run db:migrate` or `prisma migrate dev`) and run `prisma generate`

## 2. Data layer and runtime parity

- [x] 2.1 Extend `ApplicationRecord` and `updateApplication` in `src/lib/data/store.ts` for memory mode and Prisma updates
- [x] 2.2 Update any `ApplicationSnapshot` / mapping code so sessions or APIs that surface application data remain type-correct (add fields only where intentionally exposed)

## 3. Validation and service behavior

- [x] 3.1 Extend `resumeConfirmSchema` in `src/features/application/schemas.ts` with trimmed passport full name and validated email
- [x] 3.2 Update `createResumeUploadRecord` in `src/lib/application/service.ts` to persist the two fields on `Application` together with existing resume confirm behavior
- [x] 3.3 Adjust `RESUME_CONFIRMED` event payload in `createResumeUploadRecord` to avoid logging raw PII (per design)

## 4. API client and UI

- [x] 4.1 Extend `confirmResumeUpload` in `src/features/application/client.ts` to send the new JSON fields
- [x] 4.2 Pass draft `passportFullName` and `email` from `src/app/(public)/apply/resume/page.tsx` into `confirmResumeUpload`, blocking upload if invalid before calling the API where appropriate

## 5. Tests and verification

- [x] 5.1 Add or extend Vitest coverage for `resumeConfirmSchema` (valid / invalid cases)
- [x] 5.2 Add route-level or service-level test proving confirm persists identity fields when using memory or Prisma test harness
- [x] 5.3 Run `bun run test` and fix regressions; run `bun run lint` if types ripple
