import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_WAV_BYTES = 1_920_044;
const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { "Cache-Control": "no-store" } });

async function readLimitedBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("empty");
  const parts: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.byteLength;
    if (size > MAX_WAV_BYTES) {
      await reader.cancel();
      throw new Error("large");
    }
    parts.push(part.value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    body.set(part, offset);
    offset += part.byteLength;
  }
  return body;
}

function validWav(bytes: Uint8Array) {
  if (bytes.length < 44) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (offset: number, value: string) =>
    value
      .split("")
      .every((char, index) => bytes[offset + index] === char.charCodeAt(0));
  const dataBytes = view.getUint32(40, true);
  return (
    text(0, "RIFF") &&
    text(8, "WAVE") &&
    text(12, "fmt ") &&
    text(36, "data") &&
    view.getUint32(16, true) === 16 &&
    view.getUint16(20, true) === 1 &&
    view.getUint16(22, true) === 1 &&
    view.getUint32(24, true) === 16000 &&
    view.getUint16(34, true) === 16 &&
    dataBytes === bytes.length - 44 &&
    dataBytes >= 16000 &&
    dataBytes <= 16000 * 2 * 60
  );
}

export async function POST(request: Request) {
  const apiToken = process.env.CHIMEGE_API_TOKEN?.trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  const allowlist = process.env.CHIMEGE_ALLOWED_USER_IDS?.trim();
  const allowed = (
    allowlist ||
    process.env.BONDOOK_AI_ALLOWED_USER_IDS ||
    process.env.TOGI_AI_ALLOWED_USER_IDS ||
    ""
  )
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (!apiToken || !supabaseUrl || !publishable || !allowed.length)
    return json(
      { error: "Дуугаар бичих үйлчилгээ одоогоор тохируулаагүй байна." },
      503,
    );

  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";
  if (!accessToken)
    return json({ error: "Дуугаар бичихэд бүртгэлээр нэвтэрнэ үү." }, 401);
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "audio/wav")
    return json({ error: "Аудио файлын төрөл дэмжигдэхгүй байна." }, 415);

  const client = createClient(supabaseUrl, publishable, {
    global: { headers: { Authorization: authorization! } },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user)
    return json(
      { error: "Нэвтрэх хугацаа дууссан байна. Дахин нэвтэрнэ үү." },
      401,
    );
  if (!allowed.includes(data.user.id))
    return json(
      { error: "Энэ бүртгэлд дуугаар бичих эрх нээгээгүй байна." },
      403,
    );

  let audio: Uint8Array;
  try {
    const declaredLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_WAV_BYTES)
      return json({ error: "Бичлэг 60 секундээс хэтэрч болохгүй." }, 413);
    audio = await readLimitedBody(request);
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error && error.message === "large"
            ? "Бичлэгийн хэмжээ хэтэрлээ."
            : "Аудио хүсэлтийг уншиж чадсангүй.",
      },
      error instanceof Error && error.message === "large" ? 413 : 400,
    );
  }
  if (!validWav(audio))
    return json(
      { error: "Аудио формат буруу байна. Дахин бичлэг хийнэ үү." },
      400,
    );

  const quota = await client.rpc("consume_togi_request", {
    expected_user_id: data.user.id,
  });
  if (quota.error)
    return json(
      {
        error:
          "Өдөр тутмын хязгаарыг шалгаж чадсангүй. Түр хүлээгээд оролдоно уу.",
      },
      503,
    );
  if (!quota.data)
    return json(
      { error: "Өдрийн нийт 20 онлайн хүсэлтийн хязгаарт хүрлээ." },
      429,
    );

  try {
    const body = new ArrayBuffer(audio.byteLength);
    new Uint8Array(body).set(audio);
    const response = await fetch("https://api.chimege.com/v1.2/transcribe", {
      method: "POST",
      headers: { Token: apiToken, "Content-Type": "audio/wav" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(35000),
    });
    if (!response.ok)
      return json(
        { error: "Chimege түр хариу өгсөнгүй. Дараа дахин оролдоно уу." },
        502,
      );
    const raw = await response.text();
    let text = raw;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed === "object" &&
        "transcription" in parsed &&
        typeof parsed.transcription === "string"
      )
        text = parsed.transcription;
    } catch {
      // Chimege may return the transcript as plain text.
    }
    text = text.trim();
    if (!text || text.length > 10000)
      return json(
        {
          error:
            "Хоосон эсвэл хэт урт хариу ирлээ. Богино бичлэгээр оролдоно уу.",
        },
        502,
      );
    return json({ text });
  } catch {
    return json(
      {
        error:
          "Chimege-тэй холбогдож чадсангүй. Сүлжээгээ шалгаад дахин оролдоно уу.",
      },
      502,
    );
  }
}
