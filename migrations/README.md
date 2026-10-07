# Migrations

This directory holds the phase-1 D1 SQL migrations.

Current order:

1. `0001_auth_base.sql`
   - Better Auth base tables for Email OTP on D1 / SQLite
2. `0002_applications.sql`
3. `0003_participants.sql`
4. `0004_schedule_model.sql`
5. `0005_event_windows.sql`
6. `0006_project_drafts.sql`
7. `0007_participant_events.sql`
8. `0008_indexes_and_constraints.sql`
9. `0009_portal_profiles.sql`

Recommended local apply flow after the `DB` binding is configured in `wrangler.jsonc`:

```bash
npm run db:local:reset
wrangler d1 migrations apply starward2026 --remote
```

Notes:

- `0001_auth_base.sql` is the auth-layer migration.
- `0002+` remain domain-layer migrations owned by this project.
- The auth runtime uses Better Auth + Email OTP, while participant invite / activation rules continue to live in the `participants` table.
- The canonical phase-1 schedule model is `schedule_versions + schedule_segments`.
- 本地开发推荐通过 `npm run db:local:reset` 同时完成 reset、migrate 与 seed。
- 具体本地样本说明见 [../docs/development/local-d1.md](../docs/development/local-d1.md)。

## Unified credit hard cut

`0012_unified_credit.sql` replaces all profile credit modes with `credit_name` and
`is_anonymous`. It deliberately discards existing profile rows and removes name
columns from applications, participants, and project drafts; there is no backfill
or compatibility path. Apply this migration together with the new application
version. Users complete their profile again; local fixtures use the new schema.

## Work publication

`0013_work_publication.sql` adds optional work type, cover, public link and publication
fields to existing drafts without replacing existing data. Existing works remain
unpublished. Apply this migration with the works gallery version. The public release
window controls new publication only; closing it does not remove the archive.
Unpublish a work before returning approved material for edits.

## Collaboration and reservations

`0014_collaboration.sql` adds bilateral swap requests, indexes and invalidation
triggers. Slot ownership, participant eligibility, schedule retirement and window
closure invalidate pending requests permanently. Application reservations use the
existing held-slot model: pending participants reserve, approved participants
confirm, rejected or withdrawn applications release. Deploy this migration with
the collaboration API. The internal `collaboration_guards` table has no retained
rows: its CHECK constraint aborts a whole D1 batch if a concurrent edit violates
an operation's preconditions. Swap acceptance clears both owners before assigning
them again, preserving the existing unique held-slot constraint.

## Neighbor contact

`0015_bilibili_uid.sql` adds an optional stored Bilibili UID without replacing
existing profiles. New profile saves and applications require a numeric UID;
legacy profiles remain readable until their next save. The authenticated neighbor
API shares this UID only with the adjacent confirmed creator, alongside public
credit and slot details. Other contact fields remain private. Apply this migration
with the compact creator workspace version.
