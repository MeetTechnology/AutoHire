## Context

The `/apply/result` detailed review area currently builds the editable field list from every secondary field definition as soon as any completed secondary prompt text is available. Fields whose source values are not present yet become empty editable fields and are marked missing, even when their prompts are still running.

The progress model already exposes `completedPrompts` and `totalPrompts`, and the UI already waits for prompt completion before showing the ready state. This change should use that same completion boundary to decide when missing fields are meaningful.

## Goals / Non-Goals

**Goals:**

- Show fields backed by completed detailed review output while the run is still incomplete.
- Hide fields with no produced source value until all prompts complete.
- Once all prompts complete, show the full editable field set, including genuinely missing fields.
- Preserve existing progress polling, status labels, save behavior, and continue-to-materials behavior.

**Non-Goals:**

- Changing the upstream secondary analysis API contract.
- Changing the number or definitions of detailed review fields.
- Changing how completed prompt text is parsed into secondary fields.
- Adding manual edit support before the detailed review run is ready.

## Decisions

- Use run completion as the missing-field visibility boundary.
  - Rationale: `completedPrompts >= totalPrompts` is already the UI readiness rule, so using it for missing-field visibility keeps behavior consistent.
  - Alternative considered: use secondary status `completed` only. This would be less precise when a status transition and prompt counters are briefly out of sync.

- Filter incomplete-run editable fields after parsing completed result text.
  - Rationale: The existing parser can continue aggregating completed prompt output, while the service can decide whether to return only fields with source values or the full field set.
  - Alternative considered: make the frontend hide missing fields. That would reduce visible noise, but still sends misleading snapshot data to the client and duplicates completion logic.

- Keep completed-run behavior unchanged.
  - Rationale: After all prompts finish, empty fields represent genuinely unavailable extracted values and should remain visible for applicant review or correction.

## Risks / Trade-offs

- [Risk] A completed prompt may intentionally produce an empty value for a field before the whole run completes, and that field will stay hidden until completion. → Mitigation: This is acceptable because missing values should only require attention after all prompts have had a chance to contribute.
- [Risk] If upstream does not provide prompt counters, the service cannot reliably determine incomplete progress. → Mitigation: Preserve current behavior when total prompt count is unavailable.
