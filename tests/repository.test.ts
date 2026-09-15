import { describe, it, expect } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { Repository, RevisionError } from "@/lib/persistence/repository";
import { StudyStore } from "@/lib/persistence/store";
import { actions } from "@/lib/persistence/actions";
import { fixture, MemoryStorage } from "./fixtures";
describe("durable storage", () => {
  it("backs up exact v2 JSON before migration and never changes tracker-data", async () => {
    const storage = new MemoryStorage(),
      raw = JSON.stringify({ ...fixture(), schemaVersion: 2 }),
      repo = new Repository(new IDBFactory(), storage);
    storage.setItem("tracker-data", raw);
    const d = await repo.initialize("guest");
    expect(d.data.schemaVersion).toBe(4);
    expect(storage.getItem("tracker-data")).toBe(raw);
    expect((await repo.backups("guest"))[0].raw).toBe(raw);
    await repo.close();
  });
  it("does not overwrite corrupted legacy data with an empty document", async () => {
    const storage = new MemoryStorage(),
      repo = new Repository(new IDBFactory(), storage);
    storage.setItem("tracker-data", "{broken");
    await expect(repo.initialize("guest")).rejects.toThrow();
    expect(await repo.load("guest")).toBeNull();
    expect((await repo.backups("guest"))[0].raw).toBe("{broken");
    await repo.close();
  });
  it("recovers the v2 pending write only when its base matches", async () => {
    const storage = new MemoryStorage(),
      repo = new Repository(new IDBFactory(), storage),
      old = JSON.stringify(fixture()),
      pending = fixture();
    pending.sessions[0].note = "Recovered";
    storage.setItem("tracker-data", old);
    storage.setItem(
      "tracker-data:pending:v2",
      JSON.stringify({ base: old, payload: JSON.stringify(pending) }),
    );
    expect((await repo.initialize("guest")).data.sessions[0].note).toBe(
      "Recovered",
    );
    expect(storage.getItem("tracker-data")).toBe(old);
    await repo.close();
  });
  it("atomically rejects a stale write from another tab", async () => {
    const factory = new IDBFactory(),
      storage = new MemoryStorage(),
      a = new Repository(factory, storage),
      b = new Repository(factory, storage);
    const initial = await a.initialize("guest");
    const results = await Promise.allSettled([
      a.save("guest", fixture(), initial.revision),
      b.save("guest", fixture(), initial.revision),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toHaveProperty(
      "reason",
      expect.any(RevisionError),
    );
    expect((await a.load("guest"))?.revision).toBe(2);
    await a.close();
    await b.close();
  });
  it("keeps guest and two account namespaces separate", async () => {
    const repo = new Repository(new IDBFactory(), new MemoryStorage());
    await repo.initialize("guest");
    await repo.initialize("account:a");
    await repo.initialize("account:b");
    await repo.save("account:a", fixture(), 1);
    expect((await repo.load("guest"))?.data.sessions).toHaveLength(0);
    expect((await repo.load("account:b"))?.data.sessions).toHaveLength(0);
    expect((await repo.load("account:a"))?.data.sessions).toHaveLength(1);
    await repo.close();
  });
  it("serializes rapid mutations and refreshes after revision conflicts", async () => {
    const repo = new Repository(new IDBFactory(), new MemoryStorage()),
      store = new StudyStore(repo);
    await store.initialize();
    await Promise.all([
      store.mutate(actions.addSubject("A", "#e6c75a")),
      store.mutate(actions.addSubject("B", "#e6c75a")),
    ]);
    expect(store.getSnapshot().data.subjects).toHaveLength(2);
    await repo.save("guest", fixture(), store.getSnapshot().revision);
    await expect(
      store.mutate(actions.addSubject("C", "#e6c75a")),
    ).rejects.toBeInstanceOf(RevisionError);
    expect(store.getSnapshot().data.sessions).toHaveLength(1);
    store.destroy();
  });
  it("pre-import backups and source files survive merging", async () => {
    const repo = new Repository(new IDBFactory(), new MemoryStorage()),
      store = new StudyStore(repo);
    await store.initialize();
    await store.importData(JSON.stringify(fixture()));
    expect(store.getSnapshot().data.sessions).toHaveLength(1);
    expect(await repo.backups("guest")).toHaveLength(2);
    store.destroy();
  });
});
