import { shiftDate } from "@/lib/calculations/dates";
import type { ReviewSchedule } from "@/types/knowledge";

/**
 * FSRS-4.5 (Free Spaced Repetition Scheduler), DSR model.
 * Algorithm reference: https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm
 *
 * The app keeps SM-2 as the default and offers FSRS per user. A review still
 * produces the same ReviewSchedule shape, with the memory state (stability and
 * difficulty) stored alongside it so history round-trips through the cloud.
 */
export const FSRS_WEIGHTS = [
  0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474,
  0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755,
];
export const DEFAULT_RETENTION = 0.9;
export const FSRS_FACTOR = 19 / 81;
export const FSRS_DECAY = -0.5;
const MIN_STABILITY = 0.1;
const MAX_INTERVAL = 36500;
const DAY_MS = 86400000;

export type FsrsRating = 1 | 2 | 3 | 4;
export interface FsrsOptions {
  retention?: number;
  /** Learned from the user's own history; see ./calibrate.ts */
  scale?: number;
  weights?: number[];
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const round = (value: number) => Math.round(value * 10000) / 10000;

/**
 * The app grades 0–5 (SM-2). FSRS uses four ratings, so the middle grades are
 * folded deliberately: 0–2 is a lapse, 3 hard, 4 good, 5 easy.
 */
export function ratingFromGrade(grade: number): FsrsRating {
  if (!Number.isInteger(grade) || grade < 0 || grade > 5)
    throw Error("Үнэлгээ 0–5 байна.");
  if (grade <= 2) return 1;
  if (grade === 3) return 2;
  if (grade === 4) return 3;
  return 4;
}

/** R(t,S): probability of recall after t days for a memory of stability S. */
export function retrievability(elapsedDays: number, stability: number): number {
  if (!(stability > 0) || !Number.isFinite(stability)) return 0;
  const t = Math.max(0, elapsedDays);
  return clamp(Math.pow(1 + (FSRS_FACTOR * t) / stability, FSRS_DECAY), 0, 1);
}

/** I(r,S): days until retrievability drops to the requested retention. */
export function intervalForRetention(stability: number, retention: number) {
  if (!(retention > 0 && retention < 1))
    throw Error("Хадгалалтын магадлал 0–1 хооронд байна.");
  return (
    (Math.max(MIN_STABILITY, stability) / FSRS_FACTOR) *
    (Math.pow(retention, 1 / FSRS_DECAY) - 1)
  );
}

export function initialStability(rating: FsrsRating, weights = FSRS_WEIGHTS) {
  return Math.max(MIN_STABILITY, weights[rating - 1]);
}

export function initialDifficulty(rating: FsrsRating, weights = FSRS_WEIGHTS) {
  return clamp(weights[4] - Math.exp(weights[5] * (rating - 1)) + 1, 1, 10);
}

export function nextDifficulty(
  difficulty: number,
  rating: FsrsRating,
  weights = FSRS_WEIGHTS,
) {
  const delta = -weights[6] * (rating - 3),
    damped = difficulty + delta * ((10 - difficulty) / 9),
    reverted =
      weights[7] * initialDifficulty(3, weights) + (1 - weights[7]) * damped;
  return clamp(reverted, 1, 10);
}

export function nextRecallStability(
  difficulty: number,
  stability: number,
  recall: number,
  rating: FsrsRating,
  weights = FSRS_WEIGHTS,
) {
  const hardPenalty = rating === 2 ? weights[15] : 1,
    easyBonus = rating === 4 ? weights[16] : 1,
    growth =
      Math.exp(weights[8]) *
      (11 - difficulty) *
      Math.pow(stability, -weights[9]) *
      (Math.exp(weights[10] * (1 - recall)) - 1) *
      hardPenalty *
      easyBonus;
  // A successful review never shortens stability.
  return Math.max(stability, stability * (growth + 1));
}

export function nextForgetStability(
  difficulty: number,
  stability: number,
  recall: number,
  weights = FSRS_WEIGHTS,
) {
  const next =
    weights[11] *
    Math.pow(difficulty, -weights[12]) *
    (Math.pow(stability + 1, weights[13]) - 1) *
    Math.exp(weights[14] * (1 - recall));
  return clamp(next, 0.01, stability);
}

function daysBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`),
    end = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.round((end - start) / DAY_MS));
}

/** Days since the last review; falls back to the scheduled interval. */
export function elapsedDays(previous: ReviewSchedule, today: string): number {
  if (previous.lastReview) return daysBetween(previous.lastReview, today);
  return Math.max(
    0,
    daysBetween(previous.dueOn, today) + Math.max(0, previous.interval),
  );
}

/**
 * Next schedule for a card reviewed with FSRS. Returns the same shape SM-2
 * returns plus the memory state, so the queue, history and cloud sync stay
 * untouched.
 */
export function fsrsSchedule(
  previous: ReviewSchedule,
  grade: number,
  today: string,
  options: FsrsOptions = {},
): ReviewSchedule {
  const rating = ratingFromGrade(grade),
    weights = options.weights ?? FSRS_WEIGHTS,
    retention = options.retention ?? DEFAULT_RETENTION,
    scale = clamp(options.scale ?? 1, 0.5, 2),
    known =
      typeof previous.stability === "number" &&
      previous.stability > 0 &&
      typeof previous.difficulty === "number";

  let stability: number, difficulty: number;
  if (!known) {
    stability = initialStability(rating, weights);
    difficulty = initialDifficulty(rating, weights);
  } else {
    const recall = retrievability(
      elapsedDays(previous, today),
      previous.stability!,
    );
    difficulty = nextDifficulty(previous.difficulty!, rating, weights);
    stability =
      rating === 1
        ? nextForgetStability(
            previous.difficulty!,
            previous.stability!,
            recall,
            weights,
          )
        : nextRecallStability(
            previous.difficulty!,
            previous.stability!,
            recall,
            rating,
            weights,
          );
  }

  const interval =
    rating === 1
      ? 1
      : clamp(
          Math.round(intervalForRetention(stability, retention) * scale),
          1,
          MAX_INTERVAL,
        );
  return {
    repetitions: rating === 1 ? 0 : previous.repetitions + 1,
    interval,
    ease: previous.ease,
    dueOn: shiftDate(today, interval),
    algorithm: "fsrs",
    stability: round(stability),
    difficulty: round(difficulty),
    lastReview: today,
  };
}
