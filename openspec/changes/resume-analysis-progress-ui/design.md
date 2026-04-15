## Context

- Today, `AnalysisProgressPanel` in `src/app/(public)/apply/result/page.tsx` renders a **fixed-width** inner bar (`w-3/5`) and a **spinner**, while the caption alternates between (a) a rotating `ANALYSIS_MESSAGES` array every 1.8s and (b) fallback `statusText` from `GET /api/applications/:id/analysis-status` (via `refreshAnalysisState`). There is **no** coupling between bar fill and elapsed time or job phase.
- Empirical primary analysis duration is about **32s**; product expectation is a **30–60s** honest wait window. The assessor prompt implies a clear conceptual order: intake → structured extraction (multiple facets) → eligibility determination → consolidated output—this order should drive **user-visible** copy without implying step-level observability from the backend.

## Goals / Non-Goals

**Goals:**

- Implement a **monotonic** displayed progress value (0% up to a pre-completion cap, then completion when the session leaves analyzing or job reports terminal success).
- Calibrate motion so a **~32s** run typically reaches the **upper mid-range** of the bar (visibly “almost there” but not full), and slower runs can **creep** toward the cap for up to **~60s** without jumping backward.
- Replace ad-hoc rotation with a **single canonical English message sequence** aligned to extraction/eligibility phases (see Decisions); optionally surface API `progressMessage` when it adds factual value (e.g. queued, syncing).
- Share the same **timing and bar rules** for `CV_ANALYZING` / `REANALYZING` and `SECONDARY_ANALYZING`, with a **separate message list** for the detailed-analysis stage.

**Non-Goals:**

- Exposing true LLM internal steps, token counts, or backend micro-phases as facts.
- Changing analysis algorithms, queues, or Prisma models.
- Adding new required fields to the analysis-status JSON contract (optional additive fields remain out of scope unless specs require them).

## Decisions

### D1 — Where logic lives

- **Decision:** Add a small **pure** helper module under `src/features/application/` (e.g. `analysis-progress-model.ts`) exporting:
  - constants for reference duration and cap (`REFERENCE_DURATION_MS` ≈ 32_000, `SOFT_MAX_WAIT_MS` = 60_000, `PRE_COMPLETE_CAP` ≈ 0.90–0.93),
  - `getDisplayedProgressRatio(elapsedMs: number): number`,
  - `getPrimaryStageMessageIndex(elapsedMs: number): number` (or derive index from the same ratio bands),
  - parallel helpers or a `mode: "primary" | "secondary"` parameter for secondary copy.
- **Alternatives considered:** Inline all math in `result/page.tsx` (rejected: harder to test and tune); drive progress only from poll count (rejected: poll jitter changes UX).

### D2 — Progress curve (bar fill)

- **Decision:** Use **elapsed time since entering** the current analyzing status, reset when `applicationStatus` crosses into or between `CV_ANALYZING` | `REANALYZING` | `SECONDARY_ANALYZING` (each segment gets a fresh clock; optional: do not reset on `REANALYZING` if that is a continuation—product call; default **reset per status entry** for simpler mental model).
- **Curve:** Piecewise-linear mapping `elapsedMs → [0, PRE_COMPLETE_CAP]`:
  - **0–12s:** 0% → **28%** (fast initial feedback),
  - **12–32s:** 28% → **78%** (covers measured ~32s in the steep part of the journey),
  - **32–60s:** 78% → **PRE_COMPLETE_CAP** (slow crawl for stragglers),
  - **>60s:** hold at **PRE_COMPLETE_CAP** until terminal.
- **On terminal success** (poll reports completed and session updates out of analyzing, or equivalent): set bar to **100%** for a short moment (150–300ms) **or** skip 100% and unmount panel when content swaps—prefer **immediate transition to result UI** with no fake 100% if that avoids a flash; spec will choose one; design default: **jump to full width then unmount** on next paint if trivial, else **omit 100%** and rely on panel disappearance.
- **Alternatives considered:** Single exponential (rejected: harder to hit exact 32s band without tuning); tied to `analysisMessageIndex` only (rejected: decouples bar from time).

### D3 — Stage messages (primary)

- **Decision:** Fixed ordered list (English), **advanced by elapsed time bands** aligned to the same piecewise regions (or sub-segments) so text and bar feel coherent. Example band mapping (tune in implementation to match spec wording):

  | Order | Approx. time focus | User-facing intent (maps to prompt) |
  |------:|--------------------|--------------------------------------|
  | 1 | 0–8s | Ingest CV / related text |
  | 2 | 8–16s | Birth year, degrees, doctoral detail |
  | 3 | 16–24s | Current title, country, 2020+ experience |
  | 4 | 24–32s | Research areas |
  | 5 | 32–45s | Eligibility rules |
  | 6 | 45s+ | Consolidating structured review |

- **Alternatives considered:** Random rotation (rejected: contradicts “aligned to prompt”); one message for whole wait (rejected: feels static).

### D4 — Secondary (`SECONDARY_ANALYZING`) copy

- **Decision:** Shorter list (3–4 lines) focused on “detailed / expert-facing fields” and “gates materials stage”—reuse **same bar curve** and caps for consistency.

### D5 — `progressMessage` from API

- **Decision:** Treat as **secondary** line: default hidden; show beneath the stage line when `jobStatus` is `queued` or when `progressMessage` contains sync-oriented wording (e.g. “syncing”, “queued”), or when it differs from the generic “analyzing” string—implementation uses simple heuristics. Never prepend `[[[]]]` / `{{{}}}` / `!!!` content from models into UI.
- **Alternatives considered:** Always show API text as primary (rejected: fights curated sequencing); never show (rejected: loses useful queue/sync signal).

### D6 — Polling and state

- **Decision:** Keep **2s** polling for `fetchAnalysisStatus`; drive **UI progress** from `requestAnimationFrame` or **100–250ms** `setInterval` local timer for smooth bar updates (cheap). Avoid resetting elapsed timer on each successful poll unless status flips.

## Risks / Trade-offs

- **[Risk] Misleading if jobs often exceed 60s** → Mitigation: hold at cap + copy that acknowledges “still running” after 60s (spec); optional message variant.
- **[Risk] Users interpret bar as download %** → Mitigation: no “%” label; optional aria `progressbar` with `aria-valuetext` like “Review in progress, about half expected time elapsed”.
- **[Risk] `REANALYZING` reset feels like loss of progress** → Mitigation: document in spec; optional carry-forward of elapsed if same page session detects only sub-status change (open question).

## Migration Plan

- **Deploy:** Standard app deploy; no migrations.
- **Rollback:** Revert UI module and `result/page.tsx` wiring; no data rollback.

## Open Questions

- Should **re-analysis** (`REANALYZING`) **preserve** elapsed time from the prior analyzing segment or **reset** the bar?
- Exact **PRE_COMPLETE_CAP** and breakpoints—confirm against one production-like trace after implementation (tweak constants in one file).
