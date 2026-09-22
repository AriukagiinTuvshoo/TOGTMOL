import type { RecordBase } from "./study";
export interface KnowledgeBase extends RecordBase {
  title: string;
  subjectId: string | null;
  tags: string[];
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
}
export interface ReviewSchedule {
  repetitions: number;
  interval: number;
  ease: number;
  dueOn: string;
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
  | StudyNote
  | FlashcardDeck
  | Flashcard
  | CardReview
  | StudyQuiz
  | QuizAttempt
  | StudyLink;
export type KnowledgeKind = KnowledgeRecord["kind"];
