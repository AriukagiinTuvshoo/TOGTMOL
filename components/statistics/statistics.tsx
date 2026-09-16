"use client";
import { useMemo, useState } from "react";
import { useStudy } from "@/hooks/use-study";
import { periodStats } from "@/lib/calculations/analytics";
import {
  dateLabel,
  formatTime,
  weekStart,
  datesBetween,
} from "@/lib/calculations/dates";
import { Metric, SectionTitle, SubjectSelect } from "@/components/ui/common";
import { SessionList } from "@/components/ui/session-list";
import { BarChart } from "./charts";
import { Insights } from "@/components/assistant/insights";
export function Statistics() {
  const { index, today } = useStudy(),
    [period, setPeriod] = useState<number | "all" | "today" | "week" | "month">(
      "week",
    ),
    [subject, setSubject] = useState("");
  const stats = useMemo(
    () =>
      periodStats(
        index,
        period === "today"
          ? 1
          : period === "week"
            ? datesBetween(weekStart(today), today).length
            : period === "month"
              ? Number(today.slice(-2))
              : period,
        today,
        subject || undefined,
      ),
    [index, period, today, subject],
  );
  const groups = new Map<string, number>();
  for (const d of stats.days) {
    const key =
      stats.days.length > 90
        ? d.date.slice(0, 7)
        : stats.days.length > 30
          ? weekStart(d.date)
          : d.date;
    groups.set(key, (groups.get(key) ?? 0) + d.seconds);
  }
  const buckets = [...groups].slice(-36),
    ids = new Set(stats.days.flatMap((d) => [...d.sessions]));
  return (
    <div className="stack">
      <div className="filter-row">
        <div className="segmented">
          {(["today", "week", "month", 7, 30, 90, 365, "all"] as const).map(
            (n) => (
              <button
                key={n}
                aria-pressed={n === period}
                onClick={() => setPeriod(n)}
              >
                {n === "all"
                  ? "Бүгд"
                  : n === "today"
                    ? "Өнөөдөр"
                    : n === "week"
                      ? "Энэ долоо хоног"
                      : n === "month"
                        ? "Энэ сар"
                        : `${n} өдөр`}
              </button>
            ),
          )}
        </div>
        <SubjectSelect all value={subject} onChange={setSubject} />
      </div>
      <div className="metrics four">
        <Metric label="Нийт хугацаа" value={formatTime(stats.seconds)} />
        <Metric
          label="Өдрийн дундаж"
          value={formatTime(stats.averageDaily)}
          foot={`${stats.periodDays} календарийн өдрөөр`}
        />
        <Metric
          label="Нэг хичээлийн дундаж"
          value={formatTime(stats.averageSession)}
        />
        <Metric
          label="Суралцсан өдөр"
          value={stats.studyDays}
          foot={`${stats.sessionCount} хичээл`}
        />
      </div>
      <div className="metrics four">
        <Metric
          label="Тогтмол байдал"
          value={`${stats.consistency.toFixed(0)}%`}
          foot="Суралцсан өдөр / сонгосон өдрүүд"
        />
        <Metric
          label="Хамгийн урт дараалал"
          value={
            <>
              {stats.longestStreak}
              <small>өдөр</small>
            </>
          }
        />
        <Metric
          label="Хамгийн идэвхтэй өдөр"
          value={stats.bestDay ? dateLabel(stats.bestDay, today) : "—"}
        />
        <Metric
          label="Илүү төвлөрдөг цаг"
          value={
            stats.bestHour === null
              ? "—"
              : `${String(stats.bestHour).padStart(2, "0")}:00`
          }
          foot="Хэмжсэн хугацааны нийлбэрээр"
        />
      </div>
      <section
        className="card statistics-highlights"
        aria-label="Нэмэлт үзүүлэлт"
      >
        <div>
          <span>Одоогийн дараалал</span>
          <strong>{stats.currentStreak} өдөр</strong>
        </div>
        <div>
          <span>Хамгийн урт хичээл</span>
          <strong>{formatTime(stats.longestSession)}</strong>
          <small>Бүтэн хэмжилтийн хугацаа</small>
        </div>
        <div>
          <span>Илүү цаг зориулсан хичээл</span>
          <strong>
            {stats.topSubject
              ? index.subjects.get(stats.topSubject)?.name
              : "—"}
          </strong>
        </div>
      </section>
      <section className="card">
        <SectionTitle
          title="Суралцах хэмнэл"
          subtitle={
            stats.days.length > 90
              ? "Сараар нэгтгэсэн · сүүлийн 36 сар"
              : stats.days.length > 30
                ? "Долоо хоногоор нэгтгэсэн"
                : "Өдөр бүрийн хугацаа"
          }
        />
        <BarChart
          values={buckets.map((b) => b[1])}
          labels={buckets.map((b, i) =>
            i % Math.max(1, Math.ceil(buckets.length / 8)) === 0
              ? b[0].slice(stats.days.length > 90 ? 2 : 5)
              : "",
          )}
          label="Суралцах хэмнэл"
        />
      </section>
      <div className="two-columns">
        <section className="card">
          <SectionTitle
            title="Хичээлийн хуваарилалт"
            subtitle={
              stats.topSubject
                ? `Илүү цаг зориулсан: ${index.subjects.get(stats.topSubject)?.name}`
                : "Хичээл хэмжиж эхлэхэд энд харагдана."
            }
          />
          <div className="distribution">
            {[...stats.bySubject]
              .sort((a, b) => b[1] - a[1])
              .map(([id, sec]) => (
                <div key={id}>
                  <div>
                    <span>
                      <i
                        className="subject-dot"
                        style={{ background: index.subjects.get(id)?.color }}
                      />
                      {index.subjects.get(id)?.name}
                    </span>
                    <strong>{formatTime(sec)}</strong>
                  </div>
                  <div className="progress">
                    <span
                      style={{
                        width: `${stats.seconds ? (sec / stats.seconds) * 100 : 0}%`,
                        background: index.subjects.get(id)?.color,
                      }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </section>
        <section className="card">
          <SectionTitle
            title="Өдрийн аль цагт?"
            subtitle="Pause болон амралтыг оруулаагүй."
          />
          <BarChart
            values={stats.hours}
            labels={stats.hours.map((_, i) =>
              i % 4 === 0 ? String(i).padStart(2, "0") : "",
            )}
            label="Цаг тус бүрийн хугацаа"
          />
        </section>
      </div>
      <Insights />
      <section className="card">
        <SectionTitle title="Сонгосон хугацааны хичээлүүд" />
        <SessionList
          sessions={index.sessions.filter((s) => ids.has(s.id))}
          limit={10}
        />
      </section>
      <p className="tiny muted">
        Эхлэх цаг нь тодорхойгүй хуучин бичлэгийг цагийн харьцуулалтаас хасна.
        Нийт хугацаанд хэвээр тооцно. Шөнө дамнасан шинэ хичээлийг бодитоор
        суралцсан өдөр, цагт хуваарилна.
      </p>
    </div>
  );
}
