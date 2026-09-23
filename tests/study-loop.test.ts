import { afterEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { fixture, MemoryStorage, NOW, session, subject } from "./fixtures";
import { planPreview, commitPlan } from "@/lib/world/planner";
import {
  goalDetails,
  milestoneProgress,
  editGoalDetails,
  nextTask,
} from "@/lib/world/milestones";
import { goalProgress } from "@/lib/world/progress";
import { actions } from "@/lib/persistence/actions";
import { migrate } from "@/lib/migration/migrate";
import { mergeData } from "@/lib/migration/merge";
import {
  buildIndex,
  emptyDay,
  intensity,
  periodStats,
} from "@/lib/calculations/analytics";
import { coachInsights } from "@/lib/assistant/coach";
import {
  aiContext,
  createAIChatProvider,
  localReply,
} from "@/lib/assistant/chat-provider";
import { Repository, RevisionError } from "@/lib/persistence/repository";
import { StudyStore } from "@/lib/persistence/store";
import {
  initialMusicSelection,
  normalizeMusicPreference,
} from "@/lib/music/preferences";
import { roomFurniture, updateFurniture } from "@/lib/world/furniture";

const today = "2026-09-15";
function planned() {
  const data = fixture();
  data.sessions = [];
  const preview = planPreview(
    {
      title: "Python давтах",
      subjectId: "math",
      startsOn: today,
      weeks: 4,
      daysPerWeek: 3,
      minutesPerDay: 25,
      description: "Жижиг төсөл хийх",
      milestoneTitles: ["Суурь", "Функц", "Төсөл"],
    },
    data,
    NOW,
  );
  return commitPlan(preview)(data);
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("v4.1 goal milestones and task lifecycle", () => {
  it("preserves an explicitly unassigned session stage when its task is later assigned", () => {
    const data = planned(),
      goal = data.studyGoals[0],
      task = data.tasks[0];
    data.sessions = [
      session({
        extras: { goalId: goal.id, taskId: task.id, milestoneId: null },
      }),
    ];
    expect(
      milestoneProgress(data, goal, today).every((m) => m.seconds === 0),
    ).toBe(true);
    expect(goalProgress(data, goal, today).seconds).toBe(60);
    goal.extras.studyPlan = undefined;
    expect(
      coachInsights(data, buildIndex(data, today), today).some((i) =>
        i.id.startsWith("goal:"),
      ),
    ).toBe(false);
  });
  it("creates stable stages with editable descriptions and balanced task links, preserving v4 JSON and merge compatibility", () => {
    const data = planned(),
      goal = data.studyGoals[0],
      details = goalDetails(goal);
    expect(details.description).toBe("Жижиг төсөл хийх");
    expect(details.weeklyDays).toBe(3);
    expect(
      milestoneProgress(data, goal, today).map((m) => m.tasks.length),
    ).toEqual([4, 4, 4]);
    expect(migrate(JSON.parse(JSON.stringify(data)))).toEqual(data);
    expect(mergeData(data, migrate(data), data)).toEqual(data);
  });
  it("tolerates malformed optional stage/furniture metadata and retains the exact source for export", () => {
    const data = planned(),
      raw = [
        null,
        { id: "a", title: "First" },
        { id: "a", title: "Duplicate" },
        { title: 12 },
      ];
    data.studyGoals[0].extras.studyPlan = {
      description: 12,
      weeklyDays: 900,
      milestones: raw,
      unknown: true,
    };
    const copy = migrate(data);
    expect(goalDetails(copy.studyGoals[0])).toEqual({
      description: "",
      weeklyDays: 5,
      milestones: [{ id: "a", title: "First" }],
    });
    expect(copy.studyGoals[0].extras.studyPlan).toEqual(
      data.studyGoals[0].extras.studyPlan,
    );
    const world = updateFurniture(copy.settings.world, { chair: "sage" });
    expect(roomFurniture(world).chair).toBe("sage");
    world.extras.furniture = {
      chair: "bad",
      bookshelf: "true",
      special: "kept",
    };
    expect(roomFurniture(world)).toMatchObject({
      chair: "linen",
      bookshelf: false,
    });
    expect(
      migrate({ ...data, settings: { ...data.settings, world } }).settings.world
        .extras.furniture,
    ).toEqual(world.extras.furniture);
  });
  it("edits a goal without recreating tasks or time, retaining unknown fields and rejecting stale edits", () => {
    const data = planned(),
      goal = data.studyGoals[0];
    goal.extras.studyPlan = {
      ...(goal.extras.studyPlan as object),
      futureField: "kept",
    };
    const patch = {
      title: "Шинэ нэр",
      weeklyMinutes: 90,
      targetMinutes: 400,
      endsOn: goal.endsOn,
      ...goalDetails(goal),
    };
    const edited = editGoalDetails(goal.id, goal.updatedAt, patch)(data);
    expect(edited.tasks).toBe(data.tasks);
    expect(edited.sessions).toBe(data.sessions);
    expect(edited.studyGoals[0].extras.studyPlan).toHaveProperty(
      "futureField",
      "kept",
    );
    expect(() => editGoalDetails(goal.id, -1, patch)(data)).toThrow(
      /өөрчлөгдсөн/,
    );
    expect(() =>
      editGoalDetails(goal.id, goal.updatedAt, { ...patch, milestones: [] })(
        data,
      ),
    ).toThrow();
  });
  it("links a measured session to its stage and excludes pauses, unrelated study and checkmarks from progress", () => {
    let now = NOW;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    let data = planned();
    const task = data.tasks[0],
      goal = data.studyGoals[0];
    data = actions.toggleTask(task.id)(data);
    expect(milestoneProgress(data, goal, today)[0].seconds).toBe(0);
    data = actions.start("math", "pomodoro", "focus", 25, task.id)(data);
    expect(data.activeTimer?.extras.plannedDurationSec).toBe(1500);
    expect(() => actions.deleteTask(task.id)(data)).toThrow();
    now += 60000;
    data = actions.pause()(data);
    now += 900000;
    data = actions.resume()(data);
    now += 60000;
    data = actions.saveTimer("Функц давтав", true)(actions.finish()(data));
    data.sessions.push(session({ id: "unrelated", durationSec: 3600 }));
    expect(goalProgress(data, goal, today)).toMatchObject({
      seconds: 120,
      weeklySeconds: 120,
    });
    expect(milestoneProgress(data, goal, today)[0].seconds).toBe(120);
    expect(data.tasks[0].extras.completedOn).toBe(today);
    expect(data.sessions[0].extras.milestoneId).toBe(task.extras.milestoneId);
  });
  it("allocates a goal's cross-midnight weekly time and excludes a second goal on the same subject", () => {
    const data = planned(),
      goal = data.studyGoals[0];
    const start = new Date("2026-09-13T23:59:00").getTime();
    data.sessions = [
      session({
        id: "cross",
        date: "2026-09-13",
        startEpoch: start,
        endEpoch: start + 120000,
        durationSec: 120,
        segments: [{ start, end: start + 120000 }],
        extras: { goalId: goal.id },
      }),
      session({
        id: "other",
        durationSec: 1800,
        extras: { goalId: "another" },
      }),
    ];
    expect(goalProgress(data, goal, today)).toMatchObject({
      seconds: 120,
      weeklySeconds: 60,
    });
  });
  it("reschedules a completed task without rewriting the actual completion day or session stage snapshot", () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    let data = planned();
    data = actions.toggleTask(data.tasks[0].id)(data);
    const task = data.tasks[0];
    data = actions.editTask(task.id, task.updatedAt, {
      title: "Зассан",
      date: "2026-09-20",
      minutes: 40,
      startTime: "09:30",
      milestoneId: goalDetails(data.studyGoals[0]).milestones[1].id,
    })(data);
    expect(data.tasks[0]).toMatchObject({
      completed: true,
      date: "2026-09-20",
      extras: { completedOn: today },
    });
    expect(() => actions.editTask(task.id, -1, { ...task })(data)).toThrow();
    expect(() =>
      actions.editTask(task.id, data.tasks[0].updatedAt, {
        ...task,
        minutes: NaN,
      })(data),
    ).toThrow();
  });
  it("prioritizes today's scheduled work and validates the stopwatch/pomodoro boundary", () => {
    const data = planned();
    data.tasks[0].date = "2026-09-14";
    data.tasks[1].date = today;
    expect(nextTask(data.tasks, today)?.id).toBe(data.tasks[1].id);
    expect(
      actions.start("math", "stopwatch", "shortBreak", null)(data).activeTimer
        ?.phase,
    ).toBe("focus");
    expect(() =>
      actions.start("math", "pomodoro", "focus", Infinity)(data),
    ).toThrow();
  });
});

describe("useful, factual feedback", () => {
  it("uses actual minutes for calendar colors and distinguishes untimed marks", () => {
    expect(
      [0, 20, 20.01, 40, 40.01, 60, 60.01].map((m) =>
        intensity({ ...emptyDay(today), seconds: m * 60 }),
      ),
    ).toEqual([0, 1, 2, 2, 3, 3, 4]);
    expect(intensity({ ...emptyDay(today), subjects: new Set(["math"]) })).toBe(
      0,
    );
  });
  it("reports a current streak and full longest session while keeping period totals bounded", () => {
    const data = fixture();
    data.sessions.push(
      session({ id: "older", date: "2026-09-14", durationSec: 1800 }),
    );
    const index = buildIndex(data, today);
    expect(periodStats(index, 1, today)).toMatchObject({
      seconds: 60,
      currentStreak: 2,
      longestSession: 60,
      sessionCount: 1,
    });
    expect(periodStats(index, 7, today).longestSession).toBe(1800);
  });
  it("compares a goal's remaining workload against its selected study days, without inventing skill progress", () => {
    const data = planned(),
      goal = data.studyGoals[0];
    goal.endsOn = today;
    const text = coachInsights(data, buildIndex(data, today), today)
      .map((i) => i.body)
      .join(" ");
    expect(text).toContain("300 минут");
    expect(text).toContain("сунгах");
    goal.endsOn = "2026-09-14";
    goal.startsOn = "2026-09-01";
    expect(
      coachInsights(data, buildIndex(data, today), today)[0].body,
    ).toContain("Дуусах өдөр өнгөрсөн");
  });
  it("reviews calendar-week subject totals and passes the original goal request into the editable planner", () => {
    const data = fixture();
    data.sessions.push(
      session({ id: "sunday", date: "2026-09-13", durationSec: 5400 }),
    );
    const context = { data, index: buildIndex(data, today), today };
    expect(localReply("Долоо хоногоо харъя", context).text).toContain(
      "Математик: 1м",
    );
    expect(localReply("Python goal 2 months", context).planPrompt).toBe(
      "Python goal 2 months",
    );
    expect(aiContext(context, false).notes).toEqual([]);
    expect(aiContext(context, true).notes[0].note).toBe("Тэгшитгэл");
  });
  it("keeps AI notes private by default, sends opted-in recent notes and bounds UTF-8 request bytes", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ text: "Санал" }) });
    vi.stubGlobal("fetch", fetcher);
    const data = planned();
    data.subjects.push(
      ...Array.from({ length: 50 }, (_, i) =>
        subject(`long${i}`, "漢".repeat(100)),
      ),
    );
    data.sessions = [session({ note: "Тэмдэглэл" })];
    const context = { data, index: buildIndex(data, today), today };
    await createAIChatProvider(async () => "fake-token").reply(
      "hello",
      context,
    );
    expect(
      JSON.parse(fetcher.mock.calls[0][1].body).context.notes,
    ).toBeUndefined();
    await createAIChatProvider(async () => "fake-token", true).reply(
      "Миний тэмдэглэл: " + "漢".repeat(1480),
      context,
    );
    const body = fetcher.mock.calls[1][1].body;
    expect(new TextEncoder().encode(body).length).toBeLessThanOrEqual(23500);
    expect(JSON.parse(body).context.notes[0].note).toBe("Тэмдэглэл");
  });
  it("loads legacy music volume preferences and restores only valid saved sources without autoplay", () => {
    const old = normalizeMusicPreference({ volume: 0.7, muted: true });
    expect(old).toMatchObject({
      volume: 0.7,
      muted: true,
      defaultCategory: "theme",
    });
    expect(initialMusicSelection(old, "night", [])).toBe("ambient:rain");
    expect(
      initialMusicSelection({ ...old, lastPlayed: "unknown" }, "forest", []),
    ).toBe("ambient:nature");
    expect(
      initialMusicSelection(
        { ...old, lastPlayed: "ambient:rain" },
        "forest",
        [],
      ),
    ).toBe("ambient:rain");
    expect(
      initialMusicSelection(
        {
          ...old,
          rememberLast: false,
          defaultCategory: "piano",
          lastPlayed: "ambient:rain",
        },
        "forest",
        [],
      ),
    ).toBe("ambient:piano");
  });
});

describe("recoverable local reset and legacy backups", () => {
  it("opens the actual stored-document envelope created by an earlier upgrade and preserves all records", () => {
    const raw = { revision: 4, data: { ...planned(), schemaVersion: 3 } };
    const restored = migrate(raw);
    expect(restored.sessions).toEqual(raw.data.sessions);
    expect(restored.studyGoals).toEqual(raw.data.studyGoals);
    expect(migrate({ format: "togtmol-backup", data: restored })).toEqual(
      restored,
    );
  });
  it("backs up before clearing guest records, restores from that backup and leaves account data intact", async () => {
    const repo = new Repository(new IDBFactory(), new MemoryStorage());
    const store = new StudyStore(repo);
    await store.switchNamespace("guest");
    const data = planned();
    await store.mutate(() => data);
    await repo.save("account:a", fixture(), 0);
    await store.clearGuestData();
    expect(store.getSnapshot().data.tasks).toHaveLength(0);
    const backups = (await repo.backups("guest")).filter((b) =>
      b.label.includes("цэвэрлэхийн"),
    );
    expect(backups).toHaveLength(1);
    expect(migrate(JSON.parse(backups[0].raw)).studyGoals).toEqual(
      data.studyGoals,
    );
    expect((await repo.load("account:a"))?.data.sessions).toHaveLength(1);
    await store.importData(backups[0].raw);
    expect(store.getSnapshot().data.tasks).toHaveLength(data.tasks.length);
    store.destroy();
  });
  it("refuses reset when backup fails, a timer exists, or an account namespace is active", async () => {
    const repo = new Repository(new IDBFactory(), new MemoryStorage()),
      store = new StudyStore(repo);
    await store.switchNamespace("guest");
    await store.mutate(() => planned());
    const before = await repo.rawDocument("guest");
    const backup = vi.spyOn(repo, "backup").mockRejectedValue(Error("Quota"));
    await expect(store.clearGuestData()).rejects.toThrow("Quota");
    expect(await repo.rawDocument("guest")).toBe(before);
    backup.mockRestore();
    await store.mutate(actions.start("math", "stopwatch", "focus", null));
    await expect(store.clearGuestData()).rejects.toThrow(/Ажиллаж/);
    await store.mutate(actions.discard());
    await store.switchNamespace("account:a");
    await expect(store.clearGuestData()).rejects.toThrow(/локал/);
    store.destroy();
  });
  it("does not clobber another tab's revision while preparing a reset backup", async () => {
    const factory = new IDBFactory(),
      storage = new MemoryStorage(),
      repo = new Repository(factory, storage),
      other = new Repository(factory, storage),
      store = new StudyStore(repo);
    await store.switchNamespace("guest");
    const previous = await other.load("guest");
    await other.save("guest", fixture(), previous!.revision);
    await expect(store.clearGuestData()).rejects.toBeInstanceOf(RevisionError);
    expect(store.getSnapshot().data.sessions).toHaveLength(1);
    store.destroy();
    await other.close();
  });
});
