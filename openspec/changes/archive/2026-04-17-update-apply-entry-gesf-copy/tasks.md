## 1. Shell typography

- [x] 1.1 Add optional `PageShell` prop to control main `<h1>` weight (for example `headerTitleClassName`) without affecting existing callers’ default semibold styling

## 2. Apply entry copy and structure

- [x] 2.1 Update hero `description` and header-slot pill copy per `apply-entry-intro-copy`
- [x] 2.2 Pass headline override so “Global Excellent Scientists Fund” renders non-bold on `/apply`
- [x] 2.3 Update accordion metadata: GESF overview title/summary; replace overview body with mission text and disc-bulleted sub-programs
- [x] 2.4 Update benefits section summary to “Competitive Package” and replace body with the four approved English items
- [x] 2.5 Replace eligibility body with the three approved English rules
- [x] 2.6 Rename process section to English “Online Application Process”, keep five-step visualization, replace footer prose with linearity / save / one-week feedback text
- [x] 2.7 Add “Timeline & Key Dates” accordion after process and before “About”; render four English-only bullets per spec (no Chinese in that block)

## 3. Verification

- [x] 3.1 Manually verify `/apply`: copy, list markers, timeline English-only, headline weight, and unchanged loading/redirect/confirm behavior
