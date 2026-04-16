## 1. Result-page detailed review status layout

- [x] 1.1 Update `src/app/(public)/apply/result/page.tsx` to render detailed-review status and compact prompt progress above the "Detailed review" section.
- [x] 1.2 Remove the bottom "Technical details" disclosure and any redundant completed-prompts label from the detailed-review flow.
- [x] 1.3 Ensure the green "Detailed review is ready" success state appears only after all prompts complete and the in-progress `x/9` indicator is hidden at that point.

## 2. Completion-state cleanup and interaction validity

- [x] 2.1 Update the detailed-review started-state messaging so "The detailed review has already been started for this application." is shown only while a run is still incomplete.
- [x] 2.2 Restructure the detailed-review disclosure action area to avoid rendering a nested `<button>` inside the disclosure trigger.
- [x] 2.3 Verify the result page no longer emits the nested-button hydration warning when detailed review reaches the ready state.

## 3. Verification

- [x] 3.1 Add or update focused tests for detailed-review status presentation and the step-completion messaging on `/apply/result`.
- [x] 3.2 Run the relevant test suite or targeted verification for result-page detailed-review behavior and confirm the HTML structure is valid.
