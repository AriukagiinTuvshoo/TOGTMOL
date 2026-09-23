import { describe, it, expect, vi, afterEach } from "vitest";
import { fixture, session, NOW, subject, MemoryStorage } from "./fixtures";
import { emptyData } from "@/lib/constants";
import { IDBFactory } from "fake-indexeddb";
import { migrate } from "@/lib/migration/migrate";
import { mergeData } from "@/lib/migration/merge";
import { Repository } from "@/lib/persistence/repository";
import { actions } from "@/lib/persistence/actions";
import {
  companionProgress,
  dailyXP,
  companionState,
  goalProgress,
} from "@/lib/world/progress";
import { buildIndex } from "@/lib/calculations/analytics";
import {
  commitPlan,
  deleteGoal,
  inferPlan,
  planPreview,
  restoreGoal,
} from "@/lib/world/planner";
import { normalizeWorld } from "@/lib/world/config";
import { localReply, aiContext } from "@/lib/assistant/chat-provider";
import { parseYouTube } from "@/lib/music/youtube";
import type { StudyData } from "@/types/study";
afterEach(() => vi.restoreAllMocks());
const input = {
  title: "Математик давтах",
  subjectId: "math",
  startsOn: "2026-09-15",
  weeks: 2,
  daysPerWeek: 5,
  minutesPerDay: 25,
};
describe("v4 migration and world preferences", () => {
  it("upgrades an existing v3 IndexedDB document with a complete backup before its first v4 write", async () => {
    const repo = new Repository(new IDBFactory(), new MemoryStorage()),
      v3 = { ...fixture(), schemaVersion: 3 } as unknown as StudyData;
    await repo.save("guest", v3, 0);
    const original = JSON.parse(await repo.rawDocument("guest")),
      updated = await repo.load("guest");
    expect(updated?.data.schemaVersion).toBe(5);
    expect(updated?.data.sessions).toEqual(v3.sessions);
    expect(updated?.revision).toBe(2);
    expect(JSON.parse((await repo.backups("guest"))[0].raw)).toEqual(original);
    await repo.load("guest");
    expect(await repo.backups("guest")).toHaveLength(1);
    await repo.close();
  });
  it("does not overwrite v3 if its safety backup fails", async () => {
    const repo = new Repository(new IDBFactory(), new MemoryStorage()),
      v3 = { ...fixture(), schemaVersion: 3 } as unknown as StudyData;
    await repo.save("guest", v3, 0);
    vi.spyOn(repo, "backup").mockRejectedValue(Error("Quota"));
    await expect(repo.load("guest")).rejects.toThrow("Quota");
    expect(JSON.parse(await repo.rawDocument("guest")).data.schemaVersion).toBe(
      3,
    );
    await repo.close();
  });
  it("round-trips v3 records, unknown fields and a running timer without loss", () => {
    const raw = {
        ...actions.start("math", "stopwatch", "focus", null)(fixture()),
        schemaVersion: 3,
        customKey: { a: 1 },
      },
      v4 = migrate(raw);
    expect(v4.sessions).toEqual(raw.sessions);
    expect(v4.activeTimer).toEqual(raw.activeTimer);
    expect(v4.extras.customKey).toEqual({ a: 1 });
    expect(migrate(v4)).toEqual(v4);
  });
  it("normalizes world controls and quarantines malformed goal/music rows without discarding their source", () => {
    const world = normalizeWorld({
      design: "bad",
      desk: ["lamp", "lamp", "inject"],
      unknown: "kept",
    });
    expect(world.design).toBe("cozy");
    expect(world.desk).toEqual(["lamp"]);
    expect(world.extras.unknown).toBe("kept");
    const data = migrate({
      ...fixture(),
      studyGoals: [{ bad: 1 }],
      musicSources: [{ kind: "video", youtubeId: "<iframe>" }],
    });
    expect(data.quarantine).toHaveLength(2);
    expect(data.quarantine[1].value).toEqual({
      kind: "video",
      youtubeId: "<iframe>",
    });
  });
  it("merges distinct goals and music from two devices, retaining tombstones and both conflicting versions", () => {
    const base = commitPlan(planPreview(input, fixture(), NOW))(fixture()),
      left = structuredClone(base),
      right = structuredClone(base);
    left.studyGoals[0].title = "A";
    left.studyGoals[0].updatedAt = NOW + 1;
    right.studyGoals[0].title = "B";
    right.studyGoals[0].updatedAt = NOW + 2;
    right.musicSources = [
      {
        id: "music",
        title: "Rain",
        kind: "video",
        youtubeId: "abcdefghijk",
        createdAt: NOW,
        updatedAt: NOW,
        deletedAt: null,
        extras: {},
      },
    ];
    const merged = mergeData(left, right, base);
    expect(merged.studyGoals[0].title).toBe("B");
    expect(merged.conflicts[0].collection).toBe("studyGoals");
    expect(merged.musicSources).toEqual(right.musicSources);
    const deleted = deleteGoal(base.studyGoals[0].id)(base);
    expect(
      mergeData(base, deleted, base).studyGoals[0].deletedAt,
    ).not.toBeNull();
  });
});
describe("goals, real study and gentle rewards", () => {
  it("parses stated duration, previews exact tasks and commits idempotently", () => {
    const proposal = inferPlan(
      "Математик 2 долоо хоног өдөрт 30 минут",
      fixture(),
      "2026-09-15",
    );
    expect(proposal).toMatchObject({
      subjectId: "math",
      weeks: 2,
      minutesPerDay: 30,
    });
    const preview = planPreview(proposal, fixture(), NOW);
    expect(preview.tasks).toHaveLength(10);
    expect(new Set(preview.tasks.map((t) => t.date)).size).toBe(10);
    expect(preview.goal.targetMinutes).toBe(300);
    expect(fixture().tasks).toHaveLength(0);
    const committed = commitPlan(preview)(fixture());
    expect(commitPlan(preview)(committed).tasks).toHaveLength(10);
    expect(() => planPreview({ ...input, weeks: 13 }, fixture())).toThrow();
  });
  it("links task to timer to saved session; checkmarks alone cannot add minutes or XP", () => {
    let now = NOW;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    let data = commitPlan(planPreview(input, fixture(), NOW))(fixture());
    const goal = data.studyGoals[0],
      task = data.tasks[0];
    data = actions.toggleTask(task.id)(data);
    expect(goalProgress(data, goal, input.startsOn).seconds).toBe(0);
    expect(companionProgress(data).xp).toBe(0);
    data = actions.start("math", "pomodoro", "focus", 25, task.id)(data);
    now += 120000;
    data = actions.pause()(data);
    now += 900000;
    data = actions.resume()(data);
    now += 60000;
    data = actions.finish()(data);
    data = actions.saveTimer("Дараа үргэлжлүүлэх", true)(data);
    const saved = data.sessions.at(-1)!;
    expect(saved.durationSec).toBe(180);
    expect(saved.extras.goalId).toBe(goal.id);
    expect(saved.extras.taskId).toBe(task.id);
    expect(goalProgress(data, goal, input.startsOn).seconds).toBe(180);
    expect(companionProgress(data).xp).toBe(3);
    data = actions.deleteSession(saved.id)(data);
    expect(goalProgress(data, goal, input.startsOn).seconds).toBe(0);
  });
  it("rejects a mismatched/deleted task and restores only children from the same goal deletion", () => {
    let data = commitPlan(planPreview(input, fixture(), NOW))(fixture());
    const goal = data.studyGoals[0],
      task = data.tasks[0];
    data.subjects.push(subject("english", "English"));
    expect(() =>
      actions.start("english", "stopwatch", "focus", null, task.id)(data),
    ).toThrow();
    data.tasks[0].deletedAt = 1;
    data = deleteGoal(goal.id)(data);
    data = restoreGoal(goal.id)(data);
    expect(data.tasks[0].deletedAt).toBe(1);
    expect(data.tasks[1].deletedAt).toBeNull();
  });
  it("unlocks room rewards from recorded study hours while preserving old data", () => {
    const d = fixture();
    d.sessions = [
      session({
        id: "five-hours",
        durationSec: 5 * 3600,
        startEpoch: NOW - 5 * 3600000,
        endEpoch: NOW,
        segments: [{ start: NOW - 5 * 3600000, end: NOW }],
      }),
    ];
    expect(companionProgress(d).studyHours).toBe(5);
    expect(companionProgress(d).roomRewards.map((reward) => reward.id)).toEqual([
      "botanical_poster",
    ]);

    d.sessions.push(
      session({
        id: "another-five-hours",
        durationSec: 5 * 3600,
        startEpoch: NOW - 10 * 3600000,
        endEpoch: NOW - 5 * 3600000,
        segments: [{ start: NOW - 10 * 3600000, end: NOW - 5 * 3600000 }],
      }),
    );
    expect(companionProgress(d).studyHours).toBe(10);
    expect(companionProgress(d).roomRewards.map((reward) => reward.id)).toEqual([
      "botanical_poster",
      "bookshelf",
      "star",
    ]);
  });

  it("caps daily XP at 60 and excludes manual marks and edited timing", () => {
    expect([0, 10, 30, 60, 90, 900].map(dailyXP)).toEqual([
      0, 10, 30, 45, 60, 60,
    ]);
    const d = fixture();
    d.sessions = [
      session({
        durationSec: 9000,
        startEpoch: NOW - 9000000,
        segments: [{ start: NOW - 9000000, end: NOW }],
      }),
    ];
    expect(companionProgress(d).xp).toBe(60);
    d.sessions[0].manuallyEdited = true;
    expect(companionProgress(d).xp).toBe(0);
    expect(companionProgress(actions.markDay("math", "2026-09-15")(d)).xp).toBe(
      0,
    );
  });
  it("reacts to study, pause, break and welcome-back without changing history", () => {
    const d = actions.start("math", "stopwatch", "focus", null)(fixture()),
      index = buildIndex(d);
    expect(companionState(d, index, "2026-09-15")).toBe("studying");
    expect(companionState(actions.pause()(d), index, "2026-09-15")).toBe(
      "paused",
    );
    d.activeTimer!.phase = "shortBreak";
    expect(companionState(d, index, "2026-09-15")).toBe("break");
    d.activeTimer = null;
    expect(companionState(d, index, "2026-09-19")).toBe("welcome");
  });
  it("uses actual weekly notes locally and leaves them out of online context by default", () => {
    const data = fixture(),
      index = buildIndex(data, "2026-09-15"),
      context = { data, index, today: "2026-09-15" };
    expect(localReply("Тэмдэглэлээ дүгнэе", context).text).toContain(
      "Тэгшитгэл",
    );
    expect(aiContext(context, false).notes).toEqual([]);
    expect(localReply("квантын онол юу вэ", context).text).toContain(
      "local горимд",
    );
    expect(localReply("Долоо хоногоо харъя", context).text).toContain("1м");
    expect(emptyData().schemaVersion).toBe(5);
  });
});
describe("official YouTube source validation", () => {
  it.each([
    "https://youtu.be/abcdefghijk",
    "https://www.youtube.com/watch?v=abcdefghijk",
    "https://m.youtube.com/shorts/abcdefghijk",
    "https://www.youtube-nocookie.com/embed/abcdefghijk",
  ])("accepts official video URL %s", (url) => {
    expect(parseYouTube(url)).toEqual({
      kind: "video",
      youtubeId: "abcdefghijk",
    });
  });
  it("recognizes playlists and rejects arbitrary hosts, credentials, malformed IDs and scripts", () => {
    expect(
      parseYouTube("https://www.youtube.com/playlist?list=PLabcdefghijk123"),
    ).toEqual({ kind: "playlist", youtubeId: "PLabcdefghijk123" });
    for (const url of [
      "https://youtube.com.evil.example/watch?v=abcdefghijk",
      "https://youtube.com@evil.example/watch?v=abcdefghijk",
      "https://evil@youtube.com/watch?v=abcdefghijk",
      "javascript:alert(1)",
      "https://youtu.be/abc",
      "https://youtube.com:8443/watch?v=abcdefghijk",
    ])
      expect(() => parseYouTube(url)).toThrow();
  });
});
