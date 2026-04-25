## Context

AutoHire currently keeps the applicant-facing resume upload on `/apply/resume`: the browser uploads the file to OSS through a presigned URL, confirms the uploaded object with the BFF, and the applicant starts an initial analysis job. The BFF then reads the stored object and calls the resume-process `POST /resume-process/upload` endpoint, which performs extraction and eligibility judgment in one upstream job.

The resume-process backend now exposes a split initial flow:

- `POST /resume-process/extraction/upload` uploads the resume to upstream and runs only the 11-field extraction prompt.
- `GET /resume-process/jobs/:jobId` returns the shared job detail, including split fields such as `extraction_*` and `judgment_*`.
- `POST /resume-process/jobs/:jobId/judge-eligibility` starts eligibility judgment on the same upstream job after extraction is complete.

The upstream judge endpoint has no request body and uses the stored `extraction_raw_response` as its input. Therefore the initial AutoHire confirmation step is an applicant acknowledgement of extracted data, not an editing workflow, unless the backend contract later accepts corrected extracted data.

## Goals / Non-Goals

**Goals:**

- Keep the existing browser-to-OSS upload and BFF authorization model.
- Change the initial resume review into the sequence: upload CV, start extraction, show extracted information, confirm, run eligibility judgment, show final outcome.
- Persist extraction-stage data separately from final eligibility results so page refreshes and polling cannot mistake extraction completion for final judgment completion.
- Distinguish extraction progress from eligibility judgment progress in `/apply/resume` status copy and UI state.
- Preserve existing final outcome behavior after judgment: `ELIGIBLE`, `INELIGIBLE`, `INFO_REQUIRED`, supplemental-field reanalysis, secondary review, and materials navigation.

**Non-Goals:**

- Do not move browser uploads directly to the resume-process backend; the app continues to store uploads through its current OSS/object-store path.
- Do not implement applicant editing of extracted fields unless the upstream judge API accepts confirmed/corrected field values.
- Do not change the backend prompt text from AutoHire; the split prompts are owned and versioned by resume-process.
- Do not change secondary analysis semantics except to prevent secondary analysis from starting before eligibility judgment has produced the final initial result.

## Decisions

### Decision 1: Add explicit application states for extraction

Add application statuses for the split stage:

- `CV_EXTRACTING`: an extraction-only upstream job is queued or processing.
- `CV_EXTRACTION_REVIEW`: extraction completed and the applicant must confirm the extracted information.

Keep `CV_ANALYZING` for eligibility judgment after confirmation. Final statuses remain unchanged.

Rationale: the upstream job may report `completed` after extraction even though eligibility judgment has not run. A distinct local application state prevents route guards, progress UI, and secondary analysis from treating extraction completion as final analysis completion.

Alternatives considered:

- Reuse `CV_ANALYZING` for both extraction and judgment. This reduces enum churn but makes progress copy and completion handling ambiguous.
- Store the stage only in `ResumeAnalysisJob.stageText`. This avoids a migration but gives routing and access control no reliable state.

### Decision 2: Persist extraction review separately from final analysis results

Introduce a local extraction-review persistence layer tied to the application and the latest initial analysis job. It should store:

- `applicationId`
- `analysisJobId`
- upstream numeric `externalJobId`
- normalized `extractedFields`
- optional `rawExtractionResponse`
- `status` such as `PROCESSING`, `READY`, `CONFIRMED`, `FAILED`
- `confirmedAt` when the applicant confirms

Do not create or overwrite `ResumeAnalysisResult` when extraction completes. Create the final `ResumeAnalysisResult` only after judgment completes and upstream `initial_result.raw_response` / `parsed_result` contain the complete three-section judgment output.

Rationale: `ResumeAnalysisResult.analysisJobId` is unique and currently represents a final initial-analysis result. Reusing it for extraction would cause `refreshAnalysisState` to skip fetching final judgment output because an existing result for the same job already exists.

Alternatives considered:

- Store extraction as a `ResumeAnalysisResult` with `eligibilityResult: UNKNOWN`. This conflicts with the final result lifecycle and the unique `analysisJobId` relation.
- Keep extraction only in React state. This breaks refresh, multi-tab continuation, and session restore.

### Decision 3: Keep the existing BFF route shape for starting review and add a confirmation route

Repurpose `POST /api/applications/:applicationId/resume/analyze` to start extraction-only initial review. Add a new BFF route such as `POST /api/applications/:applicationId/resume/confirm-extraction` to confirm extracted information and trigger upstream eligibility judgment.

Rationale: existing UI and tests already treat `/resume/analyze` as the applicant action for starting CV review. Its internal behavior can change from one-step initial analysis to extraction-first review without exposing upstream service details to the browser. A separate confirmation route makes the applicant-controlled boundary explicit.

Alternatives considered:

- Add a new `/resume/extract` BFF route and leave `/resume/analyze` as judgment. This is more explicit but requires larger client-side routing changes and makes the existing "Start CV Analysis" action misleading.

### Decision 4: Extend the resume-analysis client with split-stage primitives

Add live-mode client functions:

- `createResumeExtractionJob(input)` calling `POST /resume-process/extraction/upload`.
- `getResumeAnalysisStatus(input)` enhanced to return an analysis stage derived from upstream `extraction_status`, `judgment_status`, and job status.
- `getResumeExtractionResult(input)` to normalize `initial_result.extraction_raw_response` / `extraction_parsed_result` into the existing extracted-field keys.
- `triggerEligibilityJudgment(input)` calling `POST /resume-process/jobs/:jobId/judge-eligibility`.
- `getResumeAnalysisResult(input)` continues to read final `raw_response` / `parsed_result`, but only after judgment is complete.

Rationale: keeping split-service knowledge inside `src/lib/resume-analysis/client.ts` preserves the existing application service boundary and avoids leaking upstream response shapes into React components.

Alternatives considered:

- Parse split-stage payloads directly in route handlers. This would duplicate upstream schema handling and make tests less focused.

### Decision 5: Confirmation is acknowledgement-only for now

The confirmation UI should present the 11 extracted fields in a reviewable table/card and ask the applicant to confirm before judgment starts. It should not send edited field values to upstream because the documented `judge-eligibility` endpoint has no body and uses upstream `extraction_raw_response`.

Rationale: accepting edits in the UI without passing them to judgment would create a false sense that corrected values affect eligibility.

Alternatives considered:

- Allow local edits and store them only in AutoHire. This would diverge UI truth from judgment input.
- Add a BFF-only synthesized judgment call using edited JSON. This is not supported by the documented upstream contract.

### Decision 6: Mock mode should mirror the split lifecycle

Mock mode should no longer jump directly from start review to final eligibility. It should return an extraction-ready state first, then create the final mock eligibility result only after confirmation.

Rationale: component tests and E2E flows need to exercise the same applicant decision boundary as live mode.

Alternatives considered:

- Keep mock mode as one-step. This would leave the highest-risk UI path untested locally.

## Risks / Trade-offs

- Upstream marks the job `completed` after extraction, before judgment. → Use local `CV_EXTRACTION_REVIEW` status and separate extraction persistence so AutoHire treats extraction completion as an intermediate state.
- Applicant expects to correct extracted fields before judgment. → Keep copy clear that the applicant is confirming extracted information; treat editing as an open backend-contract question.
- Secondary analysis could start from an extraction-only upstream job because upstream job status is technically `completed`. → Gate secondary analysis on local final eligibility state and existence of a final `ResumeAnalysisResult`, not upstream job completion alone.
- Existing result polling assumes one completed state. → Add stage-aware status handling and only call final result normalization after judgment completion.
- Prisma enum/status migration touches route guards, seeds, tests, and mock data. → Update status resolution helpers and sample applications together with the schema migration.

## Migration Plan

1. Add local persistence for extraction review data and application statuses `CV_EXTRACTING` / `CV_EXTRACTION_REVIEW`.
2. Extend `src/lib/resume-analysis/client.ts` with split extraction, extraction-result, status-stage, and judgment-trigger functions.
3. Update application service methods:
   - start initial review by creating an extraction job;
   - refresh extraction jobs into `CV_EXTRACTION_REVIEW`;
   - confirm extraction by triggering judgment and moving to `CV_ANALYZING`;
   - create final `ResumeAnalysisResult` only after judgment completes.
4. Update `/apply/resume` to show extraction progress, extracted-information confirmation, judgment progress, and final outcome.
5. Update route/status helpers, mock store, seed data, route tests, client tests, and E2E flow.
6. Deploy after the resume-process service has migration `000099` and workers for `resume:extract` / `resume:judge_eligibility`.

Rollback strategy: keep the old `POST /resume-process/upload` client path available behind a local feature flag or small service-level fallback while the split flow is being validated. If split endpoints fail in production, disable the split path and return to the previous one-step initial analysis without changing stored resume uploads.

## Open Questions

- Should the applicant be allowed to correct extracted values before judgment? If yes, resume-process needs an API that accepts confirmed/corrected extracted information rather than always using stored `extraction_raw_response`.
- Should extraction start automatically immediately after upload confirmation, or should AutoHire preserve the current explicit "Start CV Analysis" action? This design preserves the explicit action to keep the replace/delete-before-review window.
- Should the upstream `GET /jobs/:jobId` response expose a first-class stage field for polling, or should AutoHire continue deriving stage from `extraction_status` and `judgment_status`?
