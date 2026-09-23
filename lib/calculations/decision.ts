import type { Settings, StudyData, StudyIndex } from "@/types/study";
import { parseDate, shiftDate, weekStart } from "./dates";
function heatmapLevel(minutes: number) {
  return minutes > 60 ? 4 : minutes > 40 ? 3 : minutes > 20 ? 2 : minutes > 0 ? 1 : 0;
}

export const DEFAULT_STREAK_FREEZES = 2;

export function streakFreezeLimit(settings: Settings): number {
  const value = settings.extras.streakFreezeLimit;
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 2
    ? value
    : DEFAULT_STREAK_FREEZES;
}

export interface StreakWithFreezes {
  streak: number;
  usedFreezes: number;
}

export function currentStreakWithFreezes(
  dates: Set<string>,
  today: string,
  freezeLimit = DEFAULT_STREAK_FREEZES,
): StreakWithFreezes {
  const oldest = [...dates].sort()[0];
  if (!oldest) return { streak: 0, usedFreezes: 0 };
  let cursor = dates.has(today) ? today : shiftDate(today, -1);
  let streak = 0;
  let usedFreezes = 0;
  const limit = Math.max(0, Math.floor(freezeLimit));

  while (cursor >= oldest) {
    if (dates.has(cursor)) {
      streak++;
    } else if (usedFreezes < limit) {
      usedFreezes++;
      streak++;
    } else {
      break;
    }
    cursor = shiftDate(cursor, -1);
  }
  return { streak, usedFreezes };
}

function dayDistance(from: string, to: string): number {
  const a = parseDate(from);
  const b = parseDate(to);
  if (!a || !b) return Number.POSITIVE_INFINITY;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function longestStreakWithFreezes(
  dates: Iterable<string>,
  freezeLimit = DEFAULT_STREAK_FREEZES,
): number {
  const sorted = [...new Set(dates)].sort();
  if (!sorted.length) return 0;
  const limit = Math.max(0, Math.floor(freezeLimit));
  let best = 1;
  let run = 1;
  let used = 0;

  for (let i = 1; i < sorted.length; i++) {
    const gap = dayDistance(sorted[i - 1], sorted[i]) - 1;
    if (gap < 0) continue;
    if (gap === 0) {
      run++;
      continue;
    }
    if (gap <= limit && used + gap <= limit) {
      used += gap;
      run += gap + 1;
      best = Math.max(best, run);
      continue;
    }
    run = 1;
    used = 0;
  }
  return Math.max(best, run);
}

export interface AnnualHeatmapCell {
  date: string;
  minutes: number;
  level: number;
  inYear: boolean;
}

export interface AnnualHeatmap {
  year: number;
  weeks: AnnualHeatmapCell[][];
  activeDays: number;
  totalMinutes: number;
}

export function annualHeatmap(
  index: StudyIndex,
  year: number,
): AnnualHeatmap {
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const firstWeek = weekStart(start);
  const lastWeek = weekStart(end);
  const weeks: AnnualHeatmapCell[][] = [];
  let cursor = firstWeek;
  let activeDays = 0;
  let totalSeconds = 0;

  while (cursor <= lastWeek) {
    const week: AnnualHeatmapCell[] = [];
    for (let day = 0; day < 7; day++) {
      const date = shiftDate(cursor, day);
      const summary = index.days.get(date);
      const minutes = (summary?.seconds ?? 0) / 60;
      const inYear = date >= start && date <= end;
      if (inYear) {
        if (minutes > 0) activeDays++;
        totalSeconds += summary?.seconds ?? 0;
      }
      week.push({
        date,
        minutes,
        level: inYear ? heatmapLevel(minutes) : 0,
        inYear,
      });
    }
    weeks.push(week);
    cursor = shiftDate(cursor, 7);
  }

  return {
    year,
    weeks,
    activeDays,
    totalMinutes: totalSeconds / 60,
  };
}

export interface BehaviorAttempt {
  id: string;
  subjectId: string;
  startEpoch: number;
  discardedAt: number;
  accumulatedSec: number;
  targetSec: number | null;
}

function behaviorAttempts(data: StudyData): BehaviorAttempt[] {
  const raw = data.extras.behaviorAttempts;
  if (!Array.isArray(raw)) return [];
  return raw.filter((value): value is BehaviorAttempt => {
    if (!value || typeof value !== "object") return false;
    const item = value as Record<string, unknown>;
    return (
      typeof item.id === "string" &&
      typeof item.subjectId === "string" &&
      Number.isFinite(item.startEpoch) &&
      Number.isFinite(item.discardedAt) &&
      Number.isFinite(item.accumulatedSec) &&
      (item.targetSec === null || Number.isFinite(item.targetSec))
    );
  });
}

export interface BehaviorPattern {
  id: string;
  tone: "attention" | "positive";
  title: string;
  body: string;
  count: number;
}

export function behaviorPatterns(
  data: StudyData,
  index: StudyIndex,
  minimumAttempts = 4,
): BehaviorPattern[] {
  const completed = index.sessions
    .filter((session) => session.startEpoch > 0)
    .map((session) => ({
      startEpoch: session.startEpoch,
      abandoned: false,
    }));
  const abandoned = behaviorAttempts(data).map((attempt) => ({
    startEpoch: attempt.startEpoch,
    abandoned: true,
  }));
  const all = [...completed, ...abandoned];
  if (all.length < minimumAttempts) return [];

  const late = all.filter((item) => new Date(item.startEpoch).getHours() >= 21);
  if (late.length < minimumAttempts) return [];

  const lateAbandoned = late.filter((item) => item.abandoned).length;
  const rate = Math.round((lateAbandoned / late.length) * 100);

  if (lateAbandoned === 0)
    return [
      {
        id: "late-starts-complete",
        tone: "positive",
        title: "21:00-с хойших эхлэл тогтвортой байна",
        body: `Энэ цагийн ${late.length} эхлэлээс одоогоор дуусгалгүй орхисон нь алга.`,
        count: late.length,
      },
    ];

  return [
    {
      id: "late-starts-abandoned",
      tone: "attention",
      title: "Оройн эхлэл дээр тасалдах хандлага байна",
      body: `21:00-с хойш эхэлсэн ${late.length} session-ээс ${lateAbandoned} нь дуусгалгүй орхигдсон (${rate}%). Оройн session-ээ богино зорилтоор эхлүүлэхийг туршаарай.`,
      count: late.length,
    },
  ];
}
