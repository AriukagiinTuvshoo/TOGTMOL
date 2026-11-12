import { uid } from "@/lib/constants";
import { dateKey, studyDate } from "@/lib/calculations/dates";
import { dayBoundary } from "@/lib/preferences";
import { parseKnowledge } from "./validation";
import { sm2 } from "./spaced-repetition";
import { fsrsSchedule } from "./fsrs";
import type { StudyData } from "@/types/study";
import type {
  CardReview,
  Flashcard,
  FlashcardDeck,
  KnowledgeRecord,
  QuizAttempt,
  StudyQuiz,
} from "@/types/knowledge";

export function recordBase(
  title: string,
  subjectId: string | null = null,
  tags: string[] = [],
  now = Date.now(),
) {
  return {
    id: uid("knowledge"),
    title,
    subjectId,
    tags,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    extras: {},
  };
}
export function saveKnowledge(
  record: KnowledgeRecord,
  expectedUpdatedAt?: number,
) {
  return (data: StudyData): StudyData => {
    const old = data.knowledge.find((r) => r.id === record.id);
    if (old && (old.updatedAt !== expectedUpdatedAt || old.deletedAt))
      throw Error(
        "Энэ бичлэг өөрчлөгдсөн. Шинэ хувилбарыг нээгээд дахин засна уу.",
      );
    if (!old && expectedUpdatedAt !== undefined)
      throw Error("Засах бичлэг олдсонгүй.");
    if (
      record.subjectId &&
      !data.subjects.some((s) => s.id === record.subjectId && !s.deletedAt)
    )
      throw Error("Хичээл олдсонгүй.");
    if (record.title.length > 180 || record.tags.length > 30)
      throw Error("Нэр 180 тэмдэгт, шошго 30-аас хэтрэхгүй байна.");
    if (record.kind === "note" && record.body.length > 50000)
      throw Error("Тэмдэглэл 50,000 тэмдэгтээс хэтэрсэн.");
    if (
      record.kind === "card" &&
      !data.knowledge.some(
        (r) => r.kind === "deck" && r.id === record.deckId && !r.deletedAt,
      )
    )
      throw Error("Картын багцыг сонгоно уу.");
    const checked = parseKnowledge({
      ...record,
      updatedAt: Math.max(Date.now(), (old?.updatedAt ?? 0) + 1),
    });
    return {
      ...data,
      knowledge: old
        ? data.knowledge.map((r) => (r.id === checked.id ? checked : r))
        : [...data.knowledge, checked],
    };
  };
}
export function removeKnowledge(id: string) {
  return (data: StudyData): StudyData => {
    const now = Date.now();
    return {
      ...data,
      knowledge: data.knowledge.map((r) =>
        r.id === id
          ? { ...r, deletedAt: now, updatedAt: Math.max(now, r.updatedAt + 1) }
          : r,
      ),
    };
  };
}
export function reviewCard(
  id: string,
  grade: number,
  expectedUpdatedAt: number,
  now = Date.now(),
  reviewId = uid("review"),
  today?: string,
) {
  return (data: StudyData): StudyData => {
    if (data.knowledge.some((r) => r.id === reviewId)) return data;
    const reviewDay =
      today ?? studyDate(new Date(now), dayBoundary(data.settings));
    const card = data.knowledge.find(
      (r): r is Flashcard => r.kind === "card" && r.id === id && !r.deletedAt,
    );
    if (!card || card.updatedAt !== expectedUpdatedAt)
      throw Error("Карт өөрчлөгдсөн. Давтлагаа дахин нээнэ үү.");
    if (
      !data.knowledge.some(
        (r) => r.kind === "deck" && r.id === card.deckId && !r.deletedAt,
      )
    )
      throw Error("Багц хогийн саванд байна.");
    // Same-day retries improve recall without jumping to the next inter-day interval.
    const sameDay = data.knowledge
      .filter(
        (r): r is CardReview =>
          r.kind === "review" &&
          r.cardId === id &&
          !r.deletedAt &&
          studyDate(new Date(r.reviewedAt), dayBoundary(data.settings)) ===
            reviewDay,
      )
      .sort((a, b) => a.reviewedAt - b.reviewedAt);
    const before = sameDay[0]?.before ?? card.schedule;
    // SM-2 stays the default; a user can opt into FSRS in the settings.
    const calibration = data.settings.extras.fsrsScale,
      scale =
        typeof calibration === "number" && Number.isFinite(calibration)
          ? Math.min(2, Math.max(0.5, calibration))
          : 1;
    const after =
      data.settings.extras.srsAlgorithm === "fsrs"
        ? fsrsSchedule(before, grade, reviewDay, { scale })
        : sm2(before, grade, reviewDay);
    const review: CardReview = {
      ...recordBase(card.title, card.subjectId, card.tags, now),
      id: reviewId,
      kind: "review",
      cardId: id,
      grade,
      reviewedAt: now,
      before,
      after,
    };
    return {
      ...data,
      knowledge: [
        ...data.knowledge.map((r) =>
          r.id === id
            ? {
                ...card,
                schedule: after,
                updatedAt: Math.max(now, card.updatedAt + 1),
              }
            : r,
        ),
        review,
      ],
    };
  };
}
export const normalizeAnswer = (value: string) =>
  value.trim().normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ");
export function gradeQuiz(
  quiz: StudyQuiz,
  responses: Record<string, string>,
  now = Date.now(),
): QuizAttempt {
  const answers = quiz.questions.map((q) => ({
    question: q,
    response: responses[q.id] ?? "",
    correct:
      normalizeAnswer(responses[q.id] ?? "") === normalizeAnswer(q.answer),
  }));
  return {
    ...recordBase(quiz.title, quiz.subjectId, quiz.tags, now),
    kind: "attempt",
    quizId: quiz.id,
    date: dateKey(new Date(now)),
    answers,
    score: answers.filter((a) => a.correct).length,
    total: answers.length,
  };
}
export function saveQuizAttempt(
  attempt: QuizAttempt,
  expectedQuizUpdatedAt: number,
) {
  return (data: StudyData): StudyData => {
    if (data.knowledge.some((r) => r.id === attempt.id)) return data;
    const quiz = data.knowledge.find(
      (r) => r.id === attempt.quizId && r.kind === "quiz" && !r.deletedAt,
    );
    if (!quiz || quiz.updatedAt !== expectedQuizUpdatedAt)
      throw Error("Сорил өөрчлөгдсөн. Дахин нээгээд оролдоно уу.");
    return {
      ...data,
      knowledge: [
        ...data.knowledge,
        {
          ...attempt,
          date: studyDate(
            new Date(attempt.createdAt),
            dayBoundary(data.settings),
          ),
        },
      ],
    };
  };
}
export const cardKey = (front: string) =>
  front.trim().normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ");

/**
 * Import cards from an external source (Anki text export, CSV, pasted text).
 * The deck is created when needed, and cards whose question already exists in
 * that deck are skipped so a repeated import does not double the deck.
 */
export function importCards(
  cards: { front: string; back: string; tags?: string[] }[],
  options: {
    title: string;
    subjectId?: string | null;
    deckId?: string;
    tags?: string[];
    today: string;
    now?: number;
  },
) {
  return (data: StudyData): StudyData => {
    if (!cards.length) throw Error("Импортлох карт олдсонгүй.");
    if (cards.length > 2000)
      throw Error("Нэг удаад 2000 хүртэл карт импортолно.");
    const title = options.title.trim();
    const now = options.now ?? Date.now();
    const existingDeck = options.deckId
      ? data.knowledge.find(
          (r): r is FlashcardDeck =>
            r.kind === "deck" && r.id === options.deckId && !r.deletedAt,
        )
      : undefined;
    if (options.deckId && !existingDeck) throw Error("Багц олдсонгүй.");
    if (!existingDeck && !title) throw Error("Багцын нэрээ оруулна уу.");
    if (title.length > 180) throw Error("Багцын нэр 180 тэмдэгтээс хэтрэхгүй.");
    const deck: FlashcardDeck = existingDeck ?? {
      ...recordBase(title, options.subjectId ?? null, options.tags ?? [], now),
      kind: "deck",
      description: "Гаднаас импортолсон (Anki текст/CSV)",
    };
    let next = existingDeck ? data : saveKnowledge(deck, undefined)(data);
    const deckId = deck.id;
    const seen = new Set(
      next.knowledge
        .filter(
          (r): r is Flashcard =>
            r.kind === "card" && r.deckId === deckId && !r.deletedAt,
        )
        .map((card) => cardKey(card.front)),
    );
    for (const card of cards) {
      const key = cardKey(card.front);
      if (!key || !card.back.trim() || seen.has(key)) continue;
      seen.add(key);
      next = saveKnowledge(
        {
          ...recordBase(
            card.front.slice(0, 180),
            options.subjectId ?? deck.subjectId ?? null,
            [...new Set([...(card.tags ?? []), ...(options.tags ?? [])])].slice(
              0,
              30,
            ),
            now,
          ),
          kind: "card" as const,
          deckId,
          front: card.front,
          back: card.back,
          schedule: {
            repetitions: 0,
            interval: 0,
            ease: 2.5,
            dueOn: options.today,
          },
        },
        undefined,
      )(next);
    }
    return next;
  };
}
export function addCards(cards: Flashcard[]) {
  return (data: StudyData): StudyData => {
    let next = data;
    for (const card of cards)
      if (!next.knowledge.some((r) => r.id === card.id))
        next = saveKnowledge(card)(next);
    return next;
  };
}
