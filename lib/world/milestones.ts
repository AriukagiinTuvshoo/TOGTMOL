import type { DailyTask, StudyData, StudyGoal } from "@/types/study";
import { datesBetween, parseDate } from "@/lib/calculations/dates";
import { isObject } from "@/lib/migration/values";

export interface Milestone {
  id: string;
  title: string;
}
export interface GoalDetails {
  description: string;
  weeklyDays: number;
  milestones: Milestone[];
}

// Versioned optional metadata travels through the existing v4 JSON payload.
// Reading damaged metadata never overwrites its original value in extras.
export function goalDetails(goal: StudyGoal): GoalDetails {
  const raw = isObject(goal.extras.studyPlan) ? goal.extras.studyPlan : {};
  const seen = new Set<string>();
  const milestones: Milestone[] = [];
  if (Array.isArray(raw.milestones))
    for (const m of raw.milestones) {
      if (
        isObject(m) &&
        typeof m.id === "string" &&
        m.id.length > 0 &&
        m.id.length <= 200 &&
        typeof m.title === "string" &&
        m.title.trim() &&
        !seen.has(m.id)
      ) {
        seen.add(m.id);
        milestones.push({ id: m.id, title: m.title.slice(0, 120) });
      }
    }
  return {
    description:
      typeof raw.description === "string" ? raw.description.slice(0, 2000) : "",
    weeklyDays:
      Number.isInteger(raw.weeklyDays) &&
      Number(raw.weeklyDays) >= 1 &&
      Number(raw.weeklyDays) <= 7
        ? Number(raw.weeklyDays)
        : 5,
    milestones,
  };
}

export function milestoneProgress(
  data: StudyData,
  goal: StudyGoal,
  today: string,
) {
  const tasks = data.tasks.filter((t) => t.goalId === goal.id && !t.deletedAt);
  const taskMilestones = new Map(
    tasks.map((t) => [t.id, t.extras.milestoneId]),
  );
  const seconds = new Map<string, number>();
  for (const s of data.sessions) {
    if (s.deletedAt || s.date > today || s.subjectId !== goal.subjectId)
      continue;
    const linked =
      s.extras.goalId === goal.id ||
      taskMilestones.has(String(s.extras.taskId));
    const id = Object.hasOwn(s.extras, "milestoneId")
      ? s.extras.milestoneId
      : taskMilestones.get(String(s.extras.taskId));
    if (linked && typeof id === "string")
      seconds.set(id, (seconds.get(id) ?? 0) + s.durationSec);
  }
  return goalDetails(goal).milestones.map((milestone) => {
    const linked = tasks.filter((t) => t.extras.milestoneId === milestone.id);
    const completed = linked.filter((t) => t.completed).length;
    return {
      ...milestone,
      tasks: linked,
      completed,
      done: linked.length > 0 && completed === linked.length,
      seconds: seconds.get(milestone.id) ?? 0,
      targetMinutes: linked.reduce((n, t) => n + t.minutes, 0),
    };
  });
}

export function milestoneSuggestions(text: string): string[] {
  if (/python|пайтон/i.test(text))
    return [
      "Python-ийн суурь",
      "Функц ба өгөгдлийн бүтэц",
      "Объект хандалтат програмчлал",
      "Жижиг төсөл ба давтлага",
    ];
  if (/англи|english/i.test(text))
    return [
      "Үг ба өгүүлбэр",
      "Сонсож ойлгох",
      "Ярих ба бичих",
      "Давтлага ба өөрийгөө шалгах",
    ];
  if (/япон|japanese|日本/i.test(text))
    return [
      "Үг ба ханз",
      "Өгүүлбэрийн бүтэц",
      "Унших ба сонсох",
      "Ярих ба давтлага",
    ];
  return [
    "Сууриа давтах",
    "Жишээгээр ажиллах",
    "Бие даан турших",
    "Давтаж, дүгнэх",
  ];
}

export function nextTask(tasks: DailyTask[], today: string) {
  return tasks
    .filter((t) => !t.deletedAt && !t.completed)
    .sort(
      (a, b) =>
        // Today's plan comes before unfinished earlier days, then future work.
        Number(b.date === today) - Number(a.date === today) ||
        a.date.localeCompare(b.date) ||
        (a.startTime ?? "99:99").localeCompare(b.startTime ?? "99:99") ||
        a.createdAt - b.createdAt,
    )[0];
}

export const editGoalDetails =
  (
    id: string,
    expected: number,
    patch: Pick<
      StudyGoal,
      "title" | "weeklyMinutes" | "targetMinutes" | "endsOn"
    > &
      GoalDetails,
  ) =>
  (data: StudyData): StudyData => {
    const goal = data.studyGoals.find((g) => g.id === id && !g.deletedAt);
    if (!goal || goal.updatedAt !== expected)
      throw Error("Зорилго өөрчлөгдсөн тул дахин нээж засна уу.");
    if (
      !patch.title.trim() ||
      patch.title.length > 200 ||
      patch.description.length > 2000 ||
      !Number.isInteger(patch.weeklyDays) ||
      patch.weeklyDays < 1 ||
      patch.weeklyDays > 7 ||
      !Number.isFinite(patch.weeklyMinutes) ||
      patch.weeklyMinutes < 5 ||
      patch.weeklyMinutes > 10080 ||
      !Number.isFinite(patch.targetMinutes) ||
      patch.targetMinutes < 5 ||
      patch.targetMinutes > 120960 ||
      !parseDate(patch.endsOn) ||
      patch.endsOn < goal.startsOn ||
      patch.milestones.length > 12 ||
      patch.milestones.some(
        (m) => !m.id || !m.title.trim() || m.title.length > 120,
      ) ||
      new Set(patch.milestones.map((m) => m.id)).size !==
        patch.milestones.length
    )
      throw Error("Зорилгын нэр, хугацаа, үе шатыг шалгана уу.");
    const old = goalDetails(goal);
    if (
      old.milestones.some((m) => !patch.milestones.some((n) => n.id === m.id))
    )
      throw Error("Өмнөх үе шатыг устгахгүй. Нэрийг нь өөрчилж болно.");
    const previous = isObject(goal.extras.studyPlan)
      ? goal.extras.studyPlan
      : {};
    return {
      ...data,
      studyGoals: data.studyGoals.map((g) =>
        g.id === id
          ? {
              ...g,
              title: patch.title.trim(),
              weeklyMinutes: patch.weeklyMinutes,
              targetMinutes: patch.targetMinutes,
              endsOn: patch.endsOn,
              updatedAt: Date.now(),
              extras: {
                ...g.extras,
                studyPlan: {
                  ...previous,
                  ...(Array.isArray(previous.milestones) &&
                  previous.milestones.length !== old.milestones.length
                    ? {
                        recoveredMilestoneSource:
                          previous.recoveredMilestoneSource ??
                          previous.milestones,
                      }
                    : {}),
                  version: 1,
                  description: patch.description.trim(),
                  weeklyDays: patch.weeklyDays,
                  milestones: patch.milestones.map((m) => ({
                    ...(Array.isArray(previous.milestones)
                      ? previous.milestones.find(
                          (p) => isObject(p) && p.id === m.id,
                        )
                      : {}),
                    ...m,
                    title: m.title.trim(),
                  })),
                },
              },
            }
          : g,
      ),
    };
  };

export function goalPace(goal: StudyGoal, seconds: number, today: string) {
  const remainingMinutes = Math.max(
    0,
    Math.ceil(goal.targetMinutes - seconds / 60),
  );
  const daysLeft = datesBetween(
    today < goal.startsOn ? goal.startsOn : today,
    goal.endsOn,
  ).length;
  const studyDaysLeft = Math.max(
    1,
    Math.ceil((daysLeft / 7) * goalDetails(goal).weeklyDays),
  );
  return {
    remainingMinutes,
    daysLeft,
    minutesPerStudyDay: Math.ceil(remainingMinutes / studyDaysLeft),
  };
}
