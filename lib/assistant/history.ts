import type { ChatReply } from "./chat-provider";
import { isObject } from "@/lib/migration/values";
import { fingerprint } from "@/lib/migration/values";
export interface BondookMessage extends ChatReply {
  id: string;
  createdAt: number;
  role: "user" | "assistant";
  kind: "local" | "ai";
}
export function readMessages(raw: unknown): BondookMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (r): r is BondookMessage =>
      isObject(r) &&
      typeof r.id === "string" &&
      typeof r.text === "string" &&
      Number.isFinite(r.createdAt) &&
      ["user", "assistant"].includes(String(r.role)) &&
      ["local", "ai"].includes(String(r.kind)),
  );
}
export function mergeMessages(left: unknown, right: unknown) {
  const valid = [
    ...new Map(
      [...readMessages(left), ...readMessages(right)].map((m) => [m.id, m]),
    ).values(),
  ].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  const raw = [
    ...(Array.isArray(left) ? left : []),
    ...(Array.isArray(right) ? right : []),
  ];
  const unknown = raw.filter((r) => !readMessages([r]).length);
  return [
    ...new Map(unknown.map((r) => [fingerprint(r), r])).values(),
    ...valid,
  ];
}
