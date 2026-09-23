export const pad = (n: number) => String(n).padStart(2, "0");
export const dateKey = (d = new Date()) =>
  `${String(d.getFullYear()).padStart(4, "0")}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function dateKeyInTimeZone(
  d: Date | number = new Date(),
  timeZone?: string,
) {
  const value = d instanceof Date ? d : new Date(d);
  if (!timeZone) return dateKey(value);
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(value);
    const map = Object.fromEntries(
      parts.filter((p) => p.type !== "literal").map((p) => [p.type, p.value]),
    );
    return `${map.year}-${map.month}-${map.day}`;
  } catch {
    return dateKey(value);
  }
}
export function hourInTimeZone(d: Date | number, timeZone?: string) {
  const value = d instanceof Date ? d : new Date(d);
  if (!timeZone) return value.getHours();
  try {
    return Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour: "2-digit",
        hourCycle: "h23",
      }).formatToParts(value).find((p) => p.type === "hour")?.value ?? 0,
    );
  } catch {
    return value.getHours();
  }
}
export function studyDate(
  d = new Date(),
  boundary = 0,
  timeZone?: string,
) {
  const date = dateKeyInTimeZone(d, timeZone);
  return hourInTimeZone(d, timeZone) < boundary
    ? shiftDate(date, -1)
    : date;
}
export function flexibleStreak(dates: Set<string>, today: string, grace = 1) {
  let current = today,
    studied = 0,
    used = 0;
  const oldest = [...dates].sort()[0];
  if (!oldest) return { studied: 0, recoveryDays: 0 };
  while (current >= oldest) {
    if (dates.has(current)) studied++;
    else if (current !== today) {
      if (used >= grace) break;
      used++;
    }
    current = shiftDate(current, -1);
  }
  return { studied, recoveryDays: used };
}
export function parseDate(ds: unknown): Date | null {
  if (typeof ds !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(ds)) return null;
  const [y, m, d] = ds.split("-").map(Number);
  const value = new Date(0);
  value.setFullYear(y, m - 1, d);
  value.setHours(12, 0, 0, 0);
  return dateKey(value) === ds ? value : null;
}
export function shiftDate(ds: string, n: number): string {
  const d = parseDate(ds);
  if (!d) throw Error("Огноог шалгана уу.");
  d.setDate(d.getDate() + n);
  return dateKey(d);
}
export function weekStart(
  ds = dateKey(),
  startsOn: "monday" | "sunday" = "monday",
): string {
  const d = parseDate(ds)!,
    firstDay = startsOn === "sunday" ? 0 : 1,
    offset = (d.getDay() - firstDay + 7) % 7;
  return shiftDate(ds, -offset);
}
export function datesBetween(start: string, end: string): string[] {
  if (!parseDate(start) || !parseDate(end) || start > end) return [];
  const result: string[] = [];
  for (
    let ds = start;
    ds <= end && result.length < 36600;
    ds = shiftDate(ds, 1)
  )
    result.push(ds);
  return result;
}
export function recentDates(count: number, today = dateKey()) {
  return datesBetween(shiftDate(today, 1 - count), today);
}
export function dateLabel(ds: string, today = dateKey()) {
  if (ds === today) return "Өнөөдөр";
  if (ds === shiftDate(today, -1)) return "Өчигдөр";
  return ds.replaceAll("-", ".");
}
export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0м";
  if (seconds < 60) return `${Math.floor(seconds)}с`;
  const minutes = Math.round(seconds / 60),
    h = Math.floor(minutes / 60),
    m = minutes % 60;
  return h ? `${h}ц${m ? ` ${m}м` : ""}` : `${m}м`;
}
export function clock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
}
export function timeLabel(epoch: number) {
  const d = new Date(epoch);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function currentStreak(dates: Set<string>, today = dateKey()) {
  let ds = dates.has(today) ? today : shiftDate(today, -1),
    n = 0;
  while (dates.has(ds)) {
    n++;
    ds = shiftDate(ds, -1);
  }
  return n;
}
export function longestStreak(dates: Iterable<string>) {
  let previous = "",
    run = 0,
    best = 0;
  for (const ds of [...new Set(dates)].sort()) {
    run = previous && shiftDate(previous, 1) === ds ? run + 1 : 1;
    previous = ds;
    best = Math.max(best, run);
  }
  return best;
}
