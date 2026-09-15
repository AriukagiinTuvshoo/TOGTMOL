import type { StudyData, StudyIndex } from "@/types/study";
import { periodStats, weeklyReport } from "@/lib/calculations/analytics";
import { formatTime } from "@/lib/calculations/dates";
export interface Insight {
  id: string;
  title: string;
  body: string;
}
export interface PlanSuggestion {
  subjectId: string;
  title: string;
  minutes: number;
  reason: string;
}
// An API-backed provider can implement this contract without changing storage or timer code.
export interface StudyAssistantProvider {
  kind: "local" | "ai";
  review(index: StudyIndex, today: string): Promise<Insight[]>;
  plan(
    data: StudyData,
    index: StudyIndex,
    today: string,
    budget: number,
  ): Promise<PlanSuggestion[]>;
}
export function insights(index: StudyIndex, today: string): Insight[] {
  const stats = periodStats(index, 30, today),
    week = weeklyReport(index, today),
    result: Insight[] = [];
  if (!stats.sessionCount)
    return [
      {
        id: "start",
        title: "Таны хэмнэл эндээс эхэлнэ",
        body: "Эхний хичээлээ хэмжсэний дараа бодит мэдээлэлд тулгуурласан дүгнэлт харагдана.",
      },
    ];
  result.push({
    id: "average",
    title: `Дундаж хичээл ${formatTime(stats.averageSession)}`,
    body: `Сүүлийн 30 өдрийн ${stats.sessionCount} хичээлийн сонгосон хугацаанд багтсан хэмжилтээр.`,
  });
  if (week.change !== null)
    result.push({
      id: "week",
      title: `Энэ долоо хоног ${Math.abs(week.change).toFixed(0)}% ${week.change >= 0 ? "өссөн" : "бага"}`,
      body: "Өмнөх долоо хоногийн ижил өдрүүдтэй харьцуулсан. Өдөр бүр ижил байх албагүй.",
    });
  if (stats.sessionCount >= 3 && stats.bestHour !== null)
    result.push({
      id: "hour",
      title: `${String(stats.bestHour).padStart(2, "0")}:00 цагт илүү хугацаа`,
      body: "Сүүлийн 30 өдрийн хэмжсэн хугацаа хамгийн их хуримтлагдсан цаг. Танд тохирвол энэ цагт төлөвлөөрэй.",
    });
  const active = [...index.subjects.values()].filter(
      (s) => !s.deletedAt && !s.archived,
    ),
    least = active
      .map((s) => ({ s, seconds: stats.bySubject.get(s.id) ?? 0 }))
      .sort((a, b) => a.seconds - b.seconds)[0];
  if (active.length > 1 && least)
    result.push({
      id: "balance",
      title: `${least.s.name}: ${formatTime(least.seconds)}`,
      body: "Сүүлийн 30 өдөр хамгийн бага цаг зориулсан хичээл. Мэдлэгийн түвшнийг хугацаанаас дүгнэх боломжгүй.",
    });
  return result;
}
export function suggestPlan(
  data: StudyData,
  index: StudyIndex,
  today: string,
  budget: number,
): PlanSuggestion[] {
  const stats = periodStats(index, 7, today),
    subjects = data.subjects
      .filter((s) => !s.deletedAt && !s.archived)
      .sort(
        (a, b) =>
          (stats.bySubject.get(a.id) ?? 0) - (stats.bySubject.get(b.id) ?? 0),
      )
      .slice(0, Math.min(3, Math.max(1, Math.floor(budget / 10))));
  if (!subjects.length || !Number.isFinite(budget) || budget < 5) return [];
  const minutes = Math.floor(budget / subjects.length);
  return subjects.map((s, i) => ({
    subjectId: s.id,
    title: `${s.name} — давтах`,
    minutes: minutes + (i === 0 ? budget % subjects.length : 0),
    reason: `Сүүлийн 7 өдөр ${formatTime(stats.bySubject.get(s.id) ?? 0)} зориулсан.`,
  }));
}
export const localAssistant: StudyAssistantProvider = {
  kind: "local",
  review: async (index, today) => insights(index, today),
  plan: async (data, index, today, budget) =>
    suggestPlan(data, index, today, budget),
};
