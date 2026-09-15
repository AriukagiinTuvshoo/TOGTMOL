import type { Extras, RecordBase, Span } from "@/types/study";
export const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
export const finite = (v: unknown, fallback = 0): number =>
  (typeof v === "number" || (typeof v === "string" && v.trim() !== "")) &&
  Number.isFinite(Number(v))
    ? Number(v)
    : fallback;
export const text = (v: unknown, fallback = ""): string =>
  typeof v === "string" ? v : fallback;
export const identifier = (v: unknown): string | null =>
  (typeof v === "string" && v.length > 0) ||
  (typeof v === "number" && Number.isFinite(v))
    ? String(v)
    : null;
export function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (isObject(value))
    return `{${Object.keys(value)
      .sort()
      .map((k) => JSON.stringify(k) + ":" + stable(value[k]))
      .join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
export function fingerprint(value: unknown): string {
  let a = 2166136261,
    b = 2246822519;
  for (const c of stable(value)) {
    const n = c.charCodeAt(0);
    a = Math.imul(a ^ n, 16777619);
    b = Math.imul(b ^ n, 3266489917);
  }
  return (
    (a >>> 0).toString(16).padStart(8, "0") +
    (b >>> 0).toString(16).padStart(8, "0")
  );
}
export function extras(v: Record<string, unknown>, known: string[]): Extras {
  const result: Extras = { ...(isObject(v.extras) ? v.extras : {}) };
  for (const [k, value] of Object.entries(v))
    if (
      !known.includes(k) &&
      k !== "extras" &&
      !["__proto__", "constructor", "prototype"].includes(k)
    )
      result[k] = value;
  return result;
}
export function base(
  v: Record<string, unknown>,
  id: string,
  known: string[],
): RecordBase {
  return {
    id,
    createdAt: Math.max(0, finite(v.createdAt)),
    updatedAt: Math.max(0, finite(v.updatedAt)),
    deletedAt: finite(v.deletedAt) > 0 ? finite(v.deletedAt) : null,
    extras: extras(v, ["id", "createdAt", "updatedAt", "deletedAt", ...known]),
  };
}
export function validSpans(v: unknown): Span[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter(isObject)
    .filter((s) => finite(s.start) > 0 && finite(s.end) >= finite(s.start))
    .map((s) => ({ start: finite(s.start), end: finite(s.end) }));
}
