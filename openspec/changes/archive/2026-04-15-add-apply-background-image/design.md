## Context

- The proposal scopes branding to the **public `/apply` introduction** only, not the whole multi-step subtree (`/apply/resume`, `/apply/materials`, `/apply/result`).
- Today, `src/app/(public)/apply/page.tsx` renders `ApplyEntryClient`, which composes `PageFrame` / `PageShell` from `src/components/ui/page-shell.tsx`.
- Global atmosphere comes from `src/app/globals.css`: `body` background color plus `body::before` fixed at `z-index: -1` with layered gradients. Any new background must stack above that pseudo-element but below interactive content.

## Goals / Non-Goals

**Goals:**

- Show a **PNG** full-viewport (or full-main) background on **exactly** the `/apply` entry route, sourced from **`public/`** via a root-absolute URL (Next.js static file convention).
- Preserve **readability** of titles, stepper, cards, and banners (overlay or equivalent).
- Keep **invite flow behavior** unchanged (no new redirects, no API changes).
- Define a **single canonical asset path** so deployers know where to drop the file.

**Non-Goals:**

- Applying the same background to `/apply/resume`, `/apply/materials`, or `/apply/result` (would require a different scope or path-gated layout).
- Replacing or removing the global `body` / `body::before` treatment app-wide.
- Using a remote CDN image or authenticated asset fetch.
- Animations or parallax (static image only unless specs expand later).

## Decisions

### 1. Where the UI change lives (route scope)

**Choice:** Implement the backdrop **only in the `/apply` entry tree**—for example by wrapping the existing `PageFrame` content inside `ApplyEntryClient` (or a tiny presentational child used exclusively there).

**Alternatives considered:**

| Option                                                    | Rationale              | Why not chosen                                                                                                                   |
| --------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/(public)/apply/layout.tsx` full-bleed background | Simple nesting         | Wraps **all** `/apply/*` segments unless additional path logic is added; violates intro-only scope.                              |
| CSS only in `globals.css` keyed off `body` class          | Central styling        | Hard to limit to `/apply` without coupling layout to route class toggles.                                                        |
| `next/image` with `fill` as bottom layer                  | Automatic optimization | Heavier markup; decorative backgrounds are commonly CSS `background-image`; LCP less critical when image is non-hero below text. |

### 2. How the image is applied

**Choice:** A **positioned wrapper** around the entry layout: inner layer with `background-image: url("/apply/entry-background.png")`, `background-size: cover`, `background-position: center`, `background-repeat: no-repeat`, and a **semi-opaque scrim** (solid or gradient) between the photo and the foreground so existing Tailwind tokens and cards remain legible.

**Alternatives considered:**

| Option                                 | Notes                                                                                                                                                 |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `next/image` + `fill` + `object-cover` | Valid per Next.js docs; use if we later need `priority` or explicit `sizes`; adds client boundary considerations if placed under server-only parents. |
| Inline `<img>`                         | Loses optimization; not preferable.                                                                                                                   |

### 3. Canonical asset location

**Choice:** **`public/apply/entry-background.png`** → referenced in code as **`/apply/entry-background.png`**.

Operators supply or replace that PNG without renaming (unless a coordinated rename is done in code and docs).

### 4. Stacking with `body::before`

**Choice:** Backdrop wrapper uses **`position: relative`** on the outer shell and an **`absolute inset-0` background layer** with **`z-index: 0`**, while main column content uses **`relative z-10`** (or equivalent) so it sits above the image and scrim. The global `body::before` remains at `z-index: -1`, so the photograph reads **above** the dotted gradient but **below** apply content.

### 5. Reduced motion and accessibility

**Choice:** No motion tied to the background. Decorative layer: ensure **contrast** via scrim and existing card styles; if any assistive technology concern arises from purely decorative imagery, keep it **CSS background** (no content img requiring `alt`) per HTML guidance for non-informative decoration—details can be echoed in the capability spec.

## Risks / Trade-offs

| Risk                                                      | Mitigation                                                                                                       |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Missing PNG at deploy time shows empty or partial styling | CI or `tasks.md` checklist: verify file exists before release; document in README or operator notes.             |
| Too-strong photo competes with text                       | Tunable scrim opacity in one place; ship conservative default.                                                   |
| Large PNG hurts LCP on slow networks                      | Prefer reasonably compressed PNG; consider WebP follow-up (non-goal for this change unless spec adds it).        |
| Duplicating wrapper patterns                              | Keep wrapper minimal or extract a single `ApplyEntryBackdrop` component colocated with application feature code. |

## Migration Plan

1. Land code that references `/apply/entry-background.png` and the overlay behavior.
2. Add **`public/apply/entry-background.png`** to the deployment artifact (or document that operators must upload it); optional: commit a lightweight placeholder in-repo if product allows.
3. Rollback: revert the wrapper/styles; remove or ignore the PNG file—no data migration.

## Open Questions

- Final **scrim opacity** and whether to use a **top-only gradient** vs uniform wash (can be resolved during implementation / visual review).
- Whether to commit a **placeholder PNG** in git for local dev or rely on `.gitkeep` + docs only (product preference).
