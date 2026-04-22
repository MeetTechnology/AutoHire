## Context

The current initial CV review flow parses and displays 7 extracted fields, stores two optional screening identity values on `Application` (`screeningPassportFullName`, `screeningContactEmail`), and uses `eligibilityResult` plus `missingFields` to drive the post-analysis UI. `INELIGIBLE` ends the flow on the review page, `INSUFFICIENT_INFO` becomes `INFO_REQUIRED` and shows the supplemental form, and `ELIGIBLE` can immediately enter `/apply/materials`.

This change adds three extraction-only contact fields (`Name`, `Personal Email`, `Phone Number`) to the initial-review contract, adds persistent storage for phone, and introduces a new completion rule: missing contact fields can block applicant progression, but they must not change eligibility judgment. That makes the change cross-cutting across prompt contract, result normalization, snapshot shaping, supplemental-field handling, and materials-entry gating.

## Goals / Non-Goals

**Goals:**

- Parse and display 10 initial CV review extracted fields in a stable applicant-visible order.
- Persist application-level screening contact data for name, personal email, and phone number.
- Keep the three contact fields fully outside eligibility judgment, rejection logic, and missing-critical-field determination.
- Require applicants to fill missing contact fields before proceeding when the review outcome is otherwise eligible.
- Show contact-field prompts together with existing missing critical fields when the outcome is still `INSUFFICIENT_INFO`.
- Preserve applicant-entered contact values after reanalysis when the upstream result still omits those values.

**Non-Goals:**

- Changing the program’s eligibility rules or the meaning of `INELIGIBLE` / `ELIGIBLE`.
- Introducing a separate new review step or a new applicant-facing route.
- Replacing the broader secondary-analysis field system.
- Reconciling screening contact fields back into `ExpertInvitation` or other identity systems.
- Using web search or external enrichment to fill missing contact data.

## Decisions

1. **Extend the initial-review extraction contract to 10 fields, but treat the 3 contact fields as extraction-only**

   The parser and field table will add `name`, `personal_email`, and `phone_number` alongside the existing seven keys. These three fields will be parsed from `### 1. Extracted Information`, displayed in the extract table, and eligible for applicant completion, but they will be excluded from eligibility and “missing critical information” reasoning. This matches the prompt contract and prevents local code from accidentally turning a contact omission into a rejection or a critical-info failure.

   **Alternative considered:** Keep them outside `extractedFields` and store them only on `Application`. Rejected because the result page must show them as part of the same extract output contract and preserve upstream-vs-user provenance through one normalized shape.

2. **Reuse `Application` as the source of truth for applicant-supplied contact values**

   The system will keep using `screeningPassportFullName` and `screeningContactEmail` and add a new nullable `screeningPhoneNumber` column. These fields represent the best known application-level contact values, whether they came from resume extraction fallback, resume upload confirmation, or the post-review completion form.

   **Alternative considered:** Store the fallback values only inside `ResumeAnalysisResult.extractedFields`. Rejected because the values must survive reanalysis rounds and independently gate progression into materials.

3. **Reuse `INFO_REQUIRED` as the “action required before progress” status, even when eligibility is already `ELIGIBLE`**

   A new database enum is unnecessary. When the upstream result is `ELIGIBLE` but one or more contact fields are still missing after considering stored application values, the application will remain in `INFO_REQUIRED` while `eligibilityResult` stays `ELIGIBLE`. This preserves the applicant-facing “fill this before continuing” behavior with the existing review-page additional-information subview and keeps materials entry blocked until completion.

   **Alternative considered:** Introduce a new `CONTACT_REQUIRED` status. Rejected because it would expand enums, routing, stepper logic, and tests for a case that already fits the existing “additional information required” interaction model.

4. **Synthesize contact-required fields locally instead of trusting the upstream missing-field list**

   After normalizing the upstream result, the application service will derive `missingContactFields` from the three contact keys by checking:
   - extracted contact value from the latest result
   - stored application screening contact value

   Missing contact fields will be:
   - ignored for `INELIGIBLE`
   - appended to `latestResult.missingFields` for `INSUFFICIENT_INFO`
   - used as the only missing-fields set for “eligible but contact incomplete”

   This keeps the local system aligned with the prompt rule that those contact fields are non-critical for judgment while still letting the UI ask for them when needed.

   **Alternative considered:** Require the upstream model to emit contact fields inside `Missing fields:` for all cases. Rejected because it conflicts with the new prompt rule that they must not affect judgment and would make local behavior brittle.

5. **Use fallback merge precedence `upstream extracted value` > `stored application value` for the 3 contact fields**

   The normalized result will keep the upstream-extracted contact value when present. If the upstream value is empty / `!!!null!!!`, the result snapshot will fill that contact field from the stored application screening value so the extract table and future snapshots remain populated after applicant completion. This merge applies especially after reanalysis.

   **Alternative considered:** Always overwrite extracted values with stored applicant-entered values. Rejected because successfully extracted CV values should remain canonical when available.

6. **Split the post-review submit behavior into two paths**

   The existing supplemental submit action will continue to serve `INFO_REQUIRED`, but the service will branch:
   - if eligibility is still `INSUFFICIENT_INFO`, persist any contact fields included in the submission and then trigger reanalysis as today
   - if eligibility is already `ELIGIBLE` and only contact fields are missing, persist them and transition back to `ELIGIBLE` without starting a new analysis job

   This matches the requested business flow: eligible applicants should not be forced through unnecessary reanalysis when only non-judgment contact fields are missing.

   **Alternative considered:** Always reanalyze after any contact completion. Rejected because it adds latency and external dependency cost without affecting judgment.

## Risks / Trade-offs

- **[Risk] `INFO_REQUIRED` now covers two semantics (critical missing info vs. contact completion)** → Mitigation: keep `eligibilityResult` authoritative, branch banner copy and submit behavior based on `eligibilityResult` plus which fields are missing.
- **[Risk] Existing materials auto-entry for `ELIGIBLE` could bypass contact completion** → Mitigation: only set `applicationStatus` back to `ELIGIBLE` after all required contact fields are stored; keep incomplete contact cases in `INFO_REQUIRED`.
- **[Risk] Stored contact values and extracted result values may drift across reanalysis rounds** → Mitigation: apply a deterministic merge policy (`extracted` first, `stored fallback` second) in snapshot/result shaping.
- **[Risk] Prompt and parser contract drift** → Mitigation: update the upstream prompt text and parser tests together so the 10-field contract is validated in one change.
- **[Risk] Current field names are inconsistent (`screeningPassportFullName` vs. applicant-visible `Name`)** → Mitigation: keep the existing database column for backward compatibility and document that it stores the application-level full name used for screening/contact completion.

## Migration Plan

1. Add nullable `screeningPhoneNumber` to `Application` and align memory-store records / snapshot types.
2. Deploy parser, service, and UI changes that understand the 10-field extract contract and contact-completion gating.
3. Update the supplemental submit flow so contact-only completion persists and unlocks materials without reanalysis, while mixed critical+contact cases still reanalyze.
4. Rollback strategy: revert application code first; the new nullable phone column can remain in place safely if the feature is rolled back.

## Open Questions

- Should the applicant-visible label stay `Name`, or should UI copy clarify that the stored application field is the scholar’s full contact name?
- If a user manually enters a contact value and a later reanalysis extracts a different value, should the later extracted value silently win, or should the UI preserve the user-supplied value once confirmed? The default design here is to let the extracted non-empty value win.
