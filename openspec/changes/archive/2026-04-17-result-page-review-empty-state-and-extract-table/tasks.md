## 1. Result page pre-start copy cleanup

- [x] 1.1 Locate the pre-detailed-review rendering branch in `src/app/(public)/apply/result/page.tsx` that currently displays "No detailed review fields are currently available for this application state."
- [x] 1.2 Remove that sentence without changing status gating or detailed-review transition behavior.
- [x] 1.3 Verify `/apply/result?view=review` still shows existing status-driven guidance before and after detailed review starts.

## 2. Initial CV review extract table rendering

- [x] 2.1 Refactor the `InitialCvReviewExtractCard` content in `src/app/(public)/apply/result/page.tsx` to use semantic table markup for field label/value rows.
- [x] 2.2 Keep existing field order and value derivation by continuing to use `INITIAL_CV_REVIEW_FIELD_ROWS` and `getInitialCvReviewFieldValue`.
- [x] 2.3 Ensure responsive layout and readable wrapping so the table remains usable across common viewport sizes.

## 3. Validation

- [x] 3.1 Run lint or targeted checks for the updated result page file to catch JSX/TS regressions.
- [ ] 3.2 Manually verify the `ELIGIBLE`, `SECONDARY_ANALYZING`, and `SECONDARY_REVIEW` paths to confirm copy removal and table rendering behavior match specs.
