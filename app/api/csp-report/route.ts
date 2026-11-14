export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Browsers send violation reports without credentials, so the endpoint is
// unauthenticated by design. Keep it cheap: bounded body, bounded rate, and
// only host-level fields in the log.
const MAX_BYTES = 16 * 1024;
const WINDOW_MS = 60_000;
const LIMIT = 30;
const clients = new Map<string, { count: number; resetAt: number }>();

const empty = (status: number) =>
  new Response(null, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

function clientKey(request: Request) {
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

function withinLimit(key: string) {
  const now = Date.now();
  const entry = clients.get(key);
  if (!entry || entry.resetAt <= now) {
    if (clients.size > 5_000)
      for (const [name, value] of clients)
        if (value.resetAt <= now) clients.delete(name);
    clients.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  entry.count += 1;
  return entry.count <= LIMIT;
}

async function readLimited(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder();
  let size = 0,
    raw = "";
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    raw += decoder.decode(part.value, { stream: true });
  }
  return raw + decoder.decode();
}

// A report may carry the full blocked URL, including query strings with tokens.
// Log only the host so a policy violation never turns into a credential leak.
function host(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  if (value === "inline" || value === "eval") return value;
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

type Violation = {
  directive?: unknown;
  blocked?: unknown;
  document?: unknown;
  disposition?: unknown;
};

function normalise(input: unknown): Violation | null {
  if (!input || typeof input !== "object") return null;
  const envelope = input as Record<string, unknown>;
  const legacy = envelope["csp-report"];
  if (legacy && typeof legacy === "object") {
    const report = legacy as Record<string, unknown>;
    return {
      directive: report["violated-directive"] ?? report["effective-directive"],
      blocked: host(report["blocked-uri"]),
      document: host(report["document-uri"]),
      disposition: report.disposition,
    };
  }
  const body = envelope.body;
  if (body && typeof body === "object") {
    const report = body as Record<string, unknown>;
    return {
      directive: report.effectiveDirective ?? report.violatedDirective,
      blocked: host(report.blockedURL),
      document: host(report.documentURL),
      disposition: report.disposition,
    };
  }
  return null;
}

function reports(input: unknown): Violation[] {
  if (Array.isArray(input))
    return input.map(normalise).filter((entry): entry is Violation => !!entry);
  const single = normalise(input);
  return single ? [single] : [];
}

export async function POST(request: Request) {
  const type = request.headers.get("content-type") ?? "";
  if (
    !type.includes("application/csp-report") &&
    !type.includes("application/reports+json")
  )
    return empty(415);
  if (!withinLimit(clientKey(request))) return empty(429);
  const raw = await readLimited(request);
  if (raw === null) return empty(413);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // A malformed report is not worth a retry or an error page.
    return empty(204);
  }
  for (const report of reports(parsed)) {
    const directive =
      typeof report.directive === "string"
        ? report.directive.slice(0, 80)
        : null;
    if (!directive) continue;
    console.warn(
      "[csp]",
      JSON.stringify({
        directive,
        blocked: report.blocked ?? null,
        document: report.document ?? null,
        disposition:
          typeof report.disposition === "string"
            ? report.disposition.slice(0, 20)
            : null,
      }),
    );
  }
  return empty(204);
}
