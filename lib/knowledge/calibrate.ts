import type { CardReview } from "@/types/knowledge";
import { retrievability } from "./fsrs";

/**
 * Lightweight calibration from the user's existing review history.
 *
 * Full FSRS training fits 17+ weights on thousands of reviews. In the browser we
 * only learn one number: how this user's memory compares with the interval the
 * scheduler predicted. Each review pair gives (elapsed days, pass/fail). SM-2's
 * scheduled interval is a reasonable proxy for a stability of ~90% retention, so
 * we search for the stability multiplier that best explains the outcomes.
 *
 * The result is bounded and only applied when it clearly beats the default, so a
 * short or lucky history cannot distort the card schedule.
 */
export interface CalibrationSample {
  elapsedDays: number;
  success: boolean;
  stability: number;
}
export interface FsrsCalibration {
  scale: number;
  samples: number;
  logLossBefore: number;
  logLossAfter: number;
  applied: boolean;
}
export interface CalibrationOptions {
  minSamples?: number;
  minGainPerSample?: number;
  minScale?: number;
  maxScale?: number;
  step?: number;
}

const DAY_MS = 86400000;
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** Consecutive reviews of the same card give one recall observation each. */
export function calibrationSamples(reviews: CardReview[]): CalibrationSample[] {
  const byCard = new Map<string, CardReview[]>();
  for (const review of reviews) {
    if (review.deletedAt || !Number.isFinite(review.reviewedAt)) continue;
    const group = byCard.get(review.cardId) ?? [];
    group.push(review);
    byCard.set(review.cardId, group);
  }
  const samples: CalibrationSample[] = [];
  for (const group of byCard.values()) {
    group.sort((a, b) => a.reviewedAt - b.reviewedAt);
    for (let i = 1; i < group.length; i += 1) {
      const previous = group[i - 1],
        current = group[i],
        elapsedDays = (current.reviewedAt - previous.reviewedAt) / DAY_MS,
        stability = previous.after.interval || 0;
      // Same-day retries (minutes or hours apart) say nothing about the
      // forgetting curve, so only real day-scale gaps become observations.
      if (elapsedDays < 0.5 || !(stability > 0)) continue;
      samples.push({
        elapsedDays,
        success: current.grade >= 3,
        stability,
      });
    }
  }
  return samples;
}

function logLoss(samples: CalibrationSample[], scale: number): number {
  let total = 0;
  for (const sample of samples) {
    const recall = clamp(
        retrievability(sample.elapsedDays, sample.stability * scale),
        0.01,
        0.99,
      ),
      outcome = sample.success ? recall : 1 - recall;
    total -= Math.log(outcome);
  }
  return total / samples.length;
}

export function calibrateStabilityScale(
  reviews: CardReview[],
  options: CalibrationOptions = {},
): FsrsCalibration {
  const minSamples = options.minSamples ?? 40,
    minGain = options.minGainPerSample ?? 0.005,
    minScale = options.minScale ?? 0.5,
    maxScale = options.maxScale ?? 2,
    step = options.step ?? 0.05,
    samples = calibrationSamples(reviews),
    baseline = logLoss(samples, 1);
  if (samples.length < minSamples)
    return {
      scale: 1,
      samples: samples.length,
      logLossBefore: baseline,
      logLossAfter: baseline,
      applied: false,
    };

  let bestScale = 1,
    bestLoss = baseline;
  for (let scale = minScale; scale <= maxScale + 1e-9; scale += step) {
    const loss = logLoss(samples, scale);
    if (loss < bestLoss - 1e-9) {
      bestLoss = loss;
      bestScale = Math.round(scale * 100) / 100;
    }
  }
  const applied = baseline - bestLoss >= minGain;
  return {
    scale: applied ? bestScale : 1,
    samples: samples.length,
    logLossBefore: baseline,
    logLossAfter: applied ? bestLoss : baseline,
    applied,
  };
}
