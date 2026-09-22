import type { Settings } from "@/types/study";

export const TIMER_CHIMES = [
  {
    id: "warm",
    label: "Тогтмол · Зөөлөн хонх",
    notes: [523.25, 659.25, 783.99, 1046.5, 783.99],
  },
  {
    id: "calm",
    label: "Тогтмол · Тэнгэрлэг",
    notes: [523.25, 587.33, 698.46, 783.99, 1046.5],
  },
  {
    id: "bright",
    label: "Тогтмол · Гэгээлэг",
    notes: [587.33, 659.25, 783.99, 987.77, 1174.66],
  },
] as const;

export const TIMER_DESIGNS = [
  { id: "ring", label: "Цагираг" },
  { id: "digital", label: "Цахим цаг" },
  { id: "minimal", label: "Энгийн" },
] as const;

// 10→1 uses a soft rising pentatonic line: the closer to zero,
// the brighter the pitch. This is intentionally not an alarm-like beep.
const COUNTDOWN_NOTES = [
  523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98,
  1760,
] as const;

export const COMPLETION_NOTES = [
  523.25,
  659.25,
  783.99,
  1046.5,
  1318.51,
  1567.98,
  2093,
] as const;

export function countdownFrequency(second: number): number {
  const index = Math.max(1, Math.min(10, Math.round(second)));
  return COUNTDOWN_NOTES[10 - index];
}

export function timerChime(settings: Settings) {
  return (
    TIMER_CHIMES.find((item) => item.id === settings.extras.timerChime) ??
    TIMER_CHIMES[0]
  );
}

export function timerDesign(settings: Settings) {
  return (
    TIMER_DESIGNS.find((item) => item.id === settings.extras.timerDesign)?.id ??
    "ring"
  );
}

export function countdownSecond(remainingMs: number): number | null {
  return remainingMs > 0 && remainingMs <= 10000
    ? Math.ceil(remainingMs / 1000)
    : null;
}
