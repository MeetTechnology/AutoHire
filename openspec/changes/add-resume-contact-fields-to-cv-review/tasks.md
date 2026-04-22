## 1. Data Model And Analysis Contract

- [x] 1.1 Add nullable `screeningPhoneNumber` to `Application` in `prisma/schema.prisma` and create the Prisma migration.
- [x] 1.2 Align memory-store application records, snapshot types, and mapping code with the new phone field.
- [x] 1.3 Update the initial CV review prompt / contract inputs and `result-normalizer` parsing so `Name`, `Personal Email`, and `Phone Number` are included in the extracted-information section but excluded from eligibility judgment rules.

## 2. Result Shaping And Persistence

- [x] 2.1 Expand the initial CV review extract field configuration from 7 rows to 10 rows and keep the applicant-visible display order stable.
- [x] 2.2 Add result-shaping logic that derives missing contact fields from extracted values plus stored application screening values, ignores them for ineligible outcomes, and appends them for insufficient-info outcomes.
- [x] 2.3 Persist applicant-supplied contact values from CV review follow-up submissions and merge them back into displayed extracted fields when later analysis results still omit them.

## 3. CV Review Flow Behavior

- [x] 3.1 Update the CV review experience to show the new contact rows and branch copy/actions for eligible-with-missing-contact, ineligible, and insufficient-info cases.
- [x] 3.2 Reuse the CV review follow-up form to collect missing contact fields, including the contact-only completion path that unlocks progression without starting reanalysis.
- [x] 3.3 Prevent entry into supporting materials until all required contact fields are available, while preserving the existing materials flow once contact completion is done.

## 4. Verification

- [x] 4.1 Add or update unit tests for schema validation, result normalization, missing-field synthesis, and fallback merge behavior for the three contact fields.
- [x] 4.2 Add or update route/service tests for resume confirm, CV review follow-up submission, eligible contact completion, and insufficient-info reanalysis flows.
- [ ] 4.3 Update applicant-flow coverage for the new UI states and run the relevant test suite(s) needed to verify the change.
