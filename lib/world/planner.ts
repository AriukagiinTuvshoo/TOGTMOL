import type { DailyTask, StudyData, StudyGoal } from "@/types/study";
import { uid } from "@/lib/constants";
import { shiftDate, dateKey, parseDate } from "@/lib/calculations/dates";
export interface PlanInput {
  title: string;
  subjectId: string;
  startsOn: string;
  weeks: number;
  daysPerWeek: number;
  minutesPerDay: number;
}
export interface PlanPreview {
  goal: StudyGoal;
  tasks: DailyTask[];
}
export function inferPlan(
  text: string,
  data: StudyData,
  today = dateKey(),
): PlanInput {
  const lower = text.toLocaleLowerCase(),
    subjects = data.subjects.filter((s) => !s.deletedAt && !s.archived);
  const subject = subjects.find((s) =>
    lower.includes(s.name.toLocaleLowerCase()),
  );
  const weeks =
    Number(lower.match(/(\d+)\s*(?:долоо хоног|week)/)?.[1]) ||
    (Number(lower.match(/(\d+)\s*(?:сар|month)/)?.[1]) || 1) * 4;
  const minutes =
    Number(lower.match(/(\d+)\s*(?:минут|мин\b|minute|min\b)/)?.[1]) || 25;
  return {
    title: text.trim().slice(0, 200),
    subjectId: subject?.id ?? subjects[0]?.id ?? "",
    startsOn: today,
    weeks: Math.max(1, Math.min(12, weeks)),
    daysPerWeek: 5,
    minutesPerDay: Math.max(5, Math.min(120, minutes)),
  };
}
export function planPreview(
  input: PlanInput,
  data: StudyData,
  now = Date.now(),
): PlanPreview {
  if (!data.subjects.some((s) => s.id === input.subjectId && !s.deletedAt))
    throw Error("Зорилгоо хичээлтэй холбоно уу.");
  if (
    !input.title.trim() ||
    input.title.length > 200 ||
    !parseDate(input.startsOn) ||
    !Number.isInteger(input.weeks) ||
    input.weeks < 1 ||
    input.weeks > 12 ||
    !Number.isInteger(input.daysPerWeek) ||
    input.daysPerWeek < 1 ||
    input.daysPerWeek > 7 ||
    !Number.isInteger(input.minutesPerDay) ||
    input.minutesPerDay < 5 ||
    input.minutesPerDay > 120
  )
    throw Error("Нэр, эхлэх өдөр, долоо хоног болон хугацаагаа шалгана уу.");
  const base = { createdAt: now, updatedAt: now, deletedAt: null, extras: {} };
  const goal: StudyGoal = {
    ...base,
    id: uid("goal"),
    subjectId: input.subjectId,
    title: input.title.trim(),
    startsOn: input.startsOn,
    endsOn: shiftDate(input.startsOn, input.weeks * 7 - 1),
    weeklyMinutes: input.minutesPerDay * input.daysPerWeek,
    targetMinutes: input.weeks * input.daysPerWeek * input.minutesPerDay,
  };
  const tasks: DailyTask[] = [];
  const stages = [
    "Сууриа давтах",
    "Жишээгээр ажиллах",
    "Бие даан турших",
    "Давтаж, дүгнэх",
  ];
  for (let w = 0; w < input.weeks; w++) {
    for (let day = 0; day < input.daysPerWeek; day++) {
      tasks.push({
        ...base,
        id: uid("task"),
        subjectId: input.subjectId,
        goalId: goal.id,
        date: shiftDate(
          input.startsOn,
          w * 7 + Math.floor((day * 7) / input.daysPerWeek),
        ),
        minutes: input.minutesPerDay,
        title:
          `${stages[Math.min(3, Math.floor((w / input.weeks) * 4))]} · ${goal.title}`.slice(
            0,
            200,
          ),
        completed: false,
        startTime: null,
      });
    }
  }
  return { goal, tasks };
}
export const commitPlan =
  (preview: PlanPreview) =>
  (data: StudyData): StudyData => {
    if (
      !data.subjects.some(
        (s) => s.id === preview.goal.subjectId && !s.deletedAt,
      )
    )
      throw Error("Энэ хичээл устсан байна. Шинэ төлөвлөгөө гаргана уу.");
    if (data.studyGoals.some((g) => g.id === preview.goal.id)) return data;
    return {
      ...data,
      studyGoals: [...data.studyGoals, preview.goal],
      tasks: [...data.tasks, ...preview.tasks],
    };
  };
export const deleteGoal =
  (id: string) =>
  (data: StudyData): StudyData => {
    if (data.activeTimer?.extras.goalId === id)
      throw Error("Эхлээд энэ зорилгын timer-аа дуусгана уу.");
    const now = Date.now();
    return {
      ...data,
      studyGoals: data.studyGoals.map((g) =>
        g.id === id ? { ...g, updatedAt: now, deletedAt: now } : g,
      ),
      tasks: data.tasks.map((t) =>
        t.goalId === id && !t.deletedAt
          ? { ...t, updatedAt: now, deletedAt: now }
          : t,
      ),
    };
  };
export const restoreGoal =
  (id: string) =>
  (data: StudyData): StudyData => {
    const goal = data.studyGoals.find((g) => g.id === id);
    if (!goal?.deletedAt) return data;
    const now = Date.now();
    return {
      ...data,
      studyGoals: data.studyGoals.map((g) =>
        g.id === id ? { ...g, updatedAt: now, deletedAt: null } : g,
      ),
      tasks: data.tasks.map((t) =>
        t.goalId === id && t.deletedAt === goal.deletedAt
          ? { ...t, updatedAt: now, deletedAt: null }
          : t,
      ),
      subjects: data.subjects.map((s) =>
        s.id === goal.subjectId && s.deletedAt
          ? { ...s, archived: true, updatedAt: now, deletedAt: null }
          : s,
      ),
    };
  };
