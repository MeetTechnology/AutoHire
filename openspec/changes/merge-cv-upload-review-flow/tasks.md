## 1. Flow Contract and API Updates

- [x] 1.1 Update application flow constants so the visible journey is Project Introduction, CV Review, Additional Information, and Submission Complete.
- [x] 1.2 Update route helpers and route tests so CV upload, analysis, reanalysis, review outcomes, and supplemental-field states map to the unified CV Review step.
- [x] 1.3 Update stepper links so CV Review points to the unified route and Additional Information points to materials except when supplemental fields are required.
- [x] 1.4 Relax resume upload confirmation schemas, client payloads, and service input types so Passport Full Name and Email are not required from the applicant-facing upload form.
- [x] 1.5 Add or update server/client tests proving resume upload confirmation can start analysis without applicant-entered identity fields.

## 2. Shared Review UI Extraction

- [x] 2.1 Extract the analysis progress panel from the current result page into a reusable component.
- [x] 2.2 Extract initial CV review extract and outcome cards into reusable components that can render in the unified CV Review page.
- [x] 2.3 Extract supplemental-field rendering and submission form behavior while preserving local draft behavior for supplemental fields.
- [x] 2.4 Preserve page-view and upload/analysis tracking events after extraction without duplicating events during state refreshes.

## 3. Unified CV Review Page

- [x] 3.1 Rework `/apply/resume` into the unified CV Review route that loads the application snapshot and supports upload, progress, result, and supplemental states.
- [x] 3.2 Remove Passport Full Name and Email inputs from the upload state.
- [x] 3.3 Remove resume identity draft storage reads/writes and the draft status copy from the upload state.
- [x] 3.4 Keep file selection, selected-file display, upload validation affordances, and upload tracking behavior.
- [x] 3.5 Replace the upload action area with the progress card after successful upload confirmation starts analysis.
- [x] 3.6 Replace the progress card in place with review result content when analysis completes.
- [x] 3.7 Ensure `CV_ANALYZING`, `REANALYZING`, `INFO_REQUIRED`, `INELIGIBLE`, `ELIGIBLE`, `SECONDARY_ANALYZING`, `SECONDARY_REVIEW`, and `SECONDARY_FAILED` states render the expected existing review behavior.
- [x] 3.8 Add transition styling and stable layout constraints so submit-to-progress and progress-to-result changes do not visibly jump.

## 4. Compatibility and Navigation

- [x] 4.1 Convert `/apply/result` to redirect to or delegate to the unified CV Review route.
- [x] 4.2 Ensure old `/apply/result` links with a valid session do not break and land in the unified CV Review experience.
- [x] 4.3 Update any copy that still describes Upload CV and CV Review as separate steps.
- [x] 4.4 Confirm read-only behavior still works when the application has moved beyond CV Review.

## 5. Verification

- [x] 5.1 Run or update unit tests for route helpers, schemas, upload confirmation, and analysis progress helpers.
- [x] 5.2 Update Playwright applicant-flow coverage for intro -> unified CV Review upload -> in-page progress -> in-page outcome.
- [x] 5.3 Add regression coverage that Passport Full Name, Email, and the removed draft copy are absent from the CV upload state.
- [x] 5.4 Verify the initial CV review extract table still renders with existing field order and normalization in the unified CV Review experience.
- [ ] 5.5 Run `bun run lint`, `bun run test`, and the relevant `bun run test:e2e` flow before marking implementation complete.
