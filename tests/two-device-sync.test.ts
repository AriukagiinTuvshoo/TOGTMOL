import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { IDBFactory } from "fake-indexeddb";
import { readFileSync, readdirSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SupabaseAdapter,
  SyncEngine,
  type CloudAdapter,
} from "@/lib/supabase/sync";
import { StudyStore } from "@/lib/persistence/store";
import { Repository } from "@/lib/persistence/repository";
import type { StudyData } from "@/types/study";
import { fixture, MemoryStorage, NOW } from "./fixtures";

// Two devices of one account against the real SQL schema. Every "device" is its
// own IndexedDB repository; the cloud is one PGlite database reached through RPC.
const A = "11111111-1111-4111-8111-111111111111";
let db: PGlite;

async function impersonate(userId: string) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    userId,
  ]);
  await db.exec("set role authenticated");
}

type RpcReply = {
  data: unknown;
  error: { message: string; code: string } | null;
};

function cloudClient(userId = A) {
  const client = {
    async rpc(
      name: string,
      params: Record<string, unknown>,
    ): Promise<RpcReply> {
      await impersonate(userId);
      try {
        const rows =
          name === "push_study_data"
            ? await db.query<{ v: unknown }>(
                "select public.push_study_data($1,$2,$3::jsonb) as v",
                [
                  params.expected_user_id,
                  params.expected_revision,
                  JSON.stringify(params.document),
                ],
              )
            : await db.query<{ v: unknown }>(`select public.${name}($1) as v`, [
                params.expected_user_id,
              ]);
        return { data: rows.rows[0].v, error: null };
      } catch (error) {
        return {
          data: null,
          error: {
            message: (error as Error).message,
            code: (error as { code?: string }).code ?? "P0001",
          },
        };
      }
    },
  };
  return client as unknown as SupabaseClient;
}

interface Device {
  store: StudyStore;
  engine: SyncEngine;
  adapter: SupabaseAdapter;
}

async function device(userId = A): Promise<Device> {
  const store = new StudyStore(
    new Repository(new IDBFactory(), new MemoryStorage()),
  );
  await store.initialize();
  await store.switchNamespace(`account:${userId}`);
  const adapter = new SupabaseAdapter(cloudClient(userId));
  return { store, engine: new SyncEngine(store, adapter, userId), adapter };
}

async function cloudRevision(userId = A) {
  await impersonate(userId);
  const pulled = await db.query<{ v: { revision: number; data: StudyData } }>(
    "select public.pull_study_data($1) as v",
    [userId],
  );
  await db.exec("reset role");
  return pulled.rows[0].v;
}

// Each scenario starts from an empty cloud so one test's reset epoch or
// conflicts cannot decide another test's outcome.
beforeEach(async () => {
  db = new PGlite();
  await db.exec(
    `create schema auth;create role authenticated;create role anon;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth,public to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;insert into auth.users values('${A}');`,
  );
  for (const file of readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(readFileSync("supabase/migrations/" + file, "utf8"));
}, 30000);

afterEach(async () => {
  vi.unstubAllGlobals();
  await db?.close();
});

describe("Phase 1 two-device sync scenarios", () => {
  it("moves a study record and an audio source from one device to the other", async () => {
    const a = await device(),
      b = await device();
    await a.store.mutate((d) => ({
      ...d,
      subjects: fixture().subjects,
      sessions: fixture().sessions,
      musicSources: [
        {
          id: "music-url",
          title: "Study MP3",
          kind: "audio",
          youtubeId: "",
          audioUrl: "https://cdn.example.com/study.mp3",
          createdAt: NOW,
          updatedAt: NOW,
          deletedAt: null,
          extras: {},
        },
      ],
    }));
    await a.engine.sync();

    await b.engine.sync();
    expect(b.store.getSnapshot().data.subjects[0].name).toBe("Математик");
    expect(b.store.getSnapshot().data.musicSources[0]).toMatchObject({
      id: "music-url",
      kind: "audio",
      audioUrl: "https://cdn.example.com/study.mp3",
    });

    await b.store.mutate((d) => ({
      ...d,
      sessions: [
        ...d.sessions,
        {
          ...fixture().sessions[0],
          id: "session-b",
          note: "B төхөөрөмж дээр",
          updatedAt: NOW + 5,
        },
      ],
    }));
    await b.engine.sync();
    await a.engine.sync();
    expect(
      a.store
        .getSnapshot()
        .data.sessions.map((s) => s.id)
        .sort(),
    ).toEqual(["session-1", "session-b"]);
    a.store.destroy();
    b.store.destroy();
  });

  it("keeps both versions when two devices edit the same subject, and converges afterwards", async () => {
    const a = await device(),
      b = await device();
    await a.store.mutate((d) => ({ ...d, subjects: fixture().subjects }));
    await a.engine.sync();
    await b.engine.sync();

    const rename = (name: string, updatedAt: number) => (d: StudyData) => ({
      ...d,
      subjects: d.subjects.map((s) => ({ ...s, name, updatedAt })),
    });
    await a.store.mutate(rename("A нэр", NOW + 10));
    await a.engine.sync();
    await b.store.mutate(rename("B нэр", NOW + 20));
    await b.engine.sync();
    await a.engine.sync();

    const conflicts = a.store
      .getSnapshot()
      .data.conflicts.filter((c) => c.collection === "subjects");
    expect(conflicts).toHaveLength(1);
    const shown = [
      (conflicts[0].kept as { name: string }).name,
      (conflicts[0].other as { name: string }).name,
    ].sort();
    expect(shown).toEqual(["A нэр", "B нэр"]);
    expect(conflicts[0].resolvedAt).toBeNull();
    // The newer edit wins on both devices; the other one stays recoverable above.
    expect(a.store.getSnapshot().data.subjects[0].name).toBe("B нэр");
    expect(b.store.getSnapshot().data.subjects[0].name).toBe("B нэр");
    expect(b.store.getSnapshot().data.conflicts).toHaveLength(
      a.store.getSnapshot().data.conflicts.length,
    );
    a.store.destroy();
    b.store.destroy();
  });

  it("keeps an offline edit locally, then uploads it on the next sync", async () => {
    const a = await device(),
      b = await device();
    await a.store.mutate((d) => ({ ...d, subjects: fixture().subjects }));
    await a.engine.sync();

    const offline: CloudAdapter = {
      pull: (userId) => a.adapter.pull(userId),
      async push() {
        throw Error("offline");
      },
    };
    const flaky = new SyncEngine(a.store, offline, A);
    await a.store.mutate((d) => ({
      ...d,
      subjects: d.subjects.map((s) => ({
        ...s,
        name: "Офлайн нэр",
        updatedAt: NOW + 30,
      })),
    }));
    await expect(flaky.sync()).rejects.toThrow("offline");
    expect(a.store.getSnapshot().data.subjects[0].name).toBe("Офлайн нэр");

    await a.engine.sync();
    await b.engine.sync();
    expect(b.store.getSnapshot().data.subjects[0].name).toBe("Офлайн нэр");
    a.store.destroy();
    b.store.destroy();
  });

  it("refuses to resurrect local history after a cloud erase without explicit consent", async () => {
    const a = await device();
    await a.store.mutate((d) => ({ ...d, subjects: fixture().subjects }));
    await a.engine.sync();
    const before = await cloudRevision();
    await impersonate(A);
    const erased = await db.query<{
      v: { revision: number; resetAt: number };
    }>("select public.delete_cloud_study_data($1,$2) as v", [
      A,
      before.revision,
    ]);
    await db.exec("reset role");

    await expect(a.engine.sync()).rejects.toThrow(/цэвэрлэсэн/);
    expect(a.store.getSnapshot().data.subjects).toHaveLength(1);

    await a.store.repository.setMetadata(
      `cloud-reset-consent:${A}`,
      erased.rows[0].v.resetAt,
    );
    await a.engine.sync();
    const after = await cloudRevision();
    expect(after.data.subjects).toHaveLength(1);
    expect(after.data.extras.cloudResetAt).toBe(erased.rows[0].v.resetAt);
    expect(after.revision).toBe(erased.rows[0].v.revision + 1);
    a.store.destroy();
  });

  it("backs up a corrupt account document exactly, restores it, and re-syncs without duplicating records", async () => {
    const namespace = `account:${A}`,
      storage = new MemoryStorage(),
      key = `togtmol:v3:${namespace}`;
    storage.setItem(key, "{эвдэрсэн эх");
    const restore = {
      ...fixture(),
      sessions: [],
      subjects: fixture().subjects,
    };
    vi.stubGlobal("navigator", {
      locks: { request: async (_key: string, work: () => unknown) => work() },
    });
    const repo = new Repository(undefined, storage);
    await expect(repo.load(namespace)).rejects.toThrow();
    expect((await repo.backups(namespace))[0].raw).toBe("{эвдэрсэн эх");
    const recovered = await repo.recover(namespace, JSON.stringify(restore));
    expect(recovered.data.subjects).toHaveLength(1);
    expect(await repo.metadata(`account-enabled:${A}`)).toBe(false);

    // Recovery deliberately leaves cloud sync off until the user reconnects it.
    const store = new StudyStore(repo);
    await store.switchNamespace(namespace);
    const enabled = new SyncEngine(
      store,
      new SupabaseAdapter(cloudClient()),
      A,
    );
    await expect(enabled.sync()).rejects.toThrow(/унтраалттай/);
    await repo.setMetadata(`account-enabled:${A}`, true);
    await enabled.sync();

    const b = await device();
    await b.engine.sync();
    expect(b.store.getSnapshot().data.subjects).toHaveLength(1);
    expect(b.store.getSnapshot().data.sessions).toHaveLength(0);
    store.destroy();
    await repo.close();
    b.store.destroy();
  });

  it("syncs the metadata of a device-only audio file but never pretends the bytes exist elsewhere", async () => {
    const a = await device(),
      b = await device();
    const namespace = `account:${A}`,
      key = "musicblob_abcdefgh1234";
    await a.store.repository.saveMusicBlob(
      namespace,
      key,
      new Blob(["audio"], { type: "audio/mpeg" }),
    );
    await a.store.mutate((d) => ({
      ...d,
      musicSources: [
        {
          id: "music-file",
          title: "Local recording",
          kind: "audio",
          youtubeId: "",
          audioStorageKey: key,
          mimeType: "audio/mpeg",
          sizeBytes: 5,
          createdAt: NOW,
          updatedAt: NOW,
          deletedAt: null,
          extras: {},
        },
      ],
    }));
    await a.engine.sync();
    await b.engine.sync();

    const source = b.store
      .getSnapshot()
      .data.musicSources.find((s) => s.id === "music-file");
    expect(source?.audioStorageKey).toBe(key);
    expect(await b.store.repository.loadMusicBlob(namespace, key)).toBeNull();
    expect(
      await a.store.repository.loadMusicBlob(namespace, key),
    ).not.toBeNull();
    a.store.destroy();
    b.store.destroy();
  });
});
