import type { Language } from "@/lib/i18n/config";
import {
  parseCardDrafts,
  parseQuizDrafts,
  type CardDraft,
  type QuizDraft,
} from "@/lib/knowledge/generation";
import { parsePlanProposal, type PlanProposal } from "./plan";
import {
  aiContext,
  type ChatContext,
  type ChatProvider,
} from "./chat-provider";

export const GEMINI_STORAGE_KEY = "togtmol:gemini:v1";

export const GEMINI_MODELS = [
  {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    desc: "Хурдан, ухаалаг · Өдөр тутмын хичээл ба карт үүсгэхэд хамгийн тохиромжтой",
  },
  {
    id: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    desc: "Гүнзгий логик · Хүнд бодлого, нарийн төлөвлөгөө задлахад",
  },
  {
    id: "gemini-2.0-flash",
    label: "Gemini 2.0 Flash",
    desc: "Хөнгөн, хурдтай хариулт",
  },
] as const;

export type GeminiModelId = (typeof GEMINI_MODELS)[number]["id"];

export interface GeminiDeviceConfig {
  enabled: boolean;
  apiKey: string;
  model: GeminiModelId;
}

const DEFAULT_CONFIG: GeminiDeviceConfig = {
  enabled: false,
  apiKey: "",
  model: "gemini-2.5-flash",
};

const listeners = new Set<() => void>();

function emitGeminiChange() {
  listeners.forEach((fn) => fn());
}

export function subscribeGeminiConfig(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function readGeminiConfig(): GeminiDeviceConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = window.localStorage.getItem(GEMINI_STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<GeminiDeviceConfig>;
    const validModel = GEMINI_MODELS.some((m) => m.id === parsed.model)
      ? (parsed.model as GeminiModelId)
      : "gemini-2.5-flash";
    return {
      enabled: Boolean(parsed.enabled),
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey.trim() : "",
      model: validModel,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function writeGeminiConfig(patch: Partial<GeminiDeviceConfig>) {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  const next: GeminiDeviceConfig = {
    ...readGeminiConfig(),
    ...patch,
  };
  try {
    window.localStorage.setItem(GEMINI_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota errors */
  }
  emitGeminiChange();
  return next;
}

export function clearGeminiConfig() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(GEMINI_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  emitGeminiChange();
}

export async function probeGeminiServerStatus(): Promise<{
  configuredOnServer: boolean;
  defaultModel: string;
}> {
  if (typeof window === "undefined") {
    return { configuredOnServer: false, defaultModel: "gemini-2.5-flash" };
  }
  if (typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent)) {
    return { configuredOnServer: false, defaultModel: "gemini-2.5-flash" };
  }
  try {
    const res = await fetch("/api/bondook/gemini", {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      return { configuredOnServer: false, defaultModel: "gemini-2.5-flash" };
    }
    const data = (await res.json()) as {
      configuredOnServer?: boolean;
      defaultModel?: string;
    };
    return {
      configuredOnServer: Boolean(data.configuredOnServer),
      defaultModel: data.defaultModel || "gemini-2.5-flash",
    };
  } catch {
    return { configuredOnServer: false, defaultModel: "gemini-2.5-flash" };
  }
}

function stripJsonFence(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function buildDirectEndpoints(apiKey: string, model: string): string[] {
  const encodedKey = encodeURIComponent(apiKey);
  const aiStudioUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodedKey}`;
  const vertexExpressUrl = `https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:generateContent?key=${encodedKey}`;
  return apiKey.startsWith("AQ.")
    ? [vertexExpressUrl, aiStudioUrl]
    : [aiStudioUrl, vertexExpressUrl];
}

async function callDirectBrowserGemini(
  apiKey: string,
  model: string,
  geminiPayload: Record<string, unknown>,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const endpoints = buildDirectEndpoints(apiKey, model);
  let lastError = "Google AI Studio-той холбогдож чадсангүй.";

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiPayload),
        signal: AbortSignal.timeout(28000),
      });
      const body = (await res.json().catch(() => ({}))) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
        error?: { message?: string };
      };
      if (res.ok) {
        const text = (body.candidates ?? [])
          .flatMap((c) => c.content?.parts ?? [])
          .map((p) => (typeof p.text === "string" ? p.text : ""))
          .join("\n")
          .trim();
        return { ok: true, text };
      }
      const msg = body.error?.message || "";
      if (res.status === 429) {
        return {
          ok: false,
          error:
            "Google AI Studio хүсэлтийн хязгаарт (Rate limit) хүрлээ. Түр хүлээгээд дахин оролдоно уу.",
        };
      }
      if (res.status === 400 || res.status === 401 || res.status === 403) {
        lastError = msg
          ? `Google AI түлхүүр эсвэл эрх шалгана уу: ${msg.slice(0, 180)}`
          : "Google AI API түлхүүр хүчингүй байна (aistudio.google.com/apikey).";
      } else if (msg) {
        lastError = `Google AI алдаа: ${msg.slice(0, 180)}`;
      }
    } catch {
      lastError = "Google AI серверт сүлжээгээр холбогдож чадсангүй.";
    }
  }
  return { ok: false, error: lastError };
}

function buildSystemInstruction(
  kind: "chat" | "cards" | "quiz" | "plan" | "snap",
  language: Language,
): string {
  const langRule =
    language === "en"
      ? "Respond in natural, encouraging English unless the learning material is intentionally in another language."
      : "Цэвэр, ойлгомжтой, дулаахан Монгол хэлээр хариул (хэрэв сурах материал өөр хэл дээр бол тухайн хэлний нэр томьёог хадгалж тайлбарла).";

  if (kind === "snap") {
    return `${langRule} You are Bondook (Бондоок), a multimodal study extractor. Read the uploaded notebook/whiteboard/book image carefully and return JSON matching {"title": string, "summaryMarkdown": string, "cards": [{"front": string, "back": string}], "questions": [{"type": "choice"|"boolean"|"short", "prompt": string, "options": string[], "answer": string, "explanation": string}]}.`;
  }
  if (kind === "plan") {
    return `${langRule} You are Bondook (Бондоок), TOGTMOL's study companion. Propose a realistic study plan as JSON matching {"title": string, "description": string, "weeks": number(1-12), "daysPerWeek": number(1-7), "minutesPerDay": number(5-120), "milestoneTitles": string[]}.`;
  }
  if (kind === "quiz") {
    return `${langRule} You are Bondook (Бондоок), a retrieval-practice quiz builder. Return JSON matching {"questions": [{"type": "choice"|"boolean"|"short", "prompt": string, "options": string[], "answer": string, "explanation": string}]} grounded strictly in the provided material.`;
  }
  if (kind === "cards") {
    return `${langRule} You are Bondook (Бондоок), a spaced-repetition flashcard creator. Return JSON matching {"cards": [{"front": string, "back": string}]} grounded strictly in the provided material.`;
  }
  return `${langRule} You are Bondook (Бондоок), TOGTMOL Study OS's calm, practical AI study companion. Help the student understand concepts step-by-step, summarize notes, practice languages (MN/EN/JP), or plan gentle realistic sessions based on supplied studyContext.`;
}

async function runGeminiRequest(params: {
  kind: "chat" | "cards" | "quiz" | "plan" | "snap" | "ping";
  language: Language;
  message?: string;
  context?: Record<string, unknown>;
  text?: string;
  image?: string | null;
  count?: number;
  override?: { apiKey?: string; model?: string };
}): Promise<{ text: string; model: string }> {
  const cfg = readGeminiConfig();
  const apiKey = (params.override?.apiKey ?? cfg.apiKey).trim();
  const model =
    (params.override?.model ?? cfg.model).trim() || "gemini-2.5-flash";

  // 1. If device has an API key, try direct browser -> Google API first (works even when server outbound is restricted)
  if (apiKey) {
    const geminiPayload: Record<string, unknown> =
      params.kind === "ping"
        ? {
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: "Монголоор нэг богино өгүүлбэрээр 'Бондоок Google AI Studio-той холбогдлоо! 🐾' гэж мэндчил.",
                  },
                ],
              },
            ],
            generationConfig: { maxOutputTokens: 120, temperature: 0.4 },
          }
        : (() => {
            const parts: Array<Record<string, unknown>> = [];
            if (params.kind === "chat" || params.kind === "plan") {
              parts.push({
                text: JSON.stringify({
                  question: params.message,
                  studyContext: params.context ?? {},
                }),
              });
            } else {
              parts.push({
                text:
                  params.kind === "snap"
                    ? `Extract a clean structured Markdown study note, 5 flashcards, and 3 quiz questions from this study material.${params.text?.trim() ? `\nTopic hint: ${params.text.trim()}` : ""}`
                    : params.kind === "quiz"
                      ? `Create up to ${params.count ?? 5} retrieval-practice quiz questions from this material:\n${params.text ?? ""}`
                      : `Create up to ${params.count ?? 8} concise Q/A flashcards from this material:\n${params.text ?? ""}`,
              });
              if (
                typeof params.image === "string" &&
                /^data:image\/(png|jpeg|webp);base64,/.test(params.image)
              ) {
                const [meta, b64] = params.image.split(",");
                const m = meta.match(/^data:(image\/[a-z]+);base64$/);
                if (m && b64) {
                  parts.push({ inlineData: { mimeType: m[1], data: b64 } });
                }
              }
            }
            return {
              systemInstruction: {
                parts: [
                  {
                    text: buildSystemInstruction(params.kind, params.language),
                  },
                ],
              },
              contents: [{ role: "user", parts }],
              generationConfig: {
                maxOutputTokens:
                  params.kind === "cards" ||
                  params.kind === "quiz" ||
                  params.kind === "snap"
                    ? 4096
                    : 1600,
                temperature: params.kind === "chat" ? 0.65 : 0.35,
                ...(params.kind === "cards" ||
                params.kind === "quiz" ||
                params.kind === "plan" ||
                params.kind === "snap"
                  ? { responseMimeType: "application/json" }
                  : {}),
              },
            };
          })();

    const direct = await callDirectBrowserGemini(apiKey, model, geminiPayload);
    if (direct.ok) {
      return { text: direct.text, model };
    }
    // If key was explicitly rejected (400/401/403/429), surface immediately
    if (!direct.error.includes("сүлжээгээр")) {
      throw new Error(direct.error);
    }
  }

  // 2. Fall back to server /api/bondook/gemini (uses GEMINI_API_KEY env or forwarded header)
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(apiKey ? { "x-gemini-api-key": apiKey } : {}),
    ...(model ? { "x-gemini-model": model } : {}),
  };
  const res = await fetch("/api/bondook/gemini", {
    method: "POST",
    headers,
    body: JSON.stringify({
      kind: params.kind,
      language: params.language,
      message: params.message,
      context: params.context,
      text: params.text,
      image: params.image ?? null,
      count: params.count,
    }),
    signal: AbortSignal.timeout(32000),
  });
  const data = (await res.json().catch(() => ({}))) as {
    text?: string;
    title?: string;
    summaryMarkdown?: string;
    cards?: unknown;
    questions?: unknown;
    plan?: unknown;
    model?: string;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(
      data.error || "Google AI Studio түр холбогдсонгүй. Түлхүүрээ шалгана уу.",
    );
  }
  if (params.kind === "snap") {
    return {
      text: JSON.stringify({
        title: data.title,
        summaryMarkdown: data.summaryMarkdown,
        cards: data.cards,
        questions: data.questions,
      }),
      model: data.model || model,
    };
  }
  if (params.kind === "cards" && data.cards) {
    return {
      text: JSON.stringify({ cards: data.cards }),
      model: data.model || model,
    };
  }
  if (params.kind === "quiz" && data.questions) {
    return {
      text: JSON.stringify({ questions: data.questions }),
      model: data.model || model,
    };
  }
  if (params.kind === "plan" && data.plan) {
    return { text: JSON.stringify(data.plan), model: data.model || model };
  }
  return { text: data.text || "", model: data.model || model };
}

export async function testGeminiConnection(override?: {
  apiKey?: string;
  model?: string;
}): Promise<{ ok: boolean; reply?: string; model?: string; error?: string }> {
  try {
    const res = await runGeminiRequest({
      kind: "ping",
      language: "mn",
      override,
    });
    return {
      ok: true,
      reply: res.text || "Бондоок Google AI Studio-той холбогдлоо! 🐾",
      model: res.model,
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Сүлжээний алдаа гарлаа. Дахин оролдоно уу.",
    };
  }
}

export function createGeminiChatProvider(
  includeNotes = false,
  language: Language = "mn",
): ChatProvider {
  return {
    kind: "ai",
    reply: async (message: string, context: ChatContext) => {
      const contextData = aiContext(context, includeNotes);
      const wantsPersonal =
        /миний|надад|долоо|өнөөдөр|тэмдэглэл|ахиц|хуваарь|review|my |this week|today|pace/i.test(
          message,
        );
      const chosenContext = wantsPersonal
        ? (contextData as unknown as Record<string, unknown>)
        : { today: context.today };

      const res = await runGeminiRequest({
        kind: "chat",
        language,
        message,
        context: chosenContext,
      });

      if (!res.text.trim()) {
        throw new Error("Google AI хоосон хариу буцаалаа.");
      }

      return {
        text: res.text.slice(0, 8000),
        ...(/зорилго|goal|төлөв|plan|сурмаар|болмоор|want.*learn/i.test(message)
          ? { action: "plan" as const, planPrompt: message.slice(0, 200) }
          : {}),
      };
    },
  };
}

export async function generateGeminiCards(params: {
  text: string;
  count: number;
  image?: string | null;
  language: Language;
}): Promise<CardDraft[]> {
  const res = await runGeminiRequest({
    kind: "cards",
    language: params.language,
    text: params.text,
    image: params.image ?? null,
    count: params.count,
  });
  const parsed = JSON.parse(stripJsonFence(res.text)) as unknown;
  return parseCardDrafts(parsed).slice(0, params.count);
}

export async function generateGeminiQuiz(params: {
  text: string;
  count: number;
  language: Language;
}): Promise<QuizDraft[]> {
  const res = await runGeminiRequest({
    kind: "quiz",
    language: params.language,
    text: params.text,
    count: params.count,
  });
  const parsed = JSON.parse(stripJsonFence(res.text)) as unknown;
  return parseQuizDrafts(parsed).slice(0, params.count);
}

export async function generateGeminiPlan(params: {
  message: string;
  context: Record<string, unknown>;
  language: Language;
}): Promise<PlanProposal> {
  const res = await runGeminiRequest({
    kind: "plan",
    language: params.language,
    message: params.message,
    context: params.context,
  });
  const parsed = JSON.parse(stripJsonFence(res.text)) as unknown;
  return parsePlanProposal(parsed);
}

export interface SnapStudyBundle {
  title: string;
  summaryMarkdown: string;
  cards: CardDraft[];
  questions: QuizDraft[];
}

export async function generateGeminiSnapStudy(params: {
  image: string | null;
  hintText: string;
  language: Language;
}): Promise<SnapStudyBundle> {
  const res = await runGeminiRequest({
    kind: "snap",
    language: params.language,
    image: params.image,
    text: params.hintText,
  });
  const raw = JSON.parse(stripJsonFence(res.text)) as {
    title?: unknown;
    summaryMarkdown?: unknown;
    cards?: unknown;
    questions?: unknown;
  };
  return {
    title:
      typeof raw.title === "string" && raw.title.trim()
        ? raw.title.trim().slice(0, 120)
        : "Зургаас задалсан хичээл",
    summaryMarkdown:
      typeof raw.summaryMarkdown === "string" ? raw.summaryMarkdown : "",
    cards: Array.isArray(raw.cards)
      ? parseCardDrafts({ cards: raw.cards }).slice(0, 10)
      : [],
    questions: Array.isArray(raw.questions)
      ? parseQuizDrafts({ questions: raw.questions }).slice(0, 6)
      : [],
  };
}
