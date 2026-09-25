import type { StudyData } from "@/types/study";

export type WeekStartsOn = "monday" | "sunday";

export interface CalendarDeadline {
  id: string;
  title: string;
  subjectId: string;
  date: string;
  time: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validCalendarTime(value: unknown): value is string {
  return typeof value === "string" && timePattern.test(value);
}

export function calendarTimeZone(data?: StudyData): string {
  const raw = data?.settings?.extras?.timeZone;
  if (typeof raw === "string" && raw && validTimeZone(raw)) return raw;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function calendarWeekStartsOn(data?: StudyData): WeekStartsOn {
  return data?.settings.extras.weekStartsOn === "sunday" ? "sunday" : "monday";
}

export function readCalendarDeadlines(data: StudyData): CalendarDeadline[] {
  const raw = data.extras.calendarDeadlines;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const r = item as Record<string, unknown>;
    if (
      typeof r.id !== "string" ||
      typeof r.title !== "string" ||
      typeof r.subjectId !== "string" ||
      typeof r.date !== "string" ||
      !validCalendarTime(r.time)
    )
      return [];
    return [
      {
        id: r.id,
        title: r.title,
        subjectId: r.subjectId,
        date: r.date,
        time: r.time,
        notes: typeof r.notes === "string" ? r.notes : "",
        createdAt: typeof r.createdAt === "number" ? r.createdAt : 0,
        updatedAt: typeof r.updatedAt === "number" ? r.updatedAt : 0,
        deletedAt: typeof r.deletedAt === "number" ? r.deletedAt : null,
      },
    ];
  });
}

export function withCalendarDeadlines(
  data: StudyData,
  deadlines: CalendarDeadline[],
): StudyData {
  return {
    ...data,
    extras: {
      ...data.extras,
      calendarDeadlines: deadlines,
    },
  };
}

export function zonedDateTimeToEpoch(
  date: string,
  time: string,
  timeZone = "UTC",
): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !validCalendarTime(time)) return NaN;
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const target = Date.UTC(y, m - 1, d, hh, mm, 0, 0);
  let epoch = target;
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(epoch));
    const values = Object.fromEntries(
      parts
        .filter((p) => p.type !== "literal")
        .map((p) => [p.type, Number(p.value)]),
    );
    const actual = Date.UTC(
      values.year,
      values.month - 1,
      values.day,
      values.hour,
      values.minute,
      0,
      0,
    );
    const correction = target - actual;
    if (correction === 0) break;
    epoch += correction;
  }
  return epoch;
}

export function deadlineEpoch(deadline: CalendarDeadline, timeZone: string) {
  return zonedDateTimeToEpoch(deadline.date, deadline.time, timeZone);
}

export function formatCalendarTime(epoch: number, timeZone: string) {
  return new Intl.DateTimeFormat("mn-MN", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(epoch));
}

export function formatCalendarDate(
  epoch: number,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" },
) {
  return new Intl.DateTimeFormat("mn-MN", { timeZone, ...options }).format(
    new Date(epoch),
  );
}

export function validTimeZone(value: string): boolean {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function listTimeZones(): string[] {
  try {
    const zones = Intl.supportedValuesOf("timeZone");
    return zones.filter((z) => z.includes("/"));
  } catch {
    return [
      "UTC",
      "Asia/Tokyo",
      "Asia/Seoul",
      "Asia/Ulaanbaatar",
      "Europe/London",
      "Europe/Paris",
      "America/Los_Angeles",
      "America/New_York",
    ];
  }
}

export function countdownLabel(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (days) return `${days}өдөр ${hours}ц ${minutes}м`;
  if (hours) return `${hours}ц ${minutes}м ${seconds}с`;
  return `${minutes}м ${seconds}с`;
}
