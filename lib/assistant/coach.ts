import type { StudyData, StudyIndex } from "@/types/study";
import { formatTime } from "@/lib/calculations/dates";
import { goalDetails, goalPace, nextTask } from "@/lib/world/milestones";
import { goalProgress } from "@/lib/world/progress";
import { periodStats } from "@/lib/calculations/analytics";
import type { Insight } from "./provider";
import { isObject } from "@/lib/migration/values";
import { knowledgeStatistics } from "@/lib/knowledge/statistics";
import { shiftDate } from "@/lib/calculations/dates";

export function coachInsights(
  data: StudyData,
  index: StudyIndex,
  today: string,
): Insight[] {
  const result: Insight[] = [];
  for (const goal of data.studyGoals.filter((g) => !g.deletedAt).slice(0, 20)) {
    // Older v4 goals did not store study-day preferences; do not invent them.
    if (
      !isObject(goal.extras.studyPlan) ||
      !Number.isInteger(goal.extras.studyPlan.weeklyDays)
    )
      continue;
    const p = goalProgress(data, goal, today),
      pace = goalPace(goal, p.seconds, today);
    if (!pace.remainingMinutes) continue;
    const dailyTarget = goal.weeklyMinutes / goalDetails(goal).weeklyDays;
    if (!pace.daysLeft)
      result.push({
        id: `goal:${goal.id}`,
        title: `${goal.title}: хугацаагаа шинэчилж болно`,
        body: `${formatTime(p.seconds)} хуримтлуулжээ. Дуусах өдөр өнгөрсөн тул үлдсэн ${formatTime(pace.remainingMinutes * 60)}-ыг шинэ хуваарьт тааруулаарай.`,
      });
    else if (pace.minutesPerStudyDay > dailyTarget * 1.25)
      result.push({
        id: `goal:${goal.id}`,
        title: `${goal.title}: хуваариа тааруулъя`,
        body: `${pace.daysLeft} хоног үлдсэн. Сонгосон өдрүүдээр тооцвол суралцах өдөрт ойролцоогоор ${pace.minutesPerStudyDay} минут хэрэгтэй; одоогийн төлөвлөгөө ${Math.round(dailyTarget)} минут. Хугацаагаа сунгах эсвэл зорилгын хэмжээг багасгаж болно.`,
      });
  }
  const next = nextTask(
    data.tasks.filter((t) => t.date <= today),
    today,
  );
  if (next)
    result.push({
      id: "next",
      title: "Дараагийн жижиг алхам",
      body: `${next.title} · ${next.minutes} минут. ${next.date < today ? "Өмнөх өдрийн алхмыг өнөөдөр үргэлжлүүлж эсвэл өдрийг нь сольж болно." : "Өнөөдрийн төлөвлөгөөнөөсөө шууд эхлээрэй."}`,
    });
  const recent = periodStats(index, 14, today);
  const practice = knowledgeStatistics(data, shiftDate(today, -6), today);
  if (practice.reviews >= 3)
    result.push({
      id: "recall",
      title: "Эргэн санах дадал",
      body: `Сүүлийн 7 өдөр ${practice.uniqueReviewed} өөр картаа ${practice.reviews} удаа давтжээ. ${practice.recall}% нь санасан гэсэн өөрийн үнэлгээтэй. Эргэлзсэн картаа дахин хараад, өөр үгээр тайлбарлаж үзээрэй.`,
    });
  if (recent.sessionCount >= 3 && recent.bestHour !== null)
    result.push({
      id: "rhythm",
      title: "Танд тогтсон суралцах цаг",
      body: `Сүүлийн 14 хоногийн хэмжсэн хугацаа ${String(recent.bestHour).padStart(2, "0")}:00 цаг орчимд хамгийн их байна. Дараагийн жижиг алхмаа энэ цагт төлөвлөж үзэж болно. Энэ нь зөвхөн хугацааны ажиглалт юм.`,
    });
  if (recent.sessionCount >= 3 && recent.averageSession > 90 * 60)
    result.push({
      id: "rest",
      title: "Завсарлагаа төлөвлөе",
      body: `Сүүлийн 14 өдрийн нэг хичээл дунджаар ${formatTime(recent.averageSession)} байна. Танд тохирвол хэдэн жижиг хэсэгт хуваагаад үзээрэй.`,
    });
  return result;
}
