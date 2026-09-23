"use client";
import { useMemo, useState, type FormEvent } from "react";
import { useStudy } from "@/hooks/use-study";
import { periodStats, weeklyReport } from "@/lib/calculations/analytics";
import {
  annualHeatmap,
  behaviorPatterns,
  currentStreakWithFreezes,
  streakFreezeLimit,
} from "@/lib/calculations/decision";
import {
  dateLabel,
  datesBetween,
  formatTime,
  parseDate,
  shiftDate,
  weekStart,
} from "@/lib/calculations/dates";
import { Metric, SectionTitle, SubjectSelect } from "@/components/ui/common";
import { SessionList } from "@/components/ui/session-list";
import { AnnualHeatmap, BarChart, DonutChart } from "./charts";
import { Insights } from "@/components/assistant/insights";
import { knowledgeStatistics } from "@/lib/knowledge/statistics";
import { actions } from "@/lib/persistence/actions";
import { Icon } from "@/components/ui/icon";

function examValues(data: ReturnType<typeof useStudy>["data"]) {
  const date =
    typeof data.settings.extras.statisticsExamDate === "string"
      ? data.settings.extras.statisticsExamDate
      : "";
  const title =
    typeof data.settings.extras.statisticsExamTitle === "string"
      ? data.settings.extras.statisticsExamTitle
      : "Шалгалт";
  return {
    date: parseDate(date) ? date : "",
    title: title.trim().slice(0, 80) || "Шалгалт",
  };
}

export function Statistics() {
  const { data, index, today, store, run } = useStudy(),
    [period, setPeriod] = useState<number | "all" | "today" | "week" | "month">(
      "week",
    ),
    [subject, setSubject] = useState(""),
    exam = examValues(data),
    [examDateInput, setExamDateInput] = useState(exam.date),
    [examTitleInput, setExamTitleInput] = useState(exam.title);
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
        streakFreezeLimit(data.settings),
      ),
    [index, period, today, subject, data.settings],
  );
  const global7 = useMemo(() => periodStats(index, 7, today), [index, today]);
  const previous7 = useMemo(
    () => periodStats(index, 7, shiftDate(today, -7)),
    [index, today],
  );
  const delta7 =
    previous7.seconds > 0
      ? ((global7.seconds - previous7.seconds) / previous7.seconds) * 100
      : null;
  const week = useMemo(() => weeklyReport(index, today), [index, today]);
  const freezeLimit = streakFreezeLimit(data.settings);
  const freeze = useMemo(
    () =>
      currentStreakWithFreezes(new Set(index.sortedDates), today, freezeLimit),
    [index.sortedDates, today, freezeLimit],
  );
  const patterns = useMemo(() => behaviorPatterns(data, index), [data, index]);
  const heatmap = useMemo(
    () => annualHeatmap(index, Number(today.slice(0, 4))),
    [index, today],
  );
  const knowledge = knowledgeStatistics(
    data,
    period === "all"
      ? "0000-01-01"
      : period === "today"
        ? today
        : period === "week"
          ? weekStart(today)
          : period === "month"
            ? `${today.slice(0, 7)}-01`
            : shiftDate(today, 1 - period),
    today,
    subject,
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
    ids = new Set(stats.days.flatMap((d) => [...d.sessions])),
    subjectEntries = [...stats.bySubject]
      .filter(([, value]) => value > 0)
      .sort((a, b) => b[1] - a[1]),
    topSubjectShare =
      stats.seconds > 0 && subjectEntries.length
        ? subjectEntries[0][1] / stats.seconds
        : 0,
    balanceWarning = subjectEntries.length >= 2 && topSubjectShare >= 0.65,
    examDiff = exam.date
      ? Math.round(
          (parseDate(exam.date)!.getTime() - parseDate(today)!.getTime()) /
            86400000,
        )
      : null;
  const saveExam = async (e: FormEvent) => {
    e.preventDefault();
    if (!examDateInput) {
      await run(
        () =>
          store.mutate(
            actions.settings({
              extras: {
                ...data.settings.extras,
                statisticsExamDate: "",
                statisticsExamTitle:
                  examTitleInput.trim().slice(0, 80) || "Шалгалт",
              },
            }),
          ),
        "Countdown-ыг цэвэрлэлээ.",
      );
      return;
    }
    if (!parseDate(examDateInput))
      return run(async () => {
        throw Error("Шалгалтын огноо буруу байна.");
      });
    await run(
      () =>
        store.mutate(
          actions.settings({
            extras: {
              ...data.settings.extras,
              statisticsExamDate: examDateInput,
              statisticsExamTitle:
                examTitleInput.trim().slice(0, 80) || "Шалгалт",
            },
          }),
        ),
      "Шалгалтын countdown хадгалагдлаа.",
    );
  };
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

      <section className="decision-grid" aria-label="Шийдвэрийн төв">
        <article className="card decision-card">
          <div className="decision-icon">
            <Icon name="chart" size={17} />
          </div>
          <span className="eyebrow">7 ӨДРИЙН ХАРЬЦУУЛАЛТ</span>
          <strong>{formatTime(global7.seconds)}</strong>
          <p>
            {delta7 === null
              ? "Өмнөх 7 хоногт хэмжилт байхгүй."
              : `${delta7 >= 0 ? "+" : "−"}${Math.abs(delta7).toFixed(0)}% · өмнөхөөс ${formatTime(Math.abs(global7.seconds - previous7.seconds))} ${delta7 >= 0 ? "илүү" : "бага"}`}
          </p>
          <small>Сүүлийн 7 өдөр ↔ өмнөх 7 өдөр</small>
        </article>

        <article className="card decision-card exam-card">
          <div className="decision-icon">
            <Icon name="target" size={17} />
          </div>
          <span className="eyebrow">COUNTDOWN</span>
          <strong>
            {examDiff === null
              ? "—"
              : examDiff > 0
                ? `${examDiff} өдөр`
                : examDiff === 0
                  ? "ӨНӨӨДӨР"
                  : `${Math.abs(examDiff)} өдөр өнгөрсөн`}
          </strong>
          <p>
            {examDiff === null ? "Шалгалтын өдрөө оруулаарай." : exam.title}
          </p>
          <form className="exam-form" onSubmit={saveExam}>
            <label>
              Шалгалтын өдөр
              <input
                type="date"
                value={examDateInput}
                onChange={(e) => setExamDateInput(e.target.value)}
              />
            </label>
            <label>
              Шалгалтын нэр
              <input
                value={examTitleInput}
                onChange={(e) => setExamTitleInput(e.target.value)}
                maxLength={80}
              />
            </label>
            <button className="button small">Хадгалах</button>
          </form>
        </article>

        <article className="card decision-card freeze-card">
          <div className="decision-icon">
            <Icon name="leaf" size={17} />
          </div>
          <span className="eyebrow">STREAK FREEZE</span>
          <strong>{freeze.streak} өдөр</strong>
          <p>
            Нөөц: {Math.max(0, freezeLimit - freeze.usedFreezes)} /{" "}
            {freezeLimit}
          </p>
          <label className="freeze-control">
            Хамгаалалтын өдөр
            <select
              value={freezeLimit}
              onChange={(e) =>
                void run(
                  () =>
                    store.mutate(
                      actions.settings({
                        extras: {
                          ...data.settings.extras,
                          streakFreezeLimit: Number(e.target.value),
                        },
                      }),
                    ),
                  "Streak freeze шинэчлэгдлээ.",
                )
              }
            >
              <option value={1}>1 өдөр</option>
              <option value={2}>2 өдөр</option>
            </select>
          </label>
          <small>
            {freeze.usedFreezes
              ? `${freeze.usedFreezes} хамгаалалт хэрэглэгдсэн.`
              : "Одоогоор хамгаалалт хэрэглээгүй."}
          </small>
        </article>

        <article className="card decision-card pattern-card">
          <div className="decision-icon">
            <Icon name="spark" size={17} />
          </div>
          <span className="eyebrow">ЗАН ҮЙЛИЙН PATTERN</span>
          {patterns.length ? (
            patterns.map((pattern) => (
              <div
                className={`pattern-result ${pattern.tone}`}
                key={pattern.id}
              >
                <strong>{pattern.title}</strong>
                <p>{pattern.body}</p>
              </div>
            ))
          ) : (
            <>
              <strong>Хангалттай өгөгдөл цуглуулж байна</strong>
              <p>
                21:00-с хойших эхлэл, дуусгалгүй орхилтыг 4+ тохиолдлын дараа
                харьцуулж эхэлнэ.
              </p>
            </>
          )}
        </article>
      </section>

      <section className="card stats-heatmap-card">
        <SectionTitle
          title={`${heatmap.year} оны суралцах heatmap`}
          subtitle={`${heatmap.activeDays} идэвхтэй өдөр · ${formatTime(heatmap.totalMinutes * 60)} нийт суралцсан`}
        />
        <AnnualHeatmap weeks={heatmap.weeks} year={heatmap.year} />
      </section>

      <section className="card">
        <SectionTitle
          title="Хичээл бүрийн хуваарилалт"
          subtitle={
            balanceWarning
              ? `Анхаарах дохио: ${index.subjects.get(subjectEntries[0][0])?.name ?? "нэг хичээл"} нийт хугацааны ${Math.round(topSubjectShare * 100)}%-ийг эзэлж байна.`
              : "Нийт суралцах хугацааг хичээл бүрээр харьцуул."
          }
        />
        {balanceWarning && (
          <div className="balance-warning" role="status">
            <Icon name="info" size={16} />
            <span>
              Хуваарилалт төвлөрсөн байна. Бусад зорилтот хичээлүүдийн долоо
              хоногийн хэмжилтээ бас шалгаарай.
            </span>
          </div>
        )}
        <div className="subject-chart-layout">
          <DonutChart
            items={subjectEntries.map(([id, value]) => ({
              id,
              name: index.subjects.get(id)?.name ?? "Устсан хичээл",
              value,
              color: index.subjects.get(id)?.color ?? "var(--moss)",
            }))}
            total={stats.seconds}
            label="Хичээл бүрийн хугацааны эзлэх хувь"
          />
          <div className="distribution">
            {subjectEntries.map(([id, sec]) => (
              <div key={id}>
                <div>
                  <span>
                    <i
                      className="subject-dot"
                      style={{ background: index.subjects.get(id)?.color }}
                    />
                    {index.subjects.get(id)?.name ?? "Устсан хичээл"}
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
        </div>
      </section>

      <section className="card" aria-label="Суралцах ахиц ба мэдлэг">
        <SectionTitle
          title="Эргэн санасан мэдлэг"
          subtitle="Сонгосон хугацаанд үлдээсэн тэмдэглэл, давтлага, сорил"
        />
        <div className="knowledge-stats">
          <div>
            Тэмдэглэл<strong>{knowledge.notes}</strong>
          </div>
          <div>
            Шинэ карт<strong>{knowledge.cards}</strong>
          </div>
          <div>
            Давтлага<strong>{knowledge.reviews}</strong>
            <small>{knowledge.uniqueReviewed} өөр карт</small>
          </div>
          <div>
            Сорил<strong>{knowledge.attempts}</strong>
            <small>
              {knowledge.quizAccuracy === null
                ? "Хариулт алга"
                : `${knowledge.quizAccuracy}% зөв хариулт`}
            </small>
          </div>
        </div>
        <p className="tiny muted">
          {knowledge.recall === null
            ? "Картаа давтсаны дараа өөрийн үнэлгээг энд харж болно."
            : `Картын давтлагын ${knowledge.recall}%-д хариултаа санасан гэж үнэлсэн. Энэ нь өөрийн үнэлгээ бөгөөд чадварын шалгалт биш.`}
        </p>
      </section>

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
          foot={freezeLimit ? `Freeze: ${freezeLimit} нөөц` : undefined}
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
        <section className="card">
          <SectionTitle
            title="Энэ долоо хоног"
            subtitle={`${weekStart(today).replaceAll("-", ".")} — өнөөдөр`}
          />
          <div className="weekly-total">
            {formatTime(week.seconds)}
            <span>/ {data.goals.weeklyHours}ц зорилго</span>
          </div>
          <p className="comparison">
            {week.change === null
              ? week.previousComparable === 0
                ? "Өмнөх долоо хоногийн ижил өдрүүдэд хэмжсэн хугацаа алга."
                : "Шинэ долоо хоног — шинэ боломж."
              : `Ижил өдрүүдээр харьцуулахад ${Math.abs(week.change).toFixed(0)}% ${week.change >= 0 ? "өссөн" : "буурсан"}.`}
          </p>
          <p className="comparison decision-note">
            <Icon name="chart" size={15} /> Дээрх decision card нь сүүлийн 7
            өдрийг өмнөх 7 өдөртэй шууд харьцуулж байна.
          </p>
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
