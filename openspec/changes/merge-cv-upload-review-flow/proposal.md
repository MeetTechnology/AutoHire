## Why

The current applicant journey splits CV upload and CV review into two adjacent pages, which makes the flow feel longer than the actual task and forces a page transition exactly when the applicant expects immediate review feedback. Combining upload, progress, and review results into one CV Review step will make the experience feel continuous and reduce redundant identity/draft UI.

## What Changes

- Replace the separate Upload CV and CV Review steps with a single CV Review step in the applicant-facing flow.
- Change the top progress/stepper from five steps to four steps by merging Upload CV and CV Review into one step.
- Remove the Passport Full Name and Email inputs from the CV upload surface.
- Remove the local draft status copy for the deleted identity fields, including "Draft saves automatically" and "Typed values will be cached locally after a short pause."
- After the applicant selects a CV and clicks the submit button, replace the button/upload action area with the existing review progress card instead of navigating to a separate review page.
- When analysis completes, replace the progress card in place with the CV review result content currently shown on the CV Review page.
- Preserve the existing CV review outcomes: in-progress, eligible, ineligible, additional information required, reanalysis, and detailed-review states.
- **BREAKING**: The applicant-facing step model and route access expectations change because CV upload is no longer a distinct visible step.

## Capabilities

### New Capabilities

- `unified-cv-review-flow`: Defines the combined applicant-facing CV Review step, including four-step navigation, upload UI, upload-to-progress transition, and in-place transition from analysis progress to review results.

### Modified Capabilities

- `initial-cv-review-extract-table`: The initial CV review extract table must remain available after the upload/review merge and should be defined against the unified CV Review experience instead of only the old `/apply/result` page.

## Impact

- Affected frontend routes: `src/app/(public)/apply/resume/page.tsx`, `src/app/(public)/apply/result/page.tsx`, and the apply layout/stepper consumers.
- Affected shared application flow logic: `src/features/application/constants.ts`, `src/features/application/route.ts`, and route tests.
- Affected client state: upload state, analysis polling state, progress-card rendering, and any local draft logic tied to the removed identity fields.
- Affected APIs and services: resume upload confirmation may need to stop requiring applicant-entered passport name/email or derive/accept nullable values according to the updated server contract.
- Affected tests: route access tests, upload validation tests, result/progress UI tests, and Playwright applicant-flow tests.
