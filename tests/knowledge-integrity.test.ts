import { describe, expect, it } from "vitest";
import {
  assertKnowledgeLinks,
  topicParentOptions,
  validateKnowledgeLinks,
} from "@/lib/knowledge/integrity";
import { recordBase } from "@/lib/knowledge/actions";
import { NOW } from "./fixtures";
import type { FlashcardDeck, StudyNote, StudyTopic } from "@/types/knowledge";

const topic = (id: string, over: Partial<StudyTopic> = {}): StudyTopic => ({
  ...recordBase(id, "math", [], NOW),
  id,
  kind: "topic",
  parentId: null,
  description: "",
  ...over,
});
const note = (id: string, over: Partial<StudyNote> = {}): StudyNote => ({
  ...recordBase(id, "math", [], NOW),
  id,
  kind: "note",
  body: "",
  date: "2026-09-15",
  image: null,
  links: [],
  ...over,
});
const deck = (
  id: string,
  over: Partial<FlashcardDeck> = {},
): FlashcardDeck => ({
  ...recordBase(id, "math", [], NOW),
  id,
  kind: "deck",
  description: "",
  ...over,
});

describe("validateKnowledgeLinks", () => {
  it("accepts a topic in the same subject and a matching parent", () => {
    const records = [
      topic("root"),
      topic("child", { parentId: "root" }),
      note("n", { topicId: "child" }),
      deck("d", { topicId: "root", sourceId: "missing-note" }),
    ];
    expect(validateKnowledgeLinks(records)).toEqual([]);
  });

  it("rejects a missing topic, a cross-subject topic and a deleted topic", () => {
    const records = [
      topic("math-topic"),
      topic("gone", { deletedAt: NOW }),
      topic("physics-topic", { subjectId: "physics" }),
      note("missing", { topicId: "nope" }),
      note("cross", { topicId: "physics-topic" }),
      note("deleted", { topicId: "gone" }),
    ];
    const codes = validateKnowledgeLinks(records).map((i) => i.code);
    expect(codes).toEqual([
      "missing-topic",
      "cross-subject-topic",
      "deleted-topic",
    ]);
    expect(
      validateKnowledgeLinks(records).every((i) => i.field === "topicId"),
    ).toBe(true);
  });

  it("rejects a self parent, a missing parent, a cross-subject parent and deleted parent", () => {
    const records = [
      topic("self", { parentId: "self" }),
      topic("orphan", { parentId: "nope" }),
      topic("physics", { subjectId: "physics" }),
      topic("cross", { parentId: "physics" }),
      topic("dead", { deletedAt: NOW }),
      topic("points-at-dead", { parentId: "dead" }),
    ];
    const codes = validateKnowledgeLinks(records).map((i) => i.code);
    expect(codes).toEqual([
      "self-parent",
      "missing-parent",
      "cross-subject-parent",
      "deleted-parent",
    ]);
  });

  it("rejects a cycle across several topics", () => {
    const records = [
      topic("a", { parentId: "c" }),
      topic("b", { parentId: "a" }),
      topic("c", { parentId: "b" }),
    ];
    const issues = validateKnowledgeLinks(records);
    // Every member of the loop is reported, so the report names the whole cycle.
    expect(issues.map((i) => i.code)).toEqual(["cycle", "cycle", "cycle"]);
    expect(issues.map((i) => i.recordId)).toEqual(["a", "b", "c"]);
  });

  it("reports every problem instead of stopping at the first one", () => {
    const records = [
      note("n1", { topicId: "nope" }),
      note("n2", { topicId: "nope-2" }),
    ];
    expect(validateKnowledgeLinks(records)).toHaveLength(2);
  });
});

describe("topicParentOptions", () => {
  const tree = () => [
    topic("a"),
    topic("b", { parentId: "a" }),
    topic("c", { parentId: "b" }),
    topic("d"),
  ];

  it("excludes the topic itself and all of its descendants", () => {
    expect(topicParentOptions(tree(), "a").map((t) => t.id)).toEqual(["d"]);
    expect(topicParentOptions(tree(), "b").map((t) => t.id)).toEqual([
      "a",
      "d",
    ]);
    expect(topicParentOptions(tree(), "c").map((t) => t.id)).toEqual([
      "a",
      "b",
      "d",
    ]);
  });

  it("offers every topic for a new topic", () => {
    expect(topicParentOptions(tree())).toHaveLength(4);
    expect(topicParentOptions(tree(), "new-id")).toHaveLength(4);
  });
});

describe("assertKnowledgeLinks", () => {
  it("throws a message that names the records", () => {
    expect(() =>
      assertKnowledgeLinks([note("n", { topicId: "nope" })]),
    ).toThrow(/Мэдлэгийн холбоос буруу[\s\S]*байхгүй сэдэв/);
  });

  it("passes a clean graph through", () => {
    expect(() =>
      assertKnowledgeLinks([topic("t"), note("n", { topicId: "t" })]),
    ).not.toThrow();
  });
});
