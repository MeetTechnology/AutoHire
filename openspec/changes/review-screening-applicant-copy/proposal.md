## Why

Applicant-facing copy currently emphasizes “AI” and multi-step “analysis” narratives that read like an internal eligibility checklist, which is distracting and can feel like an automated interrogation rather than a clear screening outcome. Stakeholders want a calmer, outcome-first experience: applicants should see that the system is working (wait state), then whether they meet requirements—with concise reasons when they do not—and a single expert-facing contact channel, without play-by-play reasoning about their profile.

## What Changes

- Replace user-visible “AI review” / automation-flavored naming with neutral **screening / resume review** language (English UI per product convention), while keeping the same backend behavior.
- During in-progress screening, **keep a visible progress indicator** so applicants know their resume is being processed and that they should wait.
- **Remove staged “process” copy** that simulates or narrates internal checks (e.g., rotating lines about degrees, age bands, titles, rule application). Progress may stay **non-semantic** (ratio + generic “screening in progress” style messaging only), not a step-by-step eligibility story.
- After a clear outcome: **if eligible**, messaging should point to the **next step (supporting materials / collect application materials)** without rehashing internal analysis steps.
- **If not eligible**, show **outcome + reasons** appropriate for the applicant (no internal pipeline jargon).
- Add a **single English-labeled expert contact** presented as “experts may reach the program team at …”, implemented as a **`mailto:`** link using a **placeholder address** (replaceable later without spec churn beyond config/copy).
- **Do not** add applicant-facing disclosure of how the engine works beyond what is needed for outcomes and wait states.

## Capabilities

### New Capabilities

- `apply-result-screening`: Applicant-facing screening states, copy, progress/wait UX, outcome summaries, ineligibility reasons, and expert `mailto` contact on the apply result / screening journey (and closely coupled progress copy modules).

### Modified Capabilities

- _(none)_ — `apply-entry-appearance` governs only the `/apply` introduction background; this change does not alter those requirements.

## Impact

- **UI / copy**: `src/app/(public)/apply/result/page.tsx` (banners, headers, `AnalysisProgressPanel` text, post-outcome CTAs), possibly `src/app/(public)/apply/resume/page.tsx` and `src/features/application/components/apply-entry-client.tsx` if they still surface “AI”-prefixed screening language.
- **Progress messaging module**: `src/features/application/analysis-progress-model.ts` and `src/features/application/analysis-progress-model.test.ts` (de-emphasize or replace staged narrative strings with generic wait copy while preserving progress ratio behavior).
- **Shared layout components**: `src/components/ui/page-shell.tsx` only if a reusable contact row/block is added there; otherwise keep changes local to apply surfaces.
- **APIs / data**: No contract change required for screening logic; optional env or config key for placeholder mail if not hardcoded initially (document in design).
