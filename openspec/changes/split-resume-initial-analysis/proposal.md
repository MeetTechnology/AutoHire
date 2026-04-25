## Why

The current resume flow starts eligibility assessment immediately after the applicant uploads a CV, so applicants cannot review or correct extracted information before it drives the decision. The resume-process backend now supports a split initial flow, enabling AutoHire to show extracted profile data first and only run eligibility judgment after applicant confirmation.

## What Changes

- Replace the post-upload initial analysis trigger with the new extraction-only resume-process upload path.
- Add an applicant-facing confirmation step for the 11 extracted fields before eligibility judgment starts.
- Treat Name, Personal Email, Work Email, and Phone Number as extraction-only fields that must not influence eligibility, rejection, bypass, or borderline logic.
- Trigger the new eligibility judgment endpoint only after the applicant confirms the extracted information.
- Update analysis polling, status copy, and progress handling so the UI distinguishes extraction and eligibility judgment stages.
- Preserve the existing final eligibility outcomes, missing critical information handling, supplemental-field loop, and downstream supporting-materials flow after judgment completes.

## Capabilities

### New Capabilities

- `resume-extraction-confirmation`: Covers the applicant-facing split initial resume review flow, including extraction-only upload, extracted-field confirmation, eligibility judgment trigger, and stage-aware progress/result handling.

### Modified Capabilities

- `initial-cv-review-extract-table`: The extracted-information presentation must become part of the active confirmation flow on `/apply/resume`, not only a passive post-analysis review section.

## Impact

- Affected UI: `/apply/resume` and the `CvReviewExperience` upload, progress, extracted-field display, and result states.
- Affected client APIs: resume analysis start/status/result functions in `src/features/application/client.ts`.
- Affected server integration: application service calls into `src/lib/resume-analysis/client.ts` must use `POST /resume-process/extraction/upload`, poll `GET /resume-process/jobs/:jobId`, and call `POST /resume-process/jobs/:jobId/judge-eligibility` after confirmation.
- Affected data mapping: result normalization must handle split-stage fields such as `extraction_*` and `judgment_*` while preserving compatibility with final `raw_response` / `parsed_result` after judgment.
- Affected state machine and routing: application statuses and current-step behavior may need to represent extraction complete / confirmation pending separately from eligibility judgment in progress.
- Affected tests: route tests, application service tests, resume-analysis client tests, component behavior tests, and end-to-end application flow coverage.
- External dependency: requires the resume-process backend split initial endpoints and workers described in `docs/resume_process_split_initial_api.md`.
