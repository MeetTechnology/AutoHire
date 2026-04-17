## Why

The result page currently shows a redundant empty-state sentence before detailed review starts, which adds noise and does not help users take action. The initial CV review extract is also rendered as plain key-value blocks, making it harder to scan and compare fields quickly.

## What Changes

- Remove the sentence "No detailed review fields are currently available for this application state." from the result page when detailed review has not started.
- Keep the existing detailed review progression behavior so that detailed review content appears naturally once the stage starts.
- Change the Initial CV review extract presentation from the current list/card-style items to a structured table layout for faster field scanning.
- Preserve existing data sources and status-driven gating logic; this is a presentation and copy adjustment only.

## Capabilities

### New Capabilities
- `result-review-prestart-state-copy`: Controls user-facing copy shown on `/apply/result?view=review` before detailed review starts, including suppression of redundant empty-state messaging.
- `initial-cv-review-extract-table`: Defines table-based rendering requirements for Initial CV review extract fields.

### Modified Capabilities
- `detailed-review-progress-ui`: Clarifies pre-detailed-review display expectations on the result page to avoid duplicate or unnecessary status text.

## Impact

- Affected code: `src/app/(public)/apply/result/page.tsx`, potentially `src/components/ui/page-shell.tsx` utilities if table primitives are reused, and related feature helpers for extract display.
- No API contract changes, no database schema changes, and no dependency changes are expected.
- UI behavior on `/apply/result` is refined for readability and reduced cognitive load.
