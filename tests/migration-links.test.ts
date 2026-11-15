import { describe, expect, it } from "vitest";
import { migrate } from "@/lib/migration/migrate";
import { fixture } from "./fixtures";
import { note, topic } from "./knowledge-fixtures";

const broken = () => ({
  ...fixture(),
  knowledge: [
    topic(),
    { ...topic(), id: "topic-child", parentId: "missing-root" },
    note(),
    { ...note(), id: "note-bad", topicId: "missing-topic" },
  ],
});

describe("schema 6 link policy on load", () => {
  it("keeps every record and detaches only the broken links", () => {
    const out = migrate(broken());
    expect(out.knowledge).toHaveLength(4);
    const child = out.knowledge.find((r) => r.id === "topic-child")!;
    expect(child.kind === "topic" && child.parentId).toBeNull();
    const bad = out.knowledge.find((r) => r.id === "note-bad")!;
    expect(bad.topicId).toBeUndefined();
    expect(out.quarantine.map((q) => q.reason).join(" ")).toMatch(
      /байхгүй (эх сэдэв|сэдэв)/,
    );
    expect(out.quarantine.every((q) => q.collection === "knowledge")).toBe(
      true,
    );
  });

  it("leaves a valid graph untouched and reports nothing", () => {
    const out = migrate({
      ...fixture(),
      knowledge: [topic(), { ...topic(), id: "child", parentId: "topic-1" }],
    });
    expect(out.quarantine).toHaveLength(0);
    expect(
      out.knowledge.find((r) => r.id === "child")?.kind === "topic" &&
        (out.knowledge.find((r) => r.id === "child") as { parentId: string })
          .parentId,
    ).toBe("topic-1");
  });

  it("fails instead of repairing when the caller is strict", () => {
    expect(() => migrate(broken(), { strictLinks: true })).toThrow(
      /Мэдлэгийн холбоос буруу/,
    );
  });
});
