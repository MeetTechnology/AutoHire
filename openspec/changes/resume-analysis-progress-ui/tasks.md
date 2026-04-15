## 1. Progress model and tests

- [x] 1.1 Add `src/features/application/analysis-progress-model.ts` exporting constants (`PRE_COMPLETE_CAP`, segment breakpoints in ms) and pure functions `getDisplayedProgressRatio(elapsedMs)`, `getPrimaryStageMessageIndex(elapsedMs)`, plus `getSecondaryStageMessageIndex(elapsedMs)` (or equivalent `mode` parameter) matching `design.md` piecewise curve and `specs/resume-analysis-progress/spec.md` time bands.
- [x] 1.2 Add `src/features/application/analysis-progress-model.test.ts` covering monotonicity, values at 0s / 12s / 32s / 60s / >60s, non-increase when elapsed is clamped, and primary message index boundaries (8s, 16s, 24s, 32s, 45s).
- [x] 1.3 Encode canonical **English** primary strings (six items) and secondary strings (three to four items) in the model module or a colocated constants file referenced only from UI.

## 2. Result page integration

- [x] 2.1 Track `analyzingSegmentKey` (e.g. `applicationStatus` or composite) and `segmentStartedAt` ref; reset `segmentStartedAt` when entering or switching among `CV_ANALYZING`, `REANALYZING`, and `SECONDARY_ANALYZING`.
- [x] 2.2 Drive smooth bar updates with `requestAnimationFrame` or a 100–250ms interval reading `Date.now() - segmentStartedAt`; bind bar width to `getDisplayedProgressRatio` (percentage width, capped) replacing the fixed `w-3/5` fill.
- [x] 2.3 Replace `ANALYSIS_MESSAGES` rotation and the 1800ms `analysisMessageIndex` interval with stage text from the model using elapsed time; remove obsolete state/effects that conflict with the new behavior.
- [x] 2.4 Render optional **secondary** line from `progressMessage` when `jobStatus` is queued or message matches queue/sync heuristics (case-insensitive), per `design.md` D5; keep primary line from staged lists otherwise.
- [x] 2.5 When elapsed exceeds sixty seconds while still analyzing, show English **long-wait** copy per spec (single line variant or append to secondary) without implying completion.
- [x] 2.6 Ensure no user-visible string renders literal `[[[`, `{{{`, or `!!!` marker patterns from API text (strip or omit if ever present).

## 3. Panel UX and accessibility

- [x] 3.1 Update `AnalysisProgressPanel` (or inline JSX in `result/page.tsx`) to accept `progressRatio`, `primaryMessage`, optional `secondaryMessage`, and optional `aria-valuetext` for a `role="progressbar"` wrapper if implemented.
- [x] 3.2 On transition out of analyzing (success path), either briefly animate to full width then unmount or unmount without a fake 100% flash—pick one consistent behavior and document in a short code comment if non-obvious.

## 4. Verification

- [x] 4.1 Run `bun run test` and fix any regressions.
- [x] 4.2 Run `bun run lint` and resolve new issues in touched files.
