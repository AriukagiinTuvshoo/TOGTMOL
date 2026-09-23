import type { StudyData, View } from "@/types/study";
import type {
  Flashcard,
  KnowledgeRecord,
  QuizQuestion,
} from "@/types/knowledge";
type QuizQuestionSnapshot = { quizId: string; question: QuizQuestion | null };
import { studyDate } from "@/lib/calculations/dates";
import { dayBoundary } from "@/lib/preferences";
export function knowledgeIndex(records: KnowledgeRecord[], today: string) {
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
  const fresh = cards.filter(
    (c) =>
      c.schedule.repetitions === 0 &&
      c.schedule.interval === 0 &&
      c.schedule.dueOn <= today,
  );
  const relearning = cards.filter(
    (c) =>
      c.schedule.repetitions === 0 &&
      c.schedule.interval > 0 &&
      c.schedule.dueOn <= today,
  );
  const reviewQueue = [...due, ...relearning, ...fresh];
  const quizRetryByQuestion = new Map<string, QuizQuestionSnapshot>();
  const attempts = active
    .filter(
      (r): r is import("@/types/knowledge").QuizAttempt => r.kind === "attempt",
    )
    .sort((a, b) => b.createdAt - a.createdAt);
  for (const attempt of attempts) {
    for (const answer of attempt.answers) {
      const key = `${attempt.quizId}:${answer.question.id}`;
      if (quizRetryByQuestion.has(key)) continue;
      quizRetryByQuestion.set(key, {
        quizId: attempt.quizId,
        question: answer.correct ? null : answer.question,
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
