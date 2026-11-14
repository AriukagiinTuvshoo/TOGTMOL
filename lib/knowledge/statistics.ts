import type { StudyData } from "@/types/study";
import type { ReviewSchedule } from "@/types/knowledge";
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

/** An interval this long means the card is scheduled well into the future. */
export const MATURE_INTERVAL_DAYS = 21;

/** Default window for the recall figure shown next to a deck. */
export const RETENTION_WINDOW_DAYS = 30;

/**
 * Start of a retention window, measured back from a study day. Deriving it from
 * `today` keeps callers pure: no clock read inside a render or a memo.
 */
export function retentionWindowStart(
  today: string,
  days = RETENTION_WINDOW_DAYS,
): number {
  const start = Date.parse(`${today}T00:00:00`);
  return Number.isFinite(start) ? start - days * 86400000 : -Infinity;
}

export interface DeckMastery {
  deckId: string;
  total: number;
  fresh: number;
  learning: number;
  mature: number;
  dueNow: number;
  /** 0–100 progress estimate, not a recall probability. */
  mastery: number;
  /** Share of reviews graded 3+ in the window, or null without reviews. */
  retention: number | null;
  reviews: number;
}

/** Fresh cards are 0, learning cards scale with interval, mature cards are 1. */
function cardScore(schedule: ReviewSchedule): number {
  if (schedule.repetitions === 0 || schedule.interval <= 0) return 0;
  if (schedule.interval >= MATURE_INTERVAL_DAYS) return 1;
  return Math.min(1, schedule.interval / MATURE_INTERVAL_DAYS);
}

/**
 * How far each deck has moved from "never seen" to "scheduled far ahead".
 * Everything is derived from the cards' schedules and their review history, so
 * no extra field is stored and decks that predate this function still report.
 * `options.since` limits the retention window to recent reviews (milliseconds).
 */
export function deckMastery(
  records: StudyData["knowledge"],
  today: string,
  options: { since?: number } = {},
): Map<string, DeckMastery> {
  const result = new Map<string, DeckMastery>();
  for (const record of records)
    if (record.kind === "deck" && !record.deletedAt)
      result.set(record.id, {
        deckId: record.id,
        total: 0,
        fresh: 0,
        learning: 0,
        mature: 0,
        dueNow: 0,
        mastery: 0,
        retention: null,
        reviews: 0,
      });
  const scoreSum = new Map<string, number>(),
    cardDeck = new Map<string, string>();
  for (const record of records) {
    if (record.kind !== "card" || record.deletedAt) continue;
    const stats = result.get(record.deckId);
    if (!stats) continue;
    cardDeck.set(record.id, record.deckId);
    stats.total += 1;
    if (record.schedule.dueOn <= today) stats.dueNow += 1;
    const score = cardScore(record.schedule);
    scoreSum.set(record.deckId, (scoreSum.get(record.deckId) ?? 0) + score);
    if (score === 0) stats.fresh += 1;
    else if (score === 1) stats.mature += 1;
    else stats.learning += 1;
  }
  for (const [deckId, sum] of scoreSum) {
    const stats = result.get(deckId);
    if (stats && stats.total)
      stats.mastery = Math.round((100 * sum) / stats.total);
  }
  const since = options.since ?? -Infinity,
    graded = new Map<string, { good: number; total: number }>();
  for (const record of records) {
    if (record.kind !== "review" || record.deletedAt) continue;
    if (record.reviewedAt < since) continue;
    const deckId = cardDeck.get(record.cardId);
    if (!deckId) continue;
    const tally = graded.get(deckId) ?? { good: 0, total: 0 };
    tally.total += 1;
    if (record.grade >= 3) tally.good += 1;
    graded.set(deckId, tally);
  }
  for (const [deckId, tally] of graded) {
    const stats = result.get(deckId);
    if (!stats) continue;
    stats.reviews = tally.total;
    stats.retention = Math.round((100 * tally.good) / tally.total);
  }
  return result;
}
