export interface CardDraft {
  front: string;
  back: string;
}
export function parseCardDrafts(input: unknown): CardDraft[] {
  const raw =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as { cards?: unknown }).cards
      : null;
  if (!Array.isArray(raw) || !raw.length || raw.length > 12)
    throw Error(
      "Бондоокийн картын хариу танигдсангүй. Дахин оролдох эсвэл өөрөө бичиж болно.",
    );
  return raw.map((r) => {
    if (
      !r ||
      typeof r.front !== "string" ||
      typeof r.back !== "string" ||
      !r.front.trim() ||
      !r.back.trim() ||
      r.front.length > 4000 ||
      r.back.length > 10000
    )
      throw Error("Картын асуулт эсвэл хариулт буруу байна.");
    return { front: r.front.trim(), back: r.back.trim() };
  });
}
export function localCardDrafts(
  text: string,
  title: string,
  count = 10,
): CardDraft[] {
  const lines = text
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const pairs = lines
    .map((line) => {
      const match = line.match(/^(.{1,200}?)(?:::|\s[—–]\s|:\s)(.+)$/);
      return match ? { front: match[1].trim(), back: match[2].trim() } : null;
    })
    .filter((r): r is CardDraft => r !== null);
  if (pairs.length) return pairs.slice(0, Math.min(12, count));
  if (!text.trim())
    throw Error("Төхөөрөмж дээр загвар бэлдэхийн тулд текст оруулна уу.");
  return [
    {
      front: `${title || "Энэ тэмдэглэл"}: юуг санах вэ?`,
      back: text.trim().slice(0, 10000),
    },
  ];
}


export interface QuizDraft {
  type: "choice" | "boolean" | "short";
  prompt: string;
  options: string[];
  answer: string;
  explanation: string;
}

export function parseQuizDrafts(input: unknown): QuizDraft[] {
  const raw =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as { questions?: unknown }).questions
      : null;
  if (!Array.isArray(raw) || !raw.length || raw.length > 12)
    throw Error("Бондоокийн quiz хариу танигдсангүй.");
  return raw.map((q) => {
    if (
      !q ||
      typeof q.type !== "string" ||
      !["choice", "boolean", "short"].includes(q.type) ||
      typeof q.prompt !== "string" ||
      typeof q.answer !== "string" ||
      typeof q.explanation !== "string" ||
      !q.prompt.trim() ||
      !q.answer.trim()
    )
      throw Error("Quiz асуултын бүтэц буруу байна.");
    const options = Array.isArray(q.options)
      ? q.options
          .filter((v: unknown): v is string => typeof v === "string")
          .map((v: string) => v.trim())
          .filter(Boolean)
      : [];
    if (
      q.type === "choice" &&
      (options.length < 2 || !options.includes(q.answer.trim()))
    )
      throw Error("Choice quiz-ийн сонголт эсвэл зөв хариулт буруу байна.");
    if (
      q.type === "boolean" &&
      !["Үнэн", "Худал", "True", "False"].includes(q.answer.trim())
    )
      throw Error("Boolean quiz-ийн хариулт буруу байна.");
    if (
      q.prompt.length > 4000 ||
      q.answer.length > 2000 ||
      q.explanation.length > 4000 ||
      options.length > 6
    )
      throw Error("Quiz асуултын урт хэтэрсэн байна.");
    return {
      type: q.type as QuizDraft["type"],
      prompt: q.prompt.trim(),
      options,
      answer: q.answer.trim(),
      explanation: q.explanation.trim(),
    };
  });
}

export function localQuizDrafts(text: string, count = 5): QuizDraft[] {
  const pairs = text
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((line) => line.match(/^(.{1,200}?)(?:::|\s[—–]\s|:\s)(.+)$/))
    .filter((m): m is RegExpMatchArray => Boolean(m))
    .slice(0, Math.min(12, count));
  if (!pairs.length)
    throw Error(
      "Local quiz үүсгэхэд асуулт: хариулт маягийн материал оруулна уу.",
    );
  return pairs.map((m) => ({
    type: "short",
    prompt: m[1] + " гэж юу вэ?",
    options: [],
    answer: m[2],
    explanation: "Материал: " + m[2],
  }));
}
