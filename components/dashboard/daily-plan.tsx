"use client";
import { useState } from "react";
import { useStudy } from "@/hooks/use-study";
import { actions } from "@/lib/persistence/actions";
import { dateLabel } from "@/lib/calculations/dates";
import { Empty, Progress, SectionTitle } from "@/components/ui/common";
import { Icon } from "@/components/ui/icon";
import { TaskForm } from "./task-form";
import { nextTask } from "@/lib/world/milestones";
export function DailyPlan() {
  const { data, store, run, index, today, navigate } = useStudy(),
    [date, setDate] = useState(today),
    [adding, setAdding] = useState(false),
    [editing, setEditing] = useState<string | null>(null);
  const tasks = data.tasks
      .filter((t) => !t.deletedAt && t.date === date)
      .sort(
        (a, b) =>
          (a.startTime ?? "99:99").localeCompare(b.startTime ?? "99:99") ||
          a.createdAt - b.createdAt,
      ),
    completed = tasks.filter((t) => t.completed).length,
    next = nextTask(tasks, today);
  const startTask = async (t: (typeof tasks)[number]) => {
    if (data.activeTimer) {
      navigate("focus");
      return;
    }
    if (
      await run(() =>
        store.mutate(
          actions.start(
            t.subjectId,
            "pomodoro",
            "focus",
            Math.min(240, t.minutes),
            t.id,
          ),
        ),
      )
    )
      navigate("focus");
  };
  return (
    <section className="card">
      <SectionTitle
        title="Миний төлөвлөгөө"
        subtitle={
          tasks.length
            ? `${completed}/${tasks.length} алхам биелсэн · ${tasks.reduce((n, t) => n + t.minutes, 0)} минут`
            : "Өөртөө тохирсон жижиг алхам төлөвлө."
        }
        action={
          <button
            className="icon-button bordered"
            aria-label="Төлөвлөгөө нэмэх"
            onClick={() => setAdding(true)}
          >
            <Icon name="plus" />
          </button>
        }
      />
      <div className="plan-date">
        <span>{dateLabel(date, today)}</span>
        <input
          aria-label="Төлөвлөгөөний өдөр"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>
      {tasks.length > 0 && (
        <Progress
          value={(completed / tasks.length) * 100}
          label="Төлөвлөгөөний биелэлт"
        />
      )}
      <div className="task-list">
        {tasks.map((t) => (
          <div
            className={`task-row ${t.completed ? "completed" : ""}`}
            key={t.id}
          >
            <input
              type="checkbox"
              checked={t.completed}
              aria-label={`${t.title} биелсэн`}
              onChange={() => run(() => store.mutate(actions.toggleTask(t.id)))}
            />
            <div>
              <strong>{t.title}</strong>
              <span>
                {index.subjects.get(t.subjectId)?.name} · {t.minutes}м
                {t.startTime ? ` · ${t.startTime}` : ""}
              </span>
            </div>
            <div className="task-actions">
              {!t.completed && (
                <button
                  className="icon-button"
                  aria-label={`${t.title} эхлүүлэх`}
                  onClick={() => startTask(t)}
                >
                  <Icon name="play" size={17} />
                </button>
              )}
              <button
                className="icon-button subtle"
                aria-label={`${t.title} засах`}
                onClick={() => setEditing(t.id)}
              >
                <Icon name="edit" size={16} />
              </button>
              <button
                className="icon-button subtle"
                aria-label={`${t.title} устгах`}
                onClick={() =>
                  run(
                    () => store.mutate(actions.deleteTask(t.id)),
                    "Төлөвлөгөөг хогийн сав руу шилжүүллээ.",
                  )
                }
              >
                <Icon name="close" size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
      {next && (
        <button
          className="button primary next-task-button"
          onClick={() => startTask(next)}
        >
          <Icon name="play" size={17} />
          {data.activeTimer
            ? "Ажиллаж буй цаг руу"
            : "Дараагийн алхмаа эхлүүлэх"}
        </button>
      )}
      {!tasks.length && (
        <Empty
          title="Энэ өдөр таны хэмнэлээр"
          description="Нэг хичээл, нэг жижиг зорилго байхад хангалттай."
          action={
            <button className="button small" onClick={() => setAdding(true)}>
              Алхам нэмэх
            </button>
          }
        />
      )}{" "}
      {adding && <TaskForm date={date} onClose={() => setAdding(false)} />}
      {editing && (
        <TaskForm
          key={editing}
          date={date}
          task={data.tasks.find((t) => t.id === editing)}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}
