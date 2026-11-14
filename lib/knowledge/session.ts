import { knowledgeIndex } from "./index";
import type { Flashcard, FlashcardDeck } from "@/types/knowledge";
import type { StudyData } from "@/types/study";

export const DEFAULT_REVIEW_SESSION_LIMIT = 200;
export const MAX_REVIEW_SESSION_LIMIT = 2000;

/** `0` keeps the whole queue; unreadable values fall back to the default. */
export function reviewSessionLimit(settings: StudyData["settings"]): number {
  const raw = settings.extras.reviewSessionLimit;
  if (raw === undefined || raw === null) return DEFAULT_REVIEW_SESSION_LIMIT;
  if (typeof raw !== "number" || !Number.isFinite(raw))
    return DEFAULT_REVIEW_SESSION_LIMIT;
  return Math.max(0, Math.min(MAX_REVIEW_SESSION_LIMIT, Math.round(raw)));
}

/**
 * The cards one session will show: optional subject and deck filters first,
 * then the size limit, so a filter never gets shrunk by cards outside it.
 * A card's subject comes from its deck, so no extra field is stored on cards.
 */
export function reviewSessionQueue(
  records: StudyData["knowledge"],
  today: string,
  settings: StudyData["settings"],
  options: { deckId?: string; subjectId?: string; limit?: number } = {},
): Flashcard[] {
  const limit = options.limit ?? reviewSessionLimit(settings);
  const subjectDecks = options.subjectId
    ? new Set(
        records
          .filter(
            (r): r is FlashcardDeck =>
              r.kind === "deck" &&
              !r.deletedAt &&
              r.subjectId === options.subjectId,
          )
          .map((r) => r.id),
      )
    : null;
  const queue = knowledgeIndex(records, today, settings).reviewQueue.filter(
    (card) =>
      (!options.deckId || card.deckId === options.deckId) &&
      (!subjectDecks || subjectDecks.has(card.deckId)),
  );
  return limit <= 0 ? queue : queue.slice(0, limit);
}

/** Milliseconds left on a deadline, or null when no time box is running. */
export function remainingMs(deadline: number | null, now: number) {
  return deadline === null ? null : Math.max(0, deadline - now);
}

/** `m:ss`, or `h:mm:ss` past an hour. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000)),
    hours = Math.floor(total / 3600),
    minutes = Math.floor((total % 3600) / 60),
    seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
}

/** Session length choices in minutes; 0 is "no time box". */
export const SESSION_MINUTES = [0, 10, 20, 30, 45] as const;
