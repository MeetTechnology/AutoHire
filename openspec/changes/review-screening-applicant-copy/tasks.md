## 1. Flow constants and expert contact

- [x] 1.1 Add `EXPERT_PROGRAM_CONTACT_EMAIL` (placeholder inbox such as `screening-contact@example.com`) to `src/features/application/constants.ts`, exported next to existing apply-flow constants per `design.md`.
- [x] 1.2 Update `APPLICATION_FLOW_STEPS` step 2 `label` and `hint` in `src/features/application/constants.ts` to neutral **screening / resume review** wording that satisfies the **Neutral screening vocabulary** requirement in `specs/apply-result-screening/spec.md`.

## 2. Progress messaging module

- [x] 2.1 Replace staged `PRIMARY_STAGE_MESSAGES` and `SECONDARY_STAGE_MESSAGES` in `src/features/application/analysis-progress-model.ts` with **generic** in-progress lines (at most one or two variants per phase) so primary text never reads as sequential eligibility checkpoints, while keeping `getDisplayedProgressRatio`, segment timing, `sanitizeProgressDisplayText`, and `shouldShowApiProgressSecondary` behavior intact unless a minimal adjustment is required for tests.
- [x] 2.2 Update `src/features/application/analysis-progress-model.test.ts` to match the simplified messaging (indices, long-wait suffix, and any expectations tied to the old six-item lists).

## 3. Result page copy, banners, and expert block

- [x] 3.1 Revise applicant-visible strings in `src/app/(public)/apply/result/page.tsx`—including `PageShell` title/description, `headerSummary`, `AnalysisProgressPanel` title/description, and `getInitialBanner`—so they comply with **Neutral screening vocabulary**, **Non-narrative in-progress primary messaging**, **Eligible path points to materials**, and related requirements in `specs/apply-result-screening/spec.md`.
- [x] 3.2 Add a single **English** sentence for **experts** to contact the program team, with a `mailto:` link whose `href` uses `EXPERT_PROGRAM_CONTACT_EMAIL`, visible when the result page has a loaded application snapshot (placement: stable region such as near the page footer or below primary status—choose one consistent location).
- [x] 3.3 Replace other applicant-visible **AI**-branded phrases on the result page (for example helper copy around prefilled fields) with neutral wording that still satisfies the spec’s vocabulary rules.

## 4. Resume and apply entry copy

- [x] 4.1 Update `src/app/(public)/apply/resume/page.tsx` user-facing strings that mention “AI review” so they describe screening/resume review neutrally.
- [x] 4.2 Update `src/features/application/components/apply-entry-client.tsx` (timeline labels and body copy) to remove “AI review” phrasing in line with the same vocabulary rules.

## 5. Verification

- [x] 5.1 Run `bun run test` and resolve any regressions from the above edits.
- [x] 5.2 Manually verify `/apply/result` for analyzing, ineligible, eligible / detailed-analysis, and `SECONDARY_REVIEW` states: progress bar present, primary lines generic, expert `mailto` works, stepper label on apply pages shows updated screening step text.
