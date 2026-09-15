# v2 / v3 → v4 migration and recovery

## Guarantees

1. The original `tracker-data` value is left untouched.
2. An exact source backup must succeed before the first migrated document is saved.
3. Parsing failure does not create an empty successful migration.
4. Numeric IDs become equivalent text IDs. Existing string IDs remain unchanged.
5. Session seconds, notes, recorded timestamps, goals and achievement dates are retained.
6. Unknown properties are carried in `extras`; malformed rows go to `quarantine` with their original value and reason.
7. Re-importing an identical session ID is idempotent. Conflicting values retain both versions.
8. Two active timers cannot become one silently. The local timer is retained; a second imported timer is saved in quarantine for explicit recovery.

## First load on the same origin

The repository checks for an existing document first. If none exists, it reads the host storage when present, then the local v2 key. An outstanding `tracker-data:pending:v2` journal is recovered only when its base matches the source. Mismatched journal payloads are separately backed up for manual recovery. The exact source and recovery journal are preserved before migration.

A v4 installation on a different origin cannot read the previous origin's storage. Export JSON in v2, then import it in v4. Opening two different filesystem copies is also not a reliable way to share browser storage.

## Backups and imports

The import screen previews source session count, merged count, quarantined records and conflicts. It saves the incoming bytes and a snapshot of the current document before merging. Settings exposes backup downloads and **merge restore**. Restore is additive/conflict-aware; it does not silently replace all current work with an old snapshot.

Exports have `format: "togtmol-backup"`, `version: 4`, `exportedAt`, and `data`. The live timer is exported as a paused snapshot so moving an old file later does not accumulate unattended time. Exporting does not pause the on-screen timer.

## Deletion and restoration

Session, subject and task deletion sets `deletedAt`; stale devices cannot silently resurrect an older active copy. Trash restoration sets a new timestamp. Restoring a subject also restores children deleted in the same operation, leaving previously deleted children in trash. Restoring an individual session or task restores an archived parent when needed.

## Recovery procedure

1. Keep the v2 HTML, original JSON export and any downloaded recovery files.
2. If initial loading fails, use **Эх өгөгдлөө татах**; do not clear browser storage.
3. Import a known-good file in a working v4 instance and review the preview.
4. Check `quarantine` for records needing repair. Correct only a copy of that file, retaining the original.
5. Resolve conflicts in Settings; the alternative versions remain recorded for audit.
6. Export the final merged document to a separate file.

Local backups share the browser's storage quota and are not off-device protection. No automatic deletion of old backups is performed in this version.

## Upgrading an installed v3

The database name, storage prefix, note-journal keys, namespaces and BroadcastChannel stay unchanged intentionally. `Repository.load` validates and normalizes the old document, backs up the **entire stored envelope**, then performs a revision-checked v4 write. Backup failure stops the write; a concurrent winner is reloaded. A subsequent read does not create another upgrade backup. The localStorage fallback retains the exact source string in the upgrade backup.

v4 adds `studyGoals`, `musicSources`, task `goalId`, and `settings.world`. Session/timer task and goal associations use retained extras. Existing sessions, manual marks, IDs, notes, original timestamps, achievements and active timer values remain intact. New collections participate in the same three-way merge and conflict resolver; duplicate subject alias remapping also covers study goals. Old cloud baselines are normalized before merging.

Apply the additive v4 SQL migration before deploying a v4 cloud client. Both RPCs then use schema 4. Old v3 uploads fail instead of overwriting v4 preferences or new collections. Do not roll back the client alone against an upgraded database; restore a reviewed backup in an isolated environment if a rollback is needed.
