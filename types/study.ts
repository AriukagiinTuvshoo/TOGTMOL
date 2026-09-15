export type Theme = "system" | "light" | "dark";
export type TimerMode = "stopwatch" | "pomodoro";
export type TimerPhase = "focus" | "shortBreak" | "longBreak";
export type View =
  | "overview"
  | "timer"
  | "calendar"
  | "subjects"
  | "statistics"
  | "goals"
  | "achievements"
  | "settings"
  | "assistant"
  | "room"
  | "focus";
export type Extras = Record<string, unknown>;
export interface RecordBase {
  id: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
  extras: Extras;
}
export interface Subject extends RecordBase {
  name: string;
  color: string;
  icon: string;
  archived: boolean;
}
export interface Entry extends RecordBase {
  subjectId: string;
  date: string;
}
export interface Span {
  start: number;
  end: number;
}
export interface StudySession extends RecordBase {
  subjectId: string;
  date: string;
  startEpoch: number;
  endEpoch: number;
  durationSec: number;
  note: string;
  segments: Span[];
  mode: TimerMode;
  startTimeEstimated: boolean;
  manuallyEdited: boolean;
}
export interface DailyTask extends RecordBase {
  subjectId: string;
  date: string;
  minutes: number;
  title: string;
  completed: boolean;
  startTime: string | null;
  goalId: string | null;
}
export type DesignTheme = "cozy" | "minimal" | "night" | "forest" | "sakura";
export type Companion = "cat" | "fox" | "bear" | "rabbit" | "penguin" | "dog";
export type Background =
  | "cozy"
  | "night"
  | "rain"
  | "library"
  | "forest"
  | "cafe"
  | "minimal"
  | "space"
  | "japanese"
  | "hokkaido";
export type Atmosphere = "day" | "evening" | "night" | "rain" | "snow";
export type DeskItem =
  "laptop" | "books" | "notebook" | "coffee" | "tea" | "plant" | "lamp";
export type Accessory = "leaf" | "glasses" | "star" | "flower" | "none";
export interface WorldSettings {
  design: DesignTheme;
  companion: Companion;
  background: Background;
  atmosphere: Atmosphere;
  desk: DeskItem[];
  accessory: Accessory;
  outfit: "scarf" | "vest" | "none";
  expression: "auto" | "smile" | "calm";
  extras: Extras;
}
export interface StudyGoal extends RecordBase {
  subjectId: string;
  title: string;
  startsOn: string;
  endsOn: string;
  weeklyMinutes: number;
  targetMinutes: number;
}
export interface MusicSource extends RecordBase {
  title: string;
  kind: "video" | "playlist";
  youtubeId: string;
}
export interface Goals {
  weeklyHours: number;
  weeklyDays: number;
  dailyMinutes: number | null;
  monthlyHours: number | null;
  updatedAt: number;
  extras: Extras;
}
export interface Settings {
  world: WorldSettings;
  theme: Theme;
  defaultTimer: TimerMode;
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  sound: boolean;
  notifications: boolean;
  reminderTime: string | null;
  updatedAt: number;
  extras: Extras;
}
export interface ActiveTimer {
  id: string;
  subjectId: string;
  date: string;
  sessionStartedAt: number;
  runningSince: number | null;
  accumulatedMs: number;
  running: boolean;
  note: string;
  mode: TimerMode;
  phase: TimerPhase;
  targetMs: number | null;
  status: "active" | "review";
  finishedAt: number | null;
  segments: Span[];
  startTimeEstimated: boolean;
  taskId: string | null;
  extras: Extras;
}
export interface Quarantined {
  collection: string;
  index: number;
  reason: string;
  value: unknown;
}
export type MergeCollection =
  | "subjects"
  | "entries"
  | "sessions"
  | "tasks"
  | "studyGoals"
  | "musicSources"
  | "goals"
  | "settings";
export interface MergeConflict {
  id: string;
  collection: MergeCollection;
  recordId: string;
  kept: unknown;
  other: unknown;
  resolvedAt: number | null;
}
export interface StudyData {
  schemaVersion: 4;
  subjects: Subject[];
  entries: Entry[];
  sessions: StudySession[];
  tasks: DailyTask[];
  studyGoals: StudyGoal[];
  musicSources: MusicSource[];
  goals: Goals;
  settings: Settings;
  achievementsUnlocked: Record<string, string>;
  activeTimer: ActiveTimer | null;
  quarantine: Quarantined[];
  conflicts: MergeConflict[];
  extras: Extras;
}
export interface StoredDocument {
  revision: number;
  data: StudyData;
}
export interface ExportEnvelope {
  format: "togtmol-backup";
  version: 4;
  exportedAt: string;
  data: StudyData;
}
export interface DailySummary {
  date: string;
  seconds: number;
  subjects: Set<string>;
  sessions: Set<string>;
  hours: number[];
}
export interface StudyIndex {
  days: Map<string, DailySummary>;
  subjectDays: Map<string, Map<string, DailySummary>>;
  bySubject: Map<string, StudySession[]>;
  sessions: StudySession[];
  subjects: Map<string, Subject>;
  hours: number[];
  totalSeconds: number;
  sortedDates: string[];
}
export interface PeriodStats {
  seconds: number;
  averageDaily: number;
  averageSession: number;
  studyDays: number;
  consistency: number;
  longestStreak: number;
  sessionCount: number;
  topSubject: string | null;
  bestDay: string | null;
  bestHour: number | null;
  days: DailySummary[];
  hours: number[];
  bySubject: Map<string, number>;
  periodDays: number;
}
