import { describe, expect, it } from "vitest";
import {
  FSRS_WEIGHTS,
  elapsedDays,
  fsrsSchedule,
  initialDifficulty,
  initialStability,
  intervalForRetention,
  nextDifficulty,
  nextForgetStability,
  nextRecallStability,
  ratingFromGrade,
  retrievability,
} from "@/lib/knowledge/fsrs";
import {
  calibrationSamples,
  calibrateStabilityScale,
} from "@/lib/knowledge/calibrate";
import { reviewCard } from "@/lib/knowledge/actions";
import { migrate } from "@/lib/migration/migrate";
import { shiftDate } from "@/lib/calculations/dates";
import { knowledgeFixture } from "./knowledge-fixtures";
import type { CardReview, Flashcard, ReviewSchedule } from "@/types/knowledge";
import type { StudyData } from "@/types/study";

const NOW = new Date("2026-09-15T12:00:00Z").getTime();
const DAY = 86400000;
const baseSchedule = (patch: Partial<ReviewSchedule> = {}): ReviewSchedule => ({
  repetitions: 1,
  interval: 5,
  ease: 2.5,
  dueOn: "2026-09-01",
  ...patch,
});

describe("FSRS-4.5 core", () => {
  it("keeps the forgetting curve anchored at 90% when t equals stability", () => {
    for (const stability of [0.5, 1, 5, 30, 365])
      expect(retrievability(stability, stability)).toBeCloseTo(0.9, 10);
    expect(intervalForRetention(7, 0.9)).toBeCloseTo(7, 6);
  });

  it("decays recall as elapsed time grows and never leaves 0–1", () => {
    let previous = 1;
    for (const elapsed of [0, 1, 3, 10, 100, 1000]) {
      const recall = retrievability(elapsed, 4);
      expect(recall).toBeLessThanOrEqual(1);
      expect(recall).toBeGreaterThanOrEqual(0);
      expect(recall).toBeLessThanOrEqual(previous);
      previous = recall;
    }
    expect(retrievability(0, 4)).toBe(1);
    expect(retrievability(0, 0)).toBe(0);
  });

  it("maps the 0–5 grade scale onto the four FSRS ratings", () => {
    expect([0, 1, 2].map(ratingFromGrade)).toEqual([1, 1, 1]);
    expect([3, 4, 5].map(ratingFromGrade)).toEqual([2, 3, 4]);
    expect(() => ratingFromGrade(6)).toThrow();
    expect(() => ratingFromGrade(-1)).toThrow();
  });

  it("starts new cards from the published weights", () => {
    expect(initialStability(3)).toBeCloseTo(FSRS_WEIGHTS[2], 10);
    for (const rating of [1, 2, 3, 4] as const) {
      const difficulty = initialDifficulty(rating);
      expect(difficulty).toBeGreaterThanOrEqual(1);
      expect(difficulty).toBeLessThanOrEqual(10);
    }
    // Easier ratings start with lower difficulty.
    expect(initialDifficulty(4)).toBeLessThan(initialDifficulty(1));
  });

  it("moves difficulty down for easy grades and up for lapses", () => {
    const start = 5;
    expect(nextDifficulty(start, 4)).toBeLessThan(start);
    expect(nextDifficulty(start, 1)).toBeGreaterThan(start);
    expect(nextDifficulty(1, 1)).toBeGreaterThanOrEqual(1);
    expect(nextDifficulty(9.9, 4)).toBeLessThanOrEqual(10);
  });

  it("always grows stability after recall and shrinks it after a lapse", () => {
    const difficulty = 5,
      stability = 10,
      recall = 0.85;
    const grew = nextRecallStability(difficulty, stability, recall, 3);
    expect(grew).toBeGreaterThan(stability);
    // Lower retrievability (more spacing) produces a bigger gain.
    expect(nextRecallStability(difficulty, stability, 0.6, 3)).toBeGreaterThan(
      grew,
    );
    // Harder cards grow less.
    expect(nextRecallStability(8, stability, recall, 3)).toBeLessThan(grew);
    const forgot = nextForgetStability(difficulty, stability, recall);
    expect(forgot).toBeGreaterThan(0);
    expect(forgot).toBeLessThanOrEqual(stability);
  });

  it("measures elapsed days from the last review, or from the due date for older records", () => {
    expect(
      elapsedDays(baseSchedule({ lastReview: "2026-09-10" }), "2026-09-15"),
    ).toBe(5);
    expect(
      elapsedDays(
        baseSchedule({ dueOn: "2026-09-10", interval: 5 }),
        "2026-09-12",
      ),
    ).toBe(7);
    // Without lastReview the scheduled interval is the best available guess,
    // and a future due date never counts as negative time.
    expect(
      elapsedDays(baseSchedule({ dueOn: "2026-09-30" }), "2026-09-15"),
    ).toBe(5);
  });

  it("produces a complete schedule that the queue can use", () => {
    const first = fsrsSchedule(
      { repetitions: 0, interval: 0, ease: 2.5, dueOn: "2026-09-15" },
      4,
      "2026-09-15",
    );
    expect(first).toMatchObject({
      repetitions: 1,
      algorithm: "fsrs",
      lastReview: "2026-09-15",
    });
    expect(first.stability).toBeGreaterThan(0);
    expect(first.difficulty).toBeGreaterThanOrEqual(1);
    expect(first.interval).toBeGreaterThanOrEqual(1);
    expect(first.dueOn).toBe(shiftDate("2026-09-15", first.interval));
  });

  it("grows the interval on success, resets a lapse to one day, and honours the scale", () => {
    const reviewed = baseSchedule({
      repetitions: 2,
      interval: 6,
      stability: 6,
      difficulty: 5,
      lastReview: "2026-09-09",
      algorithm: "fsrs",
    });
    const good = fsrsSchedule(reviewed, 5, "2026-09-15");
    expect(good.interval).toBeGreaterThan(reviewed.interval);
    expect(good.stability).toBeGreaterThan(reviewed.stability!);

    const lapse = fsrsSchedule(reviewed, 1, "2026-09-15");
    expect(lapse.repetitions).toBe(0);
    expect(lapse.interval).toBe(1);
    expect(lapse.dueOn).toBe("2026-09-16");
    expect(lapse.stability).toBeLessThan(reviewed.stability!);

    const scaled = fsrsSchedule(reviewed, 5, "2026-09-15", { scale: 1.5 });
    expect(scaled.interval).toBeGreaterThan(good.interval);
    // The scale is bounded so a bad calibration cannot explode intervals.
    expect(
      fsrsSchedule(reviewed, 5, "2026-09-15", { scale: 99 }).interval,
    ).toBe(fsrsSchedule(reviewed, 5, "2026-09-15", { scale: 2 }).interval);
  });

  it("is deterministic and rejects invalid grades", () => {
    const previous = baseSchedule({ lastReview: "2026-09-01" });
    expect(fsrsSchedule(previous, 4, "2026-09-15")).toEqual(
      fsrsSchedule(previous, 4, "2026-09-15"),
    );
    expect(() => fsrsSchedule(previous, 9, "2026-09-15")).toThrow();
  });
});

function reviewSample(index: number, grade: number, stability = 5): CardReview {
  return {
    id: `review-${index}`,
    kind: "review",
    title: "card",
    subjectId: null,
    tags: [],
    createdAt: NOW + index * DAY,
    updatedAt: NOW + index * DAY,
    deletedAt: null,
    extras: {},
    cardId: "card-1",
    grade,
    reviewedAt: NOW + index * DAY,
    before: baseSchedule({ interval: stability, dueOn: "2026-09-01" }),
    after: baseSchedule({ interval: stability, dueOn: "2026-09-06" }),
  };
}
function history(
  count: number,
  elapsedDays: number,
  grade: (index: number) => number,
  stability = 5,
): CardReview[] {
  const reviews: CardReview[] = [];
  let at = NOW;
  for (let i = 0; i < count; i += 1) {
    reviews.push({
      ...reviewSample(i, grade(i), stability),
      reviewedAt: at,
    });
    at += elapsedDays * DAY;
  }
  return reviews;
}

describe("FSRS calibration from existing history", () => {
  it("ignores same-day retries and deleted reviews", () => {
    const sameDay = [
      { ...reviewSample(0, 4), reviewedAt: NOW },
      { ...reviewSample(1, 4), reviewedAt: NOW + 1000 },
    ];
    expect(calibrationSamples(sameDay)).toHaveLength(0);
    const deleted = history(4, 5, () => 4).map((r) => ({
      ...r,
      deletedAt: NOW,
    }));
    expect(calibrationSamples(deleted)).toHaveLength(0);
    expect(calibrationSamples(history(3, 5, () => 4))).toHaveLength(2);
  });

  it("reports a finite loss before any history exists", () => {
    expect(calibrateStabilityScale([])).toEqual({
      scale: 1,
      samples: 0,
      logLossBefore: 0,
      logLossAfter: 0,
      applied: false,
    });
  });

  it("uses the FSRS stability when the review stored one", () => {
    const [sample] = calibrationSamples([
      {
        ...reviewSample(0, 4),
        after: { ...baseSchedule({ interval: 5 }), stability: 12 },
      },
      { ...reviewSample(1, 4), reviewedAt: NOW + 5 * DAY },
    ]);
    // The interval said 5 days, but FSRS knew the stability was 12.
    expect(sample.stability).toBe(12);
    expect(sample.elapsedDays).toBe(5);
  });

  it("asks for more history before changing anything", () => {
    const result = calibrateStabilityScale(history(10, 5, () => 4));
    expect(result.applied).toBe(false);
    expect(result.scale).toBe(1);
    expect(result.samples).toBe(9);
  });

  it("keeps the default when the history matches the predicted recall", () => {
    // 9 of 10 passes at the scheduled interval is exactly what 0.9 predicts.
    const result = calibrateStabilityScale(
      history(80, 5, (i) => (i % 10 === 0 ? 1 : 4)),
    );
    expect(result.samples).toBe(79);
    expect(result.applied).toBe(false);
    expect(result.scale).toBe(1);
  });

  it("shortens stability when the user forgets more than predicted", () => {
    const result = calibrateStabilityScale(history(80, 5, () => 1));
    expect(result.applied).toBe(true);
    expect(result.scale).toBeLessThan(1);
    expect(result.scale).toBeGreaterThanOrEqual(0.5);
    expect(result.logLossAfter).toBeLessThan(result.logLossBefore);
  });

  it("lengthens stability when the user recalls more than predicted", () => {
    const result = calibrateStabilityScale(history(80, 15, () => 5));
    expect(result.applied).toBe(true);
    expect(result.scale).toBeGreaterThan(1);
    expect(result.scale).toBeLessThanOrEqual(2);
  });
});

const withAlgorithm = (
  data: StudyData,
  algorithm: "sm2" | "fsrs",
): StudyData => ({
  ...data,
  settings: {
    ...data.settings,
    extras: { ...data.settings.extras, srsAlgorithm: algorithm },
  },
});
const card = (data: StudyData): Flashcard =>
  data.knowledge.find((r): r is Flashcard => r.kind === "card")!;

describe("review flow integration", () => {
  it("keeps SM-2 as the default when FSRS is not chosen", () => {
    const data = knowledgeFixture(),
      next = reviewCard(
        card(data).id,
        4,
        card(data).updatedAt,
        NOW,
        "r-sm2",
        "2026-09-15",
      )(data) as StudyData;
    expect(card(next).schedule.algorithm).toBeUndefined();
    expect(card(next).schedule.stability).toBeUndefined();
    expect(card(next).schedule.interval).toBe(1);
  });

  it("stores the FSRS memory state on the card and in the review history", () => {
    const data = withAlgorithm(knowledgeFixture(), "fsrs"),
      id = card(data).id,
      next = reviewCard(
        id,
        5,
        card(data).updatedAt,
        NOW,
        "r-fsrs-1",
        "2026-09-15",
      )(data) as StudyData,
      schedule = card(next).schedule;
    expect(schedule.algorithm).toBe("fsrs");
    expect(schedule.stability).toBeGreaterThan(0);
    expect(schedule.difficulty).toBeGreaterThanOrEqual(1);
    expect(schedule.difficulty).toBeLessThanOrEqual(10);
    expect(schedule.lastReview).toBe("2026-09-15");
    const review = next.knowledge.find(
      (r): r is CardReview => r.kind === "review" && r.id === "r-fsrs-1",
    )!;
    expect(review.after).toEqual(schedule);
  });

  it("grows the next interval from the stored state on a later review", () => {
    const data = withAlgorithm(knowledgeFixture(), "fsrs"),
      id = card(data).id,
      first = reviewCard(
        id,
        5,
        card(data).updatedAt,
        NOW,
        "r-1",
        "2026-09-15",
      )(data) as StudyData,
      later = NOW + 10 * DAY,
      second = reviewCard(
        id,
        4,
        card(first).updatedAt,
        later,
        "r-2",
        "2026-09-25",
      )(first) as StudyData;
    expect(card(second).schedule.interval).toBeGreaterThanOrEqual(
      card(first).schedule.interval,
    );
    expect(card(second).schedule.stability).toBeGreaterThan(
      card(first).schedule.stability!,
    );
    expect(card(second).schedule.lastReview).toBe("2026-09-25");
    // The memory state survives a load/merge cycle, so sync keeps it.
    expect(migrate(second).knowledge).toEqual(second.knowledge);
  });

  it("applies the learned stability scale to the next interval", () => {
    const base = withAlgorithm(knowledgeFixture(), "fsrs");
    const scaled: StudyData = {
      ...base,
      settings: {
        ...base.settings,
        extras: { ...base.settings.extras, fsrsScale: 1.5 },
      },
    };
    const plain = reviewCard(
        card(base).id,
        4,
        card(base).updatedAt,
        NOW,
        "r-a",
        "2026-09-15",
      )(base) as StudyData,
      adjusted = reviewCard(
        card(scaled).id,
        4,
        card(scaled).updatedAt,
        NOW,
        "r-b",
        "2026-09-15",
      )(scaled) as StudyData;
    expect(card(adjusted).schedule.interval).toBeGreaterThanOrEqual(
      card(plain).schedule.interval,
    );
  });
});
