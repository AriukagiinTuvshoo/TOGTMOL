"use client";
import { useMemo } from "react";
import { useStudy } from "@/hooks/use-study";
import { weeklyReport } from "@/lib/calculations/analytics";
import { formatTime } from "@/lib/calculations/dates";
import { insights } from "@/lib/assistant/provider";
import { coachInsights } from "@/lib/assistant/coach";
import { Progress } from "@/components/ui/common";
import { Icon } from "@/components/ui/icon";

export function WeeklyPulse() {
  const { data, index, today, navigate } = useStudy();
  const week = useMemo(() => weeklyReport(index, today), [index, today]);
  const insight = useMemo(
    () => coachInsights(data, index, today)[0] ?? insights(index, today)[0],
    [data, index, today],
  );
  const max = Math.max(60, ...week.days.map((d) => d.seconds));
  return (
    <div className="weekly-pulse">
      <section className="card week-card" aria-label="Энэ долоо хоногийн ахиц">
        <div className="section-heading">
          <div>
            <span className="eyebrow">ӨӨРИЙН ХЭМНЭЛЭЭР</span>
            <h2>Энэ долоо хоног</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Долоо хоногийн статистик нээх"
            onClick={() => navigate("statistics")}
          >
            <Icon name="arrow" />
          </button>
        </div>
        <div className="week-total">
          <strong>{formatTime(week.seconds)}</strong>
          <span>{week.studyDays} суралцсан өдөр</span>
        </div>
        <div
          className="week-bars"
          role="img"
          aria-label={week.days
            .map((d) => `${d.date}: ${formatTime(d.seconds)}`)
            .join(", ")}
        >
          {week.days.map((d, i) => (
            <div key={d.date} className={d.date === today ? "is-today" : ""}>
              <div className="week-bar-track">
                <span
                  style={{
                    height: `${d.seconds ? Math.max(5, (d.seconds / max) * 100) : 0}%`,
                  }}
                />
              </div>
              <small>{["Да", "Мя", "Лх", "Пү", "Ба", "Бя", "Ня"][i]}</small>
            </div>
          ))}
        </div>
        <Progress
          value={(week.seconds / (data.goals.weeklyHours * 3600)) * 100}
          label="Долоо хоногийн цагийн зорилго"
        />
        <p className="tiny muted">
          {formatTime(week.seconds)} / {data.goals.weeklyHours} цаг ·{" "}
          {week.studyDays}/{data.goals.weeklyDays} өдөр
        </p>
      </section>
      <section className="card coach-card">
        <span className="eyebrow">
          <Icon name="spark" size={15} /> ТОГИГИЙН САНАЛ
        </span>
        <h2>{insight.title}</h2>
        <p>{insight.body}</p>
        <button
          className="text-button"
          onClick={() =>
            navigate(insight.id.startsWith("goal:") ? "goals" : "assistant")
          }
        >
          {insight.id.startsWith("goal:")
            ? "Хуваариа харах"
            : "Хамтдаа дараагийн алхмаа сонгоё"}
          <Icon name="arrow" size={16} />
        </button>
        <small className="tiny muted">
          Таны бүртгэсэн хугацаа, төлөвлөгөөнд тулгуурлав.
        </small>
      </section>
    </div>
  );
}
