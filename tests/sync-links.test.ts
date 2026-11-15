import { describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  SyncEngine,
  cloudData,
  type CloudAdapter,
  type CloudSnapshot,
} from "@/lib/supabase/sync";
import { StudyStore } from "@/lib/persistence/store";
import { Repository } from "@/lib/persistence/repository";
import { emptyData } from "@/lib/constants";
import { fixture, MemoryStorage } from "./fixtures";
import { note, topic } from "./knowledge-fixtures";
import type { StudyData } from "@/types/study";

class Cloud implements CloudAdapter {
  snapshot: CloudSnapshot = { revision: 0, data: emptyData() };
  pushes = 0;
  async pull() {
    return structuredClone(this.snapshot);
  }
  async push(_userId: string, revision: number, data: StudyData) {
    this.pushes += 1;
    this.snapshot = {
      revision: revision + 1,
      data: structuredClone(cloudData(data)),
    };
    return this.snapshot.revision;
  }
}

async function setup() {
  const store = new StudyStore(
    new Repository(new IDBFactory(), new MemoryStorage()),
  );
  await store.initialize();
  await store.switchNamespace("account:a");
  const cloud = new Cloud(),
    engine = new SyncEngine(store, cloud, "a");
  return { store, cloud, engine };
}

describe("cloud pull with broken topic links", () => {
  it("stops before merging and uploads nothing", async () => {
    const { store, cloud, engine } = await setup();
    const local = fixture();
    await store.mutate(() => local);
    cloud.snapshot = {
      revision: 3,
      data: {
        ...fixture(),
        knowledge: [topic(), { ...note(), id: "bad", topicId: "nope" }],
      },
    };
    await expect(engine.sync()).rejects.toThrow(/Мэдлэгийн холбоос буруу/);
    expect(store.getSnapshot().data.knowledge).toEqual(local.knowledge);
    expect(cloud.pushes).toBe(0);
    store.destroy();
  });

  it("accepts a schema 5 snapshot that predates topics", async () => {
    const { store, cloud, engine } = await setup();
    cloud.snapshot = {
      revision: 2,
      data: { ...fixture(), schemaVersion: 5 } as unknown as StudyData,
    };
    await engine.sync();
    expect(store.getSnapshot().data.schemaVersion).toBe(6);
    store.destroy();
  });

  it("merges a valid snapshot", async () => {
    const { store, cloud, engine } = await setup();
    const remote = {
      ...fixture(),
      knowledge: [topic(), { ...note(), id: "ok", topicId: "topic-1" }],
    };
    cloud.snapshot = { revision: 1, data: remote };
    await engine.sync();
    const merged = store
      .getSnapshot()
      .data.knowledge.find((r) => r.id === "ok");
    expect(merged?.topicId).toBe("topic-1");
    store.destroy();
  });
});
