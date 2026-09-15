"use client";
import { useState } from "react";
import { useStudy } from "@/hooks/use-study";
import { insights, suggestPlan } from "@/lib/assistant/provider";
import { actions } from "@/lib/persistence/actions";
import { Empty, SectionTitle } from "@/components/ui/common";
import { Icon } from "@/components/ui/icon";
export function Insights({ compact = false }: { compact?: boolean }) {
  const { index, today } = useStudy(),
    items = insights(index, today);
  return (
    <section className="card insights">
      <SectionTitle
        title="Таны өгөгдөл юу хэлж байна?"
        subtitle="Бодит түүхэд тулгуурласан дүгнэлт"
      />
      <div className="insight-list">
        {items.slice(0, compact ? 2 : 4).map((item) => (
          <div key={item.id}>
            <Icon name="spark" size={20} />
            <div>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
export function Assistant() {
  const { data, index, today, store, run, navigate } = useStudy(),
    [budget, setBudget] = useState(60),
    [added, setAdded] = useState(false),
    suggestions = suggestPlan(data, index, today, budget);
  return (
    <div className="stack">
      <div className="assistant-intro">
        <Icon name="spark" size={30} />
        <div>
          <h1>Таны суралцах туслах</h1>
          <p>Өнгөрсөн алхмаа ойлгоод, дараагийнхаа хэмжээг өөрөө сонго.</p>
        </div>
        <span className="badge">ЛОКАЛ ДҮГНЭЛТ</span>
      </div>
      <Insights />
      <section className="card">
        <SectionTitle
          title="Өнөөдрийн төлөвлөгөөний санал"
          subtitle="Сүүлийн 7 өдөр бага цаг зориулсан хичээлүүдэд анхаарал хуваарилна."
        />
        <label className="budget-input">
          Өнөөдөр зарцуулах минут
          <input
            type="number"
            min={5}
            max={240}
            step={1}
            value={budget}
            onChange={(e) => {
              setBudget(Number(e.target.value));
              setAdded(false);
            }}
          />
        </label>
        {suggestions.length ? (
          <>
            <div className="suggestion-grid">
              {suggestions.map((s) => (
                <article key={s.subjectId}>
                  <span className="badge">{s.minutes} МИНУТ</span>
                  <h3>{s.title}</h3>
                  <p>{s.reason}</p>
                </article>
              ))}
            </div>
            <button
              className="button primary"
              disabled={
                added || budget < 5 || budget > 240 || !Number.isInteger(budget)
              }
              onClick={async () => {
                if (
                  await run(
                    () =>
                      store.mutate((current) =>
                        suggestions.reduce(
                          (next, s) =>
                            next.tasks.some(
                              (t) =>
                                !t.deletedAt &&
                                t.date === today &&
                                t.title === s.title,
                            )
                              ? next
                              : actions.addTask({
                                  ...s,
                                  date: today,
                                  startTime: null,
                                })(next),
                          current,
                        ),
                      ),
                    "Өнөөдрийн төлөвлөгөөнд нэмлээ.",
                  )
                )
                  setAdded(true);
              }}
            >
              <Icon name={added ? "check" : "plus"} />
              {added ? "Төлөвлөгөөнд нэмсэн" : "Эдгээр алхмыг нэмэх"}
            </button>
          </>
        ) : (
          <Empty
            title="Эхлээд хичээлээ сонгоё"
            description="Хичээл нэмсний дараа төлөвлөгөө санал болгоно."
            action={
              <button className="button" onClick={() => navigate("subjects")}>
                Хичээлүүд
              </button>
            }
          />
        )}
      </section>
      <p className="tiny muted">
        AI үйлчилгээ одоогоор холбогдоогүй. Эндэх дүгнэлт, санал нь таны
        хадгалсан мэдээллээс дүрмээр тооцогдоно; мэдээллийг гаднын AI руу
        илгээхгүй.
      </p>
    </div>
  );
}
