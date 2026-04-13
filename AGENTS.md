# Repository Guidelines

## Project Structure & Module Organization
`src/app` contains the Next.js App Router pages and API routes. Public flow pages live under `src/app/(public)/apply`, while backend endpoints are under `src/app/api/**`. Shared server utilities live in `src/lib` (`auth`, `db`, `resume-analysis`, `storage`, `validation`), and feature-scoped code lives in `src/features`. Reusable UI belongs in `src/components`. Prisma schema, migrations, and seed data are in `prisma/`. End-to-end tests live in `tests/e2e`; unit tests stay next to implementation files as `*.test.ts`. Product and architecture references live in `docs/`.

## Build, Test, and Development Commands
Use Bun for package management and scripts.

- `bun run dev` starts Next.js locally with Turbopack.
- `bun run build` creates the production build.
- `bun run start` serves the production build.
- `bun run lint` runs ESLint across the repo.
- `bun run format` applies Prettier formatting.
- `bun run test` runs Vitest unit tests.
- `bun run test:e2e` runs Playwright against a local server on port `3100`.
- `bun run db:migrate` applies Prisma development migrations.
- `bun run db:seed` loads sample data.

## Coding Style & Naming Conventions
TypeScript runs in strict mode; keep new code fully typed. Follow the existing style: 2-space indentation, double quotes, semicolons, and `@/*` imports for code under `src/`. Name React components in PascalCase, utility modules in kebab-case or domain folders, and keep route handlers in `route.ts`. Let ESLint (`eslint-config-next`) and Prettier with `prettier-plugin-tailwindcss` handle formatting and class ordering.

## Testing Guidelines
Write unit tests beside the code they cover, for example `src/lib/auth/session.test.ts`. Use Vitest for logic and route-level tests; use Playwright only for end-to-end user flows in `tests/e2e/*.spec.ts`. Run `bun run test` before every commit. Run `bun run test:e2e` when changing the application flow, uploads, or API contracts. Keep seeded or mock-friendly paths working for local verification.

## Commit & Pull Request Guidelines
Recent commits use concise imperative summaries with an uppercase first word, for example `Implement application flow with resume analysis and materials upload`. Keep commits focused on one vertical slice. For pull requests, include a short summary, affected routes/modules, required env or Prisma changes, and screenshots for UI changes. Link the relevant doc or issue when updating flows documented in `docs/`.

## Security & Configuration Tips
Start from `.env.example`; never commit real secrets in `.env`. Treat Prisma migrations, upload/storage settings, and resume-analysis integrations as deployment-sensitive changes. If a change affects the product flow or contracts, update the matching file in `docs/` in the same branch.

## Frontend presentation language

- **English only for user-facing surfaces.** Any information, literals in rendering code, and field values that the expert-facing frontend presents to users (including labels, headings, body copy, placeholders, button text, empty/error/success messages, validation hints, and table or list captions) must be authored in **English**.
- **Contracts intended for display** (for example, human-readable titles or descriptions returned by APIs and rendered without transformation) must also be **English**, so the UI stays consistent end-to-end.

## Frontend UI/UX style principles

- **Adopt a premium editorial application aesthetic.** Prefer a calm, high-trust visual tone over flashy “tech dashboard” styling. The desired feel is refined, international, and process-oriented: warm paper-like backgrounds, restrained contrast, spacious layout, and carefully composed hierarchy.
- **Use typography with clear role separation.** Display or section-leading headings may use the serif accent font to create an editorial feel, while body copy, controls, helper text, and data-heavy UI should remain on the sans font for readability. Do not overuse decorative typography inside forms or dense content.
- **Favor strong hierarchy and generous spacing.** Build pages with obvious reading order: eyebrow -> heading -> supporting copy -> status/next action -> details. Use large section breaks, card groupings, and 4px/8px spacing rhythm so the flow feels calm rather than crowded.
- **Keep the application flow visibly guided.** Multi-step pages should reinforce where the user is in the journey using subtle step indicators or stage cues. The step treatment should feel understated and polished, not like a loud progress widget.
- **Prefer reusable shells and patterns over one-off page styling.** Shared layout, section cards, buttons, banners, and form controls should be built from common primitives in `src/components/ui` so the application flow reads as one cohesive product.
- **Use progressive disclosure to reduce cognitive load.** Surface the current decision, required action, and key summary first. Secondary detail such as deep reasoning, raw analysis text, or lower-priority metadata should live in subordinate cards, expandable sections, or later page regions.
- **Make status feedback explicit and calm.** Loading, processing, success, warning, and error states must always be visible and understandable. Prefer clear status banners, concise next-step copy, and stable button states over ambiguous spinners or silent transitions.
- **Design forms for reassurance, not just input.** Supplemental fields, uploads, and confirmation actions should include context, concise helper text, and obvious affordances. Users should understand what is already recognized, what is missing, and what happens after submission.
- **Use motion and interaction sparingly but purposefully.** Hover, focus, press, and disabled states should feel polished and responsive, but motion should remain restrained. Favor subtle lift, shadow, border, and background transitions rather than dramatic animation.
- **Preserve accessibility and touch comfort.** Maintain strong contrast, visible focus states, and controls that are comfortable to tap or click. Interactive targets should generally meet a minimum comfortable size of about `44px` in height/width where practical.
- **Align copy tone with the visual system.** UI copy should be concise, composed, and reassuring. Avoid raw internal status enums, debug-style phrasing, or overly technical wording in user-visible content.
- **Reflect the product reality honestly.** This application is an invite-based, async review flow, not a generic SaaS dashboard. UI decisions should reinforce trust, continuity, and staged completion: resume first, then missing information if needed, then supporting materials, then final submission.