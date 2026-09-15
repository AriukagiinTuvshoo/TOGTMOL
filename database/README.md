# Database contract

The source of truth for the schema is the CLI-generated migration in `supabase/migrations/`. It has been executed and tested in PGlite, a real PostgreSQL engine. No hosted Supabase project was available during implementation.

| Table                   | Key                       | Purpose                                                             |
| ----------------------- | ------------------------- | ------------------------------------------------------------------- |
| `auth.users`            | UUID                      | Supabase-managed authentication identity                            |
| `public.subjects`       | user ID + text ID         | Subject details, archive flag, deletion marker                      |
| `public.study_sessions` | user ID + text ID         | Exact seconds, original epoch timestamps, notes and active segments |
| `public.study_entries`  | user ID + text ID         | Manual subject/day marks, without invented duration                 |
| `public.daily_tasks`    | user ID + text ID         | Planned subject, date, minutes, completion and optional time        |
| `public.goals`          | user ID                   | Weekly and optional daily/monthly goals                             |
| `public.achievements`   | user ID + achievement key | Persisted unlock date, including unknown legacy keys                |
| `public.study_profiles` | user ID                   | Revision, settings, quarantine, conflict versions and extensions    |

Record JSON preserves future/legacy fields, while generated relational columns support indexing and joins without duplicated values drifting apart. Exact duration uses numeric seconds; `duration_minutes` is generated from it. Client record timestamps are milliseconds since epoch (bigint), avoiding timezone-dependent conversion. Server profile update time is `timestamptz`.

Each child foreign key includes both `user_id` and `subject_id`. Every public table has RLS with owner-only select/insert/update. There are no authenticated hard-delete grants. Indexes begin with user ID. Policies use `(select auth.uid())` to avoid recomputing identity per row.

`pull_study_data(expected_user_id)` returns a snapshot and revision. `push_study_data(expected_user_id, expected_revision, document)` locks the revision row, checks identity/revision, writes all relations and increments the revision within one transaction. A failed child record rolls back all writes. Both functions are `SECURITY INVOKER`, have an empty search path and explicit grants only to authenticated users.

Do not bypass the RPC revision contract with direct app writes; independent admin updates require coordinated revision changes. Generated columns are read-only; update the record `payload` through the RPC. Unknown future schema versions are rejected until a new application migration is implemented.

## v4 additions

Apply `20260915131805_study_world_v4.sql` after the original v3 migration. It adds owner-isolated `study_goals` and `music_sources`, with generated columns, validated payloads, tombstones, explicit grants and RLS. Study goals have a composite `(user_id, subject_id)` foreign key. Existing seven public tables remain.

Updated atomic sync RPCs return/accept schema 4 and include both new collections. The client migrates older documents and sync baselines. `settings.world` remains in the profile JSON; task/session goal links are retained in payloads.

`private.togi_usage` is outside the exposed public schema. Clients have no table/schema access. The narrowly scoped `consume_togi_request(expected_user_id)` function validates `auth.uid()` and atomically increments a 20/day UTC quota; its `SECURITY DEFINER` body uses an empty search path and fully qualified references. The API route separately enforces a server-side user allowlist. No service-role key is required.
