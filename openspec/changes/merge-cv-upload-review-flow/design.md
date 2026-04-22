## Context

The applicant flow currently uses `APPLICATION_FLOW_STEPS_WITH_INTRO` to render five visible steps: Project Introduction, Upload CV, CV Review, Additional Information, and Submission Complete. Upload lives on `/apply/resume`, while review/progress/results live on `/apply/result`.

The upload page collects Passport Full Name and Email in local React state, autosaves them to localStorage, creates an upload intent, uploads the file, confirms the resume upload, and then navigates to `/apply/result`. The result page owns analysis polling, the progress card, initial CV review extract display, outcome banners, and supplemental-field reanalysis.

This change makes CV upload and CV review feel like one continuous step. The implementation should preserve the existing backend analysis lifecycle while reshaping the applicant-facing route, stepper, and page transitions.

## Goals / Non-Goals

**Goals:**

- Render a four-step top flow: Project Introduction, CV Review, Additional Information, Submission Complete.
- Use one applicant-facing CV Review surface for file upload, analysis progress, and review results.
- Remove Passport Full Name, Email, and identity-field draft autosave UI from the upload experience.
- Replace the submit/upload action area with the progress card after upload confirmation starts analysis.
- Replace the progress card in place with the same review result content currently shown on the result page.
- Preserve existing eligibility outcomes, missing-field reanalysis, detailed review states, tracking, and route guards.

**Non-Goals:**

- Changing the resume-analysis service contract or eligibility rules.
- Redesigning the supporting materials or final submission pages.
- Adding new persistence for draft upload files.
- Removing existing database columns for `screeningPassportFullName` or `screeningContactEmail`.
- Building a new animation library or introducing route-level view-transition dependencies.

## Decisions

### D1 - Make `/apply/resume` the unified CV Review route

**Decision:** Keep `/apply/resume` as the primary route because the existing intro step already routes applicants there. Rename/reframe it as CV Review and move or share the result-page review content into this route. Keep `/apply/result` as a compatibility route that redirects to the unified route or renders the same component temporarily.

**Rationale:** This minimizes entry-flow churn and avoids a larger redirect migration from the intro page. It also lets old `/apply/result` links continue to resolve during the transition.

**Alternatives considered:** Make `/apply/result` the unified route and redirect `/apply/resume`. This matches the old "review" name but would require changing the first post-intro destination and more route guard assumptions.

### D2 - Treat Upload CV and CV Review as one flow step

**Decision:** Change flow-step constants and route helpers so the visible journey is:

1. Project Introduction
2. CV Review
3. Additional Information
4. Submission Complete

The unified CV Review step covers statuses `INTRO_VIEWED`, `CV_UPLOADED`, `CV_ANALYZING`, `REANALYZING`, `INFO_REQUIRED`, `INELIGIBLE`, `ELIGIBLE`, `SECONDARY_ANALYZING`, `SECONDARY_REVIEW`, and `SECONDARY_FAILED`. `INFO_REQUIRED` can still expose an Additional Information subview on the unified/review surface when supplemental fields are required.

**Rationale:** The user mental model is "submit CV and wait for review," not two separate stages. Keeping status mapping centralized in `route.ts` reduces drift between the stepper and route guards.

**Alternatives considered:** Keep five internal steps but hide one label in the UI. Rejected because it would leave navigation/read-only logic inconsistent with what applicants see.

### D3 - Remove applicant-entered screening identity from the upload contract

**Decision:** Remove Passport Full Name and Email from the upload form and stop requiring them in the client confirm call. Update the server schema/service so resume confirmation can proceed without these fields, preserving existing nullable database columns for historical data or future server-derived identity.

**Rationale:** The requested UX removes these inputs entirely. Keeping the backend fields nullable avoids a migration and does not block analysis.

**Alternatives considered:** Autofill from invitation email and require only name removal. Rejected for this change because Passport Full Name has no reliable source, and mixing server-derived email with absent name would create ambiguous screening identity semantics.

### D4 - Reuse result-page review modules instead of duplicating logic

**Decision:** Extract shared review/progress/result pieces from `/apply/result/page.tsx` into local components or feature components, then compose them inside the unified CV Review page. Keep polling and state-transition behavior equivalent to the current result page.

**Rationale:** The current result page already handles complex states: initial analysis, reanalysis, missing fields, ineligible/eligible outcomes, and secondary analysis. Duplicating that logic inside the upload page would increase regression risk.

**Alternatives considered:** Move all upload logic into `/apply/result/page.tsx`. This makes the old result page even larger and forces upload behavior into a route that currently assumes analysis has already started.

### D5 - Use a single in-page review stage area for transitions

**Decision:** Introduce one stable "review stage" area below file selection. Its content changes by application/page state:

- no file or not submitted: upload action button
- upload/confirm pending: submitting state
- analyzing/reanalyzing: `AnalysisProgressPanel`
- completed analysis: initial CV review extract and outcome content
- info required: outcome content plus supplemental fields

Use CSS transitions on opacity/transform and stable min-height/aspect constraints to avoid layout jumps. Do not show a fake 100% completion flash unless the current progress component already reaches a terminal state before unmounting.

**Rationale:** The product goal is continuity. A stable content area lets the button become progress and then become results without a route transition or abrupt page reflow.

**Alternatives considered:** Navigate to the review route immediately after confirm. This is the current behavior and is what the change is meant to remove.

### D6 - Preserve local draft behavior only where fields remain

**Decision:** Delete the resume identity draft key usage and its status banner from the unified CV Review upload UI. Keep supplemental-field draft behavior on the Additional Information subview because those fields still exist and are user-entered.

**Rationale:** Draft copy for deleted fields would be confusing, but supplemental drafts still protect meaningful form input.

## Risks / Trade-offs

- **[Risk] Route and step index regressions** -> Mitigation: update route helper tests and Playwright flow tests for the four-step model.
- **[Risk] Removing required identity fields breaks the resume confirm API** -> Mitigation: change client and server schema together, keep DB columns nullable, and add tests for confirm without identity values.
- **[Risk] The unified page becomes too large** -> Mitigation: extract review panels, progress panel, and supplemental form into components before composing the unified page.
- **[Risk] In-place animation hides state changes from assistive technology** -> Mitigation: keep status banners, progressbar ARIA, focus management after completion where appropriate, and avoid animation-only communication.
- **[Risk] Old `/apply/result` links or stepper links break** -> Mitigation: keep a compatibility route during rollout and update stepper links to the unified route.

## Migration Plan

1. Update flow constants, route mapping, and tests for the four-step model.
2. Relax resume confirm identity validation while preserving existing nullable persistence fields.
3. Extract reusable review/progress/result components from the current result page.
4. Compose the unified CV Review route on `/apply/resume`, including upload, progress, result, and supplemental states.
5. Convert `/apply/result` to redirect or delegate to the unified route.
6. Update E2E tests for upload -> progress -> result without a route transition.
7. Rollback by restoring the previous route mapping and resume/result page split; database rollback is not required.

## Open Questions

- Should `/apply/result` redirect permanently, temporarily, or remain as a hidden compatibility renderer for one release?
- Should existing applications that already have `screeningPassportFullName` and `screeningContactEmail` show those values anywhere after the fields are removed?
- When analysis finishes, should focus move to the review outcome heading, or remain in place to avoid surprising keyboard users?
