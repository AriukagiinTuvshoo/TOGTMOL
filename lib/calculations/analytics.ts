import { dayBoundary } from "@/lib/preferences";
import type {
  DailySummary,
  PeriodStats,
  StudyData,
  StudyIndex,
  StudySession,
} from "@/types/study";
import {
  dateKey,
  studyDate,
  currentStreak,
  datesBetween,
  longestStreak,
  shiftDate,
  weekStart,
} from "./dates";
export function emptyDay(date: string): DailySummary {
  return {
    date,
    seconds: 0,
    subjects: new Set(),
    sessions: new Set(),
    hours: Array(24).fill(0),
  };
}
function getDay(map: Map<string, DailySummary>, date: string) {
  let day = map.get(date);
  if (!day) {
    day = emptyDay(date);
    map.set(date, day);
  }
  return day;
}
export function sessionAllocations(
  session: StudySession,
  boundary = 0,
): { date: string; hour: number; seconds: number }[] {
  const spans = [...session.segments].sort((a, b) => a.start - b.start),
    sum = spans.reduce((n, s) => n + (s.end - s.start) / 1000, 0);
  const valid =
    spans.length > 0 &&
    sum >= session.durationSec &&
    sum - session.durationSec <= 1.001 &&
    spans.every(
      (s, i) =>
        s.end - s.start <= 366 * 86400000 &&
        (!i || s.start >= spans[i - 1].end),
    );
  if (!valid)
    return [
      {
        date: session.date,
        hour: session.startTimeEstimated
          ? -1
          : new Date(session.startEpoch).getHours(),
        seconds: session.durationSec,
      },
    ];
  const result: { date: string; hour: number; seconds: number }[] = [];
  for (const span of spans) {
    let cursor = span.start;
    while (cursor < span.end) {
      const d = new Date(cursor),
        next = new Date(cursor);
      next.setMinutes(60, 0, 0);
      const end = Math.min(span.end, Math.max(cursor + 1, next.getTime()));
      result.push({
        date: studyDate(d, boundary),
        hour: d.getHours(),
        seconds: ((end - cursor) / 1000) * (session.durationSec / sum),
      });
      cursor = end;
    }
  }
  return result;
}
export function buildIndex(
  data: StudyData,
  today = studyDate(new Date(), dayBoundary(data.settings)),
  boundary = dayBoundary(data.settings),
): StudyIndex {
  const days = new Map<string, DailySummary>(),
    subjectDays = new Map<string, Map<string, DailySummary>>(),
    bySubject = new Map<string, StudySession[]>(),
    hours = Array<number>(24).fill(0);
  const subjectMap = new Map(data.subjects.map((s) => [s.id, s]));
  const subjectDay = (id: string, ds: string) => {
    let map = subjectDays.get(id);
    if (!map) {
      map = new Map();
      subjectDays.set(id, map);
    }
    return getDay(map, ds);
  };
  const sessions = data.sessions
    .filter(
      (s) =>
        !s.deletedAt &&
        s.durationSec > 0 &&
        (s.date <= today ||
          (boundary > 0 &&
            s.segments.length > 0 &&
            s.date === shiftDate(today, 1))),
    )
    .sort((a, b) => b.startEpoch - a.startEpoch || b.id.localeCompare(a.id));
  for (const session of sessions) {
    let list = bySubject.get(session.subjectId);
    if (!list) {
      list = [];
      bySubject.set(session.subjectId, list);
    }
    list.push(session);
    for (const part of sessionAllocations(session, boundary)) {
      if (part.date > today) continue;
      for (const d of [
        getDay(days, part.date),
        subjectDay(session.subjectId, part.date),
      ]) {
        d.seconds += part.seconds;
        d.subjects.add(session.subjectId);
        d.sessions.add(session.id);
        if (part.hour >= 0 && part.hour < 24)
          d.hours[part.hour] += part.seconds;
      }
      if (part.hour >= 0 && part.hour < 24) hours[part.hour] += part.seconds;
    }
  }
  for (const e of data.entries)
    if (!e.deletedAt && e.date <= today) {
      getDay(days, e.date).subjects.add(e.subjectId);
      subjectDay(e.subjectId, e.date).subjects.add(e.subjectId);
    }
  return {
    days,
    subjectDays,
    bySubject,
    sessions,
    subjects: subjectMap,
    hours,
    totalSeconds: [...days.values()].reduce((n, d) => n + d.seconds, 0),
    sortedDates: [...days.keys()].sort(),
  };
}
export function periodStats(
  index: StudyIndex,
  count: number | "all",
  today = dateKey(),
  subjectId?: string,
): PeriodStats {
  const map = subjectId
    ? (index.subjectDays.get(subjectId) ?? new Map<string, DailySummary>())
    : index.days;
  const first = [...map.keys()].sort()[0] ?? today;
  const start = count === "all" ? first : shiftDate(today, 1 - count),
    dates = datesBetween(start, today);
  const days = dates.map((ds) => map.get(ds) ?? emptyDay(ds)),
    sessions = new Set<string>(),
    bySubject = new Map<string, number>(),
    hours = Array<number>(24).fill(0);
  let seconds = 0,
    studyDays = 0,
    bestDay: string | null = null,
    bestValue = 0;
  for (const day of days) {
    seconds += day.seconds;
    day.sessions.forEach((id) => sessions.add(id));
    if (day.subjects.size) studyDays++;
    if (day.seconds > bestValue) {
      bestValue = day.seconds;
      bestDay = day.date;
    }
    day.hours.forEach((sec, h) => (hours[h] += sec));
    for (const id of day.subjects)
      bySubject.set(
        id,
        (bySubject.get(id) ?? 0) +
          (index.subjectDays.get(id)?.get(day.date)?.seconds ?? 0),
      );
  }
  const top = [...bySubject].sort((a, b) => b[1] - a[1])[0],
    maxHour = Math.max(...hours);
  return {
    seconds,
    averageDaily: seconds / Math.max(1, dates.length),
    averageSession: seconds / Math.max(1, sessions.size),
    studyDays,
    consistency: (studyDays / Math.max(1, dates.length)) * 100,
    longestStreak: longestStreak(
      days.filter((d) => d.subjects.size).map((d) => d.date),
    ),
    currentStreak: currentStreak(new Set([...map.keys()]), today),
    longestSession: index.sessions.reduce(
      (max, s) => (sessions.has(s.id) ? Math.max(max, s.durationSec) : max),
      0,
    ),
    sessionCount: sessions.size,
    topSubject: top?.[1] > 0 ? top[0] : null,
    bestDay,
    bestHour: maxHour > 0 ? hours.indexOf(maxHour) : null,
    days,
    hours,
    bySubject,
    periodDays: dates.length,
  };
}
export function weeklyReport(index: StudyIndex, today = dateKey()) {
  const mon = weekStart(today),
    until = datesBetween(mon, today),
    week = datesBetween(mon, shiftDate(mon, 6));
  const seconds = until.reduce(
    (n, ds) => n + (index.days.get(ds)?.seconds ?? 0),
    0,
  );
  const previousFull = week.reduce(
    (n, ds) => n + (index.days.get(shiftDate(ds, -7))?.seconds ?? 0),
    0,
  );
  const previousComparable = until.reduce(
    (n, ds) => n + (index.days.get(shiftDate(ds, -7))?.seconds ?? 0),
    0,
  );
  return {
    seconds,
    previousFull,
    previousComparable,
    change:
      previousComparable > 0 ? (seconds / previousComparable - 1) * 100 : null,
    studyDays: until.filter((ds) => index.days.get(ds)?.subjects.size).length,
    days: week.map((ds) => index.days.get(ds) ?? emptyDay(ds)),
  };
}
export function intensity(day: DailySummary | undefined) {
  const m = (day?.seconds ?? 0) / 60;
  return m > 60 ? 4 : m > 40 ? 3 : m > 20 ? 2 : m > 0 ? 1 : 0;
}
