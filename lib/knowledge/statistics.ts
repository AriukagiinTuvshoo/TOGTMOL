import type { StudyData } from "@/types/study";
import { dayBoundary } from "@/lib/preferences";
import { studyDate } from "@/lib/calculations/dates";
export function knowledgeStatistics(
  data: StudyData,
  from: string,
  to: string,
  subject = "",
) {
  const records = data.knowledge.filter(
    (r) => !r.deletedAt && (!subject || r.subjectId === subject),
  );
  const selected = records.filter((r) => {
    const date =
      "date" in r
        ? r.date
        : studyDate(
            new Date(r.kind === "review" ? r.reviewedAt : r.createdAt),
            dayBoundary(data.settings),
          );
    return date >= from && date <= to;
  });
  const reviews = selected.filter((r) => r.kind === "review");
  const attempts = selected.filter((r) => r.kind === "attempt");
  const answered = attempts.reduce((sum, r) => sum + r.total, 0);
  return {
    notes: selected.filter((r) => r.kind === "note").length,
    cards: selected.filter((r) => r.kind === "card").length,
    reviews: reviews.length,
    uniqueReviewed: new Set(reviews.map((r) => r.cardId)).size,
    recall: reviews.length
      ? Math.round(
          (100 * reviews.filter((r) => r.grade >= 3).length) / reviews.length,
        )
      : null,
    attempts: attempts.length,
    quizAccuracy: answered
      ? Math.round(
          (100 * attempts.reduce((sum, r) => sum + r.score, 0)) / answered,
        )
      : null,
  };
}
