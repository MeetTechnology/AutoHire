## 1. Data Model And State Machine

- [x] 1.1 Add application statuses for extraction in Prisma, TypeScript application types, route helpers, mock data types, and seed/sample data.
- [x] 1.2 Add persistent storage for extraction review data tied to application and latest initial analysis job, including extracted fields, raw extraction response, review status, and confirmation timestamp.
- [x] 1.3 Add data-store functions for creating, reading, updating, and restoring the latest extraction review in both Prisma and memory runtime modes.
- [x] 1.4 Update snapshot construction so `ApplicationSnapshot` exposes extraction review data needed by `/apply/resume` without treating it as a final eligibility result.
- [x] 1.5 Update status routing and step access rules so extraction progress and extraction confirmation stay on `/apply/resume` and do not unlock supporting materials.

## 2. Resume-Process Client Integration

- [x] 2.1 Extend live upstream schemas to parse split-stage fields from `initial_result`, including `extraction_*` and `judgment_*` fields.
- [x] 2.2 Implement `createResumeExtractionJob` using `POST /resume-process/extraction/upload` while preserving existing object-store read and multipart upload behavior.
- [x] 2.3 Implement extraction status normalization that distinguishes extraction progress, extraction ready, judgment progress, judgment complete, and failed stages.
- [x] 2.4 Implement `getResumeExtractionResult` to normalize extraction-only output into the existing extracted-field display shape.
- [x] 2.5 Implement `triggerEligibilityJudgment` using `POST /resume-process/jobs/:jobId/judge-eligibility`.
- [x] 2.6 Update final result fetching so final `ResumeAnalysisResult` is created only after judgment output is complete.
- [x] 2.7 Mirror the split lifecycle in mock mode so local/dev scenarios require extraction confirmation before final eligibility is produced.

## 3. Application Service And API Routes

- [x] 3.1 Update initial review start service to create an extraction-only job and transition the application to extraction-in-progress.
- [x] 3.2 Update analysis status refresh to persist extraction-ready results and transition the application to confirmation-pending without creating a final analysis result.
- [x] 3.3 Add a BFF route for confirming extraction and triggering eligibility judgment for the same upstream job.
- [x] 3.4 Update judgment refresh handling to create the final analysis result, contact-field patch, and final application status only after judgment completes.
- [x] 3.5 Ensure contact extraction fields remain usable for contact prefill while missing contact fields do not block eligibility judgment as critical information.
- [x] 3.6 Gate secondary analysis and materials progression on final local eligibility state and final analysis result availability, not extraction-only upstream completion.
- [x] 3.7 Update tracking events and page/step names for extraction started, extraction completed, extraction confirmed, judgment started, judgment completed, and failure cases.

## 4. Applicant Resume UI

- [x] 4.1 Update `/apply/resume` loading and polling logic to include extraction-progress, confirmation-pending, judgment-progress, and final-result states.
- [x] 4.2 Add extraction-specific progress copy and judgment-specific progress copy while reusing the existing progress panel behavior.
- [x] 4.3 Render the 11 extracted fields in the existing semantic table presentation during the confirmation step.
- [x] 4.4 Add a clear confirmation action that starts eligibility judgment and does not imply applicant edits affect judgment input.
- [x] 4.5 Restore the confirmation step after page refresh using persisted extraction review data.
- [x] 4.6 Preserve existing final eligible, ineligible, insufficient-info, supplemental-field, and continue-to-materials UI behavior after judgment completes.
- [x] 4.7 Update header summary, banners, button labels, disabled states, and stepper links for the new extraction and confirmation statuses.

## 5. Tests And Fixtures

- [x] 5.1 Update resume-analysis client tests for extraction upload, split-stage polling, extraction result normalization, judgment trigger, and final judgment result fetching.
- [x] 5.2 Update application service tests for state transitions from uploaded to extracting, extraction review, judgment processing, and final outcomes.
- [x] 5.3 Add route tests for the extraction confirmation BFF endpoint and update existing `/resume/analyze` route tests for extraction-first behavior.
- [x] 5.4 Update component or flow tests to verify extracted information appears before final eligibility and confirmation triggers judgment.
- [x] 5.5 Update E2E application flow to cover upload, extraction progress, extracted-field confirmation, judgment progress, and final navigation behavior.
- [x] 5.6 Update mock fixtures and seed records so representative applications exist for extraction in progress and extraction confirmation pending.

## 6. Validation And Documentation

- [x] 6.1 Run focused Vitest suites covering resume-analysis client, application service, route handlers, route helpers, and schemas.
- [ ] 6.2 Run or update Playwright E2E coverage for the applicant resume flow.
- [x] 6.3 Run lint and format checks for modified TypeScript, Prisma, and OpenSpec files.
- [x] 6.4 Document any required deployment order or feature-flag fallback for enabling the split flow after resume-process migration `000099` and workers are live.
