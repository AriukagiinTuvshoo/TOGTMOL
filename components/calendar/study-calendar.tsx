"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StoredImage } from "@/components/ui/stored-image";
import { useStudy } from "@/hooks/use-study";
import { actions } from "@/lib/persistence/actions";
import { dayBoundary } from "@/lib/preferences";
import { studyDate } from "@/lib/calculations/dates";
import {
  calendarTimeZone,
  calendarWeekStartsOn,
  formatCalendarTime,
  readCalendarDeadlines,
} from "@/lib/calculations/calendar";
import {
  dateKey,
  dateLabel,
  datesBetween,
  formatTime,
  parseDate,
  shiftDate,
  weekStart,
} from "@/lib/calculations/dates";
import { SHORT_DAYS, WEEKDAYS } from "@/lib/constants";
import { SectionTitle, SubjectSelect } from "@/components/ui/common";
import { SessionList } from "@/components/ui/session-list";
import { CalendarPlanner } from "./calendar-planner";

export function StudyCalendar({
  subjectId: fixedSubject,
}: {
  subjectId?: string;
}) {
  const { index, today, data, store, run, selectedRecord, navigate } = useStudy();
  const [selected, setSelected] = useState(
    data.sessions.find((s) => s.id === selectedRecord)?.date ?? today,
  );
  const [subjectId, setSubject] = useState(fixedSubject ?? "");
  const [month, setMonth] = useState(today.slice(0, 7));
  const [calendarView, setCalendarView] = useState<"month" | "week" | "day" | "timeline">(
    "month",
  );
  const [adding, setAdding] = useState(false);
  const [dragSessionId, setDragSessionId] = useState<string | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const weekStartDay = calendarWeekStartsOn(data);
  const timeZone = calendarTimeZone(data);
  const actualSubject = fixedSubject ?? subjectId;
  const map = actualSubject ? index.subjectDays.get(actualSubject) : index.days;
  const deadlines = readCalendarDeadlines(data).filter(
    (d) => !d.deletedAt && (!actualSubject || d.subjectId === actualSubject),
  );
  const visibleSessions = useMemo(
    () =>
      index.sessions
        .filter((s) => !s.deletedAt && (!actualSubject || s.subjectId === actualSubject))
        .sort((a, b) => a.startEpoch - b.startEpoch),
    [index.sessions, actualSubject],
  );
  const selectedDay = map?.get(selected);
  const selectedSessions = visibleSessions.filter((s) => s.date === selected);
  const selectedPlans = data.tasks
    .filter(
      (t) =>
        !t.deletedAt &&
        t.date === selected &&
        (!actualSubject || t.subjectId === actualSubject),
    )
    .sort((a, b) =>
      (a.startTime ?? "99:99").localeCompare(b.startTime ?? "99:99"),
    );
  const selectedDeadlines = deadlines.filter((d) => d.date === selected);
  const selectedWeekStart = weekStart(selected, weekStartDay);
  const selectedWeekDates = datesBetween(
    selectedWeekStart,
    shiftDate(selectedWeekStart, 6),
  );
  const firstOfMonth = month + "-01";
  const monthFirst = parseDate(firstOfMonth) ?? parseDate(today)!;
  const monthOffset =
    weekStart(dateKey(monthFirst), weekStartDay) === dateKey(monthFirst)
      ? 0
      : datesBetween(weekStart(dateKey(monthFirst), weekStartDay), dateKey(monthFirst)).length - 1;
  const monthDays = datesBetween(
    firstOfMonth,
    dateKey(new Date(monthFirst.getFullYear(), monthFirst.getMonth() + 1, 0, 12)),
  );
  const monthGrid = [
    ...Array.from({ length: monthOffset }, () => null as string | null),
    ...monthDays,
  ];
  while (monthGrid.length % 7) monthGrid.push(null);

  const plannedOn = (ds: string) =>
    data.tasks.filter(
      (t) =>
        !t.deletedAt &&
        t.date === ds &&
        (!actualSubject || t.subjectId === actualSubject),
    );
  const sessionsOn = (ds: string) => visibleSessions.filter((s) => s.date === ds);
  const deadlinesOn = (ds: string) => deadlines.filter((d) => d.date === ds);

  const moveSelection = useCallback((delta: number) => {
    const next =
      calendarView === "month"
        ? (() => {
            const d = parseDate(month + "-01");
            if (!d) return selected;
            d.setMonth(d.getMonth() + delta);
            return dateKey(d);
          })()
        : calendarView === "week"
          ? shiftDate(selectedWeekStart, delta * 7)
          : shiftDate(selected, delta);
    if (calendarView === "month") {
      setMonth(next.slice(0, 7));
      setSelected(next);
    } else {
      setSelected(next);
    }
  }, [calendarView, month, selected, selectedWeekStart]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      )
        return;
      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      moveSelection(event.key === "ArrowLeft" ? -1 : 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [calendarView, month, selected, selectedWeekStart]);

  const onTouchStart = (event: React.TouchEvent) => {
    touchStart.current = {
      x: event.changedTouches[0]?.clientX ?? 0,
      y: event.changedTouches[0]?.clientY ?? 0,
    };
  };
  const onTouchEnd = (event: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const x = event.changedTouches[0]?.clientX ?? start.x;
    const y = event.changedTouches[0]?.clientY ?? start.y;
    const dx = x - start.x;
    const dy = y - start.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    moveSelection(dx < 0 ? 1 : -1);
  };

  const dropSession = async (date: string) => {
    if (!dragSessionId || date === visibleSessions.find((s) => s.id === dragSessionId)?.date)
      return;
    const session = visibleSessions.find((s) => s.id === dragSessionId);
    setDragSessionId(null);
    if (!session) return;
    await run(
      () =>
        store.mutate(
          actions.moveSession(session.id, date, session.updatedAt),
        ),
      "Session шинэ өдөрт шилжлээ.",
    );
  };

  const dayButton = (ds: string | null, compact = false) => {
    if (!ds) return <span className="calendar-day-cell calendar-day-blank" aria-hidden="true" />;
    const plans = plannedOn(ds);
    const sessions = sessionsOn(ds);
    const dayDeadlines = deadlinesOn(ds);
    const summary = map?.get(ds);
    const hasContent = plans.length + sessions.length + dayDeadlines.length > 0;
    return (
      <div
        className={[
          "calendar-day-cell",
          selected === ds ? "selected" : "",
          ds === today ? "today" : "",
        ].join(" ")}
        onDragOver={(e) => {
          if (dragSessionId) e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          void dropSession(ds);
        }}
        onClick={() => {
          setSelected(ds);
          if (!hasContent) setAdding(true);
        }}
      >
        <div className="calendar-day-head">
          <strong>{ds.slice(-2)}</strong>
          <span>{formatTime(summary?.seconds ?? 0)}</span>
        </div>
        {dayDeadlines.slice(0, 2).map((deadline) => (
          <span className="calendar-deadline-marker" key={deadline.id} title={deadline.title}>
            🎯 {deadline.time} {deadline.title}
          </span>
        ))}
        {plans.slice(0, compact ? 2 : 3).map((plan) => {
          const subject = index.subjects.get(plan.subjectId);
          return (
            <span
              className={`calendar-event planned-event ${plan.completed ? "completed" : ""}`}
              key={plan.id}
              title={`Төлөвлөгөө · ${plan.title}`}
              style={{ "--subject-color": subject?.color ?? "var(--moss)" } as React.CSSProperties}
            >
              <i />
              {plan.startTime ?? "—"} {plan.title}
            </span>
          );
        })}
        {sessions.slice(0, compact ? 2 : 3).map((session) => {
          const subject = index.subjects.get(session.subjectId);
          return (
            <span
              key={session.id}
              className="calendar-event actual-event"
              draggable
              onDragStart={(e) => {
                setDragSessionId(session.id);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", session.id);
              }}
              style={{ "--subject-color": subject?.color ?? "var(--moss)" } as React.CSSProperties}
              title="Зөөх бол чирээд өөр өдөр дээр тавина"
            >
              <i />
              {formatCalendarTime(session.startEpoch, timeZone)} {subject?.name ?? "Хичээл"}
            </span>
          );
        })}
        {plans.length + sessions.length > (compact ? 2 : 3) && (
          <small className="calendar-more-count">
            +{plans.length + sessions.length - (compact ? 2 : 3)}
          </small>
        )}
      </div>
    );
  };

  return (
    <div className="stack" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <section className="card calendar-main-card">
        <div className="calendar-smart-head">
          <div>
            <span className="eyebrow">📅 STUDY PLANNING CENTER</span>
            <h2>Таны суралцах хуваарь</h2>
            <p>
              Төлөвлөсөн ажлаа хүрээтэй, бодитоор хийснээ дүүрэн өнгөөр харуулна.
            </p>
          </div>
          <div className="calendar-smart-buddy" aria-hidden="true">🤖✨</div>
        </div>
        <div className="calendar-quick-actions">
          <button className="button primary small" onClick={() => setAdding(true)}>
            ＋ Төлөвлөгөө нэмэх
          </button>
          <button
            className="button small"
            onClick={() => {
              setSelected(today);
              setMonth(today.slice(0, 7));
              setCalendarView("day");
            }}
          >
            ☀️ Өнөөдөр
          </button>
        </div>
        <div className="calendar-summary-strip">
          <div>
            <span>📚</span>
            <strong>{selectedPlans.length}</strong>
            <small>төлөвлөгөө</small>
          </div>
          <div>
            <span>✅</span>
            <strong>{selectedSessions.length}</strong>
            <small>бодит session</small>
          </div>
          <div>
            <span>⏱️</span>
            <strong>{formatTime(selectedDay?.seconds ?? 0)}</strong>
            <small>бодит хугацаа</small>
          </div>
          <div>
            <span>🎯</span>
            <strong>{selectedDeadlines.length}</strong>
            <small>deadline</small>
          </div>
        </div>

        <div className="calendar-control-bar">
          <div className="segmented calendar-view-switch" role="tablist" aria-label="Календарийн харагдац">
            {([
              ["month", "📅 Сар"],
              ["week", "🗓️ 7 хоног"],
              ["day", "☀️ Өдөр"],
              ["timeline", "🕐 Timeline"],
            ] as const).map(([v, label]) => (
              <button
                key={v}
                role="tab"
                aria-selected={calendarView === v}
                onClick={() => setCalendarView(v)}
              >
                {label}
              </button>
            ))}
          </div>
          {!fixedSubject && (
            <SubjectSelect all value={subjectId} onChange={setSubject} />
          )}
        </div>

        <div className="calendar-period-nav">
          <button
            className="icon-button bordered"
            onClick={() => moveSelection(-1)}
            aria-label={
              calendarView === "month"
                ? "Өмнөх сар"
                : calendarView === "week"
                  ? "Өмнөх 7 хоног"
                  : "Өмнөх өдөр"
            }
          >
            ‹
          </button>
          <strong>
            {calendarView === "month"
              ? month
              : calendarView === "week"
                ? `${selectedWeekStart} — ${selectedWeekDates[6]}`
                : dateLabel(selected, today)}
          </strong>
          <button
            className="icon-button bordered"
            onClick={() => moveSelection(1)}
            aria-label={
              calendarView === "month"
                ? "Дараагийн сар"
                : calendarView === "week"
                  ? "Дараагийн 7 хоног"
                  : "Дараагийн өдөр"
            }
          >
            ›
          </button>
        </div>

        <div className="calendar-legend-row">
          <span><i className="legend-outline" /> Төлөвлөсөн</span>
          <span><i className="legend-solid" /> Бодит session</span>
          <span><i className="legend-deadline" /> Deadline</span>
          <small>← → сум · гар утас swipe</small>
        </div>

        {calendarView === "month" && (
          <div className="calendar-grid planner-month-grid">
            {(weekStartDay === "sunday" ? WEEKDAYS : WEEKDAYS.slice(1).concat(WEEKDAYS.slice(0, 1))).map(
              (label) => (
                <div className="calendar-weekday-label" key={label}>{label}</div>
              ),
            )}
            {monthGrid.map((ds, i) => <div key={ds ?? `blank-${i}`}>{dayButton(ds, true)}</div>)}
          </div>
        )}

        {calendarView === "week" && (
          <div className="calendar-week-planner">
            {selectedWeekDates.map((ds) => (
              <div
                className={`calendar-week-column ${ds === selected ? "selected" : ""}`}
                key={ds}
                onClick={() => setSelected(ds)}
                onDragOver={(e) => dragSessionId && e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  void dropSession(ds);
                }}
              >
                <button
                  type="button"
                  className="calendar-week-column-head"
                  onClick={() => {
                    setSelected(ds);
                    if (plannedOn(ds).length + sessionsOn(ds).length + deadlinesOn(ds).length === 0)
                      setAdding(true);
                  }}
                >
                  <span>{SHORT_DAYS[parseDate(ds)!.getDay() === 0 ? 6 : parseDate(ds)!.getDay() - 1]}</span>
                  <strong>{ds.slice(5).replace("-", "/")}</strong>
                </button>
                <div className="calendar-week-column-body">
                  {deadlinesOn(ds).map((deadline) => (
                    <div className="calendar-week-event deadline-event" key={deadline.id}>
                      <b>🎯 {deadline.time}</b>
                      <span>{deadline.title}</span>
                    </div>
                  ))}
                  {plannedOn(ds).map((plan) => {
                    const subject = index.subjects.get(plan.subjectId);
                    return (
                      <div
                        className={`calendar-week-event planned-event ${plan.completed ? "completed" : ""}`}
                        style={{ "--subject-color": subject?.color ?? "var(--moss)" } as React.CSSProperties}
                        key={plan.id}
                      >
                        <b>{plan.startTime ?? "—"}</b>
                        <span>{plan.title}</span>
                        <small>{subject?.name ?? "Хичээл"} · {plan.minutes}м</small>
                      </div>
                    );
                  })}
                  {sessionsOn(ds).map((session) => {
                    const subject = index.subjects.get(session.subjectId);
                    return (
                      <div
                        className="calendar-week-event actual-event"
                        style={{ "--subject-color": subject?.color ?? "var(--moss)" } as React.CSSProperties}
                        key={session.id}
                        draggable
                        onDragStart={(e) => {
                          setDragSessionId(session.id);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                      >
                        <b>{formatCalendarTime(session.startEpoch, timeZone)}</b>
                        <span>{subject?.name ?? "Хичээл"}</span>
                        <small>{Math.round(session.durationSec / 60)}м</small>
                      </div>
                    );
                  })}
                  {!plannedOn(ds).length && !sessionsOn(ds).length && !deadlinesOn(ds).length && (
                    <button
                      type="button"
                      className="calendar-empty-slot"
                      onClick={() => {
                        setSelected(ds);
                        setAdding(true);
                      }}
                    >
                      ＋ Энд төлөвлөх
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {calendarView === "day" && (
          <div className="calendar-day-planner">
            <div className="calendar-day-dropzone" onDragOver={(e) => dragSessionId && e.preventDefault()} onDrop={(e) => { e.preventDefault(); void dropSession(selected); }}>
              <div className="calendar-day-section-title">
                <h3>Өнөөдрийн timeline</h3>
                <span>{timeZone}</span>
              </div>
              {selectedDeadlines.map((deadline) => (
                <div className="calendar-day-item deadline-event" key={deadline.id}>
                  <time>{deadline.time}</time>
                  <div><strong>🎯 {deadline.title}</strong><small>{index.subjects.get(deadline.subjectId)?.name ?? "Хичээл"} · deadline</small></div>
                </div>
              ))}
              {selectedPlans.map((plan) => (
                <div className={`calendar-day-item planned-event ${plan.completed ? "completed" : ""}`} key={plan.id}>
                  <time>{plan.startTime ?? "—"}</time>
                  <div>
                    <strong>{plan.title}</strong>
                    <small>{index.subjects.get(plan.subjectId)?.name ?? "Хичээл"} · {plan.minutes}м · төлөвлөсөн</small>
                  </div>
                </div>
              ))}
              {selectedSessions.map((session) => (
                <div
                  className="calendar-day-item actual-event"
                  key={session.id}
                  draggable
                  onDragStart={(e) => {
                    setDragSessionId(session.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                >
                  <time>{formatCalendarTime(session.startEpoch, timeZone)}</time>
                  <div>
                    <strong>{index.subjects.get(session.subjectId)?.icon ?? "📚"} {index.subjects.get(session.subjectId)?.name ?? "Хичээл"}</strong>
                    <small>{Math.round(session.durationSec / 60)}м · бодит гүйцэтгэл</small>
                  </div>
                </div>
              ))}
              {!selectedPlans.length && !selectedSessions.length && !selectedDeadlines.length && (
                <button className="calendar-empty-day-cta" onClick={() => setAdding(true)}>
                  ＋ Энэ өдөрт төлөвлөгөө нэмэх
                </button>
              )}
            </div>
          </div>
        )}

        {calendarView === "timeline" && (
          <div className="calendar-timeline">
            {visibleSessions.slice(-60).reverse().map((session) => {
              const subject = index.subjects.get(session.subjectId);
              return (
                <div
                  key={session.id}
                  className="calendar-timeline-row"
                  draggable
                  onDragStart={() => setDragSessionId(session.id)}
                  onClick={() => setSelected(session.date)}
                >
                  <time>{session.date}<br />{formatCalendarTime(session.startEpoch, timeZone)}</time>
                  <span className="calendar-timeline-line"><i style={{ background: subject?.color }} /></span>
                  <span><strong>{subject?.icon ?? "📚"} {subject?.name ?? "Хичээл"}</strong><small>{Math.round(session.durationSec / 60)} минут · бодит</small></span>
                </div>
              );
            })}
            {!visibleSessions.length && <div className="calendar-empty-state">📭 Session алга байна.</div>}
          </div>
        )}

        <p className="calendar-drag-hint">
          🖱️ Бодит session-ийг чирээд өөр өдөр рүү тавьж болно. Төлөвлөсөн хэсэг хүрээтэй, бодит session дүүрэн харагдана.
        </p>
      </section>

      <section className="card">
        <SectionTitle
          title={dateLabel(selected, today)}
          subtitle={`${formatTime(selectedDay?.seconds ?? 0)} · ${selectedDay?.subjects.size ?? 0} хичээл · ${selectedPlans.length} төлөвлөгөө`}
          action={
            <button className="button small" onClick={() => setAdding(true)}>
              ＋ Нэмэх
            </button>
          }
        />
        <SessionList sessions={selectedSessions} />
        {selectedDeadlines.length > 0 && (
          <div className="calendar-selected-deadlines">
            {selectedDeadlines.map((deadline) => (
              <div className="calendar-selected-deadline" key={deadline.id}>
                <span>🎯</span>
                <div>
                  <strong>{deadline.title}</strong>
                  <small>{deadline.date} · {deadline.time} · {index.subjects.get(deadline.subjectId)?.name ?? "Хичээл"}</small>
                </div>
                <button
                  className="text-button danger-text"
                  onClick={() =>
                    void run(
                      () => store.mutate(actions.deleteDeadline(deadline.id)),
                      "Deadline устгагдлаа.",
                    )
                  }
                >
                  Устгах
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="calendar-planned-tasks">
          <div className="calendar-subsection-head">
            <div>
              <h3>📌 Төлөвлөсөн алхмууд</h3>
              <p>Хүрээтэй төлөвлөгөө + бодит session-ийг зэрэгцүүлж харуулна.</p>
            </div>
          </div>
          {selectedPlans.map((task) => (
            <div className={`calendar-plan-row ${task.completed ? "completed" : ""}`} key={task.id}>
              <span className="calendar-plan-time">{task.startTime ?? "—"}</span>
              <span className="calendar-plan-icon">{index.subjects.get(task.subjectId)?.icon ?? "📚"}</span>
              <div><strong>{task.title}</strong><small>{index.subjects.get(task.subjectId)?.name ?? "Хичээл"} · {task.minutes}м</small></div>
              <span>{task.completed ? "✓" : "○"}</span>
            </div>
          ))}
          {!selectedPlans.length && <p className="tiny muted">Төлөвлөгөө алга. Нэг жижиг алхам нэмээрэй.</p>}
        </div>
        <div className="manual-marks">
          <h3>Суралцсан гэж тэмдэглэх</h3>
          <p className="tiny muted">Хугацаа хэмжээгүй байсан ч өдрөө тэмдэглэж болно.</p>
          <div className="chip-row">
            {data.subjects
              .filter((s) => !s.deletedAt && (!actualSubject || s.id === actualSubject))
              .map((subject) => {
                const marked = data.entries.some(
                  (e) => e.subjectId === subject.id && e.date === selected && !e.deletedAt,
                );
                const disabled = selected > today;
                return (
                  <button
                    className="subject-mark"
                    key={subject.id}
                    aria-pressed={marked}
                    disabled={disabled}
                    onClick={() =>
                      run(() => store.mutate(actions.markDay(subject.id, selected)))
                    }
                  >
                    <span className="subject-dot" style={{ background: subject.color }} />
                    {subject.name}
                    <span>{marked ? "✓" : "+"}</span>
                  </button>
                );
              })}
          </div>
        </div>
      </section>

      {adding && (
        <CalendarPlanner date={selected} onClose={() => setAdding(false)} />
      )}

      {data.knowledge.filter(
        (r) =>
          !r.deletedAt &&
          (!actualSubject || r.subjectId === actualSubject) &&
          (r.kind === "note" || r.kind === "attempt"
            ? r.date === selected
            : r.kind === "review"
              ? studyDate(new Date(r.reviewedAt), dayBoundary(data.settings)) === selected
              : false),
      ).length > 0 && (
        <section className="card">
          <h2>Энэ өдрийн мэдлэг</h2>
          <div className="calendar-knowledge">
            {data.knowledge
              .filter(
                (r) =>
                  !r.deletedAt &&
                  (!actualSubject || r.subjectId === actualSubject) &&
                  (r.kind === "note" || r.kind === "attempt"
                    ? r.date === selected
                    : r.kind === "review"
                      ? studyDate(new Date(r.reviewedAt), dayBoundary(data.settings)) === selected
                      : false),
              )
              .slice(0, 40)
              .map((r) => (
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
