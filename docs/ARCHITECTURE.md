# Architecture and upgrade decisions

## Before v3

v2 is a single HTML document with inline CSS and an imperative JavaScript application. Its persisted document lives at `tracker-data`; it uses host `window.storage` when available and a browser fallback. It already contains subjects, manual day entries, measured sessions, goals, achievements, import/export and an active timer. Its exact source is retained in `legacy/togtmol-v2.html`.

The upgrade addresses repeated history scans, tightly coupled DOM/storage code, missing session editing, missing planning and account isolation, and the absence of an installable application shell. The original v2 data contract remains readable.

## Module boundaries

| Location                | Responsibility                                                            |
| ----------------------- | ------------------------------------------------------------------------- |
| `app/`                  | Next App Router entry, metadata, manifest, responsive CSS, error boundary |
| `components/`           | Screen components and reusable accessible controls                        |
| `hooks/use-study.tsx`   | External store subscription, indexed statistics, navigation, theme        |
| `hooks/use-account.tsx` | Optional auth lifecycle, account selection, sync scheduling               |
| `types/study.ts`        | Explicit v4 document, entity, timer and analytics types                   |
| `lib/calculations/`     | Pure timer, local date, statistics and achievement calculations           |
| `lib/migration/`        | Validation, backward migration, three-way merge, conflict resolution      |
| `lib/persistence/`      | IndexedDB transactions, source backups, mutations, note recovery journal  |
| `lib/supabase/`         | Public client, real RPC adapter, account-bound sync engine                |
| `lib/assistant/`        | Deterministic insights and future AI provider contract                    |
| `scripts/`              | Build-specific offline asset manifest and service worker template         |
| `supabase/migrations/`  | Versioned PostgreSQL schema, policies and transaction functions           |
| `tests/`                | Unit, repository, database, sync, component and worker regression tests   |

## Local persistence

IndexedDB `togtmol-v3` has `documents`, `backups`, and `metadata` stores. Each document has a monotonic revision. A read/write transaction checks the expected revision and writes the entire next document atomically. Conflicting tabs reload the committed version and explicitly ask the user to retry the action. BroadcastChannel and window focus refresh synchronize the visible local state.

Mutations are serialized and published after persistence succeeds. Timer ticks never rewrite the document; time is derived from epoch timestamps. The note field uses a small synchronous localStorage recovery journal because navigation can precede a debounced IndexedDB save. Export includes that latest draft. Quota and storage errors remain visible rather than being reported as successful saves.

The fallback when IndexedDB is unavailable uses localStorage plus Web Locks; without a serialization mechanism it refuses unsafe writes. An inaccessible existing IndexedDB is not silently replaced with an empty fallback store.

## Time and statistics

Each timer stores its immutable initial start, accumulated active milliseconds, current running start and completed active segments. Pause intervals are excluded. Finishing persists a review before any session is created. Save converts focus time into one stable session ID. The five-second minimum matches the existing product's intent. Breaks do not become sessions.

Valid new segments are allocated across actual local calendar days and hours, including midnight and local timezone transitions. Legacy sessions without segments remain attributed to their saved date. Sessions with estimated start times contribute to total duration but are excluded from productive-hour conclusions. Changing recorded duration/date preserves original timing in `extras.originalTiming`.

The history index is memoized by subject/session/entry array identity and current local date. It contains day and subject/day maps, per-subject sessions, hourly totals and sorted history. UI timer ticks are isolated from the index. Lists show a bounded number of rows with an explicit “load more” action. At 10,000 sessions indexing is linear plus sorting; no cell scans the full session list.

## Account and cloud ownership

Guest data stays in `guest`. Each authenticated user has `account:<user UUID>`. Sign-in does not itself merge guest data. The settings screen reads remote counts, then lets the user open account data alone or include guest history. Exact pre-merge backups stay on the device. Logging out retains account data in its separate cache.

Postgres RLS is the authorization boundary. Every relation uses `user_id`, explicit authenticated grants and owner checks. Parent references include both user ID and subject ID. Both RPCs also require `expected_user_id`, so a changed access token cannot redirect an in-flight sync into a different account.

`SyncEngine` pulls a remote snapshot, merges against the last acknowledged common ancestor, preserves conflicts, commits locally and uploads against the remote revision. The server locks the user's revision row and commits all relations in one transaction. A stale write is rejected; retry pulls and merges again. Network failures leave the local document intact. Active timers are device-local and omitted from cloud payloads.

Records use tombstones for deletion. Import and cloud merges retain unknown fields and conflict versions. Same-name subject aliases remain as deleted relational rows so repeated cloud round trips are stable. Equivalent manual day marks use sets in analytics, preserving original source identifiers without inflating totals.

## PWA and future extensions

The postbuild script enumerates all immutable Next assets and computes a build identifier. Installation caches those assets and the public shell before offline is available. A changed worker waits for old tabs to close. Supabase requests, auth callbacks, token-bearing URLs and authorization headers are never cached.

The local assistant makes no AI request and explicitly avoids inferring knowledge proficiency from time spent. An optional authenticated server-backed provider implements the chat interface with explicit opt-in data sharing and server-held credentials.

Cloud synchronization currently exchanges complete snapshots. This is straightforward to audit at the requested 10,000-session scale; substantially larger histories should move to per-record dirty queues and paginated pull, with the same revision/conflict semantics. This is a documented future optimization, not a claim that incremental sync already exists.

## v4 study world

The existing shell, timer, repository, analytics and account layers remain. The home surface now uses `components/world/study-room.tsx`; the full timer is reused with a compact presentation. Focus mode hides navigation and exits without changing timer state. Room art and six original companions are resolution-independent SVG components; CSS animations respect reduced motion. `lib/world/config.ts` defines five themes and validated room preferences. Design-specific CSS changes shapes, surfaces and typography as well as palette.

`lib/world/planner.ts` generates reviewable, editable schedules from bounded local input. Committing a plan creates the goal and tasks in one store mutation. A task-started timer snapshots task/goal IDs, and the saved session carries them into progress calculations. Task checkmarks do not create study time. Daily XP is computed from unedited, measured sessions with spans, capped at 60/day, and manual marks cannot award it.

`MusicProvider` is the playback contract. Browser soundscapes and official YouTube player adapters implement it. The persistent player lives outside view content; namespace changes dispose audio. Music volume/mute preferences are small device-local preferences, while saved YouTube sources sync as record entities. Heavy sound generation, YouTube code, room customization, statistics and the assistant are loaded only when needed.

The chat uses a local deterministic provider by default. The optional online provider calls a Node API route; authenticated allowlisted users, a private database quota and bounded payload/output sizes control access. No AI key is exposed to browser code. Session notes remain local by default. An independent opt-in shares the five newest notes from the last seven days, capped at 500 characters each. A namespace change remounts page content and prevents an old chat from publishing a response into another account.

## v4.1: complete the study loop

No top-level collections, database tables, storage names or export version change. `lib/world/milestones.ts` defines validated optional `studyGoals[].extras.studyPlan` metadata (version 1, description, weeklyDays, stable milestone IDs/titles). Tasks carry `extras.milestoneId`; a started timer snapshots goal/task/milestone IDs and task title. Saved sessions keep that snapshot when tasks are later rescheduled or reassigned. Whole-goal conflicts use the existing three-way conflict preservation. Invalid optional metadata remains in the underlying extras payload; readers only render valid fields.

New plan previews distribute tasks across reviewable milestones and commit atomically. Existing goals receive no generated stages or rewritten tasks during load. The goal editor changes metadata and targets; the task editor explicitly changes schedules/stage links, guards stale edits and blocks edits while that task's timer is active. Each saved completion stores `extras.completedOn`, so moving a completed task does not move its historical completion day. Old completions with no timestamp are labelled using their planned day.

Goal weekly minutes now include only linked sessions, allocated across real midnight/week boundaries using the same allocation function as statistics. Other study on the same subject does not inflate that goal. The coach compares remaining goal minutes with approximate remaining study days; these are schedule suggestions, not proficiency estimates. Home uses the same goal and weekly calculations. Starting study enters focus mode; changing pages and exiting focus preserve the running timer. Notes can be opened during focus.

Music preferences keep the old namespace key and volume/mute fields, adding defaultCategory, rememberLast and lastPlayed. A shared preference event keeps the settings screen and player aligned; playback changes only on a user action. Theme recommendations are metadata in `lib/music/catalog.ts`. New furniture stays in `world.extras.furniture`. No secret or personal notes are stored in these preference keys.

Guest reset serializes with other store operations, requires no active timer, completes a full backup before a revision-checked write, retains account namespaces/backups and refuses stale writes. Migration now accepts the stored-document envelopes already produced by previous upgrade backups. The PWA settings indicator reads worker installation/update state; browser/device offline verification is still a separate deployment gate.
