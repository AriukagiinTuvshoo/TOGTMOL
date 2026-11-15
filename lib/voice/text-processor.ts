// Ported & adapted from AriukagiinTuvshoo/voice-app for TOGTMOL Study OS
// Supports Mongolian + English + Japanese code-switching restoration & transcript cleanup.

export const MONGOLIAN_FILLER_WORDS = [
  "нөгөө",
  "одоо",
  "зүгээр",
  "тийм ээ",
  "юу гэдэг юм",
  "аа",
  "мм",
  "эхх",
  "ер нь бол",
  "яг үнэндээ бол",
] as const;

const wb = (inner: string) =>
  new RegExp(`(?<![\\p{L}\\p{N}])(?:${inner})(?![\\p{L}\\p{N}])`, "giu");

const CYRILLIC_TO_ENGLISH: Array<[RegExp, string]> = [
  [wb("ви\\s*эс\\s*код"), "VS Code"],
  [wb("гит\\s*хаб"), "GitHub"],
  [wb("тайп\\s*скрипт"), "TypeScript"],
  [wb("жава\\s*скрипт"), "JavaScript"],
  [wb("пайтон"), "Python"],
  [wb("реакт"), "React"],
  [wb("некст"), "Next.js"],
  [wb("супа\\s*бейс"), "Supabase"],
  [wb("жемини"), "Gemini"],
  [wb("гүүгл\\s*эй\\s*ай"), "Google AI"],
  [wb("чат\\s*жи\\s*пи\\s*ти"), "ChatGPT"],
  [wb("помодоро"), "Pomodoro"],
  [wb("флаш\\s*карт"), "Flashcard"],
  [wb("күиз"), "Quiz"],
  [wb("эй\\s*пи\\s*ай"), "API"],
  [wb("юу\\s*ай"), "UI"],
  [wb("пи\\s*ди\\s*эф"), "PDF"],
  [wb("юү\\s*түүб"), "YouTube"],
  [wb("лоу\\s*фай"), "Lo-Fi"],
];

const CYRILLIC_TO_JAPANESE: Array<[RegExp, string]> = [
  [wb("конничива"), "こんにちは"],
  [wb("аригато"), "ありがとう"],
  [wb("охаёо"), "おはよう"],
  [wb("сенсей"), "先生"],
  [wb("нихонго"), "日本語"],
  [wb("жи\\s*эл\\s*пи\\s*ти"), "JLPT"],
  [wb("хирагана"), "ひらがな"],
  [wb("катакана"), "カタカナ"],
  [wb("канжи"), "漢字"],
  [wb("сакүра"), "桜"],
];

const GLUED_SUFFIX_FIXES: Array<[RegExp, string]> = [
  [
    /([A-Za-z0-9]+)(ийн|ын|ийг|ыг|аас|ээс|оос|өөс|руу|рүү|тай|тэй|той|гүй|дээр|дахь)(?![\p{L}\p{N}])/gu,
    "$1-$2",
  ],
];

export function restoreCodeSwitchingTerms(raw: string): string {
  let result = raw;
  for (const [pattern, replacement] of CYRILLIC_TO_ENGLISH) {
    result = result.replace(pattern, replacement);
  }
  for (const [pattern, replacement] of CYRILLIC_TO_JAPANESE) {
    result = result.replace(pattern, replacement);
  }
  for (const [pattern, replacement] of GLUED_SUFFIX_FIXES) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

export interface ProcessVoiceOptions {
  removeFillers?: boolean;
  restoreTerms?: boolean;
  autoPunctuate?: boolean;
}

export function processVoiceTranscript(
  raw: string,
  options: ProcessVoiceOptions = {},
): string {
  const {
    removeFillers = true,
    restoreTerms = true,
    autoPunctuate = true,
  } = options;

  let text = raw.trim();
  if (!text) return "";

  if (restoreTerms) {
    text = restoreCodeSwitchingTerms(text);
  }

  if (removeFillers) {
    for (const filler of MONGOLIAN_FILLER_WORDS) {
      const escaped = filler.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rx = new RegExp(
        `(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`,
        "giu",
      );
      text = text.replace(rx, " ");
    }
  }

  // Spoken punctuation helpers
  text = text
    .replace(/\s+таслал(?![\p{L}\p{N}])/giu, ",")
    .replace(/\s+цэг(?![\p{L}\p{N}])/giu, ".")
    .replace(/\s+асуултын тэмдэг(?![\p{L}\p{N}])/giu, "?")
    .replace(/\s+анхаарлын тэмдэг(?![\p{L}\p{N}])/giu, "!")
    .replace(/\s+шинэ мөр(?![\p{L}\p{N}])/giu, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .trim();

  if (!text) return "";

  // Capitalize first letter
  text = text.charAt(0).toUpperCase() + text.slice(1);

  if (autoPunctuate && !/[.!?…。！？]$/.test(text)) {
    const isQuestion =
      /(?<![\p{L}\p{N}])(юу|хэн|хэзээ|хаана|яагаад|хэрхэн|ямар|хэдэн|уу|үү|юү|бэ|вэ|what|why|how|when|where)(?![\p{L}\p{N}])/iu.test(
        text,
      );
    text += isQuestion ? "?" : ".";
  }

  return text;
}
