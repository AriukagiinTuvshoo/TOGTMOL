import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { fixture } from "./fixtures";
import { knowledgeFixture, topic } from "./knowledge-fixtures";
import type { MusicSource, StudyData } from "@/types/study";
const A = "11111111-1111-4111-8111-111111111111",
  B = "22222222-2222-4222-8222-222222222222";
let db: PGlite;
async function asUser(id: string) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create schema auth;create role authenticated;create role anon;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth,public to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;insert into auth.users values('${A}'),('${B}');`,
  );
  for (const file of readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    await db.exec(readFileSync("supabase/migrations/" + file, "utf8"));
  }
}, 30000);
afterAll(async () => {
  await db?.close();
});
describe("Postgres schema, transactions and row-level security", () => {
  it("round-trips real relational records and exact legacy identifiers", async () => {
    await asUser(A);
    const d = fixture();
    d.subjects[0].extras = { legacy: true };
    const result = await db.query<{ value: { revision: number } }>(
      "select public.push_study_data($1,0,$2::jsonb) as value",
      [A, JSON.stringify(d)],
    );
    expect(result.rows[0].value.revision).toBe(1);
    const pulled = await db.query<{
      value: { data: ReturnType<typeof fixture> };
    }>("select public.pull_study_data($1) as value", [A]);
    expect(pulled.rows[0].value.data.sessions[0].durationSec).toBe(60);
    expect(pulled.rows[0].value.data.subjects[0].extras).toEqual({
      legacy: true,
    });
    const cols = await db.query<{
      duration_minutes: string;
      subject_id: string;
    }>("select duration_minutes,subject_id from public.study_sessions");
    expect(Number(cols.rows[0].duration_minutes)).toBe(1);
    expect(cols.rows[0].subject_id).toBe("math");
  });
  it("enables RLS and explicit authenticated-only policies on every user table", async () => {
    await db.exec("reset role");
    const r = await db.query<{ relname: string; relrowsecurity: boolean }>(
      "select relname,relrowsecurity from pg_class join pg_namespace n on n.oid=relnamespace where n.nspname='public' and relkind='r'",
    );
    expect(r.rows).toHaveLength(10);
    expect(r.rows.every((r) => r.relrowsecurity)).toBe(true);
  });
  it("prevents a second user from reading the first user records", async () => {
    await asUser(B);
    for (const table of [
      "subjects",
      "study_sessions",
      "study_entries",
      "daily_tasks",
      "goals",
      "achievements",
      "study_profiles",
      "study_goals",
      "music_sources",
      "knowledge_records",
    ])
      expect(
        (await db.query(`select * from public.${table}`)).rows,
      ).toHaveLength(0);
  });
  it("rejects cross-user writes and forged ownership updates", async () => {
    await asUser(B);
    await expect(
      db.query(
        "insert into public.subjects(user_id,id,payload) values($1,$2,$3::jsonb)",
        [
          A,
          "attack",
          JSON.stringify({ ...fixture().subjects[0], id: "attack" }),
        ],
      ),
    ).rejects.toThrow(/row-level security/i);
    await asUser(A);
    await expect(
      db.query("update public.subjects set user_id=$1 where id=$2", [
        B,
        "math",
      ]),
    ).rejects.toThrow(/row-level security/i);
  });
  it("guards against an auth identity switch during an in-flight sync", async () => {
    await asUser(B);
    await expect(
      db.query("select public.push_study_data($1,0,$2::jsonb)", [
        A,
        JSON.stringify(fixture()),
      ]),
    ).rejects.toThrow("Account changed");
    await expect(
      db.query("select public.pull_study_data($1)", [A]),
    ).rejects.toThrow("Account changed");
  });
  it("uses compare-and-swap revisions to reject stale uploads", async () => {
    await asUser(A);
    await expect(
      db.query("select public.push_study_data($1,0,$2::jsonb)", [
        A,
        JSON.stringify(fixture()),
      ]),
    ).rejects.toThrow("Cloud revision changed");
    const r = await db.query<{ revision: number }>(
      "select revision from public.study_profiles",
    );
    expect(Number(r.rows[0].revision)).toBe(1);
  });
  it("rolls back every table when a child reference is invalid", async () => {
    await asUser(A);
    const d = fixture();
    d.subjects[0].name = "Should roll back";
    d.sessions[0].subjectId = "missing";
    await expect(
      db.query("select public.push_study_data($1,1,$2::jsonb)", [
        A,
        JSON.stringify(d),
      ]),
    ).rejects.toThrow(/foreign key/i);
    expect(
      (await db.query<{ name: string }>("select name from public.subjects"))
        .rows[0].name,
    ).toBe("Математик");
  });
  it("supports independent records with identical IDs for a second user", async () => {
    await asUser(B);
    const d = fixture();
    d.subjects[0].name = "B subject";
    await db.query("select public.push_study_data($1,0,$2::jsonb)", [
      B,
      JSON.stringify(d),
    ]);
    expect(
      (await db.query<{ name: string }>("select name from public.subjects"))
        .rows[0].name,
    ).toBe("B subject");
    await asUser(A);
    expect(
      (await db.query<{ name: string }>("select name from public.subjects"))
        .rows[0].name,
    ).toBe("Математик");
  });
  it("never allows a child to reference another user’s subject", async () => {
    await asUser(B);
    const d = fixture();
    d.subjects[0].id = "B-only";
    d.sessions = [];
    await db.query("select public.push_study_data($1,1,$2::jsonb)", [
      B,
      JSON.stringify(d),
    ]);
    await asUser(A);
    await expect(
      db.query(
        "insert into public.study_sessions(user_id,id,payload) values($1,$2,$3::jsonb)",
        [
          A,
          "cross",
          JSON.stringify({
            ...fixture().sessions[0],
            id: "cross",
            subjectId: "B-only",
          }),
        ],
      ),
    ).rejects.toThrow(/foreign key/i);
  });
  it("denies anonymous reads and RPC execution", async () => {
    await db.exec("reset role;set role anon");
    await expect(
      db.query("select * from public.study_sessions"),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      db.query("select public.pull_study_data($1)", [A]),
    ).rejects.toThrow(/permission denied/i);
  });
});

describe("v4 cloud extensions", () => {
  it("round-trips goal plans and YouTube records with owner-only visibility", async () => {
    const { planPreview, commitPlan } = await import("@/lib/world/planner");
    await asUser(A);
    const before = await db.query<{ value: { revision: number } }>(
      "select public.pull_study_data($1) as value",
      [A],
    );
    const data = commitPlan(
      planPreview(
        {
          title: "Goal",
          subjectId: "math",
          startsOn: "2026-09-15",
          weeks: 1,
          daysPerWeek: 2,
          minutesPerDay: 25,
        },
        fixture(),
      ),
    )(fixture());
    data.musicSources.push({
      id: "music-test",
      title: "Rain",
      kind: "video",
      youtubeId: "abcdefghijk",
      createdAt: 1,
      updatedAt: 1,
      deletedAt: null,
      extras: {},
    });
    await db.query("select public.push_study_data($1,$2,$3::jsonb)", [
      A,
      before.rows[0].value.revision,
      JSON.stringify(data),
    ]);
    const pulled = await db.query<{ value: { data: typeof data } }>(
      "select public.pull_study_data($1) as value",
      [A],
    );
    expect(pulled.rows[0].value.data.studyGoals).toEqual(data.studyGoals);
    expect(pulled.rows[0].value.data.musicSources).toEqual(data.musicSources);
    expect(pulled.rows[0].value.data.tasks[0].goalId).toBe(
      data.studyGoals[0].id,
    );
    await asUser(B);
    expect(
      (await db.query("select * from public.study_goals")).rows,
    ).toHaveLength(0);
    expect(
      (await db.query("select * from public.music_sources")).rows,
    ).toHaveLength(0);
    await expect(
      db.query(
        "insert into public.music_sources(user_id,id,payload) values($1,$2,$3::jsonb)",
        [A, "music-test", JSON.stringify(data.musicSources[0])],
      ),
    ).rejects.toThrow(/row-level security/i);
  });
  it("refuses old v3 uploads without modifying v4 data", async () => {
    await asUser(A);
    await expect(
      db.query("select public.push_study_data($1,2,$2::jsonb)", [
        A,
        JSON.stringify({ ...fixture(), schemaVersion: 3 }),
      ]),
    ).rejects.toThrow("Unsupported schema");
    expect(
      (await db.query("select * from public.study_goals")).rows,
    ).toHaveLength(1);
  });
  it("refuses v5 uploads now that schema 6 is required", async () => {
    await asUser(A);
    await expect(
      db.query("select public.push_study_data($1,2,$2::jsonb)", [
        A,
        JSON.stringify({ ...fixture(), schemaVersion: 5 }),
      ]),
    ).rejects.toThrow("Unsupported schema");
  });
  it("enforces a durable per-user daily AI cap that cannot be reset by clients", async () => {
    await asUser(A);
    for (let i = 0; i < 20; i++)
      expect(
        (
          await db.query<{ allowed: boolean }>(
            "select public.consume_togi_request($1) as allowed",
            [A],
          )
        ).rows[0].allowed,
      ).toBe(true);
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select public.consume_togi_request($1) as allowed",
          [A],
        )
      ).rows[0].allowed,
    ).toBe(false);
    await expect(db.query("delete from private.togi_usage")).rejects.toThrow(
      /permission denied/i,
    );
    await asUser(B);
    await expect(
      db.query("select public.consume_togi_request($1)", [A]),
    ).rejects.toThrow("Account changed");
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select public.consume_togi_request($1) as allowed",
          [B],
        )
      ).rows[0].allowed,
    ).toBe(true);
  });
});

describe("v5 knowledge and cloud erasure", () => {
  it("round-trips every knowledge record including private image data with owner isolation", async () => {
    await asUser(A);
    const current = await db.query<{ value: { revision: number } }>(
      "select public.pull_study_data($1) as value",
      [A],
    );
    const data = knowledgeFixture();
    data.knowledge = [...data.knowledge, topic()];
    await db.query("select public.push_study_data($1,$2,$3::jsonb)", [
      A,
      current.rows[0].value.revision,
      JSON.stringify(data),
    ]);
    const result = await db.query<{ value: { data: typeof data } }>(
      "select public.pull_study_data($1) as value",
      [A],
    );
    expect(result.rows[0].value.data.schemaVersion).toBe(6);
    expect(result.rows[0].value.data.knowledge).toEqual(
      [...data.knowledge].sort((a, b) => a.id.localeCompare(b.id)),
    );
    await asUser(B);
    expect(
      (await db.query("select * from public.knowledge_records")).rows,
    ).toHaveLength(0);
    await expect(
      db.query(
        "insert into public.knowledge_records(user_id,id,payload) values($1,$2,$3::jsonb)",
        [A, data.knowledge[0].id, JSON.stringify(data.knowledge[0])],
      ),
    ).rejects.toThrow(/row-level security/i);
    await db.exec("reset role;set role anon");
    await expect(
      db.query("select * from public.knowledge_records"),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      db.query("select public.delete_cloud_study_data($1,0)", [A]),
    ).rejects.toThrow(/permission denied/i);
  });
  it("requires matching identity and revision for erasure, keeps other users, and rejects stale reuploads", async () => {
    await asUser(A);
    const before = await db.query<{ value: { revision: number } }>(
      "select public.pull_study_data($1) as value",
      [A],
    );
    const revision = before.rows[0].value.revision;
    await expect(
      db.query("select public.delete_cloud_study_data($1,$2)", [B, revision]),
    ).rejects.toThrow("Account changed");
    await expect(
      db.query("select public.delete_cloud_study_data($1,$2)", [
        A,
        revision - 1,
      ]),
    ).rejects.toThrow("Cloud revision changed");
    expect(
      (await db.query("select * from public.knowledge_records")).rows,
    ).toHaveLength(6);
    const deleted = await db.query<{
      value: { revision: number; resetAt: number };
    }>("select public.delete_cloud_study_data($1,$2) as value", [A, revision]);
    expect(deleted.rows[0].value.revision).toBe(revision + 1);
    for (const table of [
      "subjects",
      "study_sessions",
      "study_entries",
      "daily_tasks",
      "study_goals",
      "music_sources",
      "knowledge_records",
      "goals",
      "achievements",
    ])
      expect(
        (await db.query(`select * from public.${table}`)).rows,
      ).toHaveLength(0);
    await expect(
      db.query("select public.push_study_data($1,$2,$3::jsonb)", [
        A,
        revision + 1,
        JSON.stringify(knowledgeFixture()),
      ]),
    ).rejects.toThrow("Cloud reset requires explicit consent");
    // Even v4, which doesn't know the reset epoch or knowledge table, cannot restore old rows.
    await expect(
      db.query("select public.push_study_data($1,$2,$3::jsonb)", [
        A,
        revision + 1,
        JSON.stringify({ ...fixture(), schemaVersion: 4 }),
      ]),
    ).rejects.toThrow("Unsupported schema");
    const acknowledged = knowledgeFixture();
    acknowledged.knowledge = [...acknowledged.knowledge, topic()];
    acknowledged.extras.cloudResetAt = deleted.rows[0].value.resetAt;
    await db.query("select public.push_study_data($1,$2,$3::jsonb)", [
      A,
      revision + 1,
      JSON.stringify(acknowledged),
    ]);
    expect(
      (await db.query("select * from public.knowledge_records")).rows,
    ).toHaveLength(6);
    await asUser(B);
    expect(
      (await db.query("select * from public.subjects")).rows.length,
    ).toBeGreaterThan(0);
    await db.exec("reset role");
    expect((await db.query("select * from auth.users")).rows).toHaveLength(2);
  });
});

const musicBase = {
  createdAt: 5,
  updatedAt: 5,
  deletedAt: null,
  extras: {},
};
function audioSource(patch: Partial<MusicSource> = {}): MusicSource {
  return {
    ...musicBase,
    id: "audio-source",
    title: "Study audio",
    kind: "audio",
    youtubeId: "",
    ...patch,
  } as MusicSource;
}
function withoutYouTubeId(source: MusicSource): MusicSource {
  const copy: Partial<MusicSource> = { ...source };
  delete copy.youtubeId;
  return copy as MusicSource;
}
describe("v6 audio music sources", () => {
  async function pushMusic(
    sources: MusicSource[],
  ): Promise<{ revision: number; musicSources: MusicSource[] }> {
    await asUser(A);
    const before = await db.query<{
      value: { revision: number; data: StudyData };
    }>("select public.pull_study_data($1) as value", [A]);
    const { revision, data } = before.rows[0].value;
    const pushed = await db.query<{ value: { revision: number } }>(
      "select public.push_study_data($1,$2,$3::jsonb) as value",
      [A, revision, JSON.stringify({ ...data, musicSources: sources })],
    );
    const pulled = await db.query<{
      value: { data: Pick<StudyData, "musicSources"> };
    }>("select public.pull_study_data($1) as value", [A]);
    return {
      revision: pushed.rows[0].value.revision,
      musicSources: pulled.rows[0].value.data.musicSources,
    };
  }
  it("round-trips URL and device-key audio sources with a null youtube_id", async () => {
    // A URL source has no youtubeId key at all; the UI also stores "" for files.
    const sources = [
      withoutYouTubeId(
        audioSource({
          id: "audio-url",
          audioUrl: "https://cdn.example.com/study.mp3",
        }),
      ),
      audioSource({
        id: "audio-file",
        audioStorageKey: "musicblob_abcdefgh1234",
        mimeType: "audio/mpeg",
        sizeBytes: 4096,
      }),
    ];
    const result = await pushMusic(sources);
    expect(result.revision).toBeGreaterThan(0);
    expect(
      result.musicSources
        .filter((s) => s.id.startsWith("audio-"))
        .sort((a, b) => a.id.localeCompare(b.id)),
    ).toEqual([...sources].sort((a, b) => a.id.localeCompare(b.id)));
    await db.exec("reset role");
    const stored = await db.query<{ id: string; youtube_id: string | null }>(
      "select id,youtube_id from public.music_sources where id like 'audio-%' order by id",
    );
    expect(stored.rows).toEqual([
      { id: "audio-file", youtube_id: "" },
      { id: "audio-url", youtube_id: null },
    ]);
  });
  it("rejects an audio source that no device could ever play", async () => {
    await expect(
      pushMusic([audioSource({ id: "audio-empty" })]),
    ).rejects.toThrow(/music_sources_payload_check/);
    await expect(
      pushMusic([
        audioSource({
          id: "audio-short-key",
          audioStorageKey: "musicblob_short",
        }),
      ]),
    ).rejects.toThrow(/music_sources_payload_check/);
    await expect(
      pushMusic([
        audioSource({
          id: "audio-bad-scheme",
          audioUrl: "ftp://example.com/a.mp3",
        }),
      ]),
    ).rejects.toThrow(/music_sources_payload_check/);
  });
  it("keeps the YouTube video and playlist validation intact", async () => {
    await expect(
      pushMusic([
        {
          ...musicBase,
          id: "video-short",
          title: "Broken video",
          kind: "video",
          youtubeId: "short",
        },
      ]),
    ).rejects.toThrow(/music_sources_payload_check/);
    const playlist = {
      ...musicBase,
      id: "playlist-ok",
      title: "Playlist",
      kind: "playlist" as const,
      youtubeId: "PLabcdefghij",
    };
    const result = await pushMusic([playlist]);
    expect(result.musicSources.find((s) => s.id === playlist.id)).toEqual(
      playlist,
    );
  });
});
