import type { StudyData, View } from "@/types/study";
import type {
  Flashcard,
  KnowledgeRecord,
  QuizQuestion,
} from "@/types/knowledge";
type QuizQuestionSnapshot = { quizId: string; question: QuizQuestion | null };
import { studyDate } from "@/lib/calculations/dates";
import { dayBoundary } from "@/lib/preferences";
export const DEFAULT_NEW_CARDS_PER_DAY = 20;

/** 0 means no limit; unreadable values fall back to the default. */
export function newCardsPerDay(settings: StudyData["settings"]): number {
  const raw = settings.extras.newCardsPerDay;
  if (raw === undefined || raw === null) return DEFAULT_NEW_CARDS_PER_DAY;
  if (typeof raw !== "number" || !Number.isFinite(raw))
    return DEFAULT_NEW_CARDS_PER_DAY;
  return Math.max(0, Math.min(500, Math.round(raw)));
}

/** Cards whose first-ever review happened on the given study day. */
export function newCardsIntroducedToday(
  records: KnowledgeRecord[],
  today: string,
  settings: StudyData["settings"],
) {
  const boundary = dayBoundary(settings),
    introduced = new Set<string>();
  for (const record of records) {
    if (record.kind !== "review" || record.deletedAt) continue;
    const before = record.before;
    if (before.repetitions !== 0 || before.interval !== 0) continue;
    if (studyDate(new Date(record.reviewedAt), boundary) !== today) continue;
    introduced.add(record.cardId);
  }
  return introduced.size;
}

/**
 * `settings` enables the daily new-card budget. Without it the queue keeps the
 * old behaviour of offering every new card, which older callers rely on.
 */
export function knowledgeIndex(
  records: KnowledgeRecord[],
  today: string,
  settings?: StudyData["settings"],
) {
  const active = records.filter((r) => !r.deletedAt),
    byId = new Map(active.map((r) => [r.id, r]));
  const cards = active.filter(
    (r): r is Flashcard =>
      r.kind === "card" && byId.get(r.deckId)?.kind === "deck",
  );
  const cardsByDeck = new Map<string, Flashcard[]>();
  for (const card of cards) {
    const group = cardsByDeck.get(card.deckId) ?? [];
    group.push(card);
    cardsByDeck.set(card.deckId, group);
  }
  const due = cards
    .filter((c) => c.schedule.repetitions > 0 && c.schedule.dueOn <= today)
    .sort(
      (a, b) =>
        a.schedule.dueOn.localeCompare(b.schedule.dueOn) ||
        a.id.localeCompare(b.id),
    );
  const fresh = cards
    .filter(
      (c) =>
        c.schedule.repetitions === 0 &&
        c.schedule.interval === 0 &&
        c.schedule.dueOn <= today,
    )
    // Deterministic order: the oldest cards are introduced first, so a large
    // import is worked through in a predictable way instead of randomly.
    .sort(
      (a, b) =>
        a.schedule.dueOn.localeCompare(b.schedule.dueOn) ||
        a.createdAt - b.createdAt ||
        a.id.localeCompare(b.id),
    );
  const budget = settings ? newCardsPerDay(settings) : 0,
    freshToday =
      budget === 0
        ? fresh
        : fresh.slice(
            0,
            Math.max(
              0,
              budget -
                (settings
                  ? newCardsIntroducedToday(records, today, settings)
                  : 0),
            ),
          );
  const relearning = cards.filter(
    (c) =>
      c.schedule.repetitions === 0 &&
      c.schedule.interval > 0 &&
      c.schedule.dueOn <= today,
  );
  const reviewQueue = [...due, ...relearning, ...freshToday];
  const quizRetryByQuestion = new Map<string, QuizQuestionSnapshot>();
  const attempts = active
    .filter(
      (r): r is import("@/types/knowledge").QuizAttempt => r.kind === "attempt",
    )
    .sort((a, b) => b.createdAt - a.createdAt);
  const resolvedQuizQuestions = new Set<string>();
  for (const attempt of attempts) {
    for (const answer of attempt.answers) {
      const key = `${attempt.quizId}:${answer.question.id}`;
      if (resolvedQuizQuestions.has(key)) continue;
      resolvedQuizQuestions.add(key);
      if (!answer.correct)
        quizRetryByQuestion.set(key, {
          quizId: attempt.quizId,
          question: answer.question,
        });
    }
  }
  const quizRetryQueue = [...quizRetryByQuestion.values()].filter(
    (v): v is { quizId: string; question: QuizQuestion } => v.question !== null,
  );
  return {
    active,
    byId,
    cards,
    cardsByDeck,
    due: [...due, ...relearning],
    fresh,
    freshToday,
    newCardsPerDay: settings ? budget : 0,
    reviewQueue,
    quizRetryQueue,
    notes: active.filter((r) => r.kind === "note"),
    decks: active.filter((r) => r.kind === "deck"),
    reviews: active.filter((r) => r.kind === "review"),
  };
}
export interface SearchResult {
  id: string;
  title: string;
  detail: string;
  type: string;
  view: View;
  subjectId: string | null;
  tags: string[];
  date: string;
  text: string;
}
export function searchableData(data: StudyData): SearchResult[] {
  const result: SearchResult[] = [];
  const subjects = new Map(data.subjects.map((s) => [s.id, s.name]));
  for (const r of data.knowledge) {
    if (r.deletedAt) continue;
    const body =
      r.kind === "note"
        ? r.body
        : r.kind === "card"
          ? `${r.front} ${r.back}`
          : r.kind === "link"
            ? `${r.url} ${r.description}`
            : r.kind === "deck"
              ? r.description
              : r.kind === "quiz"
                ? r.questions.map((q) => q.prompt).join(" ")
                : r.kind === "attempt"
                  ? `${r.score}/${r.total}`
                  : r.kind === "topic"
                    ? r.description
                    : `Үнэлгээ ${r.grade}`;
    result.push({
      id: r.id,
      title: r.title,
      detail: body.slice(0, 200),
      type: r.kind,
      view: "knowledge",
      subjectId: r.subjectId,
      tags: r.tags,
      date:
        "date" in r
          ? r.date
          : studyDate(
              new Date(r.kind === "review" ? r.reviewedAt : r.createdAt || 0),
              dayBoundary(data.settings),
            ),
      text: `${r.title} ${body} ${r.tags.join(" ")}`
        .normalize("NFKC")
        .toLocaleLowerCase(),
    });
  }
  for (const s of data.sessions)
    if (!s.deletedAt)
      result.push({
        id: s.id,
        title: subjects.get(s.subjectId) ?? "Хичээл",
        detail: s.note,
        type: "session",
        view: "calendar",
        subjectId: s.subjectId,
        tags: [],
        date: s.date,
        text: `${s.note} ${s.date} ${subjects.get(s.subjectId) ?? ""}`
          .normalize("NFKC")
          .toLocaleLowerCase(),
      });
  for (const s of data.subjects)
    if (!s.deletedAt)
      result.push({
        id: s.id,
        title: s.name,
        detail: "Хичээл",
        type: "subject",
        view: "subjects",
        subjectId: s.id,
        tags: [],
        date: "",
        text: s.name.toLocaleLowerCase(),
      });
  for (const g of data.studyGoals)
    if (!g.deletedAt)
      result.push({
        id: g.id,
        title: g.title,
        detail: `${g.startsOn} → ${g.endsOn}`,
        type: "goal",
        view: "goals",
        subjectId: g.subjectId,
        tags: [],
        date: g.startsOn,
        text: g.title.toLocaleLowerCase(),
      });
  return result;
}
export function searchResults(
  index: SearchResult[],
  query: string,
  filter: {
    subjectId?: string;
    tag?: string;
    type?: string;
    from?: string;
    to?: string;
  } = {},
  limit = 60,
) {
  const words = query
      .normalize("NFKC")
      .toLocaleLowerCase()
      .trim()
      .split(/\s+/)
      .filter(Boolean),
    found: SearchResult[] = [];
  for (const r of index) {
    if (
      (filter.subjectId && r.subjectId !== filter.subjectId) ||
      (filter.tag &&
        !r.tags.some((t) =>
          t.toLocaleLowerCase().includes(filter.tag!.toLocaleLowerCase()),
        )) ||
      (filter.type && r.type !== filter.type) ||
      (filter.from && r.date < filter.from) ||
      (filter.to && r.date > filter.to) ||
      !words.every((w) => r.text.includes(w))
    )
      continue;
    found.push(r);
    if (found.length >= limit) break;
  }
  return found;
}
