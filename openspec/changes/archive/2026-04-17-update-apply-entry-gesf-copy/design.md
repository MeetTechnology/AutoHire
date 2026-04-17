## Context

The `/apply` entry is implemented as a client component (`apply-entry-client.tsx`) with static English strings, accordion sections, and `PageShell` for the hero header. Repository guidelines require applicant-visible UI copy in **English**; section titles that were described in Chinese in informal notes should be expressed as clear English equivalents (for example “Online Application Process” instead of mixing Chinese into the UI).

## Goals / Non-Goals

**Goals:**

- Replace introduction copy, summaries, and section bodies per `apply-entry-intro-copy` spec.
- Add a **Timeline & Key Dates** accordion section whose visible content is **English only**.
- Render the main headline “Global Excellent Scientists Fund” **without bold weight** on `/apply` only.
- Keep invitation/session loading, redirects, read-only banners, and `postIntroConfirm` behavior unchanged.
- Preserve `apply-entry-appearance` behavior (background image on `/apply` only, scrim, no new APIs).

**Non-Goals:**

- Changing flow stepper labels in shared constants unless explicitly required by a follow-up change.
- Translating the entire app to Chinese or altering `/apply/resume` and other sub-routes beyond incidental shared component defaults.

## Decisions

1. **Headline weight** — Add an optional prop on `PageShell` (for example `headerTitleClassName?: string`) merged into the `<h1>` class list for both header variants, defaulting to current `font-semibold` when omitted. `ApplyEntryClient` passes `font-normal` (or equivalent) so other callers stay unchanged.

2. **Timeline placement** — Add a new accordion item `timeline` on the introduction page, ordered **after** “Online Application Process” and **before** “About the Service Provider”, matching the mental model “flow first, dates next, vendor last.”

3. **Sub-program bullets** — Render the three sub-projects as a semantic `<ul>` with Tailwind `list-disc` and `pl-5` (or `list-inside`) so bullets render as standard filled discs, accessible and consistent.

4. **Benefits / eligibility numbering** — Use `<ol className="list-decimal">` or explicit numbered rows in styled cards to match the stakeholder “1 / 2 / 3 / 4” list; keep one clear visual system per section.

5. **English-only timeline** — Store timeline strings as a dedicated constant array used only by the timeline section; do not interleave Chinese helper lines in the component.

## Risks / Trade-offs

- **[Risk] `cn()` / Tailwind merge** — Competing `font-semibold` defaults vs passed `font-normal`. **Mitigation:** implement the headline weight as “base classes + optional override” so the override wins, or omit default weight when `headerTitleClassName` is provided.
- **[Risk] Copy drift** — Long legal-style paragraphs are easy to mistype. **Mitigation:** mirror stakeholder text verbatim in one place; quick visual QA on `/apply`.

## Migration Plan

Ship with normal frontend deploy; no data migration. Roll back by reverting the single component (and optional `PageShell` prop) if needed.

## Open Questions

- None for implementation; if marketing later supplies official Chinese collateral, that would be a separate i18n initiative against `AGENTS.md`.
