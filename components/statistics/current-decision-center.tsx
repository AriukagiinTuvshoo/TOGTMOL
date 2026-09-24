"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useStudy } from "@/hooks/use-study";
import {
  lateSessionPattern,
  periodStats,
  weeklyReport,
} from "@/lib/calculations/analytics";
import {
  annualHeatmap,
  currentStreakWithFreezes,
  streakFreezeCount,
} from "@/lib/calculations/decision";
import {
  formatTime,
  parseDate,
  shiftDate,
  weekStart,
} from "@/lib/calculations/dates";
import { SectionTitle } from "@/components/ui/common";
import { AnnualHeatmap, DonutChart } from "./charts";
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

export function CurrentDecisionCenter() {
  const { data, index, today, store, run } = useStudy();
  const [examDateInput, setExamDateInput] = useState(examValues(data).date);
  const [examTitleInput, setExamTitleInput] = useState(examValues(data).title);
  const exam = examValues(data);

  const last7 = useMemo(() => periodStats(index, 7, today), [index, today]);
  const previous7 = useMemo(
    () => periodStats(index, 7, shiftDate(today, -7)),
    [index, today],
  );
  const delta7 =
    previous7.seconds > 0
      ? ((last7.seconds - previous7.seconds) / previous7.seconds) * 100
      : null;

  const week = useMemo(() => weeklyReport(index, today), [index, today]);
  const freezeLimit = streakFreezeCount(data.settings);
  const freeze = useMemo(
    () =>
      currentStreakWithFreezes(new Set(index.sortedDates), today, freezeLimit),
    [index.sortedDates, today, freezeLimit],
  );

  const behavior = useMemo(() => lateSessionPattern(index, today), [index, today]);

  const heatmap = useMemo(
    () => annualHeatmap(index, Number(today.slice(0, 4))),
    [index, today],
  );

  const subjectEntries = [...last7.bySubject]
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1]);
  const topSubjectShare =
    last7.seconds > 0 && subjectEntries.length
      ? subjectEntries[0][1] / last7.seconds
      : 0;
  const balanceWarning = subjectEntries.length >= 2 && topSubjectShare >= 0.65;
  useEffect(() => {
    setExamDateInput(exam.date);
    setExamTitleInput(exam.title);
  }, [exam.date, exam.title]);

  const examDiff = exam.date
    ? Math.round(
        (parseDate(exam.date)!.getTime() - parseDate(today)!.getTime()) /
          86400000,
      )
    : null;

  const saveExam = async (event: FormEvent) => {
    event.preventDefault();
    const title = examTitleInput.trim().slice(0, 80) || "Шалгалт";
    await run(
      () =>
        store.mutate(
          actions.settings({
            extras: {
              ...data.settings.extras,
              statisticsExamDate: examDateInput || "",
              statisticsExamTitle: title,
            },
          }),
        ),
      examDateInput
        ? "Шалгалтын countdown хадгалагдлаа."
        : "Countdown-ыг цэвэрлэлээ.",
    );
  };

  return (
    <>
      <section className="decision-grid" aria-label="Шийдвэрийн төв">
        <article className="card decision-card">
          <div className="decision-icon">
            <Icon name="chart" size={17} />
          </div>
          <span className="eyebrow">7 ӨДРИЙН ХАРЬЦУУЛАЛТ</span>
          <strong>{formatTime(last7.seconds)}</strong>
          <p>
            {delta7 === null
              ? "Өмнөх 7 хоногт хэмжилт байхгүй."
              : `${delta7 >= 0 ? "+" : "−"}${Math.abs(delta7).toFixed(0)}% · өмнөхөөс ${formatTime(Math.abs(last7.seconds - previous7.seconds))} ${delta7 >= 0 ? "илүү" : "бага"}`}
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
                onChange={(event) => setExamDateInput(event.target.value)}
              />
            </label>
            <label>
              Шалгалтын нэр
              <input
                value={examTitleInput}
                onChange={(event) => setExamTitleInput(event.target.value)}
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
              onChange={(event) =>
                void run(
                  () =>
                    store.mutate(
                      actions.settings({
                        extras: {
                          ...data.settings.extras,
                          streakFreezeLimit: Number(event.target.value),
                        },
                      }),
                    ),
                  "Streak freeze шинэчлэгдлээ.",
                )
              }
            >
              <option value={0}>0 өдөр</option>
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
          {behavior.measured >= 3 ? (
            <>
              <strong>
                {behavior.unfinishedPercent === null
                  ? "—"
                  : behavior.unfinishedPercent.toFixed(0) + "%"}
              </strong>
              <p>
                {behavior.unfinishedPercent === null
                  ? "Төлөвлөгөөт session-ийн мэдээлэл хүрэлцэхгүй байна."
                  : `21:00–04:59 эхэлсэн төлөвлөгөөт session-үүдийн ${behavior.unfinishedPercent.toFixed(0)}%-д төлөвлөсөн хугацаа бүрдээгүй.`}
              </p>
              <small>
                Шалгасан: {behavior.measured} төлөвлөгөөт session · нийт оройн
                эхлэлт {behavior.candidates}.
              </small>
            </>
          ) : (
            <>
              <strong>Хангалттай өгөгдөл цуглуулж байна</strong>
              <p>
                Оройн төлөвлөгөөт session-үүдээс дор хаяж 3 хэмжилт бүрдсэний
                дараа pattern харуулна.
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
              : "Сүүлийн 7 өдрийн суралцах хугацааг хичээл бүрээр харьцуул."
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
            total={last7.seconds}
            label="Хичээл бүрийн хугацааны эзлэх хувь"
          />
          <div className="distribution">
            {subjectEntries.map(([id, seconds]) => (
              <div key={id}>
                <div>
                  <span>
                    <i
                      className="subject-dot"
                      style={{ background: index.subjects.get(id)?.color }}
                    />
                    {index.subjects.get(id)?.name ?? "Устсан хичээл"}
                  </span>
                  <strong>{formatTime(seconds)}</strong>
                </div>
                <div className="progress">
                  <span
                    style={{
                      width: `${last7.seconds ? (seconds / last7.seconds) * 100 : 0}%`,
                      background: index.subjects.get(id)?.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
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
          <Icon name="chart" size={15} /> Сүүлийн 7 өдөр ба өмнөх 7 өдрийн бодит
          хэмжилтийг тусад нь харуулж байна.
        </p>
      </section>
    </>
  );
}
