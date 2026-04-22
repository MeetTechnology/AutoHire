## Why

The CV review flow now needs to extract and persist `Name`, `Personal Email`, and `Phone Number` alongside the existing seven initial-review fields, but those contact fields have different semantics: they must be displayed and saved, yet they must not affect eligibility judgment. The applicant journey also needs a new completion rule so eligible applicants cannot proceed to supporting materials until any missing contact fields have been supplied and stored.

## What Changes

- Extend the initial CV review extraction contract from 7 fields to 10 fields by adding `Name`, `Personal Email`, and `Phone Number`, while explicitly keeping those three fields outside eligibility judgment and missing-critical-field determination.
- Update CV review result normalization and display so the unified review page shows the three new contact fields together with the existing extract table rows.
- Add a nullable screening phone column on `Application` and persist all three contact fields server-side as application-level screening contact data.
- Introduce applicant-facing completion rules for missing contact fields:
  - If the initial result is `ELIGIBLE` but one or more contact fields are missing, the applicant must fill them before continuing to Additional Information / supporting materials.
  - If the initial result is `INELIGIBLE`, missing contact fields do not block or trigger extra input.
  - If the initial result is `INSUFFICIENT_INFO`, missing contact fields must appear together with any eligibility-critical missing fields in the same supplemental step and reanalysis flow.
- On reanalysis, preserve applicant-entered contact values when the upstream result still returns those contact fields as missing or `!!!null!!!`.
- **BREAKING**: Update the upstream initial CV review output contract and local result parser to expect the new 10-field extracted-information shape and the revised missing-field semantics.

## Capabilities

### New Capabilities
- `cv-review-contact-completion`: Defines how extracted or applicant-supplied contact fields are captured, persisted, requested, and used to unblock applicant progression after CV review without changing eligibility judgment.

### Modified Capabilities
- `initial-cv-review-extract-table`: Expands the configured initial CV review extract rows and display rules to include `Name`, `Personal Email`, and `Phone Number` in the applicant-visible extract section.

## Impact

- **Database**: `Application` gains a nullable phone field alongside the existing screening name and email columns; memory-store types and snapshot mapping must stay aligned.
- **Analysis contract**: CV review prompts / output parsing / missing-field inference must treat the 3 contact fields as extraction-only, non-eligibility inputs, and merge applicant-entered fallback values after reanalysis.
- **Applicant flow**: `/apply/resume` and the transition into `/apply/materials` must gate eligible applicants on completed contact fields, while preserving the existing ineligible and insufficient-info paths.
- **Code**: likely touches `prisma/schema.prisma`, a new migration, `src/lib/resume-analysis/result-normalizer.ts`, `src/features/analysis/initial-cv-review-extract.ts`, `src/features/application/components/cv-review-experience.tsx`, `src/features/application/schemas.ts`, `src/features/application/types.ts`, `src/lib/application/service.ts`, `src/lib/data/store.ts`, and related client / route handlers.
- **Tests**: update parser, schema, route, service, and applicant-flow coverage for eligible, ineligible, and insufficient-info cases involving missing contact fields.
