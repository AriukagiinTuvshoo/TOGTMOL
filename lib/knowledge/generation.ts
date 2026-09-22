export interface CardDraft {
  front: string;
  back: string;
}
export function parseCardDrafts(input: unknown): CardDraft[] {
  const raw =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as { cards?: unknown }).cards
      : null;
  if (!Array.isArray(raw) || !raw.length || raw.length > 12)
    throw Error(
      "Бондоокийн картын хариу танигдсангүй. Дахин оролдох эсвэл өөрөө бичиж болно.",
    );
  return raw.map((r) => {
    if (
      !r ||
      typeof r.front !== "string" ||
      typeof r.back !== "string" ||
      !r.front.trim() ||
      !r.back.trim() ||
      r.front.length > 4000 ||
      r.back.length > 10000
    )
      throw Error("Картын асуулт эсвэл хариулт буруу байна.");
    return { front: r.front.trim(), back: r.back.trim() };
  });
}
export function localCardDrafts(
  text: string,
  title: string,
  count = 10,
): CardDraft[] {
  const lines = text
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const pairs = lines
    .map((line) => {
      const match = line.match(/^(.{1,200}?)(?:::|\s[—–]\s|:\s)(.+)$/);
      return match ? { front: match[1].trim(), back: match[2].trim() } : null;
    })
    .filter((r): r is CardDraft => r !== null);
  if (pairs.length) return pairs.slice(0, Math.min(12, count));
  if (!text.trim())
    throw Error("Төхөөрөмж дээр загвар бэлдэхийн тулд текст оруулна уу.");
  return [
    {
      front: `${title || "Энэ тэмдэглэл"}: юуг санах вэ?`,
      back: text.trim().slice(0, 10000),
    },
  ];
}
