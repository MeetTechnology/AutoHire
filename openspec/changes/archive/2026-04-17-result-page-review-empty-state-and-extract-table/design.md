## Context

The `/apply/result` page currently combines initial CV review output and detailed-review progression. In the pre-detailed-review state, the page shows an empty-state sentence ("No detailed review fields are currently available for this application state.") that duplicates surrounding status context and adds visual noise. The same page renders "Initial CV review extract" as stacked key-value rows, which is less scannable when users want to quickly inspect multiple extracted fields.

This change is a UI/UX refinement and keeps existing status transitions, fetch behavior, and backend contracts unchanged.

## Goals / Non-Goals

**Goals:**
- Remove redundant pre-detailed-review empty-state copy from `/apply/result?view=review`.
- Keep detailed-review content reveal behavior status-driven (no timing or state-logic rewrite).
- Render Initial CV review extract in a table format that improves readability and field comparison.
- Preserve existing extracted-field ordering and display values.

**Non-Goals:**
- Changing application status definitions or routing behavior.
- Modifying detailed-review API payloads or polling behavior.
- Altering initial CV extraction data model or normalization logic.
- Introducing new dependencies or design-system primitives beyond existing utilities.

## Decisions

### Decision 1: Remove the specific empty-state sentence instead of adding replacement copy
- **Choice:** Remove the sentence entirely in the pre-detailed-review state.
- **Rationale:** Nearby status banners and section messaging already communicate what is happening. Additional empty-state copy is repetitive and distracts from actionable content.
- **Alternative considered:** Rewording the message to softer informational copy. Rejected because it still adds non-actionable text and does not improve clarity.

### Decision 2: Keep existing detailed-review gating and readiness logic unchanged
- **Choice:** Do not modify condition branches that decide when detailed-review fields appear.
- **Rationale:** Current logic already correctly drives transitions for `ELIGIBLE`, `SECONDARY_ANALYZING`, `SECONDARY_REVIEW`, and `SECONDARY_FAILED`. Requirement is presentation cleanup, not behavior changes.
- **Alternative considered:** Introducing a dedicated pre-start component branch. Rejected to minimize churn and regression risk.

### Decision 3: Convert Initial CV review extract presentation to a semantic table
- **Choice:** Render extracted field rows with table semantics (`table`/`thead`/`tbody`/`tr`/`th`/`td`) and existing display values.
- **Rationale:** Tabular structure improves horizontal scanning and value-to-field association for applicants and reviewers.
- **Alternative considered:** Keep card/list layout with stronger visual separators. Rejected because table structure better matches the data shape and reading behavior.

### Decision 4: Reuse existing extraction field configuration
- **Choice:** Continue using `INITIAL_CV_REVIEW_FIELD_ROWS` and `getInitialCvReviewFieldValue` as the single source for field order and formatting.
- **Rationale:** Avoids duplicated mapping logic and keeps extraction display consistent with existing behavior.
- **Alternative considered:** Creating a table-only field map. Rejected due to maintenance overhead and potential drift.

## Risks / Trade-offs

- **[Risk]** Table styling may look dense on narrow screens.  
  **Mitigation:** Apply responsive wrappers and spacing classes already used by page-shell patterns; keep label/value text wrapping behavior.

- **[Risk]** Removing empty-state text could reduce context for some users.  
  **Mitigation:** Retain status banners and section headers that already explain detailed-review progress.

- **[Risk]** Accessibility regressions if table semantics are incomplete.  
  **Mitigation:** Use semantic header cells and preserve clear section title/description context around the table.
