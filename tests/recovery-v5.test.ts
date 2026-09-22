import { afterEach, describe, expect, it, vi } from "vitest";
import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import { Repository, RevisionError } from "@/lib/persistence/repository";
import { StudyStore } from "@/lib/persistence/store";
import { knowledgeFixture, note } from "./knowledge-fixtures";
import { MemoryStorage, fixture } from "./fixtures";
import { migrate } from "@/lib/migration/migrate";
import { saveKnowledge } from "@/lib/knowledge/actions";
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("v5 recovery and IndexedDB records", () => {
  it("starts with working IndexedDB when localStorage accessor throws SecurityError", async () => {
    vi.stubGlobal("window", {
      get localStorage() {
        throw new DOMException("Denied", "SecurityError");
      },
    });
    vi.stubGlobal("indexedDB", new IDBFactory());
    const repo = new Repository();
    expect((await repo.initialize("guest")).data.schemaVersion).toBe(5);
    await repo.save("guest", knowledgeFixture(), 1);
    expect((await repo.load("guest"))?.data.knowledge).toHaveLength(5);
    await repo.close();
  });
  it("allows a failed database open to be retried without deleting storage", async () => {
    const factory = new IDBFactory(),
      original = factory.open.bind(factory);
    vi.spyOn(factory, "open")
      .mockImplementationOnce(() => {
        throw new DOMException("Temporarily blocked", "SecurityError");
      })
      .mockImplementation(original);
    const repo = new Repository(factory, new MemoryStorage());
    await expect(repo.initialize("guest")).rejects.toThrow(
      "Temporarily blocked",
    );
    expect((await repo.initialize("guest")).revision).toBe(1);
    await repo.close();
  });
  it("backs up corrupt fallback JSON exactly and only replaces it after explicit recovery", async () => {
    const storage = new MemoryStorage();
    storage.setItem("togtmol:v3:guest", "{corrupt source");
    vi.stubGlobal("navigator", {
      locks: { request: async (_key: string, work: () => unknown) => work() },
    });
    const repo = new Repository(undefined, storage);
    await expect(repo.load("guest")).rejects.toThrow();
    expect((await repo.backups("guest"))[0].raw).toBe("{corrupt source");
    expect(await repo.rawDocument("guest")).toBe("{corrupt source");
    const result = await repo.recover(
      "guest",
      JSON.stringify(knowledgeFixture()),
    );
    expect(result.revision).toBe(1);
    expect(result.data.knowledge).toHaveLength(5);
    expect(
      (await repo.backups("guest")).some((b) => b.raw === "{corrupt source"),
    ).toBe(true);
  });
  it("refuses recovery if the backup cannot be persisted or another tab writes during it", async () => {
    const factory = new IDBFactory(),
      repo = new Repository(factory, new MemoryStorage()),
      other = new Repository(factory, new MemoryStorage());
    const original = await repo.save("guest", knowledgeFixture(), 0),
      raw = await repo.rawDocument("guest");
    const backup = vi
      .spyOn(repo, "backup")
      .mockRejectedValueOnce(Error("Quota"));
    await expect(repo.recover("guest", null)).rejects.toThrow("Quota");
    expect(await repo.rawDocument("guest")).toBe(raw);
    backup.mockRestore();
    const saveBackup = repo.backup.bind(repo);
    vi.spyOn(repo, "backup").mockImplementationOnce(async (ns, label, raw) => {
      const b = await saveBackup(ns, label, raw);
      await other.save("guest", fixture(), original.revision);
      return b;
    });
    await expect(repo.recover("guest", null)).rejects.toBeInstanceOf(
      RevisionError,
    );
    expect((await repo.load("guest"))?.revision).toBe(2);
    expect((await repo.backups("guest")).some((b) => b.raw === raw)).toBe(true);
    await repo.close();
    await other.close();
  });
  it("stores knowledge separately, avoids rewriting images on settings edits, and restores all records", async () => {
    const factory = new IDBFactory(),
      repo = new Repository(factory, new MemoryStorage()),
      data = knowledgeFixture();
    await repo.save("guest", data, 0);
    const spy = vi.spyOn(IDBObjectStore.prototype, "put");
    await repo.save(
      "guest",
      { ...data, settings: { ...data.settings, sound: true } },
      1,
    );
    const stores = spy.mock.contexts.map((s) => (s as IDBObjectStore).name);
    expect(stores).not.toContain("knowledge");
    spy.mockRestore();
    const reopened = new Repository(factory, new MemoryStorage()),
      loaded = await reopened.load("guest");
    expect(loaded?.data.knowledge.find((r) => r.id === "note-1")).toEqual(
      note(),
    );
    const edited = saveKnowledge(
      { ...note(), body: "Зассан" },
      note().updatedAt,
    )(loaded!.data);
    await reopened.save("guest", edited, loaded!.revision);
    expect(
      (await repo.load("guest"))?.data.knowledge.find((r) => r.id === "note-1"),
    ).toMatchObject({ body: "Зассан" });
    const backup = JSON.stringify(loaded);
    await repo.recover("guest", null);
    expect((await repo.load("guest"))?.data.knowledge).toHaveLength(0);
    await repo.recover("guest", backup);
    expect((await repo.load("guest"))?.data.knowledge).toHaveLength(5);
    // The first edit after an inline recovery must populate the separate object store too.
    const restored = await repo.load("guest");
    await repo.save(
      "guest",
      {
        ...restored!.data,
        settings: { ...restored!.data.settings, sound: false },
      },
      restored!.revision,
    );
    expect((await reopened.load("guest"))?.data.knowledge).toHaveLength(5);
    await repo.close();
    await reopened.close();
  });
  it("makes one daily backup and includes history and music settings in portable exports", async () => {
    const repo = new Repository(new IDBFactory(), new MemoryStorage()),
      store = new StudyStore(repo);
    await store.switchNamespace("guest");
    await store.mutate(() => ({
      ...knowledgeFixture(),
      extras: {
        bondookMessages: [
          {
            id: "m1",
            createdAt: 1,
            role: "user",
            kind: "local",
            text: "Сайн уу",
          },
        ],
      },
    }));
    await store.mutate((d) => ({
      ...d,
      settings: {
        ...d.settings,
        extras: { musicPreferences: { volume: 0.4, muted: true } },
      },
    }));
    expect(
      (await repo.backups("guest")).filter(
        (b) => b.label === "Өдрийн автомат нөөц",
      ),
    ).toHaveLength(1);
    const exported = store.exportData(),
      restored = migrate(exported);
    expect(exported).toMatchObject({ app: "togtmol", version: 5 });
    expect(restored.extras.bondookMessages).toHaveLength(1);
    expect(restored.settings.extras.musicPreferences).toMatchObject({
      volume: 0.4,
      muted: true,
    });
    expect(restored.knowledge).toHaveLength(5);
    store.destroy();
  });
  it("targets recovery at the failed account and prevents an import from crossing account switches", async () => {
    const repo = new Repository(new IDBFactory(), new MemoryStorage()),
      store = new StudyStore(repo);
    await store.switchNamespace("guest");
    await store.mutate(() => knowledgeFixture());
    const initialize = vi
      .spyOn(repo, "initialize")
      .mockRejectedValueOnce(Error("Invalid account data"));
    await expect(store.switchNamespace("account:a")).rejects.toThrow();
    expect(store.getSnapshot()).toMatchObject({
      namespace: "account:a",
      ready: false,
    });
    expect(store.getSnapshot().data.knowledge).toHaveLength(0);
    initialize.mockRestore();
    await store.switchNamespace("guest");
    const original = repo.backup.bind(repo);
    vi.spyOn(repo, "backup").mockImplementationOnce(async (ns, label, raw) => {
      const b = await original(ns, label, raw);
      await store.switchNamespace("account:b");
      return b;
    });
    await expect(
      store.importData(JSON.stringify(knowledgeFixture())),
    ).rejects.toThrow(/Бүртгэл/);
    expect(store.getSnapshot().data.knowledge).toHaveLength(0);
    store.destroy();
  });
  it("requires disabled cloud sync before clearing an account's local copy and retains a recoverable backup", async () => {
    const repo = new Repository(new IDBFactory(), new MemoryStorage()),
      store = new StudyStore(repo);
    await store.switchNamespace("account:a");
    await store.mutate(() => knowledgeFixture());
    await repo.setMetadata("account-enabled:a", true);
    await expect(store.clearLocalData()).rejects.toThrow(/синк/);
    await repo.setMetadata("account-enabled:a", false);
    await store.clearLocalData();
    expect(store.getSnapshot().data.knowledge).toHaveLength(0);
    const backup = (await repo.backups("account:a")).find((b) =>
      b.label.includes("цэвэрлэхийн"),
    )!;
    expect(migrate(JSON.parse(backup.raw)).knowledge).toHaveLength(5);
    store.destroy();
  });
  it("claims a daily reminder only once across concurrent windows", async () => {
    const factory = new IDBFactory(),
      a = new Repository(factory),
      b = new Repository(factory);
    const claims = await Promise.all([
      a.claimOnce("reminder:a", "today"),
      b.claimOnce("reminder:a", "today"),
    ]);
    expect(claims.sort()).toEqual([false, true]);
    expect(await b.claimOnce("reminder:b", "today")).toBe(true);
    await a.close();
    await b.close();
  });
});
