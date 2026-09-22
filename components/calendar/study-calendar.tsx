"use client";
import { dayBoundary } from "@/lib/preferences";
import { studyDate } from "@/lib/calculations/dates";
import { StoredImage } from "@/components/ui/stored-image";
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
  const { index, today, data, store, run, selectedRecord, navigate } =
      useStudy(),
    [range, setRange] = useState<"month" | 30 | 90 | 365>(90),
    [selected, setSelected] = useState(
      data.sessions.find((s) => s.id === selectedRecord)?.date ?? today,
    ),
    [subjectId, setSubject] = useState(fixedSubject ?? ""),
    [month, setMonth] = useState(today.slice(0, 7)),
    [calendarView, setCalendarView] = useState<"month" | "week" | "day" | "timeline">("month");
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
  const selectedMinutes = Math.round((day?.seconds ?? 0) / 60);
  const dayMood = selectedMinutes >= 60 ? "🏆" : selectedMinutes >= 30 ? "🔥" : selectedMinutes > 0 ? "🌱" : "🌿";
  const dayMoodText = selectedMinutes >= 60 ? "Өнөөдрийн хүчтэй ахиц!" : selectedMinutes >= 30 ? "Гоё төвлөрчээ!" : selectedMinutes > 0 ? "Жижиг ахиц ч ахиц." : "Эндээс дахин эхэлж болно.";
  const cell = (ds: string | null, i: number) =>
    ds ? (
      <button
        key={ds}
        className={`heat-cell level-${intensity(map?.get(ds))} ${map?.get(ds)?.subjects.size && !map?.get(ds)?.seconds ? "manual-only" : ""} ${selected === ds ? "selected" : ""} ${ds === today ? "today" : ""}`}
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
  const selectedDateObj = parseDate(selected);
  const selectedWeekStart = weekStart(selected);
  const selectedWeekDates = datesBetween(
    selectedWeekStart,
    datesBetween(selectedWeekStart, today).length >= 7
      ? datesBetween(selectedWeekStart, selectedWeekStart).length
        ? dateKey(new Date((parseDate(selectedWeekStart)?.getTime() ?? 0) + 6 * 86400000))
        : selectedWeekStart
      : dateKey(new Date((parseDate(selectedWeekStart)?.getTime() ?? 0) + 6 * 86400000)),
  );
  const scheduleSessions = index.sessions
    .filter((s) => !s.deletedAt && (!actualSubject || s.subjectId === actualSubject))
    .sort((a, b) => a.startEpoch - b.startEpoch);
  const selectedDaySessions = scheduleSessions.filter((s) => s.date === selected);
  const selectedWeekSessions = scheduleSessions.filter((s) => selectedWeekDates.includes(s.date));
  const moveSelectedDay = (delta: number) => {
    if (!selectedDateObj) return;
    const d = new Date(selectedDateObj);
    d.setDate(d.getDate() + delta);
    const next = dateKey(d);
    if (next <= today) setSelected(next);
  };
  const moveSelectedWeek = (delta: number) => {
    const d = parseDate(selectedWeekStart);
    if (!d) return;
    d.setDate(d.getDate() + delta * 7);
    const next = dateKey(d);
    if (next <= today) setSelected(next);
  };
  const dayKnowledge = data.knowledge.filter(
    (r) =>
      !r.deletedAt &&
      (!actualSubject || r.subjectId === actualSubject) &&
      (r.kind === "note" || r.kind === "attempt"
        ? r.date === selected
        : r.kind === "review"
          ? studyDate(new Date(r.reviewedAt), dayBoundary(data.settings)) ===
            selected
          : false),
  );
  return (
    <div className="stack">
      <section className="card calendar-main-card">
        <div className="calendar-smart-head">
          <div>
            <span className="eyebrow">📅 YOUR STUDY RHYTHM</span>
            <h2>Таны суралцах хэмнэл</h2>
            <p>Өдөр бүрийн цаг, хичээл, жижиг ахицыг нэг дороос хараарай.</p>
          </div>
          <div className="calendar-smart-buddy" aria-hidden="true">🤖✨</div>
        </div>
        <div className="calendar-summary-strip">
          <div><span>🌱</span><strong>{dayMood}</strong><small>{dayMoodText}</small></div>
          <div><span>⏱️</span><strong>{formatTime(day?.seconds ?? 0)}</strong><small>сонгосон өдөр</small></div>
          <div><span>📚</span><strong>{day?.subjects.size ?? 0}</strong><small>хичээл</small></div>
          <div><span>✨</span><strong>{daySessions.length}</strong><small>session</small></div>
        </div>
        <div className="filter-row">
          <div className="segmented calendar-view-switch">
            {([["month", "📅 Сар"], ["week", "🗓️ 7 хоног"], ["day", "☀️ Өдөр"], ["timeline", "🕐 Timeline"]] as const).map(([v, label]) => (
              <button key={v} aria-pressed={calendarView === v} onClick={() => setCalendarView(v)}>{label}</button>
            ))}
          </div>
          <div className="calendar-filter-tools">
            <div className="segmented calendar-range-switch">
              {([30, 90, 365] as const).map((n) => (
                <button key={n} aria-pressed={range === n} onClick={() => setRange(n)}>{n} өдөр</button>
              ))}
            </div>
            {!fixedSubject && <SubjectSelect all value={subjectId} onChange={setSubject} />}
          </div>
        </div>
        {calendarView === "week" ? (
          <>
            <div className="calendar-period-nav">
              <button className="icon-button bordered" onClick={() => moveSelectedWeek(-1)} aria-label="Өмнөх 7 хоног">‹</button>
              <strong>{selectedWeekStart} — {selectedWeekDates[6]}</strong>
              <button className="icon-button bordered" onClick={() => moveSelectedWeek(1)} disabled={selectedWeekDates[6] >= today} aria-label="Дараагийн 7 хоног">›</button>
            </div>
            <div className="calendar-week-grid">
              {selectedWeekDates.map((ds) => {
                const sessions = selectedWeekSessions.filter((s) => s.date === ds);
                const summary = map?.get(ds);
                return <button key={ds} className={`calendar-week-day ${ds === selected ? "selected" : ""} ${ds === today ? "today" : ""}`} onClick={() => setSelected(ds)}>
                  <span className="calendar-week-date">{ds.slice(5).replace("-", "/")}</span>
                  <strong>{formatTime(summary?.seconds ?? 0)}</strong>
                  {sessions.slice(0, 3).map((s) => <span className="calendar-event-chip" key={s.id}><i style={{background: index.subjects.get(s.subjectId)?.color}} />{index.subjects.get(s.subjectId)?.icon ?? "📚"} {index.subjects.get(s.subjectId)?.name ?? "Хичээл"} · {Math.round(s.durationSec / 60)}м</span>)}
                  {sessions.length > 3 && <small>+{sessions.length - 3} session</small>}
                </button>;
              })}
            </div>
          </>
        ) : calendarView === "day" ? (
          <>
            <div className="calendar-period-nav">
              <button className="icon-button bordered" onClick={() => moveSelectedDay(-1)} aria-label="Өмнөх өдөр">‹</button>
              <strong>{dateLabel(selected, today)}</strong>
              <button className="icon-button bordered" onClick={() => moveSelectedDay(1)} disabled={selected >= today} aria-label="Дараагийн өдөр">›</button>
            </div>
            <div className="calendar-day-agenda">
              {selectedDaySessions.length ? selectedDaySessions.map((s) => {
                const subject = index.subjects.get(s.subjectId);
                const start = new Date(s.startEpoch);
                return <div className="calendar-agenda-row" key={s.id}>
                  <time>{start.toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"})}</time>
                  <div className="calendar-agenda-dot" style={{background: subject?.color}} />
                  <div><strong>{subject?.icon ?? "📚"} {subject?.name ?? "Хичээл"}</strong><small>{Math.round(s.durationSec / 60)} минут · {s.note || "Төвлөрсөн session"}</small></div>
                </div>;
              }) : <div className="calendar-empty-state">🌱 Энэ өдөр session алга. Жижигхэн 10 минутын алхмаас эхэлж болно.</div>}
            </div>
          </>
        ) : calendarView === "timeline" ? (
          <div className="calendar-timeline">
            {scheduleSessions.slice(-30).reverse().map((s) => {
              const subject = index.subjects.get(s.subjectId);
              return <button key={s.id} className="calendar-timeline-row" onClick={() => setSelected(s.date)}>
                <time>{s.date}<br />{new Date(s.startEpoch).toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"})}</time>
                <span className="calendar-timeline-line"><i style={{background: subject?.color}} /></span>
                <span><strong>{subject?.icon ?? "📚"} {subject?.name ?? "Хичээл"}</strong><small>{Math.round(s.durationSec / 60)} минут</small></span>
              </button>;
            })}
            {!scheduleSessions.length && <div className="calendar-empty-state">📭 Одоогоор session бүртгэгдээгүй байна.</div>}
          </div>
        ) : range === "month" ? (
          <>
            <div className="calendar-month-head">
              <button className="icon-button bordered" aria-label="Өмнөх сар" onClick={() => { const d = parseDate(month + "-01"); if (d) { d.setMonth(d.getMonth() - 1); setMonth(dateKey(d).slice(0, 7)); } }}>‹</button>
              <label className="month-picker">
              Сар
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                max={today.slice(0, 7)}
              />
            </label>
            <button className="icon-button bordered" aria-label="Дараагийн сар" disabled={month >= today.slice(0, 7)} onClick={() => { const d = parseDate(month + "-01"); if (d) { d.setMonth(d.getMonth() + 1); setMonth(dateKey(d).slice(0, 7)); } }}>›</button>
            </div>
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
          <small>0 · ≤20 · ≤40 · ≤60 · 60+ минут</small>
          <small>Цэгтэй нүд: хугацаа хэмжээгүй өдрийн тэмдэглэл</small>
        </div>
      </section>
      <section className="card">
        <SectionTitle
          title={dateLabel(selected, today)}
          subtitle={`${formatTime(day?.seconds ?? 0)} · ${day?.subjects.size ?? 0} хичээл`}
        />
        <SessionList sessions={daySessions} />
        <div className="calendar-tasks">
          <h3>Биелсэн алхмууд</h3>
          {data.tasks
            .filter(
              (t) =>
                !t.deletedAt &&
                t.completed &&
                (!actualSubject || t.subjectId === actualSubject) &&
                (parseDate(t.extras.completedOn)
                  ? t.extras.completedOn === selected
                  : t.date === selected),
            )
            .map((t) => (
              <div className="calendar-task" key={t.id}>
                <span aria-hidden="true">✓</span>
                <div>
                  <strong>{t.title}</strong>
                  <small>
                    {index.subjects.get(t.subjectId)?.name} · {t.minutes}м
                    төлөвлөсөн
                    {!parseDate(t.extras.completedOn)
                      ? " · хуучин бүртгэлийн төлөвлөсөн өдрөөр"
                      : ""}
                  </small>
                </div>
              </div>
            ))}
          {!data.tasks.some(
            (t) =>
              !t.deletedAt &&
              t.completed &&
              (!actualSubject || t.subjectId === actualSubject) &&
              (parseDate(t.extras.completedOn)
                ? t.extras.completedOn === selected
                : t.date === selected),
          ) && (
            <p className="tiny muted">Энэ өдөр биелсэн алхам бүртгэгдээгүй.</p>
          )}
        </div>
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
      {dayKnowledge.length > 0 && (
        <section className="card">
          <h2>Энэ өдрийн мэдлэг</h2>
          <div className="calendar-knowledge">
            {dayKnowledge.slice(0, 40).map((r) => (
              <button key={r.id} onClick={() => navigate("knowledge", r.id)}>
                {r.kind === "note" && r.image && (
                  <StoredImage src={r.image} alt={r.title} loading="lazy" />
                )}
                <strong>{r.title}</strong>
                <small>
                  {r.kind === "review"
                    ? `Карт давтсан · ${r.grade}/5`
                    : r.kind === "attempt"
                      ? `Сорил · ${r.score}/${r.total}`
                      : "Тэмдэглэл"}
                </small>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
