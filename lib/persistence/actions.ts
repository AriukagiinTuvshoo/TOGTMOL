import { dayBoundary } from "@/lib/preferences";
import { datesBetween, parseDate, studyDate } from "@/lib/calculations/dates";
import { uid } from "@/lib/constants";
import { readCalendarDeadlines, validCalendarTime, withCalendarDeadlines } from "@/lib/calculations/calendar";
import { goalDetails } from "@/lib/world/milestones";
import {
  pause,
  resume,
  review,
  sessionFromTimer,
  startTimer,
} from "@/lib/calculations/timer";
import type {
  DailyTask,
  Goals,
  Settings,
  StudyData,
  Subject,
  TimerMode,
  TimerPhase,
} from "@/types/study";
const record = (prefix: string, now: number) => ({
  id: uid(prefix),
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  extras: {},
});
function subject(data: StudyData, id: string) {
  const s = data.subjects.find((s) => s.id === id && !s.deletedAt);
  if (!s) throw Error("Хичээл олдсонгүй.");
  return s;
}
function validDate(date: string) {
  if (!parseDate(date)) throw Error("Огноог шалгана уу.");
}
export const actions = {
  addSubject:
    (name: string, color: string, extras: Record<string, unknown> = {}) =>
    (data: StudyData): StudyData => {
      const clean = name.trim();
      if (!clean || clean.length > 100)
        throw Error("Хичээлийн нэр 1–100 тэмдэгт байна.");
      if (!/^#[a-f0-9]{6}$/i.test(color)) throw Error("Өнгө буруу байна.");
      if (
        data.subjects.some(
          (s) =>
            !s.deletedAt &&
            s.name.trim().toLocaleLowerCase() === clean.toLocaleLowerCase(),
        )
      )
        throw Error("Ийм нэртэй хичээл байна.");
      return {
        ...data,
        subjects: [
          ...data.subjects,
          {
            ...record("subject", Date.now()),
            name: clean,
            color,
            icon: "book",
            archived: false,
            extras,
          },
        ],
      };
    },
  editSubject:
    (
      id: string,
      patch: Pick<Subject, "name" | "color" | "archived"> & {
        extras?: Record<string, unknown>;
      },
    ) =>
    (data: StudyData): StudyData => {
      subject(data, id);
      const clean = patch.name.trim();
      if (!clean || clean.length > 100 || !/^#[a-f0-9]{6}$/i.test(patch.color))
        throw Error("Нэр болон өнгөө шалгана уу.");
      if (
        data.subjects.some(
          (s) =>
            s.id !== id &&
            !s.deletedAt &&
            s.name.trim().toLocaleLowerCase() === clean.toLocaleLowerCase(),
        )
      )
        throw Error("Ийм нэртэй хичээл байна.");
      return {
        ...data,
        subjects: data.subjects.map((s) =>
          s.id === id
            ? {
                ...s,
                ...patch,
                extras: patch.extras ?? s.extras,
                name: clean,
                updatedAt: Date.now(),
              }
            : s,
        ),
      };
    },
  deleteSubject:
    (id: string) =>
    (data: StudyData): StudyData => {
      if (data.activeTimer?.subjectId === id)
        throw Error("Энэ хичээлийн timer-аа эхлээд дуусгана уу.");
      const now = Date.now();
      return {
        ...data,
        subjects: data.subjects.map((s) =>
          s.id === id ? { ...s, deletedAt: now, updatedAt: now } : s,
        ),
        sessions: data.sessions.map((s) =>
          s.subjectId === id && !s.deletedAt
            ? { ...s, deletedAt: now, updatedAt: now }
            : s,
        ),
        entries: data.entries.map((e) =>
          e.subjectId === id && !e.deletedAt
            ? { ...e, deletedAt: now, updatedAt: now }
            : e,
        ),
        studyGoals: data.studyGoals.map((g) =>
          g.subjectId === id && !g.deletedAt
            ? { ...g, deletedAt: now, updatedAt: now }
            : g,
        ),
        tasks: data.tasks.map((t) =>
          t.subjectId === id && !t.deletedAt
            ? { ...t, deletedAt: now, updatedAt: now }
            : t,
        ),
      };
    },
  markDay:
    (id: string, date: string) =>
    (data: StudyData): StudyData => {
      subject(data, id);
      validDate(date);
      const today = studyDate(new Date(), dayBoundary(data.settings), calendarTimeZone(data));
      if (date > today)
        throw Error("Ирээдүйн өдрийг суралцсан гэж тэмдэглэх боломжгүй.");
      const matches = data.entries.filter(
          (e) => e.subjectId === id && e.date === date,
        ),
        old = matches[0],
        marked = matches.some((e) => !e.deletedAt),
        now = Date.now();
      return {
        ...data,
        entries: old
          ? data.entries.map((e) =>
              e.subjectId === id && e.date === date
                ? { ...e, deletedAt: marked ? now : null, updatedAt: now }
                : e,
            )
          : [...data.entries, { ...record("entry", now), subjectId: id, date }],
      };
    },
  start:
    (
      id: string,
      mode: TimerMode,
      phase: TimerPhase,
      minutes: number | null,
      taskId: string | null = null,
    ) =>
    (data: StudyData): StudyData => {
      subject(data, id);
      if (data.activeTimer) throw Error("Ажиллаж буй timer байна.");
      if (
        taskId &&
        !data.tasks.some(
          (t) => t.id === taskId && !t.deletedAt && t.subjectId === id,
        )
      )
        throw Error("Төлөвлөгөө олдсонгүй.");
      if (
        mode === "pomodoro" &&
        (!Number.isFinite(minutes) || !minutes || minutes < 1 || minutes > 240)
      )
        throw Error("Хугацаа 1–240 минут байна.");
      const now = Date.now();
      return {
        ...data,
        activeTimer: {
          ...startTimer(
            id,
            mode,
            mode === "stopwatch" ? "focus" : phase,
            minutes,
            now,
            taskId,
          ),
          date: studyDate(new Date(now), dayBoundary(data.settings)),
          extras: taskId
            ? {
                taskId,
                goalId:
                  data.tasks.find((t) => t.id === taskId && !t.deletedAt)
                    ?.goalId ?? null,
                milestoneId:
                  data.tasks.find((t) => t.id === taskId)?.extras.milestoneId ??
                  null,
                taskTitle: data.tasks.find((t) => t.id === taskId)?.title ?? "",
              }
            : {},
        },
      };
    },
  pause:
    () =>
    (data: StudyData): StudyData =>
      data.activeTimer
        ? { ...data, activeTimer: pause(data.activeTimer, Date.now()) }
        : data,
  resume:
    () =>
    (data: StudyData): StudyData =>
      data.activeTimer
        ? { ...data, activeTimer: resume(data.activeTimer, Date.now()) }
        : data,
  finish:
    (completedAt?: number) =>
    (data: StudyData): StudyData => {
      const timer = data.activeTimer;
      if (!timer) return data;
      const now = Number.isFinite(completedAt)
        ? Number(completedAt)
        : Date.now();

      // A review timer can survive a reload before its final Save action.
      // Materialize its session here as well, but stay idempotent by timer id.
      if (timer.status === "review") {
        if (timer.phase !== "focus" || timer.accumulatedMs <= 0) return data;
        const session = sessionFromTimer(timer, timer.note, now);
        const exists = data.sessions.some((s) => s.id === session.id);
        return {
          ...data,
          sessions: exists
            ? data.sessions.map((s) =>
                s.id === session.id
                  ? {
                      ...s,
                      note: session.note,
                      durationSec: session.durationSec,
                      endEpoch: session.endEpoch,
                      updatedAt: now,
                      segments: session.segments,
                      extras: session.extras,
                    }
                  : s,
              )
            : [...data.sessions, session],
        };
      }

      const reviewed = review(timer, now);
      if (reviewed.phase !== "focus" || reviewed.accumulatedMs <= 0)
        return { ...data, activeTimer: reviewed };

      const session = sessionFromTimer(reviewed, reviewed.note, now);
      const exists = data.sessions.some((s) => s.id === session.id);
      return {
        ...data,
        activeTimer: reviewed,
        sessions: exists
          ? data.sessions.map((s) =>
              s.id === session.id
                ? {
                    ...s,
                    durationSec: session.durationSec,
                    endEpoch: session.endEpoch,
                    updatedAt: now,
                    segments: session.segments,
                    extras: session.extras,
                  }
                : s,
            )
          : [...data.sessions, session],
      };
    },
  discard:
    () =>
    (data: StudyData): StudyData => ({ ...data, activeTimer: null }),
  timerNote:
    (note: string) =>
    (data: StudyData): StudyData =>
      data.activeTimer
        ? {
            ...data,
            activeTimer: { ...data.activeTimer, note: note.slice(0, 10000) },
          }
        : data,
  saveTimer:
    (note: string, completeTask: boolean) =>
    (data: StudyData): StudyData => {
      const timer = data.activeTimer;
      if (!timer) throw Error("Timer олдсонгүй.");
      const now = Date.now(),
        session = sessionFromTimer(timer, note, now),
        hasExisting = data.sessions.some((s) => s.id === session.id),
        sessions = hasExisting
          ? data.sessions.map((s) =>
              s.id === session.id
                ? {
                    ...s,
                    note: session.note,
                    durationSec: session.durationSec,
                    endEpoch: session.endEpoch,
                    updatedAt: now,
                    segments: session.segments,
                    extras: session.extras,
                  }
                : s,
            )
          : [...data.sessions, session];
      return {
        ...data,
        activeTimer: null,
        sessions,
        tasks: completeTask
          ? data.tasks.map((t) =>
              t.id === timer.taskId && !t.deletedAt
                ? {
                    ...t,
                    completed: true,
                    updatedAt: now,
                    extras: {
                      ...t.extras,
                      completedOn: studyDate(
                        new Date(now),
                        dayBoundary(data.settings),
                        calendarTimeZone(data),
                      ),
                    },
                  }
                : t,
            )
          : data.tasks,
      };
    },
  editSession:
    (
      id: string,
      patch: { note: string; date: string; durationSec: number },
      expected: number,
    ) =>
    (data: StudyData): StudyData => {
      const old = data.sessions.find((s) => s.id === id && !s.deletedAt);
      if (!old) throw Error("Хичээл олдсонгүй.");
      if (old.updatedAt !== expected)
        throw Error("Энэ бичлэг өөрчлөгдсөн байна. Дахин нээгээд засна уу.");
      validDate(patch.date);
      if (
        patch.date > studyDate(new Date(), dayBoundary(data.settings), calendarTimeZone(data)) ||
        !Number.isFinite(patch.durationSec) ||
        patch.durationSec < 5 ||
        patch.durationSec > 86400 * 366
      )
        throw Error("Огноо эсвэл хугацаа буруу.");
      const timeChanged =
        patch.date !== old.date || patch.durationSec !== old.durationSec;
      return {
        ...data,
        sessions: data.sessions.map((s) =>
          s.id === id
            ? {
                ...s,
                ...patch,
                note: patch.note.trim().slice(0, 10000),
                updatedAt: Date.now(),
                manuallyEdited: s.manuallyEdited || timeChanged,
                segments: timeChanged ? [] : s.segments,
                extras: timeChanged
                  ? {
                      ...s.extras,
                      originalTiming: s.extras.originalTiming ?? {
                        date: s.date,
                        durationSec: s.durationSec,
                        startEpoch: s.startEpoch,
                        endEpoch: s.endEpoch,
                        segments: s.segments,
                      },
                    }
                  : s.extras,
              }
            : s,
        ),
      };
    },
  deleteSession:
    (id: string) =>
    (data: StudyData): StudyData => ({
      ...data,
      sessions: data.sessions.map((s) =>
        s.id === id
          ? { ...s, deletedAt: Date.now(), updatedAt: Date.now() }
          : s,
      ),
    }),
  restore:
    (collection: "sessions" | "subjects" | "tasks", id: string) =>
    (data: StudyData): StudyData => {
      const row = data[collection].find((r) => r.id === id);
      if (!row) return data;
      const now = Date.now();
      let next = {
        ...data,
        [collection]: data[collection].map((r) =>
          r.id === id ? { ...r, deletedAt: null, updatedAt: now } : r,
        ),
      };
      if (collection === "subjects") {
        const restoreRelated = <
          T extends {
            subjectId: string;
            deletedAt: number | null;
            updatedAt: number;
          },
        >(
          items: T[],
        ) =>
          items.map((r) =>
            r.subjectId === id && r.deletedAt === row.deletedAt
              ? { ...r, deletedAt: null, updatedAt: now }
              : r,
          );
        next = {
          ...next,
          sessions: restoreRelated(next.sessions),
          entries: restoreRelated(next.entries),
          tasks: restoreRelated(next.tasks),
          studyGoals: restoreRelated(next.studyGoals),
        };
      }
      if (collection === "sessions" || collection === "tasks") {
        const parent = (row as DailyTask).subjectId;
        next = {
          ...next,
          subjects: next.subjects.map((s) =>
            s.id === parent && s.deletedAt
              ? { ...s, deletedAt: null, archived: true, updatedAt: now }
              : s,
          ),
        };
      }
      return next;
    },
  addTask:
    (
      task: Pick<
        DailyTask,
        "subjectId" | "date" | "minutes" | "title" | "startTime"
      > & { goalId?: string | null; milestoneId?: string | null },
    ) =>
    (data: StudyData): StudyData => {
      subject(data, task.subjectId);
      validDate(task.date);
      if (
        !task.title.trim() ||
        !Number.isFinite(task.minutes) ||
        task.minutes < 1 ||
        task.minutes > 1440
      )
        throw Error("Төлөвлөгөөний нэр, хугацааг шалгана уу.");
      const goal = data.studyGoals.find(
        (g) =>
          g.id === task.goalId &&
          !g.deletedAt &&
          g.subjectId === task.subjectId,
      );
      if (task.goalId && !goal)
        throw Error("Хичээлтэй тохирох зорилго сонгоно уу.");
      if (
        task.milestoneId &&
        (!goal ||
          !goalDetails(goal).milestones.some((m) => m.id === task.milestoneId))
      )
        throw Error("Зорилгын үе шатыг шалгана уу.");
      if (
        task.startTime !== null &&
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(task.startTime)
      )
        throw Error("Эхлэх цагийг шалгана уу.");
      const { milestoneId, ...fields } = task;
      return {
        ...data,
        tasks: [
          ...data.tasks,
          {
            ...record("task", Date.now()),
            ...fields,
            goalId: task.goalId ?? null,
            title: task.title.trim().slice(0, 200),
            completed: false,
            extras: milestoneId ? { milestoneId } : {},
          },
        ],
      };
    },
  toggleTask:
    (id: string) =>
    (data: StudyData): StudyData => {
      const now = Date.now();
      return {
        ...data,
        tasks: data.tasks.map((t) =>
          t.id === id && !t.deletedAt
            ? {
                ...t,
                completed: !t.completed,
                updatedAt: now,
                extras: {
                  ...t.extras,
                  completedOn: t.completed
                    ? null
                    : studyDate(new Date(now), dayBoundary(data.settings)),
                },
              }
            : t,
        ),
      };
    },
  deleteTask:
    (id: string) =>
    (data: StudyData): StudyData => {
      if (data.activeTimer?.taskId === id)
        throw Error("Энэ алхмын цагийг эхлээд хадгалж эсвэл цуцална уу.");
      return {
        ...data,
        tasks: data.tasks.map((t) =>
          t.id === id
            ? { ...t, deletedAt: Date.now(), updatedAt: Date.now() }
            : t,
        ),
      };
    },
  editTask:
    (
      id: string,
      expected: number,
      patch: Pick<DailyTask, "title" | "date" | "minutes" | "startTime"> & {
        milestoneId?: string | null;
      },
    ) =>
    (data: StudyData): StudyData => {
      const task = data.tasks.find((t) => t.id === id && !t.deletedAt);
      if (!task || task.updatedAt !== expected)
        throw Error("Алхам өөрчлөгдсөн тул дахин нээж засна уу.");
      if (data.activeTimer?.taskId === id)
        throw Error("Энэ алхмын цагийг эхлээд хадгалж эсвэл цуцална уу.");
      validDate(patch.date);
      if (
        !patch.title.trim() ||
        patch.title.length > 200 ||
        !Number.isFinite(patch.minutes) ||
        patch.minutes < 1 ||
        patch.minutes > 1440 ||
        (patch.startTime !== null &&
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(patch.startTime))
      )
        throw Error("Алхмын нэр, хугацаа, цагийг шалгана уу.");
      const { milestoneId, ...fields } = patch;
      if (milestoneId) {
        const goal = data.studyGoals.find(
          (g) => g.id === task.goalId && !g.deletedAt,
        );
        if (
          !goal ||
          !goalDetails(goal).milestones.some((m) => m.id === milestoneId)
        )
          throw Error("Зорилгын үе шат олдсонгүй.");
      }
      return {
        ...data,
        tasks: data.tasks.map((t) =>
          t.id === id
            ? {
                ...t,
                ...fields,
                title: fields.title.trim(),
                updatedAt: Date.now(),
                extras:
                  milestoneId === undefined
                    ? t.extras
                    : { ...t.extras, milestoneId },
              }
            : t,
        ),
      };
    },
  addRecurringTasks:
    (input: {
      subjectId: string;
      title: string;
      startDate: string;
      endDate: string;
      weekdays: number[];
      startTime: string | null;
      minutes: number;
      goalId?: string | null;
      milestoneId?: string | null;
    }) =>
    (data: StudyData): StudyData => {
      subject(data, input.subjectId);
      validDate(input.startDate);
      validDate(input.endDate);
      if (input.endDate < input.startDate) throw Error("Дуусах огноо эхлэхээс өмнө байна.");
      if (!input.weekdays.length || input.weekdays.some((d) => d < 0 || d > 6))
        throw Error("Давтагдах өдрөө сонгоно уу.");
      if (!Number.isFinite(input.minutes) || input.minutes < 1 || input.minutes > 1440)
        throw Error("Төлөвлөсөн хугацаа 1–1440 минут байна.");
      if (input.startTime !== null && !validCalendarTime(input.startTime))
        throw Error("Эхлэх цагийг шалгана уу.");
      const dates = datesBetween(input.startDate, input.endDate);
      if (dates.length > 366) throw Error("Нэг давталтын хүрээ 366 өдрөөс их байж болохгүй.");
      const goal = data.studyGoals.find(
        (g) => g.id === input.goalId && !g.deletedAt && g.subjectId === input.subjectId,
      );
      if (input.goalId && !goal) throw Error("Хичээлтэй тохирох зорилго сонгоно уу.");
      if (
        input.milestoneId &&
        (!goal || !goalDetails(goal).milestones.some((m) => m.id === input.milestoneId))
      )
        throw Error("Зорилгын үе шатыг шалгана уу.");
      const now = Date.now(), seriesId = uid("series");
      const additions = dates
        .filter((ds) => input.weekdays.includes(parseDate(ds)!.getDay()))
        .map((date) => ({
          ...record("task", now),
          subjectId: input.subjectId,
          date,
          minutes: input.minutes,
          title: input.title.trim().slice(0, 200),
          completed: false,
          startTime: input.startTime,
          goalId: input.goalId ?? null,
          extras: {
            ...(input.milestoneId ? { milestoneId: input.milestoneId } : {}),
            seriesId,
            recurrence: {
              weekdays: [...input.weekdays].sort((a, b) => a - b),
              startDate: input.startDate,
              endDate: input.endDate,
              startTime: input.startTime,
            },
          },
        }));
      if (!additions.length) throw Error("Сонгосон хугацаанд давтагдах өдөр олдсонгүй.");
      return { ...data, tasks: [...data.tasks, ...additions] };
    },
  addDeadline:
    (input: { title: string; subjectId: string; date: string; time: string; notes?: string }) =>
    (data: StudyData): StudyData => {
      subject(data, input.subjectId);
      validDate(input.date);
      if (!input.title.trim() || input.title.trim().length > 200 || !validCalendarTime(input.time))
        throw Error("Deadline-ийн нэр, огноо, цагийг шалгана уу.");
      const now = Date.now();
      const deadlines = readCalendarDeadlines(data);
      return withCalendarDeadlines(data, [
        ...deadlines,
        {
          id: uid("deadline"),
          title: input.title.trim().slice(0, 200),
          subjectId: input.subjectId,
          date: input.date,
          time: input.time,
          notes: (input.notes ?? "").trim().slice(0, 2000),
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        },
      ]);
    },
  deleteDeadline:
    (id: string) =>
    (data: StudyData): StudyData => {
      const deadlines = readCalendarDeadlines(data);
      const now = Date.now();
      return withCalendarDeadlines(
        data,
        deadlines.map((d) =>
          d.id === id ? { ...d, deletedAt: now, updatedAt: now } : d,
        ),
      );
    },
  moveSession:
    (id: string, newDate: string, expected: number) =>
    (data: StudyData): StudyData => {
      const old = data.sessions.find((s) => s.id === id && !s.deletedAt);
      if (!old) throw Error("Session олдсонгүй.");
      if (old.updatedAt !== expected) throw Error("Session өөрчлөгдсөн байна. Дахин оролдоно уу.");
      validDate(newDate);
      const from = parseDate(old.date), to = parseDate(newDate);
      if (!from || !to) throw Error("Огноо буруу.");
      if (newDate > studyDate(new Date(), dayBoundary(data.settings), calendarTimeZone(data)))
        throw Error("Session-ийг ирээдүйн өдөр рүү зөөж болохгүй.");
      const delta = to.getTime() - from.getTime();
      const shiftEpoch = (epoch: number) => {
        const d = new Date(epoch);
        const target = new Date(to);
        target.setHours(d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
        return target.getTime();
      };
      const now = Date.now();
      return {
        ...data,
        sessions: data.sessions.map((s) =>
          s.id === id
            ? {
                ...s,
                date: newDate,
                startEpoch: shiftEpoch(s.startEpoch),
                endEpoch: shiftEpoch(s.endEpoch),
                segments: s.segments.map((span) => ({ start: span.start + delta, end: span.end + delta })),
                updatedAt: now,
                manuallyEdited: true,
                extras: {
                  ...s.extras,
                  originalTiming: s.extras.originalTiming ?? {
                    date: s.date,
                    durationSec: s.durationSec,
                    startEpoch: s.startEpoch,
                    endEpoch: s.endEpoch,
                    segments: s.segments,
                  },
                },
              }
            : s,
        ),
      };
    },
  goals:
    (patch: Partial<Goals>) =>
    (data: StudyData): StudyData => ({
      ...data,
      goals: { ...data.goals, ...patch, updatedAt: Date.now() },
    }),
  settings:
    (patch: Partial<Settings>) =>
    (data: StudyData): StudyData => ({
      ...data,
      settings: { ...data.settings, ...patch, updatedAt: Date.now() },
    }),
};
