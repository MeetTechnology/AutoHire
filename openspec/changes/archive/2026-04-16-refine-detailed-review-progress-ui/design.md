## Context

The public applicant result page at `/apply/result` currently presents detailed-review progress in three different places: a success banner, a "Technical details" disclosure near the bottom, and a started-state notice near the action controls. This makes the completion path feel noisy, and the current disclosure `meta` slot can render an `ActionButton` inside the disclosure trigger button, which causes invalid nested-button HTML and a hydration warning when detailed review becomes ready.

This change is intentionally UI-scoped. It does not alter detailed-review job orchestration, prompt counting, or the transition into the materials stage. The work focuses on rearranging existing result-page data so the applicant sees one primary progress summary before the detailed-review content and no redundant diagnostics after completion.

## Goals / Non-Goals

**Goals:**
- Surface detailed-review status and prompt completion above the main "Detailed review" disclosure instead of in a low-priority diagnostics panel.
- Show progress as a compact `x/9` indicator while prompts are still running and suppress the green ready state until all prompts finish.
- Remove redundant "already started" messaging once the run has completed.
- Eliminate nested interactive controls in the disclosure header so the page renders valid HTML without hydration warnings.

**Non-Goals:**
- Changing the number of detailed-review prompts or how prompt completion is calculated.
- Reworking secondary-analysis persistence, draft saving, or materials-stage entry rules.
- Adding new APIs, backend statuses, or database fields.

## Decisions

### Move detailed-review status into a dedicated summary block above the disclosure
The result page already computes secondary-analysis status, completed prompt counts, and readiness. Instead of keeping these details in the bottom "Technical details" disclosure, the page will render a compact summary card above the "Detailed review" section that includes the current status and a progress string in `x/9` format while work is ongoing.

This keeps the progress signal near the primary call to action and removes the need for applicants to inspect an auxiliary diagnostics section. The current bottom disclosure is low-value for applicant-facing flow and will be removed.

Alternative considered: keep the diagnostics disclosure and duplicate the progress summary above. Rejected because it preserves redundant messaging and makes the page harder to scan.

### Gate the ready banner on full prompt completion
The green "Detailed review is ready" banner should only appear after all prompts complete. Until then, the page will show status plus `x/9` progress, even if the run has started and no longer needs the "already started" informational sentence.

Alternative considered: show both in-progress progress and the ready banner once completion is near. Rejected because the user explicitly wants progress first and the ready banner only after all prompts are done.

### Hide the started-state notice once completion is reached
The "The detailed review has already been started for this application." notice will remain useful only while a run exists but is not yet complete. Once all prompts finish, the notice will be suppressed to avoid competing with the ready state.

Alternative considered: keep the notice permanently as historical context. Rejected because it duplicates the stronger completion signal and adds clutter.

### Remove nested buttons by moving header actions outside the disclosure trigger
The detailed-review disclosure currently places an `ActionButton` inside the disclosure header `meta`, which is rendered inside the disclosure trigger button. The fix should move the continue action outside the trigger region while preserving desktop and mobile access to the action.

The preferred approach is to render the disclosure header as non-nested content: either place the continue button inside the opened panel near the top summary row, or refactor the shared disclosure component so `meta` is rendered adjacent to rather than inside the trigger button. The implementation should choose the smallest safe change that avoids regressions in other disclosure usages.

Alternative considered: swap the nested button for a non-button styled element inside the trigger. Rejected because it weakens semantics and still mixes a primary action into the disclosure toggle hit area.

## Risks / Trade-offs

- [Shared disclosure layout regression] → If the `DisclosureSection` component changes, other pages may shift visually. Mitigation: prefer a local layout adjustment in the result page unless the shared component can be updated safely and verified.
- [Progress mismatch with backend counts] → The UI uses the existing total prompt count; if that value changes in the future, a hard-coded `x/9` presentation could drift. Mitigation: derive the displayed denominator from the existing run summary when available, while preserving the requested visual format.
- [State-transition ambiguity] → Hiding the started notice too early could leave users without feedback during long-running analysis. Mitigation: keep status plus progress visible above the section until the ready state is truly complete.
