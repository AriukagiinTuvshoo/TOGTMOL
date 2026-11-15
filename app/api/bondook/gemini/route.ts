import { parseCardDrafts, parseQuizDrafts } from "@/lib/knowledge/generation";
import { parsePlanProposal } from "@/lib/assistant/plan";

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
  const encodedKey = encodeURIComponent(apiKey);
  const aiStudioUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodedKey}`;
  const vertexExpressUrl = `https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:generateContent?key=${encodedKey}`;

  // Keys prefixed with "AQ." are Google Cloud / Vertex AI Express keys; "AIza" are Google AI Studio keys.
  return apiKey.startsWith("AQ.")
    ? [vertexExpressUrl, aiStudioUrl]
    : [aiStudioUrl, vertexExpressUrl];
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

export async function POST(request: Request) {
  const headerKey = request.headers.get("x-gemini-api-key")?.trim() || "";
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

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return json({ error: "Хүсэлтийн бүтэц буруу." }, 415);
  }

  let raw = "";
  const reader = request.body?.getReader();
  if (!reader) return json({ error: "Хүсэлт хоосон." }, 400);
  const decoder = new TextDecoder();
  let bytes = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 3 * 1024 * 1024) {
        await reader.cancel();
        return json({ error: "Хүсэлт хэт урт байна." }, 413);
      }
      raw += decoder.decode(part.value, { stream: true });
    }
    raw += decoder.decode();
  } catch {
    return json({ error: "Хүсэлтийг уншиж чадсангүй." }, 400);
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
    input = JSON.parse(raw);
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

  if (
    (kind === "chat" || kind === "plan") &&
    (typeof input.message !== "string" ||
      !input.message.trim() ||
      input.message.length > 3000 ||
      !input.context ||
      typeof input.context !== "object" ||
      Array.isArray(input.context))
  ) {
    return json({ error: "Асуулт болон контекстээ шалгана уу." }, 400);
  }

  if (
    kind === "snap" &&
    typeof input.image !== "string" &&
    (typeof input.text !== "string" || !input.text.trim())
  ) {
    return json({ error: "Зураг эсвэл тайлбар текст оруулна уу." }, 400);
  }

  if (
    (kind === "cards" || kind === "quiz") &&
    (typeof input.text !== "string" ||
      input.text.length > 15000 ||
      (!input.text.trim() && !input.image) ||
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
    if (
      typeof input.image === "string" &&
      /^data:image\/(png|jpeg|webp);base64,/.test(input.image)
    ) {
      const [meta, b64] = input.image.split(",");
      const mimeMatch = meta.match(/^data:(image\/[a-z]+);base64$/);
      if (mimeMatch && b64) {
        userParts.push({
          inlineData: {
            mimeType: mimeMatch[1],
            data: b64,
          },
        });
      }
    }
  }

  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: kind === "cards" || kind === "quiz" ? 4096 : 1600,
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
        cards: Array.isArray(parsed.cards)
          ? parseCardDrafts({ cards: parsed.cards }).slice(0, 10)
          : [],
        questions: Array.isArray(parsed.questions)
          ? parseQuizDrafts({ questions: parsed.questions }).slice(0, 6)
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

function stripJsonFence(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
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
        headers: { "Content-Type": "application/json" },
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
      const upstreamMsg = body.error?.message || "";
      if (res.status === 429) {
        lastError =
          "Google AI Studio хүсэлтийн хязгаарт (Rate limit) хүрлээ. Түр хүлээгээд дахин оролдоно уу.";
        break;
      }
      if (res.status === 400 || res.status === 401 || res.status === 403) {
        lastError = upstreamMsg
          ? `Google AI түлхүүр эсвэл эрх шалгана уу: ${upstreamMsg.slice(0, 180)}`
          : "Google AI API түлхүүр хүчингүй эсвэл эрх хүрэлцэхгүй байна (aistudio.google.com/apikey).";
      } else if (upstreamMsg) {
        lastError = `Google AI алдаа: ${upstreamMsg.slice(0, 180)}`;
      }
    } catch {
      lastError =
        "Google AI серверт сүлжээгээр холбогдож чадсангүй. Интернэт холболтоо шалгана уу.";
      lastStatus = 503;
    }
  }

  return { ok: false, status: lastStatus, error: lastError };
}
