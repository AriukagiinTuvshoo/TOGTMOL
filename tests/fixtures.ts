import { emptyData } from "@/lib/constants";
import type { StudyData, StudySession, Subject } from "@/types/study";
export const NOW = new Date("2026-09-15T12:00:00Z").getTime();
export function subject(id = "math", name = "Математик"): Subject {
  return {
    id,
    name,
    color: "#e6c75a",
    icon: "book",
    archived: false,
    createdAt: 1,
    updatedAt: 1,
    deletedAt: null,
    extras: {},
  };
}
export function session(patch: Partial<StudySession> = {}): StudySession {
  return {
    id: "session-1",
    subjectId: "math",
    date: "2026-09-15",
    startEpoch: NOW - 60000,
    endEpoch: NOW,
    durationSec: 60,
    note: "Тэгшитгэл",
    segments: [],
    mode: "stopwatch",
    startTimeEstimated: false,
    manuallyEdited: false,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    extras: {},
    ...patch,
  };
}
export function fixture(): StudyData {
  return { ...emptyData(), subjects: [subject()], sessions: [session()] };
}
export class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  clear() {
    this.values.clear();
  }
  getItem(k: string) {
    return this.values.get(k) ?? null;
  }
  key(i: number) {
    return [...this.values.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.values.delete(k);
  }
  setItem(k: string, v: string) {
    this.values.set(k, String(v));
  }
}
