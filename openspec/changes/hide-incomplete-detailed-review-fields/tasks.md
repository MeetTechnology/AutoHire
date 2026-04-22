## 1. Secondary Snapshot Behavior

- [x] 1.1 Add a helper that determines whether a secondary run has completed all prompts from `run.totalPrompts` and `run.completedPrompts`.
- [x] 1.2 Update editable secondary snapshot construction so incomplete runs return only fields with non-empty produced source values.
- [x] 1.3 Preserve full editable field construction, including missing fields, once all prompts complete or when prompt totals are unavailable.

## 2. Result Page Behavior

- [x] 2.1 Verify `/apply/result` continues to show the preparing message when no completed prompt values are available.
- [x] 2.2 Verify `/apply/result` displays partial produced fields without rendering unproduced fields as missing.
- [x] 2.3 Verify the completed state displays the full detailed review field set and keeps save/continue behavior unchanged.

## 3. Tests

- [x] 3.1 Add or update service tests for partial secondary results with incomplete prompt progress.
- [x] 3.2 Add or update service tests for completed prompt progress showing genuinely missing fields.
- [x] 3.3 Run the focused test suite for detailed review progress and secondary analysis snapshot behavior.
