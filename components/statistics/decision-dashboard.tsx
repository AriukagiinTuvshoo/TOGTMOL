"use client";
import { useEffect, useMemo, useState } from "react";
import { useStudy } from "@/hooks/use-study";
import {
  datesBetween,
  formatTime,
  parseDate,
  shiftDate,
  weekStart,
} from "@/lib/calculations/dates";
import {
  intensity,
  lateSessionPattern,
  periodStats,
  rollingSevenDayReport,
  streakFreezeCount,
  streakWithFreezes,
  subjectBalance,
} from "@/lib/calculations/analytics";
import { actions } from "@/lib/persistence/actions";
import { SectionTitle } from "@/components/ui/common";

function countdownDays(today: string, target: string) {
  if (!parseDate(target)) return null;
  if (target === today) return 0;
  return target > today
    ? datesBetween(today, target).length - 1
    : -(datesBetween(target, today).length - 1);
}

function formatDelta(change: number | null) {
  if (change === null) return "Өмнөх 7 хоногт хугацаа алга";
  if (change === 0) return "Өөрчлөлтгүй";
  return (change > 0 ? "+" : "") + change.toFixed(0) + "%";
}

export function DecisionDashboard() {
  const { data, index, today, store, run } = useStudy();
  const storedExamDate =
    typeof data.settings.extras.examDate === "string" &&
    parseDate(data.settings.extras.examDate)
      ? data.settings.extras.examDate
      : "";
  const [examDate, setExamDate] = useState(storedExamDate);

  useEffect(() => {
    setExamDate(storedExamDate);
  }, [storedExamDate]);

  const last7 = useMemo(() => periodStats(index, 7, today), [index, today]);
  const comparison = useMemo(
    () => rollingSevenDayReport(index, today),
    [index, today],
  );
  const balance = useMemo(() => subjectBalance(last7), [last7]);
  const behavior = useMemo(() => lateSessionPattern(index), [index]);
  const freezeCount = streakFreezeCount(data.settings);
  const freezeState = useMemo(
    () => streakWithFreezes(new Set(index.sortedDates), today, freezeCount),
    [index.sortedDates, today, freezeCount],
  );
  const examDays = examDate ? countdownDays(today, examDate) : null;

  const heatWeeks = useMemo(() => {
    const start = shiftDate(today, -364);
    const gridStart = weekStart(start);
    const dates = datesBetween(gridStart, today);
    while (dates.length % 7) dates.push("");
    return Array.from({ length: Math.ceil(dates.length / 7) }, (_, i) =>
      dates.slice(i * 7, i * 7 + 7),
    );
  }, [today]);

  const heatMonthLabels = useMemo(
    () =>
      heatWeeks.map((week) => {
        const first = week.find(Boolean);
        return first && first.endsWith("-01")
          ? first.slice(0, 7).replace("-", ".")
          : "";
      }),
    [heatWeeks],
  );

  const subjectRows = useMemo(() => {
    const entries = [...last7.bySubject]
      .filter(([, seconds]) => seconds > 0)
      .sort((a, b) => b[1] - a[1]);
    if (entries.length <= 6) return entries;
    const top = entries.slice(0, 5);
    const rest = entries.slice(5).reduce((n, [, seconds]) => n + seconds, 0);
    return [...top, ["__other__", rest] as const];
  }, [last7.bySubject]);

  const subjectPie = useMemo(() => {
    const total = subjectRows.reduce((n, [, seconds]) => n + seconds, 0);
    if (!total) return "var(--surface-muted)";
    let start = 0;
    const stops = subjectRows.map(([id, seconds]) => {
      const end = start + (seconds / total) * 360;
      const color =
        id === "__other__"
          ? "var(--surface-3)"
          : index.subjects.get(id)?.color || "var(--moss)";
      const stop = color + " " + start + "deg " + end + "deg";
      start = end;
      return stop;
    });
    return "conic-gradient(" + stops.join(", ") + ")";
  }, [index.subjects, subjectRows]);

  const saveExamDate = (value: string) => {
    if (value && !parseDate(value)) return;
    setExamDate(value);
    void run(() =>
      store.mutate((current) => {
        const extras = { ...current.settings.extras };
        if (value) extras.examDate = value;
        else delete extras.examDate;
        return actions.settings({ extras })(current);
      }),
    );
  };

  const saveFreezeCount = (value: number) => {
    void run(
      () =>
        store.mutate((current) =>
          actions.settings({
            extras: {
              ...current.settings.extras,
              streakFreezeCount: value,
            },
          })(current),
        ),
      "Streak freeze-ийн нөөц шинэчлэгдлээ.",
    );
  };

  return (
    <section className="statistics-decision" aria-label="Шийдвэрийн статистик">
      <div className="statistics-decision-head">
        <div>
          <span className="eyebrow">DATA → ACTION</span>
          <h2>Тоо хараад зогсохгүй, дараагийн алхмаа ол.</h2>
          <p>
            Сүүлийн өдрийн хэмнэл, хичээлийн баланс, давтагддаг хэв маягийг нэг дороос
            хараад төлөвлөгөөгөө засна.
          </p>
        </div>
        <div className="decision-signal">
          <span>Одоогийн streak</span>
          <strong>{freezeState.streak} өдөр</strong>
          <small>
            {freezeState.freezesUsed
              ? freezeState.freezesUsed + " freeze ашигласан · " + freezeState.freezesRemaining + " үлдсэн"
              : freezeState.freezesRemaining + " freeze нөөцтэй"}
          </small>
        </div>
      </div>

      <div className="decision-grid decision-grid-three">
        <section className="card decision-card exam-countdown">
          <SectionTitle
            title="Шалгалт хүртэл"
            subtitle="Өөрийн шалгалтын өдрийг хадгалаад үлдсэн өдрийг хянана."
          />
          <div className="exam-countdown-body">
            <strong>
              {examDays === null ? "—" : examDays === 0 ? "Өнөөдөр" : Math.abs(examDays)}
            </strong>
            {examDays !== null && examDays !== 0 && (
              <span>
                {examDays > 0 ? "өдөр үлдлээ" : Math.abs(examDays) + " өдөр өнгөрсөн"}
              </span>
            )}
          </div>
          <label className="decision-input-label">
            <span>Шалгалтын өдөр</span>
            <input
              type="date"
              value={examDate}
              onChange={(e) => saveExamDate(e.target.value)}
              aria-label="Шалгалтын өдөр"
            />
          </label>
          {examDate && (
            <button className="text-button" onClick={() => saveExamDate("")}>
              Огноог арилгах
            </button>
          )}
        </section>

        <section className="card decision-card week-comparison">
          <SectionTitle
            title="Сүүлийн 7 хоног"
            subtitle="Өмнөх 7 хоногийн яг өмнөх 7 өдөртэй харьцуулсан."
          />
          <div className="decision-big-number">{formatTime(comparison.seconds)}</div>
          <div className={"decision-change " + (comparison.change !== null && comparison.change < 0 ? "down" : "")}>
            {formatDelta(comparison.change)}
          </div>
          <div className="comparison-track">
            <div>
              <span>Одоогийн</span>
              <strong>{formatTime(comparison.seconds)}</strong>
            </div>
            <div>
              <span>Өмнөх</span>
              <strong>{formatTime(comparison.previousSeconds)}</strong>
            </div>
          </div>
          <p className="tiny muted">
            Суралцсан өдөр: {comparison.studyDays} · өмнөх: {comparison.previousStudyDays}
          </p>
        </section>

        <section className="card decision-card freeze-card">
          <SectionTitle
            title="Streak freeze"
            subtitle="Алгассан өдрийг автоматаар нөхөх 1–2 нөөц өдөр."
          />
          <div className="freeze-main">
            <strong>{freezeState.freezesRemaining}</strong>
            <span>/ {freezeCount} нөөц үлдсэн</span>
          </div>
          <div className="freeze-options" aria-label="Freeze нөөцийн тоо">
            {[1, 2].map((value) => (
              <button
                key={value}
                className="button small"
                aria-pressed={freezeCount === value}
                onClick={() => saveFreezeCount(value)}
              >
                {value} өдөр
              </button>
            ))}
          </div>
          <p className="tiny muted">
            Өнөөдөр сураагүй ч өмнөх streak-ийн тасралтыг нөөцөөс хэрэглэнэ. Нөөц дуусвал
            дараагийн тасралт streak-ийг зогсооно.
          </p>
        </section>
      </div>

      <section className="card stats-heatmap-card">
        <SectionTitle
          title="Сүүлийн 365 өдөр"
          subtitle="GitHub contribution graph шиг: өдөрт хэдэн минут төвлөрснөөр өнгө эрчимжинэ."
        />
        <div className="stats-heatmap-wrap">
          <div className="stats-heatmap-months" aria-hidden="true">
            {heatMonthLabels.map((label, i) => (
              <span key={i}>{label}</span>
            ))}
          </div>
          <div className="stats-heatmap-body">
            <div className="stats-heatmap-weekdays" aria-hidden="true">
              <span>Да</span>
              <span>Лх</span>
              <span>Ба</span>
              <span>Ня</span>
            </div>
            <div className="stats-heatmap-grid">
              {heatWeeks.map((week, wi) =>
                week.map((ds, di) => {
                  if (!ds)
                    return <span className="stats-heat-cell empty" key={wi + "-" + di} />;
                  const day = index.days.get(ds);
                  return (
                    <span
                      className={"stats-heat-cell level-" + intensity(day) + (ds === today ? " today" : "")}
                      key={ds}
                      title={ds + " · " + formatTime(day?.seconds ?? 0)}
                      aria-label={ds + ", " + formatTime(day?.seconds ?? 0)}
                    />
                  );
                }),
              )}
            </div>
          </div>
        </div>
        <div className="stats-heat-legend">
          <span>Бага</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <i key={level} className={"stats-heat-cell level-" + level} />
          ))}
          <span>Их</span>
          <small>0 · ≤20м · ≤40м · ≤60м · 60м+</small>
        </div>
      </section>

      <div className="decision-grid decision-grid-two">
        <section className="card decision-card subject-balance-card">
          <SectionTitle
            title="Хичээлийн баланс"
            subtitle="Сүүлийн 7 хоногийн бодит цагийн хуваарилалт."
          />
          {subjectRows.length ? (
            <div className="subject-balance-layout">
              <div
                className="subject-pie"
                style={{ background: subjectPie }}
                role="img"
                aria-label="Сүүлийн 7 хоногийн хичээлийн хугацааны хуваарилалт"
              />
              <div className="subject-balance-list">
                {subjectRows.map(([id, seconds]) => {
                  const share = last7.seconds ? (seconds / last7.seconds) * 100 : 0;
                  const subject = id === "__other__" ? null : index.subjects.get(id);
                  return (
                    <div key={id} className="subject-balance-row">
                      <div>
                        <span
                          className="subject-dot"
                          style={{ background: subject?.color ?? "var(--surface-3)" }}
                        />
                        <strong>{subject?.name ?? "Бусад"}</strong>
                      </div>
                      <span>{share.toFixed(0)}% · {formatTime(seconds)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="muted">Сүүлийн 7 хоногт хэмжсэн хугацаа алга.</p>
          )}
          {balance.warning && balance.topSubject && (
            <div className="decision-warning" role="status">
              <strong>Тэнцвэр алдагдаж байна.</strong>
              <span>
                {(index.subjects.get(balance.topSubject)?.name ?? "Нэг хичээл") +
                  " нь сүүлийн 7 хоногийн хугацааны " + balance.topShare.toFixed(0) +
                  "%-ийг эзэлж байна. Дараагийн session-үүдийн нэгийг бага зарцуулсан хичээлдээ өгөхийг бодоорой."}
              </span>
            </div>
          )}
          {!balance.warning && balance.subjects.length >= 2 && last7.seconds >= 2 * 60 && (
            <p className="decision-good">Одоогоор нэг хичээл хэт давамгайлаагүй байна.</p>
          )}
        </section>

        <section className="card decision-card behavior-card">
          <SectionTitle
            title="Давтагддаг хэв маяг"
            subtitle="Энгийн aggregation-оор анхаарах зан үйлийг илрүүлнэ."
          />
          {behavior.measured >= 3 ? (
            <>
              <div className="pattern-stat">
                <strong>
                  {behavior.unfinishedPercent === null
                    ? "—"
                    : behavior.unfinishedPercent.toFixed(0) + "%"}
                </strong>
                <span>21:00–04:59 эхэлсэн төлөвлөгөөт session дутуу дууссан</span>
              </div>
              <p>
                {behavior.unfinishedPercent !== null
                  ? behavior.unfinishedPercent >= 40
                    ? "Оройн session-үүдийн " + behavior.unfinishedPercent.toFixed(0) + "% нь төлөвлөсөн хугацаандаа хүрээгүй. Оройн зорилгыг богиносгох эсвэл эхлэх цагаа урагшлуулахыг туршиж болно."
                    : "Оройн session-үүдийн ихэнх нь төлөвлөсөн хугацаандаа хүрч байна (" + (100 - behavior.unfinishedPercent).toFixed(0) + "%)."
                  : "Төлөвлөгөөт Pomodoro session-ийн мэдээлэл одоогоор хүрэлцэхгүй байна."}
              </p>
              <small className="muted">
                Шалгасан: {behavior.measured} төлөвлөгөөт session · нийт оройн эхлэлт {behavior.candidates}.
              </small>
            </>
          ) : (
            <div className="pattern-empty">
              <strong>Одоогоор pattern хангалтгүй.</strong>
              <span>
                Pomodoro-оо төлөвлөгөөтэй эхлүүлж хэд хэдэн session хадгалсны дараа энд бодит
                completion pattern гарна.
              </span>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
