## Context

The apply flow surfaces resume screening on `/apply/result` with a dedicated progress card (`AnalysisProgressPanel`) and time-based stage lines from `analysis-progress-model.ts`. Flow chrome (`PageShell` stepper) still labels step 2 as **“AI Review”** in `APPLICATION_FLOW_STEPS`. Product direction (see `proposal.md`) is outcome-first English copy: neutral “screening” language, a visible wait/progress affordance without staged eligibility narration, clear next step toward materials when eligible, and a single expert-facing `mailto` contact using a placeholder address until operations provides the real inbox.

## Goals / Non-Goals

**Goals:**

- Align all **applicant-visible** strings with neutral **screening / resume review** vocabulary (no “AI” prefix in headings, step labels, or primary banners unless legally required elsewhere).
- Keep **determinate-looking progress** (existing ratio + bar + optional lightweight status from the analysis job when appropriate) so applicants know processing is ongoing.
- Replace **multi-line staged “pipeline” copy** in the progress module with **generic, non-diagnostic** wait text (no simulated checkpoints such as degrees, age, titles, or rule names).
- Present **one** English-labeled expert contact line with a working **`mailto:`** link; ship with a **placeholder** mailbox, documented for later replacement.
- When the applicant is **eligible** (including post–detailed-analysis gates already in the product), copy should **point to the next step** (supporting materials / “collect materials”) without narrating internal engine steps.

**Non-Goals:**

- Changing eligibility logic, scoring, Prisma models, or upstream resume-analysis API contracts.
- Hiding legally required disclosures not discussed in the proposal.
- Localizing the UI to Chinese (product copy remains English per repository guidelines).

## Decisions

1. **Where to store the placeholder expert email**  
   - **Decision**: Add a single exported constant (e.g. `EXPERT_PROGRAM_CONTACT_EMAIL`) in `src/features/application/constants.ts` next to existing flow constants, consumed by `/apply/result` (and any other apply surface that shows the contact).  
   - **Rationale**: Keeps the placeholder visible in one place for the follow-up “fill real address” edit; avoids new env wiring until a second environment-specific address is required.  
   - **Alternatives**: `NEXT_PUBLIC_*` env (better when ops wants different addresses per deployment without redeploying constants—can be adopted later without contradicting this approach).

2. **How to simplify in-progress copy**  
   - **Decision**: Collapse `PRIMARY_STAGE_MESSAGES` / `SECONDARY_STAGE_MESSAGES` in `analysis-progress-model.ts` to **at most one or two generic strings** per phase (initial vs detailed), still driven by `getPrimaryStageMessage` / `getSecondaryStageMessage` so callers stay stable; keep `getDisplayedProgressRatio` and timing bands **unchanged** so the bar motion stays familiar.  
   - **Rationale**: Minimizes churn in `page.tsx` and tests while removing staged narrative.  
   - **Alternatives**: Inline strings only in `page.tsx` (duplicates phase knowledge); delete message rotation entirely (loses minor “still alive” variation—acceptable if spec prefers a single frozen line).

3. **API-sourced secondary progress line**  
   - **Decision**: **Retain** the existing `sanitizeProgressDisplayText` + `shouldShowApiProgressSecondary` path only for **queue / wait** style server messages; do **not** introduce new applicant-facing channels for raw engine text. If server messages ever read like internal checklists, treat as a follow-up to tighten filtering (out of scope unless discovered in QA).  
   - **Rationale**: Preserves useful “queued” feedback without expanding narrative surface.

4. **“Recognized information summary” and review body**  
   - **Decision**: **No change** in this design unless `specs/apply-result-screening/spec.md` explicitly requires hiding or renaming that section. The proposal targeted **staged progress narration**, not necessarily the factual extracted-field list.  
   - **Alternatives**: Hide extracted summary until post-eligibility—defer to spec/product.

5. **Flow stepper labels**  
   - **Decision**: Update `APPLICATION_FLOW_STEPS` (and any mirrored copy in `page.tsx` titles) so step 2 label/hint use **Screening** / **resume screening** language consistent with the result page header.  
   - **Rationale**: Removes “AI Review” from the persistent chrome users see across steps.

## Risks / Trade-offs

- **[Risk] Placeholder mail is user-visible** → Mitigation: use an obviously placeholder domain (e.g. `screening-contact@example.com`) and document replacement in tasks; optionally add a short “placeholder” comment in code only if needed for reviewers (not shown in UI).  
- **[Risk] Generic wait copy feels static** → Mitigation: keep subtle motion (spinner + bar) and optional benign secondary line from API when queued.  
- **[Risk] `reasonText` / summaries from the engine may still read like a checklist** → Mitigation: if QA finds overlap with “process narration,” follow up in copy pass or server prompt tuning; out of scope for pure UI constant changes unless spec expands.

## Migration Plan

1. Ship UI/copy changes behind normal deploy; **no database migration**.  
2. Replace placeholder email constant when operations provides the production address (single-file edit).  
3. **Rollback**: revert the change commit; no feature flags assumed.

## Open Questions

- Whether **ineligibility** `reasonText` / `displaySummary` need editorial caps or templates (depends on upstream wording—confirm after implementation spike on real samples).  
- Whether the expert contact should also appear on **`/apply/resume`** or only on **result** (proposal implies result journey; confirm with product).
