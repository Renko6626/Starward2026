# Slot visibility implementation plan

> Execute inline with superpowers:executing-plans; scope and architecture approved in chat.

**Goal:** Preserve existing slots while temporarily excluding hidden slots from timetables, selection and relay adjacency.
**Architecture:** Add `schedule_segments.is_visible`, default 1. Extend the existing protected PATCH with `mode: 'set-visibility'` and `isVisible: boolean`; update only visibility and timestamp. Use existing React admin controls and server-side SQL filtering.
**Tech stack:** Existing React, TypeScript, Hono and D1/SQLite. No new dependency.
**Spec:** User-approved description in this conversation.

## Constraints and review focus

- Work on `hotfix/schedule-slot-visibility`, preserve unrelated untracked files. No database reset or deployment.
- Preserve assignments, times and draft associations; hiding a slot does not unpublish its already published work.
- Filter public/portal lists and adjacency; guard stale registration, claim/change and swap requests in their transaction.
- Admin can still edit all slots; show visibility and offer single/bulk toggles. Report partial bulk success and preserve unsaved edits.
- Existing special-seat rules still apply. Quick scheduling skips hidden slots without changing stored times.
- Tests use existing real SQLite fixtures; no browser interaction tests.

## Tasks

- [x] Add migration, shared type and visibility-only admin PATCH; verify authorization, validation and preservation using existing registration-schedule tests.
- [x] Filter timetable/adjacency/choices and protect mutation paths; cover hide/restore, hidden owner, stale claim/change/swap and quick schedule gaps.
- [x] Add admin selection, visibility badges, single/bulk actions and clear progress/errors; run relevant tests, type check and build, then review diff.

## Execution record

- Branch created; no tracked pre-existing changes. User requested immediate implementation on a new branch, so work continues in the current checkout.

- Added author-workspace cleanup requested during implementation, delegated to GPT-6.1 Sol medium: hide preview/review subsections and related navigation; keep source and backend; correct remaining numbering and local layout. Exact requested copy: 请继续创作，并等待后续通知。
- Independent review found a hidden pending reservation could be released by a normal application save. Fixed with a server-side reservation fallback and transaction guard; regression was observed failing, then passing. Explicit selection of another visible slot still changes the assignment.
- Related verification: `npm test -- worker/data/registration-schedule.test.ts worker/data/admin.test.ts worker/data/segments.test.ts worker/data/collaboration.test.ts worker/data/works.test.ts src/admin/lib/quick-schedule.test.ts src/admin/lib/creator-list.test.ts src/portal/components/RegistrationProgress.test.ts` — 72 passed.
- `npm run check` passed. No browser interaction tests, deployment or production database changes.
- Final `npm run build` passed (bundle-size warning only); `git diff --check` passed. Keep the completed local hotfix branch for integration.
