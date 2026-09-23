import { dayBoundary } from "@/lib/preferences";
import { ROOM_REWARDS } from "@/lib/world/config";
import type { StudyData, StudyGoal, StudyIndex } from "@/types/study";
import { buildIndex, sessionAllocations } from "@/lib/calculations/analytics";
import {
  shiftDate,
  dateKey,
  weekStart,
  currentStreak,
} from "@/lib/calculations/dates";
export type CompanionState =
  | "idle"
  | "studying"
  | "paused"
  | "break"
  | "happy"
  | "celebrating"
  | "welcome";
export function dailyXP(minutes: number): number {
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  return Math.floor(
    Math.min(minutes, 30) + Math.min(Math.max(0, minutes - 30), 60) / 2,
  );
}
export function companionProgress(data: StudyData, today = dateKey()) {
  const measured = buildIndex(
    {
      ...data,
      entries: [],
      sessions: data.sessions.filter(
        (s) =>
          !s.manuallyEdited && !s.startTimeEstimated && s.segments.length > 0,
      ),
    },
    today,
  );
  const xp = [...measured.days.values()].reduce(
    (n, d) => n + dailyXP(d.seconds / 60),
    0,
  );
  const studyHours = buildIndex(data, today).totalSeconds / 3600;
  return {
    xp,
    level: Math.floor(xp / 100) + 1,
    intoLevel: xp % 100,
    todayXP: dailyXP((measured.days.get(today)?.seconds ?? 0) / 60),
    studyHours,
    roomRewards: ROOM_REWARDS.filter((reward) => studyHours >= reward.requiredHours),
  };
}
export function companionState(
  data: StudyData,
  index: StudyIndex,
  today: string,
): CompanionState {
  const t = data.activeTimer;
  if (t)
    return t.status === "review"
      ? "happy"
      : t.phase !== "focus"
        ? "break"
        : t.running
          ? "studying"
          : "paused";
  const streak = currentStreak(new Set(index.sortedDates), today);
  if (index.days.has(today) && streak > 0 && streak % 7 === 0)
    return "celebrating";
  if (index.days.has(today)) return "happy";
  return index.sortedDates.length > 0 && !index.days.has(shiftDate(today, -1))
    ? "welcome"
    : "idle";
}
export function greeting(hour: number, state: CompanionState) {
  if (state === "welcome") return "Дахиад уулзсандаа баяртай.";
  if (state === "break") return "Жаахан амсхийгээд авъя.";
  if (state === "studying") return "Нэг алхамдаа төвлөрье.";
  if (state === "happy" || state === "celebrating")
    return "Өнөөдрийн алхам тань үнэ цэнтэй.";
  return hour < 12
    ? "Өглөөний мэнд. Өөртөө цаг гаргая."
    : hour < 18
      ? "Өдрийн мэнд. Хамтдаа эхэлье."
      : "Оройн мэнд. Тайван суралцъя.";
}
export function goalProgress(data: StudyData, goal: StudyGoal, today: string) {
  const tasks = data.tasks.filter((t) => t.goalId === goal.id && !t.deletedAt);
  const taskIds = new Set(tasks.map((t) => t.id));
  const linked = data.sessions.filter(
    (s) =>
      !s.deletedAt &&
      s.date <= today &&
      s.subjectId === goal.subjectId &&
      (s.extras.goalId === goal.id ||
        (typeof s.extras.taskId === "string" && taskIds.has(s.extras.taskId))),
  );
  const seconds = linked.reduce((n, s) => n + s.durationSec, 0);
  const start = weekStart(today);
  const weeklySeconds = linked.reduce(
    (n, session) =>
      n +
      sessionAllocations(session, dayBoundary(data.settings))
        .filter((d) => d.date >= start && d.date <= today)
        .reduce((sum, d) => sum + d.seconds, 0),
    0,
  );
  return {
    seconds,
    weeklySeconds,
    tasks,
    completed: tasks.filter((t) => t.completed).length,
    percent: Math.min(100, (seconds / (goal.targetMinutes * 60)) * 100),
  };
}
