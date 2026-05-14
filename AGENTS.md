# Repository Guidelines

## Project Structure & Module Organization

AutoHire is a Bun-managed Next.js App Router application. Core routes live in `src/app`; public application pages are under `src/app/(public)/apply`, and API handlers live in `src/app/api`. Shared UI belongs in `src/components`, feature code in `src/features`, and server utilities in `src/lib` by domain. Prisma schema, migrations, and seed data are in `prisma/`. Static files are in `public/`. Product and implementation notes live in `docs/`, `specs/`, and `openspec/`. End-to-end tests are in `tests/e2e`; unit and route tests are colocated as `*.test.ts`.

## Build, Test, and Development Commands

- `bun install`: install dependencies and run Prisma generation.
- `bun run dev`: start the Next.js development server with Turbopack.
- `bun run build`: create a production build.
- `bun run start`: serve the production build.
- `bun run lint` / `bun run lint:fix`: check or fix ESLint issues.
- `bun run format:check` / `bun run format`: check or apply Prettier formatting.
- `bun run test`: run Vitest once.
- `bun run test:e2e`: run Playwright browser tests.
- `bun run db:migrate`, `bun run db:deploy`, `bun run db:seed`: manage Prisma migrations and seed data.

## Coding Style & Naming Conventions

Write TypeScript and React using existing Next.js conventions. Prefer small domain modules over broad utility files. Components use PascalCase, hooks use `useX`, route handlers use App Router `route.ts` naming, and tests use `*.test.ts` or `*.spec.ts`. Prettier with `prettier-plugin-tailwindcss` handles formatting; ESLint enforces Next.js and TypeScript rules.

## Testing Guidelines

Use Vitest for unit, route, and server utility coverage. Use Playwright for full user flows, especially resume upload, analysis, materials, and submit paths. Run `bun run test` before pushing logic changes, and `bun run test:e2e` for routing or user-flow changes. Keep Playwright workers at `1` because tests share a memory-backed dev server.

## Commit & Pull Request Guidelines

Use concise imperative commit messages, for example `Add observability tracking and raw IP logging`. Keep commits focused. Pull requests should include a summary, test evidence, linked issue or OpenSpec change, screenshots for UI changes, and notes for database, environment, or Sentry changes.

## Security & Configuration Tips

Do not commit `.env` secrets. Add new required variables to `.env.example` and document configuration changes in the pull request. For Prisma changes, commit generated migrations and state whether `bun run db:deploy` is required. When implementing from OpenSpec artifacts, keep code aligned with `openspec/changes/*`.
