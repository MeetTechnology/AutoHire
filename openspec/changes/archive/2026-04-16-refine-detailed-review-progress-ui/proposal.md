## Why

The detailed review section currently splits status and progress across multiple areas, leaves low-value diagnostics visible after the workflow is effectively complete, and shows a nested-button hydration warning in the browser. The UI needs a clearer completion path so applicants can understand detailed review progress without redundant messaging or invalid HTML.

## What Changes

- Consolidate detailed review status and prompt progress into the primary result-page review flow above the "Detailed review" section.
- Remove the low-priority "Technical details" diagnostics panel from the bottom of the result page.
- Replace the "Completed prompts" label with a compact `x/9` progress indicator that appears before the success banner and disappears once all prompts finish.
- Hide the "The detailed review has already been started for this application." notice after all detailed-review prompts complete.
- Restructure the detailed review disclosure action area so it no longer renders interactive buttons inside the disclosure trigger button.

## Capabilities

### New Capabilities
- `detailed-review-progress-ui`: Defines the applicant-facing progress, completion, and action presentation for the detailed review portion of `/apply/result`.

### Modified Capabilities
- None.

## Impact

- Affected code: `src/app/(public)/apply/result/page.tsx`, shared page-shell disclosure UI if layout changes are needed there, and any related tests covering result-page detailed review behavior.
- Affected behavior: applicant progress messaging, success-state presentation, and browser hydration validity during detailed review completion.
