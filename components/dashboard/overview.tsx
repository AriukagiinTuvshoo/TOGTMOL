"use client";
import { useStudy } from "@/hooks/use-study";
import {
  formatTime,
  weekStart,
  datesBetween,
  parseDate,
} from "@/lib/calculations/dates";
import { periodStats, weeklyReport } from "@/lib/calculations/analytics";
import {
  streakFreezeCount,
  streakWithFreezes,
} from "@/lib/calculations/decision";
import { SHORT_DAYS, WEEKDAYS } from "@/lib/constants";
import { Empty, Metric, Progress, SectionTitle } from "@/components/ui/common";
import { Icon } from "@/components/ui/icon";
import { SessionList } from "@/components/ui/session-list";
import { BarChart } from "@/components/statistics/charts";
import { DailyPlan } from "./daily-plan";
import { Insights } from "@/components/assistant/insights";
import { companionProgress } from "@/lib/world/progress";
export function Overview() {
  const { data, index, today, navigate } = useStudy(),
    week = weeklyReport(index, today),
    subjects = data.subjects.filter((s) => !s.deletedAt && !s.archived),
    freezeCount = streakFreezeCount(data.settings),
    streak = streakWithFreezes(
      new Set(index.sortedDates),
      today,
      freezeCount,
    ).streak,
    progress = companionProgress(data, today),
    dailyTargetMinutes =
      data.goals.dailyMinutes ??
      Math.max(
        1,
        Math.round(
          (data.goals.weeklyHours * 60) / Math.max(1, data.goals.weeklyDays),
        ),
      ),
    dailyGoalPercent = Math.min(
      100,
      (periodStats(index, 1, today).seconds / (dailyTargetMinutes * 60)) * 100,
    );
  const weeklyStats = periodStats(
    index,
    datesBetween(weekStart(today), today).length,
    today,
  );
  return (
    <>
      <section className="hero">
        <div>
          <div className="eyebrow">ТӨГС БИШ. ТОГТМОЛ.</div>
          <h1>
            Жижиг алхам.
            <br />
            <em>Том мөрөөдөл.</em>
          </h1>
          <p>
            Өдөр бүр бага багаар. Өнөөдрийн ахиц чинь маргаашийн үр дүнг
            бүтээнэ.
          </p>
          <button
            className="button yellow large"
            onClick={() => navigate("timer")}
          >
            <Icon name="play" />{" "}
            {data.activeTimer ? "Timer руу очих" : "Start study"}
            <Icon name="arrow" />
          </button>
        </div>
        <div className="hero-growth" aria-hidden="true">
          <div className="growth-ring one" />
          <div className="growth-ring two" />
          <div className="growth-ring three" />
          <Icon name="leaf" size={88} />
          <span>ӨДӨР БҮР БАГА БАГААР</span>
        </div>
      </section>
      <div className="metrics four">
        <Metric
          label="Day Streak"
          value={
            <>
              <span className="metric-emoji">🔥</span> {streak}
              <small> өдөр</small>
            </>
          }
          icon="leaf"
          foot={
            streak ? "Хэмнэлээ үргэлжлүүлээрэй" : "Өнөөдөр эхлэхэд оройтоогүй"
          }
        />
        <Metric
          label="Level"
          value={
            <>
              <span className="metric-emoji">✦</span> {progress.level}
            </>
          }
          icon="award"
          foot={progress.intoLevel + "/100 XP энэ түвшинд"}
        />
        <Metric
          label="XP"
          value={
            <>
              {progress.xp}
              <small> XP</small>
            </>
          }
          icon="spark"
          foot={
            progress.todayXP
              ? "Өнөөдөр +" + progress.todayXP + " XP"
              : "Жижиг алхам = XP"
          }
        />
        <Metric
          label="Daily Goal"
          value={
            <>
              {Math.round(dailyGoalPercent)}
              <small>%</small>
            </>
          }
          icon="chart"
          foot={
            formatTime(index.days.get(today)?.seconds ?? 0) +
            " / " +
            dailyTargetMinutes +
            "м"
          }
        />
      </div>
      <div className="dashboard-columns">
        <div className="stack">
          <DailyPlan />
          <section className="card">
            <SectionTitle
              title="Миний хичээлүүд"
              action={
                <button
                  className="text-button"
                  onClick={() => navigate("subjects")}
                >
                  Бүгд <Icon name="arrow" size={16} />
                </button>
              }
            />
            {subjects.length ? (
              <div className="subject-mini-grid">
                {subjects.slice(0, 4).map((s) => (
                  <button
                    className="subject-mini"
                    key={s.id}
                    onClick={() => navigate("subjects")}
                  >
                    <span
                      className="subject-square"
                      style={{ background: s.color }}
                    >
                      <Icon name={s.icon} />
                    </span>
                    <strong>{s.name}</strong>
                    <span>
                      {formatTime(
                        index.bySubject
                          .get(s.id)
                          ?.reduce((n, x) => n + x.durationSec, 0) ?? 0,
                      )}{" "}
                      · нийт
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <Empty
                title="Сонирхлоосоо эхэлье"
                description="Сурахыг хүссэн зүйлээ хичээл болгон нэмээрэй."
                action={
                  <button
                    className="button small"
                    onClick={() => navigate("subjects")}
                  >
                    <Icon name="plus" size={16} />
                    Хичээл нэмэх
                  </button>
                }
              />
            )}
          </section>
          <section className="card">
            <SectionTitle
              title="Сүүлийн хичээлүүд"
              subtitle="Хийсэн жижиг алхмууд тань."
            />
            <SessionList sessions={index.sessions} />
          </section>
        </div>
        <div className="stack">
          <section className="card">
            <SectionTitle
              title="Энэ долоо хоног"
              subtitle={`${weekStart(today).replaceAll("-", ".")} — өнөөдөр`}
            />
            <div className="weekly-total">
              {formatTime(week.seconds)}
              <span>/ {data.goals.weeklyHours}ц зорилго</span>
            </div>
            <Progress
              value={(week.seconds / (data.goals.weeklyHours * 3600)) * 100}
              label="Долоо хоногийн цагийн зорилго"
            />
            <BarChart
              values={week.days.map((d) => d.seconds)}
              labels={SHORT_DAYS}
              label="Долоо хоногийн хугацаа"
            />
            <p className="comparison">
              {week.change === null
                ? week.previousComparable === 0
                  ? "Өмнөх долоо хоногийн ижил өдрүүдэд хэмжсэн хугацаа алга."
                  : "Шинэ долоо хоног — шинэ боломж."
                : `Өмнөх долоо хоногийн ижил өдрүүдээс ${Math.abs(week.change).toFixed(0)}% ${week.change >= 0 ? "өссөн" : "бага"}.`}
            </p>
            <dl className="detail-list">
              <div>
                <dt>Өмнөх бүтэн долоо хоног</dt>
                <dd>{formatTime(week.previousFull)}</dd>
              </div>
              <div>
                <dt>Илүү цаг зориулсан</dt>
                <dd>
                  {weeklyStats.topSubject
                    ? index.subjects.get(weeklyStats.topSubject)?.name
                    : "—"}
                </dd>
              </div>
              <div>
                <dt>Зорилгын биелэлт</dt>
                <dd>
                  {Math.round(
                    (week.seconds / (data.goals.weeklyHours * 3600)) * 100,
                  )}
                  %
                </dd>
              </div>
              <div>
                <dt>Идэвхтэй өдөр</dt>
                <dd>
                  {weeklyStats.bestDay
                    ? WEEKDAYS[parseDate(weeklyStats.bestDay)!.getDay()]
                    : "—"}
                </dd>
              </div>
              <div>
                <dt>Суралцсан өдөр</dt>
                <dd>
                  {week.studyDays} / {data.goals.weeklyDays}
                </dd>
              </div>
            </dl>
            <button
              className="text-button"
              onClick={() => navigate("statistics")}
            >
              Тайлангаа харах
              <Icon name="arrow" size={16} />
            </button>
          </section>
          <Insights compact />
          <section className="gentle-note">
            <Icon name="leaf" />
            <p>1 өдөр ч гэсэн зүгээр — дахин эхэлсэн нь хамгийн чухал.</p>
          </section>
        </div>
      </div>
    </>
  );
}
