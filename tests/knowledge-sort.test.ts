import { describe, expect, it } from "vitest";
import { sortKnowledge } from "@/lib/knowledge/sort";
import { recordBase } from "@/lib/knowledge/actions";
import { NOW } from "./fixtures";
import type { DeckMastery } from "@/lib/knowledge/statistics";
import type { FlashcardDeck, StudyNote } from "@/types/knowledge";

const deck = (id: string, at: number): FlashcardDeck => ({
  ...recordBase(id, "math", [], at),
  id,
  kind: "deck",
  description: "",
});
const note = (id: string, at: number): StudyNote => ({
  ...recordBase(id, "math", [], at),
  id,
  kind: "note",
  body: "",
  date: "2026-09-15",
  image: null,
  links: [],
});
const stats = (deckId: string, mastery: number): DeckMastery => ({
  deckId,
  total: 10,
  fresh: 0,
  learning: 0,
  mature: 0,
  dueNow: 0,
  mastery,
  retention: null,
  reviews: 0,
});

const mastery = new Map([
  ["strong", stats("strong", 90)],
  ["weak", stats("weak", 10)],
]);

describe("sortKnowledge", () => {
  it("keeps everything newest-first by default", () => {
    const records = [
      note("old", NOW),
      deck("strong", NOW + 5),
      deck("weak", NOW + 1),
    ];
    expect(sortKnowledge(records, mastery, false).map((r) => r.id)).toEqual([
      "strong",
      "weak",
      "old",
    ]);
  });

  it("puts the weakest deck first and keeps non-decks newest-first below", () => {
    const records = [
      note("newest-note", NOW + 100),
      deck("strong", NOW + 5),
      note("old-note", NOW),
      deck("weak", NOW + 1),
    ];
    expect(sortKnowledge(records, mastery, true).map((r) => r.id)).toEqual([
      "weak",
      "strong",
      "newest-note",
      "old-note",
    ]);
  });

  it("falls back to newest-first for decks with no mastery entry", () => {
    const records = [deck("unknown-a", NOW + 2), deck("unknown-b", NOW + 3)];
    expect(sortKnowledge(records, mastery, true).map((r) => r.id)).toEqual([
      "unknown-b",
      "unknown-a",
    ]);
  });

  it("does not mutate the input array", () => {
    const records = [note("a", NOW), deck("weak", NOW + 1)];
    const snapshot = records.map((r) => r.id);
    sortKnowledge(records, mastery, true);
    expect(records.map((r) => r.id)).toEqual(snapshot);
  });
});
