export type ReadBodyError = "empty" | "too_large" | "read_error";

export type ReadBodyResult<T> =
  | { ok: true; value: T; byteLength: number }
  | { ok: false; reason: ReadBodyError };

/**
 * Stream-reads a Request body up to `maxBytes`.
 * Enforces both `Content-Length` (fast fail) and actual streamed byte count
 * since clients may omit or forge `Content-Length`.
 */
export async function readLimitedBody(
  request: Request,
  maxBytes: number,
  encoding: "bytes",
): Promise<ReadBodyResult<Uint8Array>>;
export async function readLimitedBody(
  request: Request,
  maxBytes: number,
  encoding?: "utf8",
): Promise<ReadBodyResult<string>>;
export async function readLimitedBody(
  request: Request,
  maxBytes: number,
  encoding: "utf8" | "bytes" = "utf8",
): Promise<ReadBodyResult<string | Uint8Array>> {
  const declared = request.headers.get("content-length");
  if (declared !== null && declared.trim() !== "") {
    const parsed = Number(declared);
    if (Number.isFinite(parsed) && parsed > maxBytes) {
      try {
        await request.body?.cancel();
      } catch {
        /* ignore cancel errors */
      }
      return { ok: false, reason: "too_large" };
    }
  }

  const reader = request.body?.getReader();
  if (!reader) {
    return { ok: false, reason: "empty" };
  }

  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          /* ignore cancel errors */
        }
        return { ok: false, reason: "too_large" };
      }
      parts.push(part.value);
    }
  } catch {
    return { ok: false, reason: "read_error" };
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.byteLength;
  }

  if (encoding === "bytes") {
    return { ok: true, value: bytes, byteLength: size };
  }

  const decoder = new TextDecoder();
  return { ok: true, value: decoder.decode(bytes), byteLength: size };
}

/**
 * Strips optional leading/trailing ``` or ```json Markdown code fences
 * around structured JSON model responses.
 */
export function stripJsonFence(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}
