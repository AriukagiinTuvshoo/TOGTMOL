import type { RecordBase } from "./study";
export interface KnowledgeBase extends RecordBase {
  title: string;
  subjectId: string | null;
  tags: string[];
  /** Optional chapter this record belongs to; topics carry `parentId` too. */
  topicId?: string | null;
}
export interface StudyTopic extends KnowledgeBase {
  kind: "topic";
  /** Parent topic in the same subject, or null for a top-level topic. */
  parentId: string | null;
  description: string;
}
export interface StudyNote extends KnowledgeBase {
  kind: "note";
  body: string;
  date: string;
  image: string | null;
  links: string[];
}
export interface FlashcardDeck extends KnowledgeBase {
  kind: "deck";
  description: string;
  /** Note or other record the cards were generated from, when known. */
  sourceId?: string | null;
}
export interface ReviewSchedule {
  repetitions: number;
  interval: number;
  ease: number;
  dueOn: string;
  /** Present once a card has been scheduled by the optional FSRS algorithm. */
  algorithm?: "sm2" | "fsrs";
  stability?: number;
  difficulty?: number;
  lastReview?: string;
}
export interface Flashcard extends KnowledgeBase {
  kind: "card";
  deckId: string;
  front: string;
  back: string;
  schedule: ReviewSchedule;
}
export interface CardReview extends KnowledgeBase {
  kind: "review";
  cardId: string;
  grade: number;
  reviewedAt: number;
  before: ReviewSchedule;
  after: ReviewSchedule;
}
export interface QuizQuestion {
  id: string;
  type: "choice" | "boolean" | "short";
  prompt: string;
  options: string[];
  answer: string;
  explanation: string;
}
export interface StudyQuiz extends KnowledgeBase {
  kind: "quiz";
  questions: QuizQuestion[];
}
export interface QuizAttempt extends KnowledgeBase {
  kind: "attempt";
  quizId: string;
  date: string;
  score: number;
  total: number;
  answers: { question: QuizQuestion; response: string; correct: boolean }[];
}
export interface StudyLink extends KnowledgeBase {
  kind: "link";
  url: string;
  description: string;
  relatedIds: string[];
}
export type KnowledgeRecord =
  | StudyTopic
  | StudyNote
  | FlashcardDeck
  | Flashcard
  | CardReview
  | StudyQuiz
  | QuizAttempt
  | StudyLink;
export type KnowledgeKind = KnowledgeRecord["kind"];
