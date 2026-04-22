## Why

During detailed review, the result page currently exposes every editable field as soon as any prompt finishes, causing fields from unfinished prompts to appear as missing before they have actually been analyzed. This creates a misleading applicant experience while progress is still underway.

## What Changes

- Hide detailed review fields whose source value has not yet been produced while the detailed review run is still incomplete.
- Continue showing completed prompt output as soon as it is available, so applicants can see real progress without premature missing-field noise.
- After all detailed review prompts complete, show the full editable field set, including any fields that are genuinely missing.
- Preserve existing progress/status behavior and continue to use `completedPrompts/totalPrompts` as the readiness boundary.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `detailed-review-progress-ui`: Detailed review result visibility changes so incomplete runs only show fields backed by completed analysis output; missing fields appear only after all prompts finish.

## Impact

- Affects `/apply/result` detailed review result rendering and editable field preparation.
- Affects secondary analysis snapshot construction in the application service.
- May require focused tests around partial secondary analysis results and completed prompt progress.
