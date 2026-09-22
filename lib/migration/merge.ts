import { mergeMessages } from "@/lib/assistant/history";
import type {
  MergeCollection,
  MergeConflict,
  RecordBase,
  StudyData,
} from "@/types/study";
import { fingerprint, stable } from "./values";
const normalized = (name: string) =>
  name.trim().normalize("NFKC").toLocaleLowerCase();
function meaningful(value: unknown): string {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const copy = { ...value } as Record<string, unknown>;
    delete copy.updatedAt;
    return stable(copy);
  }
  return stable(value);
}
export function mergeData(
  local: StudyData,
  remoteInput: StudyData,
  base?: StudyData,
): StudyData {
  const remote = structuredClone(remoteInput),
    conflicts = new Map(
      [...local.conflicts, ...remote.conflicts].map((c) => [c.id, c]),
    );
  const aliases = new Map<string, string>(
    Object.entries({
      ...((local.extras.subjectAliases ?? {}) as Record<string, string>),
      ...((remote.extras.subjectAliases ?? {}) as Record<string, string>),
    }),
  );
  const localNames = new Map(
    local.subjects
      .filter((s) => !s.deletedAt)
      .map((s) => [normalized(s.name), s]),
  );
  const existingIds = new Set(local.subjects.map((s) => s.id));
  remote.subjects = remote.subjects.map((s) => {
    const match = localNames.get(normalized(s.name));
    if (match && !existingIds.has(s.id) && !s.deletedAt) {
      aliases.set(s.id, match.id);
      const stamp = Math.max(1, s.updatedAt, match.updatedAt);
      return {
        ...s,
        deletedAt: stamp,
        updatedAt: stamp,
        extras: { ...s.extras, mergedInto: match.id },
      };
    }
    return s;
  });
  for (const list of [
    remote.entries,
    remote.sessions,
    remote.tasks,
    remote.studyGoals,
  ])
    for (const r of list) r.subjectId = aliases.get(r.subjectId) ?? r.subjectId;
  for (const r of remote.knowledge)
    if (r.subjectId) r.subjectId = aliases.get(r.subjectId) ?? r.subjectId;
  const recordConflict = (
    collection: MergeCollection,
    id: string,
    kept: unknown,
    other: unknown,
  ) => {
    const cid = fingerprint([
      collection,
      id,
      ...[stable(kept), stable(other)].sort(),
    ]);
    if (!conflicts.has(cid))
      conflicts.set(cid, {
        id: cid,
        collection,
        recordId: id,
        kept,
        other,
        resolvedAt: null,
      });
  };
  function decide<T extends { updatedAt: number }>(
    a: T,
    b: T,
    old: T | undefined,
    collection: MergeCollection,
    id: string,
  ): T {
    if (meaningful(a) === meaningful(b))
      return a.updatedAt >= b.updatedAt ? a : b;
    if (old && meaningful(old) === meaningful(a)) return b;
    if (old && meaningful(old) === meaningful(b)) return a;
    const winner = a.updatedAt >= b.updatedAt ? a : b,
      other = winner === a ? b : a;
    recordConflict(collection, id, winner, other);
    return winner;
  }
  function mergeRecords<T extends RecordBase>(
    left: T[],
    right: T[],
    old: T[] | undefined,
    collection: MergeCollection,
  ): T[] {
    const merged = new Map(left.map((r) => [r.id, r])),
      prior = new Map(old?.map((r) => [r.id, r]));
    for (const r of right) {
      const existing = merged.get(r.id);
      merged.set(
        r.id,
        existing ? decide(existing, r, prior.get(r.id), collection, r.id) : r,
      );
    }
    return [...merged.values()];
  }
  const merged: StudyData = {
    ...local,
    subjects: mergeRecords(
      local.subjects,
      remote.subjects,
      base?.subjects,
      "subjects",
    ),
    entries: mergeRecords(
      local.entries,
      remote.entries,
      base?.entries,
      "entries",
    ),
    sessions: mergeRecords(
      local.sessions,
      remote.sessions,
      base?.sessions,
      "sessions",
    ),
    tasks: mergeRecords(local.tasks, remote.tasks, base?.tasks, "tasks"),
    studyGoals: mergeRecords(
      local.studyGoals,
      remote.studyGoals,
      base?.studyGoals,
      "studyGoals",
    ),
    musicSources: mergeRecords(
      local.musicSources,
      remote.musicSources,
      base?.musicSources,
      "musicSources",
    ),
    knowledge: mergeRecords(
      local.knowledge,
      remote.knowledge,
      base?.knowledge,
      "knowledge",
    ),
    goals: decide(local.goals, remote.goals, base?.goals, "goals", "goals"),
    settings: decide(
      local.settings,
      remote.settings,
      base?.settings,
      "settings",
      "settings",
    ),
    achievementsUnlocked: {
      ...remote.achievementsUnlocked,
      ...local.achievementsUnlocked,
    },
    activeTimer: local.activeTimer ?? remote.activeTimer,
    quarantine: [
      ...new Map(
        [...local.quarantine, ...remote.quarantine].map((q) => [
          fingerprint(q),
          q,
        ]),
      ).values(),
    ],
    conflicts: [],
    extras: { ...remote.extras, ...local.extras },
  };
  if (local.extras.bondookMessages || remote.extras.bondookMessages)
    merged.extras.bondookMessages = mergeMessages(
      local.extras.bondookMessages,
      remote.extras.bondookMessages,
    );
  // Keep all source IDs (including equivalent manual marks) for stable cloud round trips.
  // Analytics uses subject/date sets; toggling a day updates every equivalent mark.
  if (
    local.activeTimer &&
    remote.activeTimer &&
    local.activeTimer.id !== remote.activeTimer.id
  )
    merged.quarantine.push({
      collection: "activeTimer",
      index: 0,
      reason: "Хоёр timer зэрэг байсан тул хоёр дахь timer-ийг нөөцөлсөн",
      value: remote.activeTimer,
    });
  if (aliases.size)
    merged.extras.subjectAliases = {
      ...(merged.extras.subjectAliases as Record<string, string> | undefined),
      ...Object.fromEntries(aliases),
    };
  merged.conflicts = [...conflicts.values()];
  return merged;
}
export function resolveConflict(
  data: StudyData,
  conflict: MergeConflict,
  useOther: boolean,
  now: number,
): StudyData {
  let next = {
    ...data,
    conflicts: data.conflicts.map((c) =>
      c.id === conflict.id ? { ...c, resolvedAt: now } : c,
    ),
  };
  if (useOther) {
    const value = {
      ...(conflict.other as Record<string, unknown>),
      updatedAt: now,
    };
    if (conflict.collection === "goals")
      next = { ...next, goals: value as unknown as StudyData["goals"] };
    else if (conflict.collection === "settings")
      next = { ...next, settings: value as unknown as StudyData["settings"] };
    else
      next = {
        ...next,
        [conflict.collection]: (next[conflict.collection] as RecordBase[]).map(
          (r) => (r.id === conflict.recordId ? value : r),
        ),
      };
  }
  return next;
}
