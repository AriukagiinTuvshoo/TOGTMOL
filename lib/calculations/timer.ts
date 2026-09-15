import type {
  ActiveTimer,
  Span,
  StudyData,
  StudySession,
  TimerMode,
  TimerPhase,
} from "@/types/study";
import { uid } from "@/lib/constants";
import { dateKey } from "./dates";
export function elapsed(timer: ActiveTimer, now: number): number {
  const value =
    timer.accumulatedMs +
    (timer.running && timer.runningSince !== null
      ? Math.max(0, now - timer.runningSince)
      : 0);
  return timer.targetMs === null ? value : Math.min(value, timer.targetMs);
}
function effectiveEnd(t: ActiveTimer, now: number) {
  return t.running && t.runningSince !== null && t.targetMs !== null
    ? Math.min(now, t.runningSince + Math.max(0, t.targetMs - t.accumulatedMs))
    : now;
}
function appendSpan(t: ActiveTimer, now: number): Span[] {
  const end = effectiveEnd(t, now);
  return t.running && t.runningSince !== null && end > t.runningSince
    ? [...t.segments, { start: t.runningSince, end }]
    : t.segments;
}
export function startTimer(
  subjectId: string,
  mode: TimerMode,
  phase: TimerPhase,
  minutes: number | null,
  now: number,
  taskId: string | null = null,
): ActiveTimer {
  return {
    id: uid("session"),
    subjectId,
    date: dateKey(new Date(now)),
    sessionStartedAt: now,
    runningSince: now,
    accumulatedMs: 0,
    running: true,
    note: "",
    mode,
    phase,
    targetMs: mode === "pomodoro" && minutes !== null ? minutes * 60000 : null,
    status: "active",
    finishedAt: null,
    segments: [],
    startTimeEstimated: false,
    taskId,
    extras: {},
  };
}
export function pause(timer: ActiveTimer, now: number): ActiveTimer {
  if (!timer.running || timer.status === "review") return timer;
  return {
    ...timer,
    accumulatedMs: elapsed(timer, now),
    segments: appendSpan(timer, now),
    running: false,
    runningSince: null,
  };
}
export function resume(timer: ActiveTimer, now: number): ActiveTimer {
  return timer.status === "review" || timer.running
    ? timer
    : { ...timer, running: true, runningSince: now };
}
export function review(timer: ActiveTimer, now: number): ActiveTimer {
  if (timer.status === "review") return timer;
  return {
    ...pause(timer, now),
    status: "review",
    finishedAt: effectiveEnd(timer, now),
  };
}
export function sessionFromTimer(
  t: ActiveTimer,
  note: string,
  now: number,
): StudySession {
  if (t.status !== "review" || t.phase !== "focus" || t.accumulatedMs < 5000)
    throw Error("Хадгалахад бэлэн хичээл алга.");
  return {
    id: t.id,
    subjectId: t.subjectId,
    date: t.date,
    startEpoch: t.sessionStartedAt,
    endEpoch: t.finishedAt ?? now,
    durationSec: Math.floor(t.accumulatedMs / 1000),
    note: note.trim(),
    segments: t.segments,
    mode: t.mode,
    startTimeEstimated: t.startTimeEstimated,
    manuallyEdited: false,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    extras: { ...t.extras },
  };
}
export function snapshotForExport(data: StudyData, now: number): StudyData {
  return {
    ...data,
    activeTimer: data.activeTimer ? pause(data.activeTimer, now) : null,
  };
}
