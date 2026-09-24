import type { Settings, StudyIndex } from "@/types/study";
import { parseDate, shiftDate, weekStart } from "./dates";
function heatmapLevel(minutes: number) {
  return minutes > 60
    ? 4
    : minutes > 40
      ? 3
      : minutes > 20
        ? 2
        : minutes > 0
          ? 1
          : 0;
}

export const DEFAULT_STREAK_FREEZES = 2;

export function streakFreezeCount(settings: Settings): number {
  const value =
    typeof settings.extras.streakFreezeLimit === "number"
      ? settings.extras.streakFreezeLimit
      : settings.extras.streakFreezeCount;
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 2
    ? value
    : DEFAULT_STREAK_FREEZES;
}
export const streakFreezeLimit = streakFreezeCount;

export function streakWithFreezes(
  dates: Set<string>,
  today: string,
  freezeCount = DEFAULT_STREAK_FREEZES,
) {
  const reserve = Math.max(0, Math.min(2, Math.floor(freezeCount)));
  let current = dates.has(today) ? today : shiftDate(today, -1);
  let streak = 0;
  let used = 0;
  const oldest = [...dates].sort()[0];
  if (!oldest || !dates.has(current))
    return { streak: 0, freezesUsed: 0, freezesRemaining: reserve };

  while (current >= oldest) {
    if (dates.has(current)) streak++;
    else if (used < reserve) {
      used++;
      streak++;
    } else break;
    current = shiftDate(current, -1);
  }
  if (streak <= used)
    return { streak: 0, freezesUsed: 0, freezesRemaining: reserve };

  return {
    streak,
    freezesUsed: used,
    freezesRemaining: reserve - used,
  };
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
  const state = streakWithFreezes(dates, today, freezeLimit);
  return { streak: state.streak, usedFreezes: state.freezesUsed };
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

export function annualHeatmap(index: StudyIndex, year: number): AnnualHeatmap {
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

