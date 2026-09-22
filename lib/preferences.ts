import type { Settings } from "@/types/study";
export function dayBoundary(settings?: Settings): number {
  const n = settings?.extras.studyDayBoundary;
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 23
    ? n
    : 0;
}
export function completionVolume(settings: Settings) {
  const n = settings.extras.completionVolume;
  return typeof n === "number" && Number.isFinite(n)
    ? Math.max(0, Math.min(1, n))
    : 0.5;
}
