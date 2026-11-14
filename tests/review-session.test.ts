import { describe, expect, it } from "vitest";
import {
  DEFAULT_REVIEW_SESSION_LIMIT,
  MAX_REVIEW_SESSION_LIMIT,
  formatClock,
  remainingMs,
  reviewSessionLimit,
  reviewSessionQueue,
} from "@/lib/knowledge/session";
import { recordBase } from "@/lib/knowledge/actions";
import { knowledgeFixture } from "./knowledge-fixtures";
import { NOW } from "./fixtures";
import type { Flashcard, FlashcardDeck } from "@/types/knowledge";
import type { StudyData } from "@/types/study";

const TODAY = "2026-09-15";

/** Two decks with `perDeck` fresh cards each, due today. */
function twoDecks(
  perDeck: number,
  extras: Record<string, unknown> = {},
): StudyData {
  const data = knowledgeFixture(),
    decks: FlashcardDeck[] = ["a", "b"].map((suffix) => ({
      ...recordBase(`Багц ${suffix}`, "math", [], NOW),
      id: `deck-${suffix}`,
      kind: "deck",
      description: "",
    }));
  const cards: Flashcard[] = decks.flatMap((deck, deckIndex) =>
    Array.from({ length: perDeck }, (_, i) => ({
      ...recordBase(
        `${deck.title} ${i}`,
        "math",
        [],
        NOW + deckIndex * 100 + i,
      ),
      id: `${deck.id}-card-${i}`,
      kind: "card",
      deckId: deck.id,
      front: `${deck.title} асуулт ${i}`,
      back: "хариулт",
      schedule: { repetitions: 0, interval: 0, ease: 2.5, dueOn: TODAY },
    })),
  );
  return {
    ...data,
    knowledge: [
      ...data.knowledge.filter((r) => r.kind !== "card"),
      ...decks,
      ...cards,
    ],
    settings: {
      ...data.settings,
      extras: { ...data.settings.extras, newCardsPerDay: 0, ...extras },
    },
  };
}

/** `twoDecks`, but deck-b belongs to the `physics` subject. */
function twoSubjects(
  perDeck: number,
  extras: Record<string, unknown> = {},
): StudyData {
  const data = twoDecks(perDeck, extras);
  return {
    ...data,
    knowledge: data.knowledge.map((r) =>
      r.id === "deck-b" ? { ...r, subjectId: "physics" } : r,
    ),
  };
}

describe("reviewSessionLimit", () => {
  it("defaults to 200 and allows an explicit size", () => {
    expect(reviewSessionLimit(twoDecks(1).settings)).toBe(
      DEFAULT_REVIEW_SESSION_LIMIT,
    );
    expect(
      reviewSessionLimit(twoDecks(1, { reviewSessionLimit: 15 }).settings),
    ).toBe(15);
  });

  it("treats 0 as no limit and clamps the maximum", () => {
    expect(
      reviewSessionLimit(twoDecks(1, { reviewSessionLimit: 0 }).settings),
    ).toBe(0);
    expect(
      reviewSessionLimit(twoDecks(1, { reviewSessionLimit: 99999 }).settings),
    ).toBe(MAX_REVIEW_SESSION_LIMIT);
    expect(
      reviewSessionLimit(twoDecks(1, { reviewSessionLimit: -4 }).settings),
    ).toBe(0);
  });

  it("falls back to the default for unreadable values", () => {
    expect(
      reviewSessionLimit(twoDecks(1, { reviewSessionLimit: "many" }).settings),
    ).toBe(DEFAULT_REVIEW_SESSION_LIMIT);
    expect(
      reviewSessionLimit(twoDecks(1, { reviewSessionLimit: null }).settings),
    ).toBe(DEFAULT_REVIEW_SESSION_LIMIT);
  });
});

describe("reviewSessionQueue", () => {
  it("limits the session to the configured size", () => {
    const data = twoDecks(5, { reviewSessionLimit: 4 });
    expect(
      reviewSessionQueue(data.knowledge, TODAY, data.settings),
    ).toHaveLength(4);
  });

  it("filters by deck before applying the limit", () => {
    const data = twoDecks(5, { reviewSessionLimit: 3 });
    const queue = reviewSessionQueue(data.knowledge, TODAY, data.settings, {
      deckId: "deck-b",
    });
    expect(queue).toHaveLength(3);
    expect(queue.every((card) => card.deckId === "deck-b")).toBe(true);
  });

  it("returns the whole queue when the limit is 0 and respects the new-card budget", () => {
    const all = twoDecks(5, { reviewSessionLimit: 0 });
    expect(reviewSessionQueue(all.knowledge, TODAY, all.settings)).toHaveLength(
      10,
    );
    const paced = twoDecks(5, { reviewSessionLimit: 0, newCardsPerDay: 4 });
    expect(
      reviewSessionQueue(paced.knowledge, TODAY, paced.settings),
    ).toHaveLength(4);
  });

  it("keeps only cards whose deck belongs to the subject", () => {
    const data = twoSubjects(2, { reviewSessionLimit: 0 });
    const queue = reviewSessionQueue(data.knowledge, TODAY, data.settings, {
      subjectId: "physics",
    });
    expect(queue).toHaveLength(2);
    expect(queue.every((card) => card.deckId === "deck-b")).toBe(true);
    expect(
      reviewSessionQueue(data.knowledge, TODAY, data.settings, {
        subjectId: "math",
      }).every((card) => card.deckId === "deck-a"),
    ).toBe(true);
  });

  it("combines the subject and deck filters", () => {
    const data = twoSubjects(2, { reviewSessionLimit: 0 });
    expect(
      reviewSessionQueue(data.knowledge, TODAY, data.settings, {
        subjectId: "physics",
        deckId: "deck-b",
      }),
    ).toHaveLength(2);
    expect(
      reviewSessionQueue(data.knowledge, TODAY, data.settings, {
        subjectId: "physics",
        deckId: "deck-a",
      }),
    ).toHaveLength(0);
  });

  it("applies the limit after the subject filter", () => {
    const data = twoSubjects(5, { reviewSessionLimit: 3 });
    const queue = reviewSessionQueue(data.knowledge, TODAY, data.settings, {
      subjectId: "math",
    });
    expect(queue).toHaveLength(3);
    expect(queue.every((card) => card.deckId === "deck-a")).toBe(true);
  });

  it("returns nothing for a subject without decks, and ignores deleted decks", () => {
    const data = twoSubjects(2, { reviewSessionLimit: 0 });
    expect(
      reviewSessionQueue(data.knowledge, TODAY, data.settings, {
        subjectId: "chemistry",
      }),
    ).toHaveLength(0);
    const removed = twoSubjects(2, { reviewSessionLimit: 0 });
    removed.knowledge = removed.knowledge.map((r) =>
      r.id === "deck-b" ? { ...r, deletedAt: NOW } : r,
    );
    expect(
      reviewSessionQueue(removed.knowledge, TODAY, removed.settings, {
        subjectId: "physics",
      }),
    ).toHaveLength(0);
  });

  it("honours an explicit limit over the stored setting", () => {
    const data = twoDecks(5, { reviewSessionLimit: 2 });
    expect(
      reviewSessionQueue(data.knowledge, TODAY, data.settings, { limit: 7 }),
    ).toHaveLength(7);
  });

  it("leaves out cards that are not due yet", () => {
    const data = twoDecks(2, { reviewSessionLimit: 0 });
    expect(
      reviewSessionQueue(data.knowledge, "2026-09-14", data.settings),
    ).toHaveLength(0);
  });
});

describe("session clock", () => {
  it("counts down and stops at zero", () => {
    expect(remainingMs(null, NOW)).toBeNull();
    expect(remainingMs(NOW + 60000, NOW)).toBe(60000);
    expect(remainingMs(NOW - 5000, NOW)).toBe(0);
  });

  it("formats minutes and hours", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(65000)).toBe("1:05");
    expect(formatClock(3661000)).toBe("1:01:01");
    expect(formatClock(-2000)).toBe("0:00");
  });
});
