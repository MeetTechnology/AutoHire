# Repository Guidelines

## Project Structure & Module Organization

AutoHire is a Bun-managed Next.js App Router app. Core routes live in `src/app`, with public pages under `src/app/(public)/apply` and API handlers under `src/app/api`. Shared UI is in `src/components`, feature code in `src/features`, and server utilities in `src/lib` by domain (`db`, `storage`, `tracking`, `validation`). Prisma schema, migrations, and seed data are in `prisma/`; static assets are in `public/`. Product and implementation references live in `docs/`, `specs/`, and `openspec/`. End-to-end tests are in `tests/e2e`; unit and route tests are colocated as `*.test.ts`.

## Build, Test, and Development Commands

- `bun install`: install dependencies; `postinstall` runs `prisma generate`.
- `bun run dev`: start the local Next.js dev server with Turbopack.
- `bun run build`: create a production build.
- `bun run lint` / `bun run lint:fix`: check or fix ESLint issues.
- `bun run format:check` / `bun run format`: check or apply Prettier formatting.
- `bun run test`: run Vitest tests once.
- `bun run test:e2e`: run Playwright browser tests.
- `bun run db:migrate`, `bun run db:deploy`, `bun run db:seed`: manage Prisma migrations and sample data.

## Coding Style & Naming Conventions

Write TypeScript and React using existing Next.js conventions. Prefer domain folders and small modules over broad utility files. Components use PascalCase, hooks use `useX`, route handlers use App Router `route.ts` naming, and tests use `*.test.ts` or `*.spec.ts`. Formatting is handled by Prettier with `prettier-plugin-tailwindcss`; linting uses `eslint-config-next` core web vitals and TypeScript rules.

## Testing Guidelines

Add Vitest coverage beside route handlers, feature logic, and server utilities. Use Playwright for full flows in `tests/e2e`, especially resume upload, analysis, materials, and submit paths. Run `bun run test` before pushing logic changes and `bun run test:e2e` for routing or user-flow changes. **E2e:** keep `workers: 1` (shared memory store on one dev server); wait for data-bound UI after navigation, not only headings; confirm each file in the UI before the next `setInputFiles` when uploads disable inputs; if port 3100 is in use, stop the stray `next dev` or change Playwright `webServer` port.

## Commit & Pull Request Guidelines

Recent commits use concise imperative messages, for example `Add observability tracking and raw IP logging`. Keep commits focused and mention the affected area when useful. Pull requests should include a summary, test evidence, linked issue or OpenSpec change when applicable, screenshots for UI changes, and notes for database, environment, or Sentry config changes.

## Security & Configuration Tips

Do not commit `.env` secrets. Use `.env.example` for required variables and document new configuration in the PR. For Prisma changes, commit generated migrations and confirm whether `bun run db:deploy` is needed. When working from OpenSpec artifacts, keep implementation aligned with `openspec/changes/*` and update docs when behavior changes.
