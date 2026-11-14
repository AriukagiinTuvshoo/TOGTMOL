import type { KnowledgeRecord } from "@/types/knowledge";
import type { DeckMastery } from "./statistics";

const recentFirst = (a: KnowledgeRecord, b: KnowledgeRecord) =>
  b.updatedAt - a.updatedAt || a.id.localeCompare(b.id);

/**
 * Display order for the knowledge grid. By default the newest record comes
 * first. With `weakFirst`, decks move to the top ordered by lowest mastery, so
 * the decks that need work surface instead of being buried by recent edits;
 * everything else keeps the newest-first order underneath them.
 */
export function sortKnowledge(
  records: KnowledgeRecord[],
  mastery: Map<string, DeckMastery>,
  weakFirst: boolean,
): KnowledgeRecord[] {
  if (!weakFirst) return [...records].sort(recentFirst);
  return [...records].sort((a, b) => {
    const aDeck = a.kind === "deck" ? 1 : 0,
      bDeck = b.kind === "deck" ? 1 : 0;
    if (aDeck !== bDeck) return bDeck - aDeck;
    if (!aDeck) return recentFirst(a, b);
    const aScore = mastery.get(a.id)?.mastery ?? 0,
      bScore = mastery.get(b.id)?.mastery ?? 0;
    return aScore - bScore || recentFirst(a, b);
  });
}
