import {
  base,
  finite,
  identifier,
  isObject,
  text,
} from "@/lib/migration/values";
import { parseDate } from "@/lib/calculations/dates";
import type {
  KnowledgeRecord,
  QuizQuestion,
  ReviewSchedule,
} from "@/types/knowledge";
export function safeLink(input: string): string {
  if (input.length > 4096) throw Error("Холбоос хэт урт байна.");
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    throw Error("Бүтэн http эсвэл https холбоос оруулна уу.");
  }
  if (!["https:", "http:"].includes(u.protocol) || u.username || u.password)
    throw Error("Энэ төрлийн холбоосыг хадгалахгүй.");
  return u.href;
}
export const cleanTags = (input: string | string[]) =>
  [
    ...new Set(
      (typeof input === "string" ? input.split(",") : input)
        .map((t) => t.trim().slice(0, 60))
        .filter(Boolean),
    ),
  ].slice(0, 30);
export function imageData(input: unknown): string | null {
  if (input == null || input === "") return null;
  if (
    typeof input !== "string" ||
    !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(input) ||
    input.length > 12 * 1024 * 1024
  )
    throw Error("Зураг JPEG, PNG эсвэл WebP хэлбэртэй байх ёстой.");
  return input;
}
export function schedule(input: unknown): ReviewSchedule {
  if (!isObject(input) || !parseDate(input.dueOn))
    throw Error("Картын давтлагын огноо буруу.");
  const repetitions = finite(input.repetitions, -1),
    interval = finite(input.interval, -1),
    ease = finite(input.ease, -1);
  if (
    !Number.isInteger(repetitions) ||
    repetitions < 0 ||
    !Number.isInteger(interval) ||
    interval < 0 ||
    ease < 1.3 ||
    ease > 100
  )
    throw Error("Картын давтлагын хуваарь буруу.");
  return { repetitions, interval, ease, dueOn: input.dueOn as string };
}
export function question(input: unknown): QuizQuestion {
  if (
    !isObject(input) ||
    !identifier(input.id) ||
    !text(input.prompt).trim() ||
    !text(input.answer).trim() ||
    !["choice", "boolean", "short"].includes(text(input.type))
  )
    throw Error("Сорилын асуулт, зөв хариултаа оруулна уу.");
  const options = Array.isArray(input.options)
    ? input.options.filter((v): v is string => typeof v === "string")
    : [];
  if (
    input.type === "choice" &&
    (options.length < 2 ||
      options.length > 6 ||
      !options.includes(String(input.answer)) ||
      new Set(options).size !== options.length)
  )
    throw Error("Сонгох асуулт 2–6 ялгаатай сонголттой байна.");
  if (
    input.type === "boolean" &&
    !["Үнэн", "Худал"].includes(String(input.answer))
  )
    throw Error("Үнэн эсвэл Худал гэсэн хариулт сонгоно уу.");
  return {
    id: String(input.id),
    type: input.type as QuizQuestion["type"],
    prompt: String(input.prompt),
    answer: String(input.answer),
    options,
    explanation: text(input.explanation),
  };
}
export function parseKnowledge(r: Record<string, unknown>): KnowledgeRecord {
  const id = identifier(r.id);
  if (!id || !text(r.title).trim())
    throw Error("Мэдлэгийн бичлэгийн дугаар эсвэл нэр алга.");
  const shared = {
    ...base(r, id, [
      "kind",
      "title",
      "subjectId",
      "tags",
      "body",
      "date",
      "image",
      "links",
      "description",
      "deckId",
      "front",
      "back",
      "schedule",
      "cardId",
      "grade",
      "reviewedAt",
      "before",
      "after",
      "questions",
      "quizId",
      "score",
      "total",
      "answers",
      "url",
      "relatedIds",
    ]),
    title: text(r.title),
    subjectId: identifier(r.subjectId),
    tags: Array.isArray(r.tags)
      ? r.tags.filter((v): v is string => typeof v === "string")
      : [],
  };
  switch (r.kind) {
    case "note":
      if (!parseDate(r.date)) throw Error("Тэмдэглэлийн огноо буруу.");
      return {
        ...shared,
        kind: "note",
        body: text(r.body),
        date: r.date as string,
        image: imageData(r.image),
        links: Array.isArray(r.links)
          ? r.links.map((l) => safeLink(String(l)))
          : [],
      };
    case "deck":
      return { ...shared, kind: "deck", description: text(r.description) };
    case "card":
      if (
        !identifier(r.deckId) ||
        !text(r.front).trim() ||
        !text(r.back).trim()
      )
        throw Error("Картын асуулт, хариулт эсвэл багц алга.");
      return {
        ...shared,
        kind: "card",
        deckId: String(r.deckId),
        front: text(r.front),
        back: text(r.back),
        schedule: schedule(r.schedule),
      };
    case "review":
      if (
        !identifier(r.cardId) ||
        !Number.isInteger(r.grade) ||
        Number(r.grade) < 0 ||
        Number(r.grade) > 5 ||
        finite(r.reviewedAt) <= 0
      )
        throw Error("Давтлагын түүх буруу.");
      return {
        ...shared,
        kind: "review",
        cardId: String(r.cardId),
        grade: Number(r.grade),
        reviewedAt: Number(r.reviewedAt),
        before: schedule(r.before),
        after: schedule(r.after),
      };
    case "quiz":
      if (!Array.isArray(r.questions) || !r.questions.length)
        throw Error("Сорилын асуултууд алга.");
      if (
        new Set(r.questions.map((q) => (isObject(q) ? q.id : null))).size !==
        r.questions.length
      )
        throw Error("Сорилын асуултын дугаар давхардсан байна.");
      return { ...shared, kind: "quiz", questions: r.questions.map(question) };
    case "attempt": {
      if (
        !identifier(r.quizId) ||
        !parseDate(r.date) ||
        !Array.isArray(r.answers)
      )
        throw Error("Сорилын үр дүн буруу.");
      const answers = r.answers.map((a) => {
        if (!isObject(a) || typeof a.correct !== "boolean")
          throw Error("Сорилын хариулт буруу.");
        return {
          question: question(a.question),
          response: text(a.response),
          correct: a.correct,
        };
      });
      return {
        ...shared,
        kind: "attempt",
        quizId: String(r.quizId),
        date: String(r.date),
        answers,
        score: answers.filter((a) => a.correct).length,
        total: answers.length,
      };
    }
    case "link":
      return {
        ...shared,
        kind: "link",
        url: safeLink(text(r.url)),
        description: text(r.description),
        relatedIds: Array.isArray(r.relatedIds)
          ? r.relatedIds.filter((id): id is string => typeof id === "string")
          : [],
      };
    default:
      throw Error("Мэдлэгийн бичлэгийн төрөл танигдсангүй.");
  }
}
