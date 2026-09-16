import { normalizeWorld } from "@/lib/world/config";
import { validYouTubeSource } from "@/lib/music/youtube";
import { emptyData, PALETTE } from "@/lib/constants";
import { dateKey, parseDate } from "@/lib/calculations/dates";
import {
  base,
  extras,
  finite,
  fingerprint,
  identifier,
  isObject,
  text,
  validSpans,
} from "./values";
import type {
  ActiveTimer,
  DailyTask,
  StudyGoal,
  MusicSource,
  Entry,
  StudyData,
  StudySession,
  Subject,
} from "@/types/study";

function records<T>(
  data: StudyData,
  raw: Record<string, unknown>,
  key: string,
  parse: (v: Record<string, unknown>, i: number) => T,
): T[] {
  const input = raw[key];
  if (input == null) return [];
  if (!Array.isArray(input)) {
    data.quarantine.push({
      collection: key,
      index: -1,
      reason: "Жагсаалтын бүтэц буруу",
      value: input,
    });
    return [];
  }
  const result: T[] = [];
  input.forEach((v, i) => {
    try {
      if (!isObject(v)) throw Error("Бичлэгийн бүтэц буруу");
      result.push(parse(v, i));
    } catch (error) {
      data.quarantine.push({
        collection: key,
        index: i,
        reason: error instanceof Error ? error.message : "Танигдаагүй бичлэг",
        value: v,
      });
    }
  });
  return result;
}
function requireId(v: unknown) {
  const id = identifier(v);
  if (!id) throw Error("Хичээлийн дугаар алга");
  return id;
}
function requireDate(v: unknown) {
  if (!parseDate(v)) throw Error("Огноо буруу");
  return v as string;
}
function timer(raw: unknown): ActiveTimer | null {
  if (raw == null) return null;
  if (!isObject(raw)) throw Error("Цаг хэмжигчийн бүтэц буруу");
  const accumulatedMs = Math.max(0, finite(raw.accumulatedMs)),
    legacy = finite(raw.startEpoch),
    running = raw.running === true;
  const runningSince = running ? finite(raw.runningSince, legacy) : null;
  const start = finite(
    raw.sessionStartedAt,
    legacy ? Math.max(1, legacy - accumulatedMs) : 0,
  );
  if (start <= 0 || (running && !runningSince))
    throw Error("Цаг хэмжигчийн эхлэх мөч алга");
  return {
    id: identifier(raw.id) || `timer_${fingerprint(raw)}`,
    subjectId: requireId(raw.subjectId),
    date: parseDate(raw.date) ? (raw.date as string) : dateKey(new Date(start)),
    sessionStartedAt: start,
    runningSince,
    accumulatedMs,
    running,
    note: text(raw.note),
    mode: raw.mode === "pomodoro" ? "pomodoro" : "stopwatch",
    phase:
      raw.phase === "shortBreak" || raw.phase === "longBreak"
        ? raw.phase
        : "focus",
    targetMs: finite(raw.targetMs) > 0 ? finite(raw.targetMs) : null,
    status: raw.status === "review" ? "review" : "active",
    finishedAt: finite(raw.finishedAt) > 0 ? finite(raw.finishedAt) : null,
    segments: validSpans(raw.segments),
    startTimeEstimated:
      raw.startTimeEstimated === true || !finite(raw.sessionStartedAt),
    taskId: identifier(raw.taskId),
    extras: extras(raw, [
      "id",
      "subjectId",
      "date",
      "sessionStartedAt",
      "runningSince",
      "accumulatedMs",
      "running",
      "note",
      "mode",
      "phase",
      "targetMs",
      "status",
      "finishedAt",
      "segments",
      "startTimeEstimated",
      "taskId",
    ]),
  };
}
export function migrate(input: unknown): StudyData {
  if (!isObject(input)) throw Error("Нөөц файлын бүтэц танигдсангүй.");
  const raw =
    (input.format === "togtmol-backup" ||
      (Number.isSafeInteger(input.revision) && Number(input.revision) >= 1)) &&
    isObject(input.data)
      ? input.data
      : input;
  if (finite(raw.schemaVersion) > 4)
    throw Error("Энэ нөөц шинэ хувилбарт зориулагдсан байна.");
  if (
    !Array.isArray(raw.subjects) &&
    !Array.isArray(raw.entries) &&
    !Array.isArray(raw.sessions)
  )
    throw Error("Суралцах өгөгдөл олдсонгүй.");
  const data = emptyData();
  data.quarantine = Array.isArray(raw.quarantine)
    ? raw.quarantine.filter(isObject).map((q) => ({
        collection: text(q.collection),
        index: finite(q.index),
        reason: text(q.reason),
        value: q.value,
      }))
    : [];
  data.subjects = records<Subject>(data, raw, "subjects", (s, i) => {
    if (!text(s.name).trim()) throw Error("Хичээлийн нэр алга");
    return {
      ...base(s, requireId(s.id), ["name", "color", "icon", "archived"]),
      name: text(s.name),
      color: /^#[a-f0-9]{6}$/i.test(text(s.color))
        ? text(s.color)
        : PALETTE[i % PALETTE.length],
      icon: text(s.icon, "book"),
      archived: s.archived === true,
    };
  });
  data.entries = records<Entry>(data, raw, "entries", (e) => {
    const subjectId = requireId(e.subjectId),
      date = requireDate(e.date);
    return {
      ...base(
        e,
        identifier(e.id) || `entry_${fingerprint([subjectId, date])}`,
        ["subjectId", "date"],
      ),
      subjectId,
      date,
    };
  });
  data.sessions = records<StudySession>(data, raw, "sessions", (s, i) => {
    const durationSec = finite(s.durationSec, -1);
    if (durationSec < 0) throw Error("Хугацаа буруу");
    const date = requireDate(s.date),
      start = finite(s.startEpoch, parseDate(date)!.getTime());
    return {
      ...base(s, identifier(s.id) || `session_${fingerprint(s)}_${i}`, [
        "subjectId",
        "date",
        "startEpoch",
        "endEpoch",
        "durationSec",
        "note",
        "segments",
        "mode",
        "startTimeEstimated",
        "manuallyEdited",
      ]),
      subjectId: requireId(s.subjectId),
      date,
      durationSec,
      startEpoch: start,
      endEpoch: finite(s.endEpoch, start + durationSec * 1000),
      note: text(s.note),
      segments: validSpans(s.segments),
      mode: s.mode === "pomodoro" ? "pomodoro" : "stopwatch",
      startTimeEstimated:
        s.startTimeEstimated === true || !finite(s.startEpoch),
      manuallyEdited: s.manuallyEdited === true,
    };
  });
  data.tasks = records<DailyTask>(data, raw, "tasks", (t, i) => {
    const minutes = finite(t.minutes);
    if (minutes <= 0 || minutes > 1440) throw Error("Төлөвлөсөн хугацаа буруу");
    return {
      ...base(t, identifier(t.id) || `task_${fingerprint(t)}_${i}`, [
        "subjectId",
        "date",
        "minutes",
        "title",
        "completed",
        "startTime",
        "goalId",
      ]),
      goalId: identifier(t.goalId),
      subjectId: requireId(t.subjectId),
      date: requireDate(t.date),
      minutes,
      title: text(t.title),
      completed: t.completed === true,
      startTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(text(t.startTime))
        ? text(t.startTime)
        : null,
    };
  });
  data.studyGoals = records<StudyGoal>(data, raw, "studyGoals", (g) => {
    const startsOn = requireDate(g.startsOn),
      endsOn = requireDate(g.endsOn);
    if (
      !text(g.title).trim() ||
      endsOn < startsOn ||
      finite(g.weeklyMinutes) <= 0 ||
      finite(g.weeklyMinutes) > 10080 ||
      finite(g.targetMinutes) <= 0
    )
      throw Error("Зорилгын нэр, хугацаа буруу");
    return {
      ...base(g, requireId(g.id), [
        "subjectId",
        "title",
        "startsOn",
        "endsOn",
        "weeklyMinutes",
        "targetMinutes",
      ]),
      subjectId: requireId(g.subjectId),
      title: text(g.title),
      startsOn,
      endsOn,
      weeklyMinutes: finite(g.weeklyMinutes),
      targetMinutes: finite(g.targetMinutes),
    };
  });
  data.musicSources = records<MusicSource>(data, raw, "musicSources", (m) => {
    if (!validYouTubeSource(m.kind, m.youtubeId))
      throw Error("YouTube эх сурвалж буруу");
    return {
      ...base(m, requireId(m.id), ["title", "kind", "youtubeId"]),
      title: text(m.title, "YouTube"),
      kind: m.kind as MusicSource["kind"],
      youtubeId: String(m.youtubeId),
    };
  });
  if (isObject(raw.goals)) {
    const g = raw.goals;
    data.goals = {
      weeklyHours: finite(g.weeklyHours) > 0 ? finite(g.weeklyHours) : 5,
      weeklyDays:
        finite(g.weeklyDays) > 0 ? Math.min(7, finite(g.weeklyDays)) : 5,
      dailyMinutes: finite(g.dailyMinutes) > 0 ? finite(g.dailyMinutes) : null,
      monthlyHours: finite(g.monthlyHours) > 0 ? finite(g.monthlyHours) : null,
      updatedAt: finite(g.updatedAt),
      extras: extras(g, [
        "weeklyHours",
        "weeklyDays",
        "dailyMinutes",
        "monthlyHours",
        "updatedAt",
      ]),
    };
  } else if (raw.goals != null) data.extras.legacyGoals = raw.goals;
  if (isObject(raw.settings)) {
    const s = raw.settings;
    data.settings = {
      ...data.settings,
      world: normalizeWorld(s.world),
      theme: s.theme === "dark" || s.theme === "light" ? s.theme : "system",
      defaultTimer: s.defaultTimer === "pomodoro" ? "pomodoro" : "stopwatch",
      focusMinutes:
        finite(s.focusMinutes) > 0 ? Math.min(240, finite(s.focusMinutes)) : 25,
      shortBreakMinutes:
        finite(s.shortBreakMinutes) > 0
          ? Math.min(90, finite(s.shortBreakMinutes))
          : 5,
      longBreakMinutes:
        finite(s.longBreakMinutes) > 0
          ? Math.min(90, finite(s.longBreakMinutes))
          : 15,
      sound: s.sound === true,
      notifications: s.notifications === true,
      reminderTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(text(s.reminderTime))
        ? text(s.reminderTime)
        : null,
      updatedAt: finite(s.updatedAt),
      extras: extras(s, [
        "world",
        "theme",
        "defaultTimer",
        "focusMinutes",
        "shortBreakMinutes",
        "longBreakMinutes",
        "sound",
        "notifications",
        "reminderTime",
        "updatedAt",
      ]),
    };
  } else if (raw.settings != null) data.extras.legacySettings = raw.settings;
  if (isObject(raw.achievementsUnlocked))
    for (const [id, ds] of Object.entries(raw.achievementsUnlocked)) {
      if (typeof ds === "string") data.achievementsUnlocked[id] = ds;
      else
        data.quarantine.push({
          collection: "achievementsUnlocked",
          index: -1,
          reason: id,
          value: ds,
        });
    }
  try {
    data.activeTimer = timer(raw.activeTimer);
  } catch (error) {
    data.quarantine.push({
      collection: "activeTimer",
      index: 0,
      reason: String(error),
      value: raw.activeTimer,
    });
  }
  if (Array.isArray(raw.conflicts))
    data.conflicts = raw.conflicts
      .filter(isObject)
      .filter(
        (c) =>
          typeof c.id === "string" &&
          [
            "subjects",
            "sessions",
            "entries",
            "tasks",
            "studyGoals",
            "musicSources",
            "goals",
            "settings",
          ].includes(String(c.collection)),
      )
      .map((c) => ({
        id: String(c.id),
        collection:
          c.collection as StudyData["conflicts"][number]["collection"],
        recordId: text(c.recordId),
        kept: c.kept,
        other: c.other,
        resolvedAt: finite(c.resolvedAt) > 0 ? finite(c.resolvedAt) : null,
      }));
  data.extras = {
    ...extras(raw, [
      "schemaVersion",
      "subjects",
      "entries",
      "sessions",
      "tasks",
      "studyGoals",
      "musicSources",
      "goals",
      "settings",
      "achievementsUnlocked",
      "activeTimer",
      "quarantine",
      "conflicts",
    ]),
    ...data.extras,
  };
  const ids = new Set(data.subjects.map((s) => s.id));
  for (const id of [
    ...data.entries,
    ...data.sessions,
    ...data.tasks,
    ...data.studyGoals,
    ...(data.activeTimer ? [data.activeTimer] : []),
  ].map((s) => s.subjectId))
    if (!ids.has(id)) {
      data.subjects.push({
        id,
        name: "Өмнөх хичээл",
        color: "#9eb6a0",
        icon: "book",
        archived: true,
        createdAt: 0,
        updatedAt: 0,
        deletedAt: null,
        extras: { recoveredOrphan: true },
      });
      ids.add(id);
    }
  for (const collection of [
    "subjects",
    "entries",
    "sessions",
    "tasks",
    "studyGoals",
    "musicSources",
  ] as const) {
    const seen = new Set<string>();
    data[collection].forEach((r, i) => {
      if (seen.has(r.id)) {
        const old = r.id;
        r.id = `${r.id}_recovered_${i}`;
        r.extras.originalId = old;
      }
      seen.add(r.id);
    });
  }
  return data;
}
