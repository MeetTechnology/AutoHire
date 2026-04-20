# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
bun run dev          # Next.js dev server with Turbopack
bun run build        # Production build
bun run start        # Production server

# Testing
bun run test         # Vitest unit tests (single run)
bun run test:watch   # Vitest watch mode
bun run test:e2e     # Playwright E2E tests (auto-starts dev server on port 3100)

# Code quality
eslint .             # Lint
eslint . --fix       # Lint + fix
prettier . --write   # Format

# Database
bunx --bun prisma generate        # Regenerate Prisma client after schema changes
bunx --bun prisma migrate dev     # Create and apply a new migration
bunx --bun prisma migrate deploy  # Apply migrations in production
bun prisma/seed.ts                # Seed the database
```

Package manager is **Bun**. Use `bun` / `bunx --bun` instead of `npm` / `npx`.

## Architecture

AutoHire is a Next.js 16 (App Router) full-stack application for expert candidate screening. Candidates receive an invite token, upload their CV, and receive an AI-powered analysis result.

### Application Flow

1. `/apply` — entry page, validates invite token, creates application session
2. `/apply/resume` — CV upload (direct-to-OSS presigned upload)
3. `/apply/materials` — supplemental materials upload
4. `/apply/result` — displays resume analysis results with polling

### Directory Structure

```
src/
├── app/
│   ├── (public)/apply/     # Candidate-facing pages (entry, resume, materials, result)
│   └── api/applications/[applicationId]/
│       ├── resume/         # Upload intent + confirm endpoints
│       ├── materials/      # Materials upload endpoints
│       ├── secondary-analysis/  # Secondary analysis fields
│       └── submit/         # Final submission
├── features/
│   ├── analysis/           # Resume analysis display, extraction, secondary fields
│   ├── application/        # Application state machine, routing, Zod schemas, components
│   └── upload/             # Upload constants
├── lib/
│   ├── auth/               # Invite token validation, session cookies
│   ├── application/        # Application service layer (DB operations)
│   ├── db/                 # Prisma client singleton
│   ├── resume-analysis/    # External analysis API client, normalizers, field registry
│   ├── storage/            # Object store abstraction (mock or Aliyun OSS)
│   ├── oss/                # Aliyun OSS presigned URL generation
│   ├── data/               # In-memory store for mock/dev mode
│   └── env.ts              # Zod-validated environment variables (import this, not process.env)
└── components/ui/          # Shared UI primitives
```

### Runtime Modes

Controlled via environment variables — see `.env.example`:

- `APP_RUNTIME_MODE`: `auto` | `mock` | `live`
- `FILE_STORAGE_MODE`: `mock` | `oss`
- `RESUME_ANALYSIS_MODE`: `mock` | `live`

In `mock` mode, the app uses an in-memory store (`src/lib/data/`) and returns fixture data — no external services needed. Sample invite tokens for local dev: `sample-init-token`, `sample-progress-token`, `sample-submitted-token`.

### Key Patterns

- **Environment variables**: Always import from `src/lib/env.ts` (Zod-validated), never `process.env` directly.
- **Database**: Prisma 7 with PostgreSQL. Schema in `prisma/schema.prisma`. Migrations in `prisma/migrations/`.
- **File uploads**: Two-step presigned upload — client calls `/upload-intent` to get a presigned OSS URL, uploads directly from browser, then calls `/upload-confirm`.
- **Path alias**: `@/*` maps to `src/*`.
- **Testing**: Unit tests colocated with source (`.test.ts`). E2E tests in `tests/e2e/`.
