import type { KnowledgeRecord, StudyTopic } from "@/types/knowledge";

export type KnowledgeLinkIssueCode =
  | "missing-topic"
  | "deleted-topic"
  | "cross-subject-topic"
  | "missing-parent"
  | "deleted-parent"
  | "self-parent"
  | "cross-subject-parent"
  | "cycle";

export interface KnowledgeLinkIssue {
  recordId: string;
  field: "topicId" | "parentId";
  code: KnowledgeLinkIssueCode;
  message: string;
}

const topicName = (topic: StudyTopic | undefined, id: string) =>
  topic ? `«${topic.title}»` : id;

/**
 * Checks the topic graph the whole way across records, which per-record
 * validation cannot do: a link may point at nothing, at another subject, or
 * form a loop. Returns every issue instead of the first one so a report can
 * name all of them. `sourceId` is deliberately not checked: a deck may keep
 * pointing at a note the user deleted, and the UI says so.
 */
export function validateKnowledgeLinks(
  records: KnowledgeRecord[],
): KnowledgeLinkIssue[] {
  const topics = new Map<string, StudyTopic>();
  for (const record of records)
    if (record.kind === "topic") topics.set(record.id, record);
  const issues: KnowledgeLinkIssue[] = [];
  for (const record of records) {
    if (record.topicId) {
      const topic = topics.get(record.topicId);
      if (!topic)
        issues.push({
          recordId: record.id,
          field: "topicId",
          code: "missing-topic",
          message: `«${record.title}» байхгүй сэдэв рүү зааж байна.`,
        });
      else if (topic.deletedAt)
        issues.push({
          recordId: record.id,
          field: "topicId",
          code: "deleted-topic",
          message: `«${record.title}» устсан сэдэв ${topicName(topic, topic.id)} рүү зааж байна.`,
        });
      else if (topic.subjectId !== record.subjectId)
        issues.push({
          recordId: record.id,
          field: "topicId",
          code: "cross-subject-topic",
          message: `«${record.title}» өөр хичээлийн сэдэв ${topicName(topic, topic.id)} рүү зааж байна.`,
        });
    }
    if (record.kind !== "topic" || !record.parentId) continue;
    const parent = topics.get(record.parentId);
    if (!parent)
      issues.push({
        recordId: record.id,
        field: "parentId",
        code: "missing-parent",
        message: `«${record.title}» байхгүй эх сэдэв рүү зааж байна.`,
      });
    else if (parent.deletedAt)
      issues.push({
        recordId: record.id,
        field: "parentId",
        code: "deleted-parent",
        message: `«${record.title}» устсан эх сэдэв ${topicName(parent, parent.id)} рүү зааж байна.`,
      });
    else if (parent.id === record.id)
      issues.push({
        recordId: record.id,
        field: "parentId",
        code: "self-parent",
        message: `«${record.title}» өөрийгөө эх сэдэв болгосон байна.`,
      });
    else if (parent.subjectId !== record.subjectId)
      issues.push({
        recordId: record.id,
        field: "parentId",
        code: "cross-subject-parent",
        message: `«${record.title}»-ийн эх сэдэв өөр хичээлийн байна.`,
      });
    else if (hasCycle(record, topics))
      issues.push({
        recordId: record.id,
        field: "parentId",
        code: "cycle",
        message: `«${record.title}»-ийн эх сэдвийн шатлал эргэлдэж байна.`,
      });
  }
  return issues;
}

function hasCycle(start: StudyTopic, topics: Map<string, StudyTopic>): boolean {
  const seen = new Set<string>([start.id]);
  let cursor = start.parentId ? topics.get(start.parentId) : undefined;
  while (cursor) {
    if (seen.has(cursor.id)) return true;
    seen.add(cursor.id);
    cursor = cursor.parentId ? topics.get(cursor.parentId) : undefined;
  }
  return false;
}

/**
 * Topics that may be chosen as the parent of `recordId`: the record itself and
 * everything below it are excluded, so the picker cannot build a cycle. The
 * storage layer still validates the graph; this only keeps the choice sane.
 */
export function topicParentOptions(
  topics: StudyTopic[],
  recordId?: string,
): StudyTopic[] {
  if (!recordId) return topics;
  const blocked = new Set([recordId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const topic of topics)
      if (
        topic.parentId &&
        blocked.has(topic.parentId) &&
        !blocked.has(topic.id)
      ) {
        blocked.add(topic.id);
        changed = true;
      }
  }
  return topics.filter((topic) => !blocked.has(topic.id));
}

export function knowledgeLinkError(issues: KnowledgeLinkIssue[]): Error {
  const listed = issues
    .slice(0, 5)
    .map((issue) => `• ${issue.message}`)
    .join("\n");
  return Error(`Мэдлэгийн холбоос буруу байна:\n${listed}`);
}

/** Strict policy: used by import and cloud pull, which must not merge a bad graph. */
export function assertKnowledgeLinks(records: KnowledgeRecord[]) {
  const issues = validateKnowledgeLinks(records);
  if (issues.length) throw knowledgeLinkError(issues);
}
