# Migrations

`0023_schedule_slot_visibility.sql` adds `schedule_segments.is_visible`, defaulting
to 1 for existing and newly created slots. Apply it before deploying the matching
worker. It preserves times, assignments and work associations; no reset is needed.
Admins can hide or restore slots individually or in batches from the schedule page.
Hidden slots are omitted from public/author timetables, selectable slots and relay
neighbors; existing published works remain published.

`0021_cosplay_work_types.sql` adds `cosplay` to application and work types and
converts existing `mixed` intentions to `other`. It preserves application reviews,
participant application links, drafts and schedule assignments. Apply this migration
with the matching application version, before accepting new Cosplay selections.

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
Approved material remains editable by its author; changes preserve approval. Unpublish before an admin changes review status.

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

## Relay publication time

`0016_schedule_publication_time.sql` adds nullable `scheduled_at` to each existing
schedule entry. Admins set one publication instant per relay entry (Beijing time
in the editor, UTC ISO timestamps in storage). No start/end interval is needed.
Apply this migration with the public timetable version; existing times stay unset.
Approved previews appear before the relay. With migration 0018, confirmed and approved works become visible immediately; other authors' future slots do not gate released details.

## Extra schedule slots

`0017_extra_schedule_slots.sql` adds `kind` (`standard` / `extra`) to the existing
schedule records. Existing entries remain `standard`; an extra slot must have no
planned publication time. The admin append endpoint creates independently numbered
`EXTRA-01` slots without changing existing entries or ownership.
Apply the migration before running this application version, using the normal D1
migration flow. Extra and unconfigured entries do not prevent completion or archive visibility.
Review approvals still control publishing; the existing admin publication window only controls manual admin publication.

## Author release confirmation

`0018_relay_release_confirmation.sql` adds nullable `release_confirmed_at` without
changing existing rows. Apply it before deploying this version. First link submission
on the scheduled Beijing calendar day records author confirmation atomically with
the link. Approved, complete works become public immediately, independently of the
manual admin release window and the final relay time. Pending works are published
when their review completes. Later valid link edits preserve the first confirmation
time. Ordinary edits preserve approval and do not notify reviewers. Admin withdrawal
retains author confirmation, and link edits do not reverse that withdrawal.

Extra slots have no planned time and continue to use manual admin publication.
No remote migration or deployment is performed by local validation commands.

## Activity rules acceptance

`0019_activity_rule_acceptances.sql` adds a separate acceptance table keyed by
account and rules version. The backend requires an explicit current-version
confirmation before password registration or OTP account creation, and records
the server time after creating the account. Missing or outdated confirmation is
rejected before consuming a signup OTP. Existing accounts can still log in
without a historical acceptance record; no consent is backfilled for them.

Apply this additive migration before deploying the new registration code. Local
development uses `npx wrangler d1 migrations apply starward2026 --local` and keeps
the existing accounts, sessions, applications and schedule. The public version
and registration header are defined in `src/shared/activity-rules.ts`; update
the version whenever the published terms change.

## QQ optional contact email

`0020_qq_optional_contact_email.sql` makes the profile/application contact email
and participant invitation email nullable. Better Auth's user email remains
required; QQ-only accounts use an internal non-deliverable identifier that is
never written into business contact fields.

The migration snapshots the rebuilt tables and their dependent events, drafts,
swap requests and schedule references. It temporarily removes cascade children
and swap invalidation triggers, rebuilds the three business tables, then restores
all records, references, indexes and triggers. It does not use `foreign_keys=OFF`.
Back up before upgrading an existing database, apply the migration before the new
application, and run `foreign_key_check` afterwards. Never edit past migrations
or reset a populated database for this upgrade. Rolling back application code
alone is unsafe because the previous version assumes non-null email fields.
