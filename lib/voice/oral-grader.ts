// Multilingual (Mongolian / English / Japanese) Oral Recall Grader for Flashcard Voice Review

export interface OralRecallGrade {
  scorePercent: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  suggestedGrade: 1 | 3 | 4 | 5;
  feedbackMn: string;
}

const STOPWORDS = new Set([
  "нь",
  "ба",
  "болон",
  "бол",
  "гэж",
  "юм",
  "байна",
  "байдаг",
  "энэ",
  "тэр",
  "тухай",
  "дээр",
  "доор",
  "the",
  "and",
  "for",
  "that",
  "this",
  "with",
  "from",
  "are",
  "was",
  "were",
  "is",
  "of",
  "to",
  "in",
  "on",
]);

function normalizeText(input: string): string {
  return input
    .toLocaleLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractKeywords(text: string): string[] {
  const norm = normalizeText(text);
  if (!norm) return [];
  // CJK characters (Japanese Kanji/Kana) don't use spaces — split CJK bigrams + spaced words
  if (/[\u3040-\u30ff\u4e00-\u9faf]/.test(norm)) {
    const chars = [...norm.replace(/\s+/g, "")];
    if (chars.length <= 2) return [chars.join("")];
    const bigrams: string[] = [];
    for (let i = 0; i < chars.length - 1; i += 1) {
      bigrams.push(chars[i] + chars[i + 1]);
    }
    return [...new Set(bigrams)];
  }
  return [
    ...new Set(
      norm.split(" ").filter((w) => w.length >= 2 && !STOPWORDS.has(w)),
    ),
  ];
}

function stemMatch(expectedWord: string, spokenWords: string[]): boolean {
  if (spokenWords.includes(expectedWord)) return true;
  // Handle Mongolian agglutinative suffixes by prefix overlap (>= 70% of root)
  const rootLen = Math.max(3, Math.floor(expectedWord.length * 0.7));
  const prefix = expectedWord.slice(0, rootLen);
  return spokenWords.some(
    (sw) =>
      sw.startsWith(prefix) ||
      expectedWord.startsWith(sw.slice(0, Math.max(3, sw.length - 2))),
  );
}

export function gradeOralRecall(
  expectedBack: string,
  spokenAnswer: string,
): OralRecallGrade {
  const expectedKeywords = extractKeywords(expectedBack);
  const spokenKeywords = extractKeywords(spokenAnswer);

  if (!spokenAnswer.trim()) {
    return {
      scorePercent: 0,
      matchedKeywords: [],
      missingKeywords: expectedKeywords.slice(0, 5),
      suggestedGrade: 1,
      feedbackMn: "Хариулт сонсогдсонгүй. Дахин ярих эсвэл хариултаа харна уу.",
    };
  }

  if (expectedKeywords.length === 0) {
    const exact =
      normalizeText(expectedBack) === normalizeText(spokenAnswer) ? 100 : 60;
    return {
      scorePercent: exact,
      matchedKeywords: [],
      missingKeywords: [],
      suggestedGrade: exact >= 85 ? 5 : 4,
      feedbackMn: exact >= 85 ? "Яг зөв хэллээ! 🎉" : "Ойролцоо хариуллаа!",
    };
  }

  const matched: string[] = [];
  const missing: string[] = [];

  for (const kw of expectedKeywords) {
    if (stemMatch(kw, spokenKeywords)) {
      matched.push(kw);
    } else {
      missing.push(kw);
    }
  }

  const scorePercent = Math.round(
    (matched.length / expectedKeywords.length) * 100,
  );

  let suggestedGrade: 1 | 3 | 4 | 5 = 1;
  let feedbackMn = "";

  if (scorePercent >= 82) {
    suggestedGrade = 5;
    feedbackMn = "Гайхалтай! Түлхүүр ойлголтуудыг бүрэн саналаа 🎉";
  } else if (scorePercent >= 55) {
    suggestedGrade = 4;
    feedbackMn =
      "Сайн байна! Гол санааг хэлсэн ч зарим үгийг нэмж бататгаарай.";
  } else if (scorePercent >= 28) {
    suggestedGrade = 3;
    feedbackMn =
      "Тал хувийг саналаа. Орхигдсон түлхүүр үгсийг харьцуулж хараарай.";
  } else {
    suggestedGrade = 1;
    feedbackMn =
      "Түлхүүр утга зөрүүтэй байна. Зөв хариултыг уншаад дахин давтаарай.";
  }

  return {
    scorePercent,
    matchedKeywords: matched.slice(0, 6),
    missingKeywords: missing.slice(0, 5),
    suggestedGrade,
    feedbackMn,
  };
}
