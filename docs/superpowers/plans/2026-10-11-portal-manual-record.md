# Portal Manual and Golden Record Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this approved visual change in place on its feature branch.

**Goal:** Apply the approved standards-manual layout with Golden Record engraving and the existing peripheral grid, hatching, and gradient masks to `/portal`.

**Architecture:** Keep the current React components, routes, form state, authentication and API contracts. `ArchiveBackground` owns passive decoration; `archive.css` owns the scoped presentation. Use local static artwork and CSS masks without adding DOM observers, dependencies, or animation.

**Tech Stack:** Existing React, TypeScript and CSS.

**Spec:** User-approved combination of the standards-manual and Golden Record prototypes, with the previous two-sided grid and sparse diagonal hatching restored.

## Global Constraints

- Preserve all fields, form associations, validation, save/submit behavior and button power icons.
- Keep the dark native select/option palette, including the publication-time picker.
- No cards, extra dashboard content, new architecture, or new dependencies.
- Decorations are static, aria-hidden, and pointer-events none; mobile stacks the existing chapters.
- Follow the user's verification scope: existing checks and screenshots only, no automated clicking/filling/submission, no new permanent tests for CSS.

## Review Focus

- Long chapter summaries and account labels must fit narrow screens.
- Pending, first-registration and approved states keep usable chapters, feedback and relay actions.
- Background clipping must not change layout or obscure controls.
- Open dialogs and hidden forms must not become grid items.
- Public/login/admin routes must not inherit portal-only selectors.

## Task 1: Apply the presentation

- [x] Preserve the source artwork under `public/images/portal/` and record NASA/JPL provenance in `docs/design/portal-archive-artwork.md`.
- [x] Update `src/portal/components/ArchiveBackground.tsx`: retain grid and hatch patterns, replace orbit artwork with clipped engraving details.
- [x] Consolidate `src/portal/archive.css`: standards-manual typography, two columns, responsive summaries, dark inputs/options, passive masked backgrounds.

## Task 2: Validate and review

- [x] Run `npm run check`, existing portal validation tests, and `npm run build`; inspect results.
- [x] Capture real `/portal` rendering with local seeded sessions and an explicitly labeled initial-registration fixture at desktop/mobile widths. Include pending and approved states without interactions.
- [x] Review the final diff and obtain one focused independent code review; resolve material findings.
- [x] Report changed files, actual checks, preview URL, and remaining verification limits for user review.

## Execution Notes

- Base: local `origin/main` commit `541a8b7`, which includes the latest role-aware portal navigation.
- The current tracked worktree was clean. A feature branch keeps the change separate while reusing the local development database and server.

## Validation Results

- `npm run check` — passed.
- `npm test -- src/portal/lib/registration-validation.test.ts src/portal/lib/schedule-selection.test.ts src/portal/lib/registration-draft.test.ts` — passed (existing registration validation, draft and schedule-selection coverage).
- `npm run build` — passed, including existing station/orbit asset prechecks; existing >500 kB chunk warning remains.
- `git diff --check` — passed.
- `node temp/portal-implementation/capture.mjs` — rendered first-registration at 1440, 800, 390 and 320 px, plus pending at 1440 px and approved at 1440/390 px. No horizontal overflow or page-script errors; art loaded and dark select/option colors preserved. Initial-registration uses response fixtures; pending/approved use local seed sessions. No automated clicking, filling or submitting.
- Ordinary author accounts receive the expected 403 from `/api/admin/session`; role-aware navigation handles it. This is not a screenshot failure.
- Independent read-only code review found no material regression; the primary agent inspected the actual rendered screenshots.

## Local Environment

The development server was restarted on port 20263. The existing local database was backed up using SQLite backup into `.wrangler/backups/2026-10-11-portal-manual-record/`, then the pre-existing `0022_admin_roles.sql` migration was applied locally for the latest navigation query. No reset, remote migration, deployment or production data change was performed.

Implemented on `feat/portal-manual-record`. Artwork and source attribution are included in this change. Business logic and API contracts were not modified by this visual update. After reviewing the implementation, the user authorized pushing the branch, opening a PR, and integrating the open PRs into main.
