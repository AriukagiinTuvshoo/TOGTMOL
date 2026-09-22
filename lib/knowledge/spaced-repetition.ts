import { shiftDate } from "@/lib/calculations/dates";
import type { ReviewSchedule } from "@/types/knowledge";
/** SM-2, P. Wozniak: https://super-memory.com/english/ol/sm2.htm */
export function sm2(
  previous: ReviewSchedule,
  grade: number,
  today: string,
): ReviewSchedule {
  if (!Number.isInteger(grade) || grade < 0 || grade > 5)
    throw Error("Үнэлгээ 0–5 байна.");
  const repetitions = grade < 3 ? 0 : previous.repetitions + 1;
  const interval =
    grade < 3 || repetitions === 1
      ? 1
      : repetitions === 2
        ? 6
        : Math.ceil(previous.interval * previous.ease);
  const ease = Math.max(
    1.3,
    previous.ease + 0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02),
  );
  return { repetitions, interval, ease, dueOn: shiftDate(today, interval) };
}
