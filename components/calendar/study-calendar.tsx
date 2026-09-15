"use client";
import { useMemo, useState } from "react";
import { useStudy } from "@/hooks/use-study";
import { actions } from "@/lib/persistence/actions";
import {
  dateKey,
  dateLabel,
  datesBetween,
  formatTime,
  parseDate,
  recentDates,
  weekStart,
} from "@/lib/calculations/dates";
import { intensity } from "@/lib/calculations/analytics";
import { SHORT_DAYS } from "@/lib/constants";
import { SectionTitle, SubjectSelect } from "@/components/ui/common";
import { SessionList } from "@/components/ui/session-list";
export function StudyCalendar({
  subjectId: fixedSubject,
}: {
  subjectId?: string;
}) {
  const { index, today, data, store, run } = useStudy(),
    [range, setRange] = useState<"month" | 30 | 90 | 365>(90),
    [selected, setSelected] = useState(today),
    [subjectId, setSubject] = useState(fixedSubject ?? ""),
    [month, setMonth] = useState(today.slice(0, 7));
  const actualSubject = fixedSubject ?? subjectId,
    map = actualSubject ? index.subjectDays.get(actualSubject) : index.days;
  const dates = useMemo(() => {
    if (range === "month") {
      const d = parseDate(month + "-01");
      if (!d) return [];
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0, 12);
      return datesBetween(month + "-01", dateKey(last));
    }
    return recentDates(range, today);
  }, [range, month, today]);
  const day = map?.get(selected),
    daySessions = index.sessions.filter((s) => day?.sessions.has(s.id));
  const cell = (ds: string | null, i: number) =>
    ds ? (
      <button
        key={ds}
        className={`heat-cell level-${intensity(map?.get(ds))} ${selected === ds ? "selected" : ""} ${ds === today ? "today" : ""}`}
        disabled={ds > today}
        onClick={() => setSelected(ds)}
        title={`${ds}: ${formatTime(map?.get(ds)?.seconds ?? 0)}, ${map?.get(ds)?.subjects.size ?? 0} хичээл`}
        aria-label={`${ds}, ${formatTime(map?.get(ds)?.seconds ?? 0)}, ${map?.get(ds)?.subjects.size ?? 0} хичээл`}
        aria-pressed={selected === ds}
      >
        {range === "month" ? Number(ds.slice(-2)) : null}
      </button>
    ) : (
      <span key={`empty-${i}`} className="heat-cell empty-cell" />
    );
  const groups: (string | null)[][] = [];
  if (range !== "month" && dates.length) {
    const start = weekStart(dates[0]),
      all: (string | null)[] = datesBetween(start, today).map((ds) =>
        ds < dates[0] ? null : ds,
      );
    while (all.length % 7) all.push(null);
    for (let i = 0; i < all.length; i += 91) groups.push(all.slice(i, i + 91));
  }
  const offset =
    range === "month" && dates.length
      ? (parseDate(dates[0])!.getDay() + 6) % 7
      : 0;
  return (
    <div className="stack">
      <section className="card">
        <SectionTitle
          title="Таны тогтмол байдал"
          subtitle="Нүд бүр нэг өдөр. Жижиг ахиц бүр энд үлдэнэ."
        />
        <div className="filter-row">
          <div className="segmented">
            {([30, 90, 365, "month"] as const).map((n) => (
              <button
                key={n}
                aria-pressed={range === n}
                onClick={() => setRange(n)}
              >
                {n === "month" ? "Сараар" : `${n} өдөр`}
              </button>
            ))}
          </div>
          {!fixedSubject && (
            <SubjectSelect all value={subjectId} onChange={setSubject} />
          )}
        </div>
        {range === "month" ? (
          <>
            <label className="month-picker">
              Сар
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                max={today.slice(0, 7)}
              />
            </label>
            <div className="monthly-calendar">
              {SHORT_DAYS.map((s) => (
                <span key={s} className="weekday">
                  {s}
                </span>
              ))}
              {Array.from({ length: offset }, (_, i) => cell(null, i))}
              {dates.map(cell)}
            </div>
          </>
        ) : (
          <div className={`heat-groups ${range === 365 ? "year" : ""}`}>
            {groups.map((group, i) => (
              <div className="heat-group" key={i}>
                <div className="heat-month">
                  {group.find(Boolean)?.slice(0, 7).replace("-", ".")} —{" "}
                  {[...group]
                    .reverse()
                    .find(Boolean)
                    ?.slice(0, 7)
                    .replace("-", ".")}
                </div>
                <div className="heat-wrapper">
                  <div className="heat-day-labels">
                    <span>Да</span>
                    <span>Лх</span>
                    <span>Ба</span>
                    <span>Ня</span>
                  </div>
                  <div className="heat-grid">{group.map(cell)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="heat-legend">
          <span>Бага</span>
          {[0, 1, 2, 3, 4].map((n) => (
            <span key={n} className={`legend-cell level-${n}`} />
          ))}
          <span>Их</span>
          <small>0 · ≤30 · ≤60 · ≤120 · 120+ минут</small>
        </div>
      </section>
      <section className="card">
        <SectionTitle
          title={dateLabel(selected, today)}
          subtitle={`${formatTime(day?.seconds ?? 0)} · ${day?.subjects.size ?? 0} хичээл`}
        />
        <SessionList sessions={daySessions} />
        <div className="manual-marks">
          <h3>Суралцсан гэж тэмдэглэх</h3>
          <p className="tiny muted">
            Хугацаа хэмжээгүй байсан ч өдрөө тэмдэглэж болно. Timer-ийн
            бичлэгүүд тусдаа хадгалагдана.
          </p>
          <div className="chip-row">
            {data.subjects
              .filter(
                (s) =>
                  !s.deletedAt && (!actualSubject || s.id === actualSubject),
              )
              .map((s) => {
                const marked = data.entries.some(
                  (e) =>
                    e.subjectId === s.id && e.date === selected && !e.deletedAt,
                );
                return (
                  <button
                    className="subject-mark"
                    key={s.id}
                    aria-pressed={marked}
                    disabled={selected > today}
                    onClick={() =>
                      run(() => store.mutate(actions.markDay(s.id, selected)))
                    }
                  >
                    <span
                      className="subject-dot"
                      style={{ background: s.color }}
                    />
                    {s.name}
                    <span>{marked ? "✓" : "+"}</span>
                  </button>
                );
              })}
          </div>
        </div>
      </section>
    </div>
  );
}
