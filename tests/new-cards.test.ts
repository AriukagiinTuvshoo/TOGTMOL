import { describe, expect, it } from "vitest";
import {
  DEFAULT_NEW_CARDS_PER_DAY,
  knowledgeIndex,
  newCardsIntroducedToday,
  newCardsPerDay,
} from "@/lib/knowledge/index";
import { importCards, recordBase, reviewCard } from "@/lib/knowledge/actions";
import { knowledgeFixture } from "./knowledge-fixtures";
import { NOW } from "./fixtures";
import type { CardReview, Flashcard } from "@/types/knowledge";
import type { StudyData } from "@/types/study";

const TODAY = "2026-09-15";
const DAY = 86400000;

/** Fixture plus `count` extra fresh cards created one millisecond apart. */
function withFresh(
  count: number,
  extras: Record<string, unknown> = {},
): StudyData {
  const data = knowledgeFixture(),
    deck = data.knowledge.find((r) => r.kind === "deck")!,
    cards: Flashcard[] = Array.from({ length: count }, (_, i) => ({
      ...recordBase(`Шинэ ${i + 1}`, "math", [], NOW + i),
      id: `fresh-${i}`,
      kind: "card",
      deckId: deck.id,
      front: `Асуулт ${i + 1}`,
      back: `Хариулт ${i + 1}`,
      schedule: { repetitions: 0, interval: 0, ease: 2.5, dueOn: TODAY },
    }));
  return {
    ...data,
    knowledge: [...data.knowledge.filter((r) => r.kind !== "card"), ...cards],
    settings: {
      ...data.settings,
      extras: { ...data.settings.extras, ...extras },
    },
  };
}

function newReview(
  cardId: string,
  id: string,
  reviewedAt = NOW,
  before: CardReview["before"] = {
    repetitions: 0,
    interval: 0,
    ease: 2.5,
    dueOn: TODAY,
  },
): CardReview {
  return {
    ...recordBase(cardId, "math", [], reviewedAt),
    id,
    kind: "review",
    cardId,
    grade: 4,
    reviewedAt,
    before,
    after: { repetitions: 1, interval: 1, ease: 2.5, dueOn: "2026-09-16" },
  };
}

describe("daily new-card budget", () => {
  it("defaults to a bounded number of new cards per day", () => {
    const data = withFresh(30),
      index = knowledgeIndex(data.knowledge, TODAY, data.settings);
    expect(index.newCardsPerDay).toBe(DEFAULT_NEW_CARDS_PER_DAY);
    expect(index.fresh).toHaveLength(30);
    expect(index.freshToday).toHaveLength(DEFAULT_NEW_CARDS_PER_DAY);
    expect(index.reviewQueue).toHaveLength(DEFAULT_NEW_CARDS_PER_DAY);
  });

  it("keeps the old unlimited behaviour when no settings are given", () => {
    const data = withFresh(30);
    expect(knowledgeIndex(data.knowledge, TODAY).reviewQueue).toHaveLength(30);
  });

  it("respects a custom limit and 0 for no limit", () => {
    const five = withFresh(30, { newCardsPerDay: 5 });
    expect(newCardsPerDay(five.settings)).toBe(5);
    expect(
      knowledgeIndex(five.knowledge, TODAY, five.settings).freshToday,
    ).toHaveLength(5);
    const unlimited = withFresh(30, { newCardsPerDay: 0 });
    expect(
      knowledgeIndex(unlimited.knowledge, TODAY, unlimited.settings).freshToday,
    ).toHaveLength(30);
  });

  it("clamps and rejects unreadable limits instead of breaking the queue", () => {
    expect(
      newCardsPerDay(withFresh(0, { newCardsPerDay: 9999 }).settings),
    ).toBe(500);
    expect(
      newCardsPerDay(withFresh(0, { newCardsPerDay: "abc" }).settings),
    ).toBe(DEFAULT_NEW_CARDS_PER_DAY);
    expect(
      newCardsPerDay(withFresh(0, { newCardsPerDay: null }).settings),
    ).toBe(DEFAULT_NEW_CARDS_PER_DAY);
  });

  it("subtracts the new cards already introduced today", () => {
    const data = withFresh(30, { newCardsPerDay: 5 });
    const withReviews: StudyData = {
      ...data,
      knowledge: [
        ...data.knowledge,
        newReview("fresh-0", "review-1"),
        newReview("fresh-1", "review-2"),
      ],
    };
    expect(
      newCardsIntroducedToday(
        withReviews.knowledge,
        TODAY,
        withReviews.settings,
      ),
    ).toBe(2);
    expect(
      knowledgeIndex(withReviews.knowledge, TODAY, withReviews.settings)
        .freshToday,
    ).toHaveLength(3);
  });

  it("counts a card once even when it is reviewed several times today", () => {
    const data = withFresh(30, { newCardsPerDay: 10 });
    const reviewedLater: StudyData = {
      ...data,
      knowledge: [
        ...data.knowledge,
        newReview("fresh-0", "review-1"),
        newReview("fresh-0", "review-2", NOW + 60000),
      ],
    };
    expect(
      newCardsIntroducedToday(
        reviewedLater.knowledge,
        TODAY,
        reviewedLater.settings,
      ),
    ).toBe(1);
  });

  it("ignores reviews from another study day and non-first reviews", () => {
    const data = withFresh(30, { newCardsPerDay: 10 });
    const other: StudyData = {
      ...data,
      knowledge: [
        ...data.knowledge,
        newReview("fresh-0", "review-yesterday", NOW - DAY),
        newReview("fresh-1", "review-repeat", NOW, {
          repetitions: 2,
          interval: 6,
          ease: 2.5,
          dueOn: TODAY,
        }),
      ],
    };
    expect(
      newCardsIntroducedToday(other.knowledge, TODAY, other.settings),
    ).toBe(0);
  });

  it("stops the budget at zero without hiding overdue cards", () => {
    const data = withFresh(30, { newCardsPerDay: 1 });
    const fullDay: StudyData = {
      ...data,
      knowledge: [...data.knowledge, newReview("fresh-0", "review-1")],
    };
    const index = knowledgeIndex(fullDay.knowledge, TODAY, fullDay.settings);
    expect(index.freshToday).toHaveLength(0);
    expect(index.reviewQueue).toHaveLength(0);
    // A reviewed card is due tomorrow even though the new-card budget is spent.
    const target = fullDay.knowledge.find(
      (r): r is Flashcard => r.kind === "card" && r.id === "fresh-1",
    )!;
    const reviewed = reviewCard(
      target.id,
      4,
      target.updatedAt,
      NOW + 1,
      "r-overdue",
      TODAY,
    )(fullDay);
    const tomorrow = knowledgeIndex(
      reviewed.knowledge,
      "2026-09-16",
      reviewed.settings,
    );
    expect(tomorrow.due).toHaveLength(1);
    expect(tomorrow.freshToday).toHaveLength(1);
  });

  it("introduces the oldest cards first, so a big import ramps predictably", () => {
    const data = withFresh(4, { newCardsPerDay: 2 });
    const index = knowledgeIndex(data.knowledge, TODAY, data.settings);
    expect(index.freshToday.map((c) => c.front)).toEqual([
      "Асуулт 1",
      "Асуулт 2",
    ]);
  });

  it("keeps a 500-card import to one day's budget", () => {
    const imported = importCards(
      Array.from({ length: 500 }, (_, i) => ({
        front: `Импорт ${i}`,
        back: "хариулт",
      })),
      { title: "Том импорт", today: TODAY },
    )(knowledgeFixture());
    const index = knowledgeIndex(imported.knowledge, TODAY, imported.settings);
    expect(index.fresh).toHaveLength(501);
    expect(index.freshToday).toHaveLength(DEFAULT_NEW_CARDS_PER_DAY);
    expect(index.reviewQueue).toHaveLength(DEFAULT_NEW_CARDS_PER_DAY);
  });
});
