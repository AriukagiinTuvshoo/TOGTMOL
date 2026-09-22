import type { StudyData } from "@/types/study";
import { fixture, NOW } from "./fixtures";
import type {
  Flashcard,
  StudyNote,
  StudyQuiz,
  FlashcardDeck,
  StudyLink,
} from "@/types/knowledge";
export const SAMPLE_IMAGE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lYQAAAAASUVORK5CYII=";
const base = (id: string, title: string) => ({
  id,
  title,
  subjectId: "math",
  tags: ["алгебр"],
  createdAt: NOW,
  updatedAt: NOW,
  deletedAt: null,
  extras: {},
});
export const note = (): StudyNote => ({
  ...base("note-1", "Тэгшитгэлийн санаа"),
  kind: "note",
  body: "Үл мэдэгдэхийг тусгаарлана. x + 2 = 4 → x = 2",
  date: "2026-09-15",
  image: SAMPLE_IMAGE,
  links: ["https://example.org/algebra"],
});
export const deck = (): FlashcardDeck => ({
  ...base("deck-1", "Алгебрын карт"),
  kind: "deck",
  description: "Эргэн санах дадлага",
});
export const card = (id = "card-1"): Flashcard => ({
  ...base(id, "x + 2 = 4"),
  kind: "card",
  deckId: "deck-1",
  front: "x + 2 = 4 бол x?",
  back: "x = 2",
  schedule: { repetitions: 0, interval: 0, ease: 2.5, dueOn: "2026-09-15" },
});
export const quiz = (): StudyQuiz => ({
  ...base("quiz-1", "Богино сорил"),
  kind: "quiz",
  questions: [
    {
      id: "q1",
      type: "choice",
      prompt: "2 + 2?",
      options: ["3", "4", "5"],
      answer: "4",
      explanation: "Хоёр хос нийлээд дөрөв.",
    },
    {
      id: "q2",
      type: "boolean",
      prompt: "0 эерэг тоо мөн үү?",
      options: [],
      answer: "Худал",
      explanation: "0 нь эерэг ч биш, сөрөг ч биш.",
    },
    {
      id: "q3",
      type: "short",
      prompt: "Python дахь функцийн түлхүүр үг?",
      options: [],
      answer: "def",
      explanation: "def нэр(...):",
    },
  ],
});
export const link = (): StudyLink => ({
  ...base("link-1", "Алгебрын материал"),
  kind: "link",
  url: "https://example.org/algebra",
  description: "Тэгшитгэл",
  relatedIds: ["note-1"],
});
export function knowledgeFixture(): StudyData {
  return { ...fixture(), knowledge: [note(), deck(), card(), quiz(), link()] };
}
