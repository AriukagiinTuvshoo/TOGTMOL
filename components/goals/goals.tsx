"use client";
import { GoalPlanner } from "./goal-planner";
import { useState } from "react";
import { useStudy } from "@/hooks/use-study";
import { actions } from "@/lib/persistence/actions";
import { weeklyReport } from "@/lib/calculations/analytics";
import { formatTime } from "@/lib/calculations/dates";
import { Progress, SectionTitle } from "@/components/ui/common";
import { Icon } from "@/components/ui/icon";
export function Goals() {
  const { data, index, today, store, run } = useStudy(),
    [hours, setHours] = useState(String(data.goals.weeklyHours)),
    [days, setDays] = useState(String(data.goals.weeklyDays)),
    [daily, setDaily] = useState(String(data.goals.dailyMinutes ?? "")),
    [monthly, setMonthly] = useState(String(data.goals.monthlyHours ?? "")),
    [busy, setBusy] = useState(false),
    w = weeklyReport(index, today);
  const monthSeconds = [...index.days]
    .filter(([ds]) => ds.slice(0, 7) === today.slice(0, 7))
    .reduce((n, [, d]) => n + d.seconds, 0);
  const cards = [
    {
      title: "Долоо хоногийн цаг",
      value: w.seconds,
      target: data.goals.weeklyHours * 3600,
      text: `${formatTime(w.seconds)} / ${data.goals.weeklyHours}ц`,
    },
    {
      title: "Долоо хоногийн өдрүүд",
      value: w.studyDays,
      target: data.goals.weeklyDays,
      text: `${w.studyDays} / ${data.goals.weeklyDays} өдөр`,
    },
    ...(data.goals.dailyMinutes
      ? [
          {
            title: "Өнөөдрийн зорилго",
            value: index.days.get(today)?.seconds ?? 0,
            target: data.goals.dailyMinutes * 60,
            text: `${formatTime(index.days.get(today)?.seconds ?? 0)} / ${data.goals.dailyMinutes}м`,
          },
        ]
      : []),
    ...(data.goals.monthlyHours
      ? [
          {
            title: "Энэ сарын зорилго",
            value: monthSeconds,
            target: data.goals.monthlyHours * 3600,
            text: `${formatTime(monthSeconds)} / ${data.goals.monthlyHours}ц`,
          },
        ]
      : []),
  ];
  return (
    <div className="stack">
      <GoalPlanner />
      <details className="card" open>
        <summary>Нийт суралцах хэмнэл, зорилго</summary>
        <div className="two-columns">
          <div className="stack">
            {cards.map((c) => (
              <section className="card goal-card" key={c.title}>
                <Icon
                  name={c.value >= c.target ? "check" : "target"}
                  size={26}
                />
                <h2>{c.title}</h2>
                <strong>{c.text}</strong>
                <Progress value={(c.value / c.target) * 100} label={c.title} />
                <p className="muted">
                  {c.value >= c.target
                    ? "Зорилгодоо хүрлээ. Өөртөө баяр хүргээрэй."
                    : "Өөрийн хэмнэлээр, нэг алхам нэг удаа."}
                </p>
              </section>
            ))}
          </div>
          <section className="card align-start">
            <SectionTitle
              title="Өөртөө тохируулъя"
              subtitle="Зорилго тань чиглүүлнэ. Дарамт болох шаардлагагүй."
            />
            <form
              className="form-stack"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                if (
                  await run(
                    () =>
                      store.mutate(
                        actions.goals({
                          weeklyHours: Number(hours),
                          weeklyDays: Number(days),
                          dailyMinutes: daily ? Number(daily) : null,
                          monthlyHours: monthly ? Number(monthly) : null,
                        }),
                      ),
                    "Зорилго шинэчлэгдлээ.",
                  )
                ) {
                }
                setBusy(false);
              }}
            >
              <label>
                Долоо хоногт суралцах цаг
                <input
                  type="number"
                  min={0.1}
                  max={168}
                  step={0.1}
                  required
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                />
              </label>
              <label>
                Долоо хоногт суралцах өдөр
                <input
                  type="number"
                  min={1}
                  max={7}
                  step={1}
                  required
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                />
              </label>
              <label>
                Өдөрт суралцах минут (заавал биш)
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={daily}
                  onChange={(e) => setDaily(e.target.value)}
                  placeholder="Тохируулаагүй"
                />
              </label>
              <label>
                Сард суралцах цаг (заавал биш)
                <input
                  type="number"
                  min={1}
                  max={744}
                  value={monthly}
                  onChange={(e) => setMonthly(e.target.value)}
                  placeholder="Тохируулаагүй"
                />
              </label>
              <button className="button primary" disabled={busy}>
                Зорилго хадгалах
              </button>
            </form>
          </section>
        </div>
      </details>
    </div>
  );
}
