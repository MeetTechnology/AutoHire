## Why

The public `/apply` introduction should reflect the latest GESF program messaging, deadlines, and structure (mission, package, eligibility, process expectations, and a clear admissions timeline). Stakeholders also clarified presentation rules: the main headline must not appear bold, and the new timeline must be English-only for applicants.

## What Changes

- Update `PageShell` header **description** and the header-slot deadline pill copy on `/apply`.
- Adjust accordion section titles and summaries (overview → GESF mission & sub-programs with disc bullets; benefits → competitive package list; eligibility → three rules; process → online flow narrative and existing step cards where applicable).
- Add a dedicated **Timeline & Key Dates** block on the introduction page with **English-only** bullet points (no Chinese lines in that block).
- Ensure the primary page title **“Global Excellent Scientists Fund”** renders **without bold weight** on this entry view (while keeping other pages’ typography unchanged unless they opt in).
- Preserve existing invitation/session behavior, API usage, and background image behavior for `/apply`.

## Capabilities

### New Capabilities

- `apply-entry-intro-copy`: Applicant-facing English copy, structure (accordion sections), bullet styling for sub-programs, process guidance text, timeline content, and headline weight rules for the `/apply` introduction entry.

### Modified Capabilities

None. `apply-entry-appearance` stays as-is in main specs; this change does not alter background PNG rules, sub-route exclusion, or scrim requirements.

## Impact

- Primarily `src/features/application/components/apply-entry-client.tsx` (copy constants, optional new accordion section, process body text).
- Possibly `src/components/ui/page-shell.tsx` if a small, backward-compatible prop is needed to control header title weight for `/apply` only.
- No database, API contract, or invitation-token behavior changes expected.
