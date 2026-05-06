# AI Material Supplement Implementation Decisions

## Summary

This document consolidates implementation decisions for the first phase of the AI material supplement feature. Its purpose is to give Tasks 1.x and 2.x a single decision entrypoint without changing the source PRD, page spec, RFC, database spec, or API spec.

This document only applies to the first-phase, post-submission supplement workflow.

## Confirmed Product Decisions

The following items are already consistent across the existing feature documents and can be implemented directly:

- AI material review starts after final submission and does not block the existing `/apply/materials` submission flow.
- Supplement materials are handled in a dedicated supplement experience instead of being merged into `/apply/materials`.
- Supplement files are stored and managed separately from `ApplicationMaterial`.
- Phase 1 review scope only includes 6 categories:
  - `IDENTITY`
  - `EDUCATION`
  - `EMPLOYMENT`
  - `PROJECT`
  - `PATENT`
  - `HONOR`
- `PRODUCT`, `PAPER`, `BOOK`, and `CONFERENCE` materials are out of review scope for this phase.
- Each application defaults to at most 3 supplement review rounds.
- Each category submission batch defaults to at most 10 files.
- Duplicate supplement files are defined as same file name plus same file size.
- Review history must be retained; latest results are shown by default, while prior results remain queryable.
- Satisfied requests are hidden by default on the main supplement page and remain visible in history.
- The current project is responsible for trigger, sync/read, storage, and display only; the external AI backend is responsible for actual review execution and output parsing.
- Non-`SUBMITTED` applications must not enter the supplement flow.

## Decision Rules

- `已确认`: explicitly consistent in the existing feature documents and safe to implement directly.
- `建议默认`: not finally locked in the specs, but safe to use as the iteration default so implementation can proceed with limited future adjustment.
- `阻塞`: directly affects API contract, schema shape, frontend validation, or external integration; leaving it undefined would create avoidable rework.

## P0 Decisions Requiring Lock

### 1. Allowed supplement file types

- `Decision`: Which file types may be uploaded for supplement materials.
- `Status`: `建议默认`
- `Chosen Default / Recommendation`: Reuse the existing upload extension allowlist already implemented in the repo:
  - `.pdf`
  - `.doc`
  - `.docx`
  - `.zip`
  - `.rar`
  - `.7z`
  Source of truth today:
  - [constants.ts](/D:/zhangprj1/AutoHire/src/features/upload/constants.ts)
  - [upload.ts](/D:/zhangprj1/AutoHire/src/lib/validation/upload.ts)
- `Why it matters`: Frontend validation, upload intent validation, and user-facing error handling need one concrete rule. Reusing the current repo rule avoids inventing a second upload policy in Phase 1.

### 2. Supplement single-file size limit

- `Decision`: What size limits apply to supplement uploads.
- `Status`: `建议默认`
- `Chosen Default / Recommendation`: Reuse the existing upload size limits already implemented in the repo:
  - standard file limit: `20 MB`
  - archive file limit: `100 MB`
  Source of truth today:
  - [constants.ts](/D:/zhangprj1/AutoHire/src/features/upload/constants.ts)
  - [upload.ts](/D:/zhangprj1/AutoHire/src/lib/validation/upload.ts)
- `Why it matters`: File size limits affect frontend validation, API validation, upload messaging, and storage expectations. Reusing the current limits keeps supplement upload behavior aligned with the existing system.

### 3. External backend sync mode

- `Decision`: Whether the project reads review results by polling, callback, or both.
- `Status`: `建议默认`
- `Chosen Default / Recommendation`: Keep both surfaces in the design, but implement in this order:
  - support mock mode first
  - support manual/server-triggered `sync` API first
  - keep internal callback API as a reserved integration path
  This means the current project should expose both `sync` and internal callback interfaces, while the first implementation path should rely on mock plus explicit sync.
- `Why it matters`: This choice drives service flow, API sequencing, and test strategy. Prioritizing sync keeps Phase 1 unblocked while preserving the callback contract for later live integration.

### 4. Callback authentication

- `Decision`: How the internal callback endpoint is authenticated.
- `Status`: `阻塞`
- `Chosen Default / Recommendation`: Treat `API key + signature + timestamp` as the target design, but do not finalize implementation details until the external backend protocol is confirmed.
- `Why it matters`: Callback auth affects internal route contract, env vars, replay protection, and security review. A placeholder direction is useful, but the exact protocol must be agreed before live callback implementation.

### 5. `resultPayload` structure

- `Decision`: What structured review result shape the current project expects from the external backend.
- `Status`: `阻塞`
- `Chosen Default / Recommendation`: Define and use a minimal internal adapter shape for current-project persistence and UI reads, but require the external backend result fields to be confirmed before live integration. The current project should not couple page rendering directly to the raw external payload.
- `Why it matters`: `resultPayload` drives schema design, adapter logic, validation, callback handling, sync handling, and request/history rendering. Leaving this vague would cause churn across Tasks 1.2, 1.4, 2.1, and later API tasks.

### 6. Supplement page path

- `Decision`: Which route is the canonical supplement entry page.
- `Status`: `建议默认`
- `Chosen Default / Recommendation`: Use:
  - main page: `/apply/supplement`
  - history page: `/apply/supplement/history`
  This is already the dominant path used across the existing feature docs.
- `Why it matters`: Route choice affects page implementation, link wiring, API usage flow, and history navigation. Using the dominant existing path removes unnecessary routing ambiguity.

## Non-P0 Defaults For This Iteration

The following items should be treated as iteration defaults so implementation can proceed with mock and placeholder support where needed:

- History should use a dedicated page, not a modal or inline expansion by default.
- Supplement upload should work primarily at category level; `supplementRequestId` may remain optional in Phase 1.
- If a category has multiple active requests, one uploaded batch should be treated as input for that category review as a whole, not bound to exactly one request by default.
- `materialSupplementStatus` should be derived from latest run/latest requests first; do not expand `Application` unless later implementation proves the derived approach insufficient.
- Do not add a standalone `SupplementReviewSyncLog` table in the first pass; prefer existing event logging or add a dedicated sync log only if debugging needs become concrete.
- `rawResultPayload`, parsed file text persistence, `fileHash`, and virus scanning are not Phase 1 prerequisites. They may stay as placeholders or deferred fields.
- If live backend details remain incomplete, support `mock` mode first and keep a live client skeleton behind adapter boundaries.
- New request versions should be created as new records and old ones should move to history/latest=false semantics, rather than mutating historical request content in place.

## Explicitly Out Of Scope

The following are not part of this phase and should not block implementation:

- Email notification flow
- Manual review / operator review workflow
- New account system
- Multi-language support
- `PRODUCT`, `PAPER`, `BOOK`, and `CONFERENCE` review support

Even if some of these appear as future placeholders in the source specs, they are not Phase 1 blockers.

## Blocking Items Before Task 1

The following items should be treated as real blockers before or during early implementation tasks because they directly affect contracts, validation, schema design, or live integration:

1. Final external backend `resultPayload` field structure
   - Blocks: Task 1.2, Task 1.4, Task 2.1, Task 3.6, Task 3.7, Task 5.3

2. Final live callback authentication protocol
   - Needed details: header names, signing method, timestamp window, replay strategy
   - Blocks: Task 1.4 live integration design, Task 3.7, Task 5.4 live callback path

3. External backend live protocol details
   - Needed details: create-review request shape, get-result response shape, external IDs, error behavior
   - Blocks: Task 1.4 live client completeness, later live integration tasks

## Notes For Implementers

- Use this document as a decision layer above the existing five source specs; do not rewrite the source specs as part of Task 0.1.
- Where this document says `建议默认`, implementation may proceed with a mock-friendly or adapter-friendly shape unless a later explicit product/backend confirmation replaces it.
- Where this document says `阻塞`, downstream tasks should avoid hard-coding speculative live-contract details.
