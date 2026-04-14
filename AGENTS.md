# Repository Guidelines

## Project Structure & Module Organization
`src/app` contains Next.js App Router pages and API routes. Public application pages live under `src/app/(public)/apply`, and backend handlers live in `src/app/api/**`. Shared server utilities belong in `src/lib` (for example `auth`, `db`, `resume-analysis`, `storage`, `validation`), feature-scoped code lives in `src/features`, and reusable UI belongs in `src/components`. Prisma schema, migrations, and seed data live in `prisma/`. End-to-end tests are in `tests/e2e`, while unit tests should sit next to implementation as `*.test.ts`. Product and architecture references belong in `docs/`.

## Build, Test, and Development Commands
Use Bun for package management and scripts.

- `bun run dev`: start the local Next.js app with Turbopack.
- `bun run build`: create the production build.
- `bun run start`: serve the production build.
- `bun run lint` / `bun run format`: run ESLint and Prettier.
- `bun run test`: run Vitest unit tests.
- `bun run test:e2e`: run Playwright end-to-end tests.
- `bun run db:migrate` / `bun run db:seed`: apply Prisma dev migrations and load sample data.

## Coding Style & Naming Conventions
TypeScript is strict; keep new code fully typed. Follow the existing style: 2-space indentation, double quotes, semicolons, and `@/*` imports for code under `src/`. Name React components in PascalCase, utility modules in kebab-case or domain folders, and route handlers as `route.ts`. Let `eslint-config-next` and Prettier with `prettier-plugin-tailwindcss` handle formatting and class ordering.

## Testing Guidelines
Use Vitest for logic and route-level tests, and Playwright for end-to-end flow coverage. Keep unit tests beside the code they cover, for example `src/lib/auth/session.test.ts`. Run `bun run test` before every commit, and run `bun run test:e2e` when changing application flow, uploads, or API contracts.

## Commit & Pull Request Guidelines
Recent commits use concise imperative summaries with an uppercase first word, for example `Implement secondary resume analysis and application materials flow`. Keep commits focused on one vertical slice. Pull requests should include a short summary, affected routes or modules, required env or Prisma changes, linked docs or issues, and screenshots for UI changes.

## Security & Product Notes
Start from `.env.example`; never commit real secrets. Treat Prisma migrations, storage settings, and resume-analysis integrations as deployment-sensitive. User-facing frontend copy must stay in English. Preserve the product’s guided, invite-based application flow: resume first, then missing information, then supporting materials, then final submission.
