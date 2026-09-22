import type { StudyData } from "@/types/study";
import { knowledgeIndex } from "@/lib/knowledge/index";
import { shiftDate } from "@/lib/calculations/dates";
export function reminderMessage(data: StudyData, today: string) {
  const extras = data.settings.extras,
    parts: string[] = [];
  if (extras.remindPlan) {
    const count = data.tasks.filter(
      (t) => !t.deletedAt && !t.completed && t.date === today,
    ).length;
    if (count) parts.push(`${count} жижиг алхам`);
  }
  if (extras.remindCards) {
    const count = knowledgeIndex(data.knowledge, today).reviewQueue.length;
    if (count) parts.push(`${count} давтах карт`);
  }
  if (extras.remindGoals) {
    const count = data.studyGoals.filter(
      (g) =>
        !g.deletedAt && g.endsOn >= today && g.endsOn <= shiftDate(today, 3),
    ).length;
    if (count) parts.push(`${count} зорилгын хугацаа дөхөж байна`);
  }
  return parts.length
    ? `${parts.join(" · ")}. Боломжтой үедээ үргэлжлүүлээрэй.`
    : "Өнөөдөр нэг жижиг алхам хийх үү?";
}
