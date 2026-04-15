## Why

The public `/apply` application introduction currently shares only the global `body` styling (solid fill plus CSS gradient texture). A dedicated PNG background on that entry route improves first-impression branding and visual depth without changing the guided application behavior.

## What Changes

- Introduce a static PNG background visible on the `/apply` route (application intro entry only), loaded from the Next.js `public/` directory.
- Keep existing stepper and content readable (contrast, stacking, and reduced-motion behavior addressed in design/specs).
- Document the expected asset filename and path for operators who deploy or replace the image.

## Capabilities

### New Capabilities

- `apply-entry-appearance`: Requirements for visual treatment of the public `/apply` introduction view, including optional or required use of a PNG background from public assets, layering with existing global styles, and basic accessibility expectations (e.g. contrast, non-text decoration).

### Modified Capabilities

- None. No existing capability specs were found under `openspec/specs/` in this repository to update at the requirement level.

## Impact

- Affects the `/apply` route UI only (e.g. route-level layout under `src/app/(public)/apply/` and/or the entry client shell), not resume, materials, or result steps unless explicitly scoped later.
- Adds or references one PNG under `public/` (conventional path to be fixed in `design.md` / `tasks.md`).
- No API, Prisma, or auth contract changes.
- May require coordination with `src/app/globals.css` (`body` / `body::before`) so the new layer stacks predictably.
