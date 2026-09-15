import { describe, it, expect } from "vitest";
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
import { fixture, MemoryStorage, NOW } from "./fixtures";
class Cloud implements CloudAdapter {
  snapshot: CloudSnapshot = { revision: 0, data: emptyData() };
  pushes = 0;
  fail = false;
  async pull() {
    if (this.fail) throw Error("offline");
    return structuredClone(this.snapshot);
  }
  async push(
    userId: string,
    revision: number,
    data: ReturnType<typeof fixture>,
  ) {
    if (this.fail) throw Error("offline");
    if (revision !== this.snapshot.revision) throw Error("revision");
    this.pushes++;
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
describe("sync engine", () => {
  it("uploads, pulls, and does not repeatedly upload unchanged snapshots", async () => {
    const { store, cloud, engine } = await setup();
    await store.mutate(() => fixture());
    await engine.sync();
    expect(cloud.snapshot.data.sessions).toHaveLength(1);
    expect(cloud.pushes).toBe(1);
    await engine.sync();
    expect(cloud.pushes).toBe(1);
    store.destroy();
  });
  it("preserves local changes after a network failure", async () => {
    const { store, cloud, engine } = await setup();
    await store.mutate(() => fixture());
    cloud.fail = true;
    await expect(engine.sync()).rejects.toThrow("offline");
    expect(store.getSnapshot().data.sessions).toHaveLength(1);
    cloud.fail = false;
    await engine.sync();
    expect(cloud.snapshot.data.sessions).toHaveLength(1);
    store.destroy();
  });
  it("merges remote changes with local edits using a baseline", async () => {
    const { store, cloud, engine } = await setup();
    await store.mutate(() => fixture());
    await engine.sync();
    await store.mutate((d) => ({
      ...d,
      subjects: d.subjects.map((s) => ({
        ...s,
        name: "Local name",
        updatedAt: NOW + 10,
      })),
    }));
    cloud.snapshot.data.sessions[0].note = "Remote note";
    cloud.snapshot.data.sessions[0].updatedAt = NOW + 10;
    cloud.snapshot.revision++;
    await engine.sync();
    expect(store.getSnapshot().data.subjects[0].name).toBe("Local name");
    expect(store.getSnapshot().data.sessions[0].note).toBe("Remote note");
    expect(store.getSnapshot().data.conflicts).toHaveLength(0);
    store.destroy();
  });
  it("cannot upload guest data or another account under the wrong user", async () => {
    const { store, engine } = await setup();
    await store.switchNamespace("guest");
    await store.mutate(() => fixture());
    await expect(engine.sync()).rejects.toThrow("Бүртгэл өөрчлөгдсөн");
    expect(
      (await store.repository.load("account:a"))?.data.sessions,
    ).toHaveLength(0);
    store.destroy();
  });
  it("does not send active timers to other devices", async () => {
    const { store, cloud, engine } = await setup();
    const d = fixture();
    d.activeTimer = {
      id: "active",
      subjectId: "math",
      date: "2026-09-15",
      sessionStartedAt: NOW,
      runningSince: NOW,
      accumulatedMs: 0,
      running: true,
      note: "draft",
      mode: "stopwatch",
      phase: "focus",
      targetMs: null,
      status: "active",
      finishedAt: null,
      segments: [],
      startTimeEstimated: false,
      taskId: null,
      extras: {},
    };
    await store.mutate(() => d);
    await engine.sync();
    expect(cloud.snapshot.data.activeTimer).toBeNull();
    expect(store.getSnapshot().data.activeTimer?.id).toBe("active");
    store.destroy();
  });
});
