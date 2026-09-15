"use client";
import { useMemo, useState } from "react";
import { useStudy } from "@/hooks/use-study";
import {
  commitPlan,
  deleteGoal,
  inferPlan,
  planPreview,
  restoreGoal,
  type PlanInput,
  type PlanPreview,
} from "@/lib/world/planner";
import { goalProgress } from "@/lib/world/progress";
import { actions } from "@/lib/persistence/actions";
import { formatTime, parseDate } from "@/lib/calculations/dates";
import {
  Modal,
  Progress,
  SectionTitle,
  SubjectSelect,
} from "@/components/ui/common";
import { Icon } from "@/components/ui/icon";
export function GoalPlanner() {
  const { data, index, today, store, run, navigate } = useStudy(),
    [adding, setAdding] = useState(false),
    [editing, setEditing] = useState<string | null>(null);
  const active = data.studyGoals.filter((g) => !g.deletedAt),
    deleted = data.studyGoals.filter((g) => g.deletedAt),
    progress = useMemo(
      () =>
        new Map(
          data.studyGoals
            .filter((g) => !g.deletedAt)
            .map((g) => [g.id, goalProgress(data, g, today, index)]),
        ),
      [data, index, today],
    );
  return (
    <section className="stack">
      <SectionTitle
        title="Зорилгоо жижиг алхам болгоё"
        subtitle="Зорилго → төлөвлөгөө → timer → бодит ахиц"
        action={
          <button className="button primary" onClick={() => setAdding(true)}>
            <Icon name="plus" /> Шинэ зорилго
          </button>
        }
      />
      {!active.length && (
        <div className="goal-invitation">
          <div>
            <span className="eyebrow">ONE SMALL STEP</span>
            <h2>Юунд бага багаар хүрмээр байна?</h2>
            <p>
              “Англи хэлээ 4 долоо хоног, өдөрт 25 минут давтъя” гэж бичээд
              эхэлж болно.
            </p>
          </div>
          <button className="button" onClick={() => setAdding(true)}>
            Тогитой төлөвлөх <Icon name="arrow" />
          </button>
        </div>
      )}
      <div className="goal-plans">
        {active.map((g) => {
          const p = progress.get(g.id)!,
            next = p.tasks
              .filter((t) => !t.completed)
              .sort((a, b) => a.date.localeCompare(b.date))[0];
          return (
            <article className="card goal-plan" key={g.id}>
              <div className="section-heading">
                <span className="badge">
                  {index.subjects.get(g.subjectId)?.name}
                </span>
                <div className="button-row">
                  <button
                    className="icon-button"
                    aria-label={`${g.title} засах`}
                    onClick={() => setEditing(g.id)}
                  >
                    <Icon name="edit" size={17} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`${g.title} устгах`}
                    onClick={() =>
                      run(
                        () => store.mutate(deleteGoal(g.id)),
                        "Зорилго хогийн саванд орлоо. Доороос сэргээж болно.",
                      )
                    }
                  >
                    <Icon name="trash" size={17} />
                  </button>
                </div>
              </div>
              <h3>{g.title}</h3>
              <p className="tiny muted">
                {g.startsOn} — {g.endsOn}
              </p>
              <strong className="goal-time">
                {formatTime(p.seconds)}{" "}
                <small>/ {formatTime(g.targetMinutes * 60)}</small>
              </strong>
              <Progress value={p.percent} label={`${g.title} бодит ахиц`} />
              <p className="tiny muted">
                Энэ зорилгын timer-аар хэмжсэн хугацаа · {p.completed}/
                {p.tasks.length} алхам
              </p>
              <div className="subject-week">
                <span>Хичээлдээ энэ долоо хоногт</span>
                <strong>
                  {formatTime(p.weeklySeconds)} /{" "}
                  {formatTime(g.weeklyMinutes * 60)}
                </strong>
              </div>
              <Progress
                value={(p.weeklySeconds / (g.weeklyMinutes * 60)) * 100}
                label={`${g.title} долоо хоногийн зорилго`}
              />
              {next ? (
                <div className="goal-next">
                  <div>
                    <small>Дараагийн алхам · {next.date}</small>
                    <p>{next.title}</p>
                  </div>
                  <button
                    className="icon-button bordered"
                    aria-label={`${g.title} дараагийн алхам эхлүүлэх`}
                    onClick={async () => {
                      if (data.activeTimer) {
                        navigate("timer");
                        return;
                      }
                      if (
                        await run(() =>
                          store.mutate(
                            actions.start(
                              g.subjectId,
                              "pomodoro",
                              "focus",
                              next.minutes,
                              next.id,
                            ),
                          ),
                        )
                      )
                        navigate("focus");
                    }}
                  >
                    <Icon name="play" />
                  </button>
                </div>
              ) : (
                <p>
                  {p.percent >= 100
                    ? "Энэ зорилгодоо хүрлээ. Өөртөө баяр хүргэе."
                    : "Алхмуудаа тэмдэглэж дуусжээ. Бодит хугацааг timer-аар хэмжинэ."}
                </p>
              )}
              <details>
                <summary>Бүх алхам ({p.tasks.length})</summary>
                <ol className="goal-task-list">
                  {p.tasks.map((t) => (
                    <li key={t.id}>
                      <label>
                        <input
                          type="checkbox"
                          checked={t.completed}
                          onChange={() =>
                            run(() => store.mutate(actions.toggleTask(t.id)))
                          }
                        />
                        <span>
                          {t.date} · {t.minutes}м<br />
                          {t.title}
                        </span>
                      </label>
                    </li>
                  ))}
                </ol>
              </details>
            </article>
          );
        })}
      </div>
      {deleted.length > 0 && (
        <details className="card">
          <summary>Устгасан зорилго ({deleted.length})</summary>
          {deleted.map((g) => (
            <div className="section-heading" key={g.id}>
              <span>{g.title}</span>
              <button
                className="button small"
                onClick={() =>
                  run(
                    () => store.mutate(restoreGoal(g.id)),
                    "Зорилго сэргээгдлээ.",
                  )
                }
              >
                Сэргээх
              </button>
            </div>
          ))}
        </details>
      )}
      {adding && <PlanWizard onClose={() => setAdding(false)} />}
      {editing && (
        <EditGoal key={editing} id={editing} onClose={() => setEditing(null)} />
      )}
    </section>
  );
}
function EditGoal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, store, run } = useStudy(),
    goal = data.studyGoals.find((g) => g.id === id)!,
    [expected] = useState(goal.updatedAt),
    [title, setTitle] = useState(goal.title),
    [weekly, setWeekly] = useState(goal.weeklyMinutes),
    [target, setTarget] = useState(goal.targetMinutes),
    [end, setEnd] = useState(goal.endsOn);
  return (
    <Modal title="Зорилго засах" onClose={onClose}>
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await run(
              () =>
                store.mutate((d) => {
                  if (
                    !title.trim() ||
                    title.length > 200 ||
                    !Number.isFinite(weekly) ||
                    weekly < 5 ||
                    weekly > 10080 ||
                    !Number.isFinite(target) ||
                    target < 5 ||
                    target > 120960 ||
                    !parseDate(end) ||
                    end < goal.startsOn
                  )
                    throw Error("Зорилгын нэр, хугацаа, огноог шалгана уу.");
                  const old = d.studyGoals.find((g) => g.id === id);
                  if (!old || old.updatedAt !== expected)
                    throw Error("Зорилго өөрчлөгдсөн тул дахин нээж засна уу.");
                  return {
                    ...d,
                    studyGoals: d.studyGoals.map((g) =>
                      g.id === id
                        ? {
                            ...g,
                            title: title.trim(),
                            weeklyMinutes: weekly,
                            targetMinutes: target,
                            endsOn: end,
                            updatedAt: Date.now(),
                          }
                        : g,
                    ),
                  };
                }),
              "Зорилго шинэчлэгдлээ.",
            )
          )
            onClose();
        }}
      >
        <label>
          Зорилгын нэр
          <input
            required
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          Долоо хоногт (минут)
          <input
            type="number"
            required
            min={5}
            max={10080}
            value={weekly}
            onChange={(e) => setWeekly(Number(e.target.value))}
          />
        </label>
        <label>
          Нийт зорилтот минут
          <input
            type="number"
            required
            min={5}
            max={120960}
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
          />
        </label>
        <label>
          Дуусах өдөр
          <input
            type="date"
            required
            min={goal.startsOn}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
        <p className="tiny muted">
          Өмнөх төлөвлөгөө, суралцсан хугацаа хэвээр хадгалагдана.
        </p>
        <button className="button primary">Өөрчлөлт хадгалах</button>
      </form>
    </Modal>
  );
}
export function PlanWizard({
  onClose,
  initial = "",
}: {
  onClose: () => void;
  initial?: string;
}) {
  const { data, today, store, run, navigate } = useStudy(),
    [text, setText] = useState(initial),
    [input, setInput] = useState<PlanInput | null>(
      initial ? inferPlan(initial, data, today) : null,
    ),
    [preview, setPreview] = useState<PlanPreview | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const patch = (p: Partial<PlanInput>) => {
    setInput((i) => (i ? { ...i, ...p } : i));
    setPreview(null);
  };
  return (
    <Modal title="Тогитой төлөвлөх" onClose={onClose}>
      {!data.subjects.some((s) => !s.deletedAt) ? (
        <div className="form-stack">
          <p>Эхлээд суралцах хичээлээ нэмье.</p>
          <button
            className="button primary"
            onClick={() => {
              onClose();
              navigate("subjects");
            }}
          >
            Хичээл нэмэх
          </button>
        </div>
      ) : (
        <div className="form-stack">
          <label>
            Таны зорилго
            <textarea
              rows={3}
              maxLength={200}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setPreview(null);
              }}
              placeholder="Англи хэлээ 4 долоо хоног, өдөрт 25 минут давтъя"
            />
          </label>
          <button
            className="button"
            disabled={!text.trim()}
            onClick={() => {
              setInput(inferPlan(text, data, today));
              setPreview(null);
              setError("");
            }}
          >
            Алхмуудын санал гаргах
          </button>
          <p className="tiny muted">
            Local planner: хичээлийн нэр, долоо хоног/сар, минутыг таньж хуваарь
            санал болгоно. Агуулгын түвшинг дүгнэхгүй; доорх утгуудаа өөрчилж
            болно.
          </p>
          {input && (
            <>
              <label>
                Зорилгын нэр
                <input
                  value={input.title}
                  maxLength={200}
                  onChange={(e) => patch({ title: e.target.value })}
                />
              </label>
              <label>
                Хичээл
                <SubjectSelect
                  value={input.subjectId}
                  onChange={(subjectId) => patch({ subjectId })}
                />
              </label>
              <div className="form-grid">
                <label>
                  Эхлэх өдөр
                  <input
                    type="date"
                    value={input.startsOn}
                    onChange={(e) => patch({ startsOn: e.target.value })}
                  />
                </label>
                <label>
                  Долоо хоног
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={input.weeks}
                    onChange={(e) => patch({ weeks: Number(e.target.value) })}
                  />
                </label>
                <label>
                  Долоо хоногт өдөр
                  <input
                    type="number"
                    min={1}
                    max={7}
                    value={input.daysPerWeek}
                    onChange={(e) =>
                      patch({ daysPerWeek: Number(e.target.value) })
                    }
                  />
                </label>
                <label>
                  Нэг өдөрт минут
                  <input
                    type="number"
                    min={5}
                    max={120}
                    value={input.minutesPerDay}
                    onChange={(e) =>
                      patch({ minutesPerDay: Number(e.target.value) })
                    }
                  />
                </label>
              </div>
              <button
                className="button"
                onClick={() => {
                  try {
                    setPreview(planPreview(input, data));
                    setError("");
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Хуваарийг урьдчилж харах
              </button>
            </>
          )}
          {error && <p role="alert">{error}</p>}
          {preview && (
            <div className="plan-preview">
              <h3>
                {preview.tasks.length} жижиг алхам ·{" "}
                {formatTime(preview.goal.targetMinutes * 60)}
              </h3>
              <p>
                Хичээлийн зорилго: {formatTime(preview.goal.weeklyMinutes * 60)}
                /долоо хоног
              </p>
              <ol className="goal-task-list">
                {preview.tasks.map((t) => (
                  <li key={t.id}>
                    <strong>
                      {t.date} · {t.minutes}м
                    </strong>
                    <span>{t.title}</span>
                  </li>
                ))}
              </ol>
              <button
                className="button primary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  if (
                    await run(
                      () => store.mutate(commitPlan(preview)),
                      "Зорилго болон алхмууд хадгалагдлаа.",
                    )
                  )
                    onClose();
                  setBusy(false);
                }}
              >
                Энэ төлөвлөгөөг хадгалах
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
