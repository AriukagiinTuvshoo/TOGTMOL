import { defaultWorld } from "@/lib/world/config";
import type { StudyData } from "@/types/study";
export const LEGACY_KEY = "tracker-data";
export const PALETTE = [
  "#e6c75a",
  "#9eb6a0",
  "#92b5d4",
  "#c8a3ca",
  "#dfaa87",
  "#84c1b6",
  "#df9999",
];
export const WEEKDAYS = [
  "Ням",
  "Даваа",
  "Мягмар",
  "Лхагва",
  "Пүрэв",
  "Баасан",
  "Бямба",
];
export const SHORT_DAYS = ["Да", "Мя", "Лх", "Пү", "Ба", "Бя", "Ня"];
export const uid = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
export function emptyData(): StudyData {
  return {
    schemaVersion: 4,
    subjects: [],
    entries: [],
    sessions: [],
    tasks: [],
    studyGoals: [],
    musicSources: [],
    goals: {
      weeklyHours: 5,
      weeklyDays: 5,
      dailyMinutes: null,
      monthlyHours: null,
      updatedAt: 0,
      extras: {},
    },
    settings: {
      world: defaultWorld(),
      theme: "system",
      defaultTimer: "stopwatch",
      focusMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      sound: false,
      notifications: false,
      reminderTime: null,
      updatedAt: 0,
      extras: {},
    },
    achievementsUnlocked: {},
    activeTimer: null,
    quarantine: [],
    conflicts: [],
    extras: {},
  };
}
