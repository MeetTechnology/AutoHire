## 1. Static asset

- [x] 1.1 Add the final branding PNG at `public/apply/entry-background.png` (URL `/apply/entry-background.png`). If the binary is not committed, add `public/apply/.gitkeep` (or equivalent) and record in release notes that operators must supply this file before deploy.

## 2. Entry-only UI

- [x] 2.1 In `ApplyEntryClient` (or a small colocated presentational wrapper used only there), wrap the existing `PageFrame` tree in a `relative` container with a full-area background layer using `background-image: url("/apply/entry-background.png")`, `background-size: cover`, `background-position: center`, and `background-repeat: no-repeat`.
- [x] 2.2 Add a semi-opaque scrim or gradient layer between the photograph and foreground content so stepper, banners, and body text remain legible per `apply-entry-appearance` spec.
- [x] 2.3 Apply `z-index` stacking so the photo and scrim sit above global `body::before` but below interactive foreground (`relative` + higher `z-index` on the main column), without changing invite/session logic or API calls.

## 3. Verification

- [x] 3.1 Manually verify `/apply` shows the background when the PNG is present, and `/apply/resume`, `/apply/materials`, and `/apply/result` do not show this backdrop.
- [x] 3.2 Run `bun run lint` and fix any new issues from the change.
- [x] 3.3 Run `bun run test` and ensure existing suites pass.
