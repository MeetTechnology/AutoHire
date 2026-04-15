## Why

The AI review wait state uses a decorative progress bar and loosely coupled status text, so applicants cannot tell how far the automated review has conceptually progressed or how long to expect. Measured end-to-end analysis runs about 32 seconds; the experience should feel honest within a **30–60 second** expectation window and surface **stage-aligned** messages that mirror the screening workflow (structured extraction, then eligibility reasoning), without implying a false percentage tied to unknown server timing.

## What Changes

- Replace the non-semantic progress bar on the analysis-in-progress UI with a **time-bounded, monotonic** progress model calibrated so that typical runs (~32s) land in a credible band and the bar **never completes** before the job finishes (completion jumps to done or is replaced by the result view).
- Drive the **bottom progress line** from an ordered set of **English** user-facing messages mapped to the assessor workflow: document intake, structured field extraction (birth year / degrees / doctoral detail / title mapping / job country / 2020+ experience / research areas), eligibility rule application, and consolidation toward outcome—without exposing internal prompt markup (`[[[]]]`, `{{{}}}`, `!!!`) or claiming live model steps the backend does not emit.
- Keep or refine **server-sourced** `progressMessage` from `fetchAnalysisStatus` as a secondary line or merge rule so API failures or “syncing result” states still read truthfully.
- Apply the same **progress semantics** for **secondary/detailed** analyzing states where the same panel pattern is used, with copy appropriate to that stage unless spec narrows scope to primary analysis only.

## Capabilities

### New Capabilities

- `resume-analysis-progress`: Requirements for in-flow resume (and where applicable, detailed) analysis wait UI: progress bar timing bounds (30–60s expectation), monotonicity, completion behavior, and the canonical ordered list of progress messages aligned to extraction and eligibility assessment stages.

### Modified Capabilities

- _(none)_ — Existing `apply-entry-appearance` governs the program introduction step; this change targets the post-upload analysis wait experience only.

## Impact

- `src/app/(public)/apply/result/page.tsx` (`AnalysisProgressPanel`, polling effects, message state).
- `src/features/application/client.ts` (`fetchAnalysisStatus` consumption) and/or `src/app/api/**/analysis-status` if server messages must align with the new copy rules.
- Possible small shared UI helpers or constants under `src/features/application` or `src/components/ui` if message sequences and timing are centralized.
- No database or Prisma changes anticipated; no **BREAKING** API contract changes unless we later expose explicit `analysisPhase` from the server (out of scope unless added in design).
