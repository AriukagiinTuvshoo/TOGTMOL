"use client";
import { useState } from "react";
import { useStudy } from "@/hooks/use-study";
import { actions } from "@/lib/persistence/actions";
import { dateLabel } from "@/lib/calculations/dates";
import {
  Empty,
  Modal,
  Progress,
  SectionTitle,
  SubjectSelect,
} from "@/components/ui/common";
import { Icon } from "@/components/ui/icon";
export function DailyPlan() {
  const { data, store, run, index, today, navigate } = useStudy(),
    [date, setDate] = useState(today),
    [adding, setAdding] = useState(false);
  const tasks = data.tasks.filter((t) => !t.deletedAt && t.date === date),
    completed = tasks.filter((t) => t.completed).length;
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
            {!t.completed && (
              <button
                className="icon-button"
                aria-label={`${t.title} эхлүүлэх`}
                onClick={async () => {
                  if (data.activeTimer) {
                    navigate("timer");
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
                    navigate("timer");
                }}
              >
                <Icon name="play" size={17} />
              </button>
            )}
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
        ))}
      </div>
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
    </section>
  );
}
function TaskForm({ date, onClose }: { date: string; onClose: () => void }) {
  const { data, store, run, navigate } = useStudy(),
    [subject, setSubject] = useState(
      data.subjects.find((s) => !s.deletedAt && !s.archived)?.id ?? "",
    ),
    [title, setTitle] = useState(""),
    [minutes, setMinutes] = useState("25"),
    [startTime, setTime] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Modal title="Жижиг алхам төлөвлөх" onClose={onClose}>
      {!data.subjects.some((s) => !s.deletedAt) ? (
        <Empty
          title="Эхлээд хичээл нэмнэ үү"
          description="Төлөвлөгөөг хичээлтэй холбоно."
          action={
            <button
              className="button primary"
              onClick={() => {
                onClose();
                navigate("subjects");
              }}
            >
              Хичээл нэмэх
            </button>
          }
        />
      ) : (
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            if (
              await run(
                () =>
                  store.mutate(
                    actions.addTask({
                      subjectId: subject,
                      date,
                      minutes: Number(minutes),
                      title,
                      startTime: startTime || null,
                    }),
                  ),
                "Төлөвлөгөө нэмэгдлээ.",
              )
            )
              onClose();
            setBusy(false);
          }}
        >
          <label>
            Хичээл
            <SubjectSelect value={subject} onChange={setSubject} required />
          </label>
          <label>
            Юу хийх вэ?
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Жишээ: 10 шинэ үг давтах"
              required
              maxLength={200}
            />
          </label>
          <div className="form-grid">
            <label>
              Минут
              <input
                type="number"
                min={1}
                max={1440}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                required
              />
            </label>
            <label>
              Эхлэх цаг (заавал биш)
              <input
                type="time"
                value={startTime}
                onChange={(e) => setTime(e.target.value)}
              />
            </label>
          </div>
          <button className="button primary" disabled={busy}>
            Төлөвлөх
          </button>
        </form>
      )}
    </Modal>
  );
}
