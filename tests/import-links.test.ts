import { describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { StudyStore } from "@/lib/persistence/store";
import { Repository } from "@/lib/persistence/repository";
import { fixture, MemoryStorage } from "./fixtures";
import { note, topic } from "./knowledge-fixtures";

async function setup() {
  const repo = new Repository(new IDBFactory(), new MemoryStorage()),
    store = new StudyStore(repo);
  await store.initialize();
  return { repo, store };
}

describe("import with broken topic links", () => {
  it("rejects the import and keeps the stored data", async () => {
    const { repo, store } = await setup();
    const before = store.getSnapshot().data;
    const bad = {
      ...fixture(),
      knowledge: [topic(), { ...note(), id: "note-bad", topicId: "nope" }],
    };
    await expect(store.importData(JSON.stringify(bad))).rejects.toThrow(
      /Мэдлэгийн холбоос буруу/,
    );
    expect(store.getSnapshot().data.sessions).toEqual(before.sessions);
    expect(store.getSnapshot().data.knowledge).toEqual(before.knowledge);
    expect((await repo.backups("guest")).map((b) => b.label)).not.toContain(
      "Импортолсон эх файл",
    );
    store.destroy();
  });

  it("imports a valid graph and keeps the source link", async () => {
    const { store } = await setup();
    const good = {
      ...fixture(),
      knowledge: [topic(), { ...note(), id: "note-ok", topicId: "topic-1" }],
    };
    await store.importData(JSON.stringify(good));
    const imported = store
      .getSnapshot()
      .data.knowledge.find((r) => r.id === "note-ok");
    expect(imported?.topicId).toBe("topic-1");
    store.destroy();
  });
});
