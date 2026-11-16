import { parseCardDrafts, parseQuizDrafts } from "@/lib/knowledge/generation";
import { parsePlanProposal } from "@/lib/assistant/plan";
import { readLimitedBody, stripJsonFence } from "@/lib/http/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 3 * 1024 * 1024;
const MAX_IMAGE_CHARS = 2 * 1024 * 1024;
const MAX_TEXT_CHARS = 15_000;
const MAX_MESSAGE_CHARS = 3_000;
const MAX_API_KEY_CHARS = 512;
const DATA_IMAGE_RE =
  /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { "Cache-Control": "no-store" } });

const ALLOWED_MODELS = new Set([
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
]);

function resolveModel(headerModel: string | null): string {
  const candidate = (
    headerModel ||
    process.env.GEMINI_MODEL ||
    "gemini-2.5-flash"
  ).trim();
  return ALLOWED_MODELS.has(candidate) ? candidate : "gemini-2.5-flash";
}

function buildEndpoints(apiKey: string, model: string): string[] {
  const aiStudioUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const vertexExpressUrl = `https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:generateContent`;

  // Keys prefixed with "AQ." are Google Cloud / Vertex AI Express keys; "AIza" are Google AI Studio keys.
  return apiKey.startsWith("AQ.")
    ? [vertexExpressUrl, aiStudioUrl]
    : [aiStudioUrl, vertexExpressUrl];
}

function parseValidatedImage(
  image: unknown,
):
  | { ok: true; inlineData: { mimeType: string; data: string } | null }
  | { ok: false } {
  if (image === undefined || image === null) {
    return { ok: true, inlineData: null };
  }
  if (typeof image !== "string" || image.length > MAX_IMAGE_CHARS) {
    return { ok: false };
  }
  const match = DATA_IMAGE_RE.exec(image);
  if (!match) {
    return { ok: false };
  }
  return {
    ok: true,
    inlineData: { mimeType: match[1], data: match[2] },
  };
}

export async function GET() {
  const configuredOnServer = Boolean(
    process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_AI_API_KEY?.trim(),
  );
  return json({
    configuredOnServer,
    defaultModel: resolveModel(null),
  });
}

const PUBLIC_RATE_WINDOW_MS = 10 * 60 * 1000;
const PUBLIC_RATE_MAX_REQUESTS = 30;
const publicIpBuckets = new Map<string, number[]>();

function checkPublicServerRateLimit(request: Request): boolean {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "anon";
  const now = Date.now();
  const recent = (publicIpBuckets.get(ip) ?? []).filter(
    (ts) => now - ts < PUBLIC_RATE_WINDOW_MS,
  );
  if (recent.length >= PUBLIC_RATE_MAX_REQUESTS) {
    publicIpBuckets.set(ip, recent);
    return false;
  }
  recent.push(now);
  publicIpBuckets.set(ip, recent);
  if (publicIpBuckets.size > 500) {
    for (const [k, arr] of publicIpBuckets) {
      if (arr.every((ts) => now - ts >= PUBLIC_RATE_WINDOW_MS)) {
        publicIpBuckets.delete(k);
      }
    }
  }
  // Bound memory even if many unique addresses arrive within one window.
  while (publicIpBuckets.size > 1000) {
    let oldestIp: string | null = null;
    let oldestSeen = Infinity;
    for (const [candidate, timestamps] of publicIpBuckets) {
      const firstSeen = timestamps[0] ?? now;
      if (firstSeen < oldestSeen) {
        oldestSeen = firstSeen;
        oldestIp = candidate;
      }
    }
    if (oldestIp === null) break;
    publicIpBuckets.delete(oldestIp);
  }
  return true;
}

export async function POST(request: Request) {
  const headerKey = request.headers.get("x-gemini-api-key")?.trim() || "";
  if (
    headerKey &&
    (headerKey.length > MAX_API_KEY_CHARS || /[\r\n]/.test(headerKey))
  ) {
    return json({ error: "API түлхүүрийн бүтэц буруу байна." }, 400);
  }
  const envKey = (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    ""
  ).trim();
  const apiKey = headerKey || envKey;

  if (!apiKey) {
    return json(
      {
        error:
          "Google AI Studio API түлхүүр тохируулаагүй байна. Бондоок → Google AI тохиргоо хэсэгт түлхүүрээ оруулна уу.",
      },
      503,
    );
  }

  // Protect shared server key against public abuse; personal device keys are unrestricted
  if (!headerKey && envKey && !checkPublicServerRateLimit(request)) {
    return json(
      {
        error:
          "Нийтийн үнэгүй AI хязгаар түр дүүрлээ. 10 минутын дараа оролдох эсвэл өөрийн Google AI түлхүүрээ оруулж хязгааргүй ашиглаарай.",
      },
      429,
    );
  }

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return json({ error: "Хүсэлтийн бүтэц буруу." }, 415);
  }

  const bodyResult = await readLimitedBody(request, MAX_BODY_BYTES);
  if (!bodyResult.ok) {
    if (bodyResult.reason === "too_large") {
      return json({ error: "Хүсэлт хэт урт байна." }, 413);
    }
    return json(
      {
        error:
          bodyResult.reason === "empty"
            ? "Хүсэлт хоосон."
            : "Хүсэлтийг уншиж чадсангүй.",
      },
      400,
    );
  }

  let input: {
    kind?: unknown;
    message?: unknown;
    context?: unknown;
    text?: unknown;
    image?: unknown;
    count?: unknown;
    language?: unknown;
  };
  try {
    const parsed: unknown = JSON.parse(bodyResult.value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return json({ error: "Хүсэлтийн JSON бүтэц буруу." }, 400);
    }
    input = parsed as typeof input;
  } catch {
    return json({ error: "Хүсэлтийн JSON бүтэц буруу." }, 400);
  }

  const kind =
    input.kind === "cards" ||
    input.kind === "quiz" ||
    input.kind === "plan" ||
    input.kind === "snap" ||
    input.kind === "ping"
      ? input.kind
      : "chat";

  const language = input.language === "en" ? "en" : "mn";
  const model = resolveModel(request.headers.get("x-gemini-model"));

  if (kind === "ping") {
    const pingBody = {
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
      generationConfig: {
        maxOutputTokens: 120,
        temperature: 0.4,
      },
    };
    const result = await invokeGemini(apiKey, model, pingBody);
    if (!result.ok) {
      return json({ error: result.error }, result.status);
    }
    return json({
      text: result.text || "Бондоок Google AI Studio-той холбогдлоо! 🐾",
      model,
      kind: "ai",
    });
  }

  const imageCheck = parseValidatedImage(input.image);
  if (!imageCheck.ok) {
    return json(
      {
        error:
          "Зургийн формат эсвэл хэмжээ буруу байна (PNG, JPEG, WebP · дээд тал нь 2MB).",
      },
      400,
    );
  }

  if (
    (kind === "chat" || kind === "plan") &&
    (imageCheck.inlineData !== null ||
      typeof input.message !== "string" ||
      !input.message.trim() ||
      input.message.length > MAX_MESSAGE_CHARS ||
      !input.context ||
      typeof input.context !== "object" ||
      Array.isArray(input.context))
  ) {
    return json({ error: "Асуулт болон контекстээ шалгана уу." }, 400);
  }

  if (kind === "snap") {
    if (
      input.text !== undefined &&
      input.text !== null &&
      (typeof input.text !== "string" || input.text.length > MAX_TEXT_CHARS)
    ) {
      return json(
        { error: "Тайлбар текст хэт урт эсвэл буруу бүтэцтэй байна." },
        400,
      );
    }
    const snapText = typeof input.text === "string" ? input.text.trim() : "";
    if (!imageCheck.inlineData && !snapText) {
      return json({ error: "Зураг эсвэл тайлбар текст оруулна уу." }, 400);
    }
  }

  if (
    (kind === "cards" || kind === "quiz") &&
    (typeof input.text !== "string" ||
      input.text.length > MAX_TEXT_CHARS ||
      (!input.text.trim() && !imageCheck.inlineData) ||
      !Number.isInteger(input.count) ||
      Number(input.count) < 1 ||
      Number(input.count) > 12)
  ) {
    return json(
      {
        error:
          kind === "quiz"
            ? "Quiz үүсгэх материал болон тоог шалгана уу."
            : "Карт үүсгэх текст, зураг эсвэл тоог шалгана уу.",
      },
      400,
    );
  }

  const languageInstruction =
    language === "en"
      ? "Respond in natural, encouraging English unless the learning material is intentionally in another language."
      : "Цэвэр, ойлгомжтой, дулаахан Монгол хэлээр хариул (хэрэв сурах материал өөр хэл дээр бол тухайн хэлний нэр томьёог хадгалж тайлбарла).";

  const systemText =
    languageInstruction +
    " " +
    (kind === "plan"
      ? "You are Bondook (Бондоок), TOGTMOL's study companion. Propose a realistic study plan as JSON matching {title, description, weeks (1-12), daysPerWeek (1-7), minutesPerDay (5-120), milestoneTitles (string[])}. Respect available time and never claim anything is already saved."
      : kind === "snap"
        ? "You are Bondook (Бондоок), a multimodal study extractor. Read the uploaded notebook/whiteboard/book image carefully and return JSON matching {title: string, summaryMarkdown: string, cards: [{front: string, back: string}], questions: [{type: 'choice'|'boolean'|'short', prompt: string, options: string[], answer: string, explanation: string}]}."
        : kind === "quiz"
          ? "You are Bondook (Бондоок), a careful retrieval-practice quiz builder. Return JSON matching {questions: [{type: 'choice'|'boolean'|'short', prompt, options: string[], answer, explanation}]} grounded strictly in the provided material."
          : kind === "cards"
            ? "You are Bondook (Бондоок), a concise spaced-repetition flashcard creator. Return JSON matching {cards: [{front, back}]} grounded strictly in the provided material."
            : "You are Bondook (Бондоок), TOGTMOL Study OS's calm, practical AI study companion. Help the student understand concepts step-by-step, summarize notes, practice languages (MN/EN/JP), or plan gentle realistic sessions based on supplied studyContext. Avoid guilt or pressure; keep formatting crisp and readable.");

  const userParts: Array<Record<string, unknown>> = [];
  if (kind === "chat" || kind === "plan") {
    userParts.push({
      text: JSON.stringify({
        question: input.message,
        studyContext: input.context,
      }),
    });
  } else {
    userParts.push({
      text:
        kind === "snap"
          ? `Extract a clean structured Markdown study note (headings, bullet points, formulas), 5 flashcards, and 3 quiz questions from this study material.${typeof input.text === "string" && input.text.trim() ? `\nTopic hint: ${input.text.trim()}` : ""}`
          : kind === "quiz"
            ? `Create up to ${input.count} retrieval-practice quiz questions from this material:\n${input.text}`
            : `Create up to ${input.count} concise Q/A flashcards from this material:\n${input.text}`,
    });
    if (imageCheck.inlineData) {
      userParts.push({
        inlineData: imageCheck.inlineData,
      });
    }
  }

  const generationConfig: Record<string, unknown> = {
    maxOutputTokens:
      kind === "cards" || kind === "quiz" || kind === "snap" ? 4096 : 1600,
    temperature: kind === "chat" ? 0.65 : 0.35,
  };

  if (
    kind === "cards" ||
    kind === "quiz" ||
    kind === "plan" ||
    kind === "snap"
  ) {
    generationConfig.responseMimeType = "application/json";
  }

  const geminiPayload = {
    systemInstruction: {
      parts: [{ text: systemText }],
    },
    contents: [
      {
        role: "user",
        parts: userParts,
      },
    ],
    generationConfig,
  };

  const result = await invokeGemini(apiKey, model, geminiPayload);
  if (!result.ok) {
    return json({ error: result.error }, result.status);
  }

  if (kind === "snap") {
    try {
      const cleaned = stripJsonFence(result.text);
      const parsed = JSON.parse(cleaned) as {
        title?: unknown;
        summaryMarkdown?: unknown;
        cards?: unknown;
        questions?: unknown;
      };
      return json({
        title:
          typeof parsed.title === "string" && parsed.title.trim()
            ? parsed.title.trim().slice(0, 120)
            : "Зургаас задалсан хичээл",
        summaryMarkdown:
          typeof parsed.summaryMarkdown === "string"
            ? parsed.summaryMarkdown.slice(0, 15000)
            : "",
        cards:
          Array.isArray(parsed.cards) && parsed.cards.length > 0
            ? parseCardDrafts({ cards: parsed.cards.slice(0, 10) })
            : [],
        questions:
          Array.isArray(parsed.questions) && parsed.questions.length > 0
            ? parseQuizDrafts({ questions: parsed.questions.slice(0, 6) })
            : [],
        kind: "ai",
        model,
      });
    } catch {
      return json(
        { error: "Зургийн агуулгыг задлахад алдаа гарлаа. Дахин оролдоно уу." },
        502,
      );
    }
  }

  if (kind === "plan") {
    try {
      const cleaned = stripJsonFence(result.text);
      return json({
        plan: parsePlanProposal(JSON.parse(cleaned)),
        kind: "ai",
        model,
      });
    } catch {
      return json(
        {
          error: "AI төлөвлөгөөний бүтцийг уншиж чадсангүй. Дахин оролдоно уу.",
        },
        502,
      );
    }
  }

  if (kind === "cards") {
    try {
      const cleaned = stripJsonFence(result.text);
      return json({
        cards: parseCardDrafts(JSON.parse(cleaned)).slice(
          0,
          Number(input.count),
        ),
        kind: "ai",
        model,
      });
    } catch {
      return json(
        { error: "Картын хариуг задлахад алдаа гарлаа. Дахин оролдоно уу." },
        502,
      );
    }
  }

  if (kind === "quiz") {
    try {
      const cleaned = stripJsonFence(result.text);
      return json({
        questions: parseQuizDrafts(JSON.parse(cleaned)).slice(
          0,
          Number(input.count),
        ),
        kind: "ai",
        model,
      });
    } catch {
      return json(
        { error: "Quiz хариуг задлахад алдаа гарлаа. Дахин оролдоно уу." },
        502,
      );
    }
  }

  return result.text
    ? json({ text: result.text.slice(0, 8000), kind: "ai", model })
    : json({ error: "AI хоосон хариу буцаалаа." }, 502);
}

async function invokeGemini(
  apiKey: string,
  model: string,
  payload: Record<string, unknown>,
): Promise<
  { ok: true; text: string } | { ok: false; status: number; error: string }
> {
  const endpoints = buildEndpoints(apiKey, model);
  let lastError = "Google AI Studio-той холбогдож чадсангүй.";
  let lastStatus = 502;

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(28000),
      });

      const body = (await res.json().catch(() => ({}))) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
        error?: { message?: string; status?: string; code?: number };
      };

      if (res.ok) {
        const text = (body.candidates ?? [])
          .flatMap((c) => c.content?.parts ?? [])
          .map((p) => (typeof p.text === "string" ? p.text : ""))
          .join("\n")
          .trim();
        return { ok: true, text };
      }

      lastStatus = res.status >= 400 && res.status < 600 ? res.status : 502;
      const upstreamMsg = (body.error?.message || "")
        .replaceAll(apiKey, "[REDACTED]")
        .slice(0, 180);
      if (res.status === 429) {
        lastError =
          "Google AI Studio хүсэлтийн хязгаарт (Rate limit) хүрлээ. Түр хүлээгээд дахин оролдоно уу.";
        break;
      }
      if (res.status === 400 || res.status === 401 || res.status === 403) {
        lastError = upstreamMsg
          ? `Google AI түлхүүр эсвэл эрх шалгана уу: ${upstreamMsg}`
          : "Google AI API түлхүүр хүчингүй эсвэл эрх хүрэлцэхгүй байна (aistudio.google.com/apikey).";
      } else if (upstreamMsg) {
        lastError = `Google AI алдаа: ${upstreamMsg}`;
      }
    } catch {
      lastError =
        "Google AI серверт сүлжээгээр холбогдож чадсангүй. Интернэт холболтоо шалгана уу.";
      lastStatus = 503;
    }
  }

  return { ok: false, status: lastStatus, error: lastError };
}
