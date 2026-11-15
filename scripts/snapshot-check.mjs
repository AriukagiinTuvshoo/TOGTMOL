export const EXPECTED_SCHEMA_VERSION = 6;

/**
 * Returns a human-readable problem with a production snapshot, or null when the
 * snapshot can be accepted. Shared with the unit test so the smoke test cannot
 * silently drift back to an older schema.
 */
export function snapshotProblem(snapshot) {
  if (!snapshot || typeof snapshot !== "object")
    return "The production database returned no study snapshot.";
  if (
    typeof snapshot.revision !== "number" ||
    !Number.isSafeInteger(snapshot.revision) ||
    snapshot.revision < 0
  )
    return "The production database returned a snapshot with an invalid revision.";
  const data = snapshot.data;
  if (!data || typeof data !== "object")
    return "The production database returned a snapshot without data.";
  if (data.schemaVersion !== EXPECTED_SCHEMA_VERSION)
    return `The production database returned a v${String(data.schemaVersion)} study snapshot, but this app requires v${EXPECTED_SCHEMA_VERSION}. Apply the latest Supabase migration before running the smoke test.`;
  return null;
}
