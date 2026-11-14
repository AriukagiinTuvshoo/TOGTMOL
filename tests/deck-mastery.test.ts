import { describe, expect, it } from "vitest";
import { MATURE_INTERVAL_DAYS, deckMastery } from "@/lib/knowledge/statistics";
import { recordBase } from "@/lib/knowledge/actions";
import { knowledgeFixture } from "./knowledge-fixtures";
import { NOW } from "./fixtures";
import type {
  CardReview,
  Flashcard,
  FlashcardDeck,
  ReviewSchedule,
} from "@/types/knowledge";
import type { StudyData } from "@/types/study";

const TODAY = "2026-09-15";
const DAY = 86400000;
const schedule = (over: Partial<ReviewSchedule> = {}): ReviewSchedule => ({
  repetitions: 0,
  interval: 0,
  ease: 2.5,
  dueOn: TODAY,
  ...over,
});

/** One deck whose cards have the given intervals (0 = never reviewed). */
function deckData(intervals: number[], deckId = "deck-1"): StudyData {
  const data = knowledgeFixture();
  const deck: FlashcardDeck = {
    ...recordBase("Багц", "math", [], NOW),
    id: deckId,
    kind: "deck",
    description: "",
  };
  const cards: Flashcard[] = intervals.map((interval, i) => ({
    ...recordBase(`Карт ${i}`, "math", [], NOW + i),
    id: `${deckId}-card-${i}`,
    kind: "card",
    deckId,
    front: "асуулт",
    back: "хариулт",
    schedule: schedule({ repetitions: interval > 0 ? 3 : 0, interval }),
  }));
  return {
    ...data,
    knowledge: [
      ...data.knowledge.filter((r) => r.kind !== "card" && r.kind !== "deck"),
      deck,
      ...cards,
    ],
  };
}

function review(
  cardId: string,
  grade: number,
  at = NOW,
  id = `review-${cardId}-${at}-${grade}`,
): CardReview {
  return {
    ...recordBase("Давтлага", "math", [], at),
    id,
    kind: "review",
    cardId,
    grade,
    reviewedAt: at,
    before: schedule(),
    after: schedule(),
  };
}

describe("deckMastery", () => {
  it("splits cards into fresh, learning and mature and weights mastery", () => {
    const stats = deckMastery(
      deckData([0, 7, MATURE_INTERVAL_DAYS]).knowledge,
      TODAY,
    ).get("deck-1");
    expect(stats).toMatchObject({
      total: 3,
      fresh: 1,
      learning: 1,
      mature: 1,
      dueNow: 3,
      reviews: 0,
      retention: null,
    });
    // (0 + 7/21 + 1) / 3 = 44.4%
    expect(stats?.mastery).toBe(44);
  });

  it("reports an empty deck as zero instead of dividing by zero", () => {
    expect(
      deckMastery(deckData([]).knowledge, TODAY).get("deck-1"),
    ).toMatchObject({
      total: 0,
      mastery: 0,
      retention: null,
    });
  });

  it("takes retention from graded reviews of this deck only", () => {
    const data = deckData([5, 5]);
    const other = deckData([5], "deck-other");
    data.knowledge = [
      ...data.knowledge,
      review("deck-1-card-0", 5),
      review("deck-1-card-0", 4),
      review("deck-1-card-1", 2),
      review("deck-1-card-1", 5, NOW, "deleted-review"),
      review("ghost-card", 0),
      ...other.knowledge.filter(
        (r) => r.kind === "review" || r.kind === "deck",
      ),
      review("deck-other-card-0", 0),
    ].map((r) => (r.id === "deleted-review" ? { ...r, deletedAt: NOW } : r));
    const stats = deckMastery(data.knowledge, TODAY).get("deck-1");
    expect(stats?.reviews).toBe(3);
    expect(stats?.retention).toBe(67);
  });

  it("limits retention to the requested window", () => {
    const data = deckData([1]);
    data.knowledge = [
      ...data.knowledge,
      review("deck-1-card-0", 5, NOW, "recent"),
      review("deck-1-card-0", 0, NOW - 40 * DAY, "old"),
    ];
    expect(
      deckMastery(data.knowledge, TODAY, { since: NOW - 10 * DAY }).get(
        "deck-1",
      ),
    ).toMatchObject({ reviews: 1, retention: 100 });
  });

  it("ignores deleted decks, deleted cards and cards without a live deck", () => {
    const data = deckData([0, 30]);
    data.knowledge = data.knowledge.map((r) =>
      r.id === "deck-1-card-0" || r.id === "deck-1"
        ? { ...r, deletedAt: NOW }
        : r,
    );
    const stats = deckMastery(data.knowledge, TODAY);
    expect(stats.has("deck-1")).toBe(false);
    expect(stats.size).toBe(0);
  });
});
