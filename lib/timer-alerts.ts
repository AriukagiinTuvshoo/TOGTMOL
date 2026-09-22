import type { Settings } from "@/types/study";

export const TIMER_CHIMES = [
  {
    id: "warm",
    label: "Зөөлөн хонх",
    notes: [659.25, 783.99, 987.77, 1174.66, 987.77],
  },
  {
    id: "calm",
    label: "Тайван аялгуу",
    notes: [523.25, 659.25, 783.99, 659.25, 523.25],
  },
  {
    id: "bright",
    label: "Гэгээлэг аялгуу",
    notes: [783.99, 987.77, 1174.66, 1318.51, 1174.66],
  },
] as const;
export const TIMER_DESIGNS = [
  { id: "ring", label: "Цагираг" },
  { id: "digital", label: "Цахим цаг" },
  { id: "minimal", label: "Энгийн" },
] as const;

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
