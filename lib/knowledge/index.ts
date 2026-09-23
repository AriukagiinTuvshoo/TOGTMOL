import type { StudyData, View } from "@/types/study";
import type { Flashcard, KnowledgeRecord } from "@/types/knowledge";
import type { QuizQuestion } from "@/types/knowledge";

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
ort type { StudyData, View } from "@/types/study";
import type { Flashcard, KnowledgeRecord } from "@/types/knowledge";
import type { QuizQuestion } from "@/types/knowledge";

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

