"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { parsePlanProposal } from "@/lib/assistant/plan";
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
import { formatTime } from "@/lib/calculations/dates";
import {
  Modal,
  Progress,
  SectionTitle,
  SubjectSelect,
} from "@/components/ui/common";
import { Icon } from "@/components/ui/icon";
import { GoalEditor } from "./goal-editor";
import {
  goalDetails,
  milestoneProgress,
  nextTask,
} from "@/lib/world/milestones";
import { TaskForm } from "@/components/dashboard/task-form";
export function GoalPlanner() {
  const { data, index, today, store, run, navigate } = useStudy(),
    [adding, setAdding] = useState(false),
    [editing, setEditing] = useState<string | null>(null),
    [editingTask, setEditingTask] = useState<string | null>(null);
  const active = data.studyGoals.filter((g) => !g.deletedAt),
    deleted = data.studyGoals.filter((g) => g.deletedAt),
    progress = useMemo(
      () =>
        new Map(
          data.studyGoals
            .filter((g) => !g.deletedAt)
            .map((g) => [g.id, goalProgress(data, g, today)]),
        ),
      [data, today],
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
            Бондооктой төлөвлөх <Icon name="arrow" />
          </button>
        </div>
      )}
      <div className="goal-plans">
        {active.map((g) => {
          const p = progress.get(g.id)!,
            next = nextTask(p.tasks, today),
            details = goalDetails(g),
            milestones = milestoneProgress(data, g, today);
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
              {details.description && (
                <p className="goal-description">{details.description}</p>
              )}
              <p className="tiny muted">
                {g.startsOn} — {g.endsOn} ·{" "}
                {g.extras.studyPlan
                  ? `${details.weeklyDays} өдөр/долоо хоног`
                  : "Суралцах өдрүүдээ тохируулаарай"}
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
                <span>Энэ зорилгод энэ долоо хоногт</span>
                <strong>
                  {formatTime(p.weeklySeconds)} /{" "}
                  {formatTime(g.weeklyMinutes * 60)}
                </strong>
              </div>
              <Progress
                value={(p.weeklySeconds / (g.weeklyMinutes * 60)) * 100}
                label={`${g.title} долоо хоногийн зорилго`}
              />
              {milestones.length > 0 && (
                <ol
                  className="milestone-list"
                  aria-label={`${g.title} үе шатууд`}
                >
                  {milestones.map((m, i) => (
                    <li key={m.id} className={m.done ? "is-complete" : ""}>
                      <span
                        className="milestone-number"
                        aria-label={m.done ? "Биелсэн" : `${i + 1}-р үе шат`}
                      >
                        {m.done ? "✓" : String(i + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <strong>{m.title}</strong>
                        <small>
                          {m.completed}/{m.tasks.length} алхам ·{" "}
                          {formatTime(m.seconds)} хэмжсэн
                        </small>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
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
                        navigate("focus");
                        return;
                      }
                      if (
                        await run(() =>
                          store.mutate(
                            actions.start(
                              g.subjectId,
                              "pomodoro",
                              "focus",
                              Math.min(240, next.minutes),
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
                      <button
                        className="icon-button"
                        aria-label={`${t.title} засах`}
                        onClick={() => setEditingTask(t.id)}
                      >
                        <Icon name="edit" size={16} />
                      </button>
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
      {editingTask && (
        <TaskForm
          key={editingTask}
          date={today}
          task={data.tasks.find((t) => t.id === editingTask)}
          onClose={() => setEditingTask(null)}
        />
      )}
      {adding && <PlanWizard onClose={() => setAdding(false)} />}
      {editing && (
        <GoalEditor
          key={editing}
          id={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
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
    { language } = useI18n(),
    [text, setText] = useState(initial),
    [input, setInput] = useState<PlanInput | null>(
      initial ? inferPlan(initial, data, today) : null,
    ),
    [preview, setPreview] = useState<PlanPreview | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [onlineProposal, setOnlineProposal] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const propose = async () => {
    if (!onlineProposal) {
      setInput(inferPlan(text, data, today));
      setPreview(null);
      setError("");
      return;
    }
    const namespace = store.getSnapshot().namespace,
      controller = new AbortController();
    pending.current?.abort();
    pending.current = controller;
    const timeout = setTimeout(() => controller.abort(), 35000);
    setBusy(true);
    setError("");
    try {
      const client = getSupabase(),
        session = client ? (await client.auth.getSession()).data.session : null;
      if (
        !session ||
        namespace !== `account:${session.user.id}` ||
        store.getSnapshot().namespace !== namespace
      )
        throw Error("Онлайн санал авахын тулд бүртгэлээрээ нэвтэрнэ үү.");
      const draft = input ?? inferPlan(text, data, today);
      await store.mutate((d) => {
        if (store.getSnapshot().namespace !== namespace)
          throw Error("Бүртгэл өөрчлөгдсөн.");
        return {
          ...d,
          settings: {
            ...d.settings,
            updatedAt: Date.now(),
            extras: { ...d.settings.extras, aiEnabled: true },
          },
        };
      });
      const response = await fetch("/api/bondook/plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message: text,
          context: {
            today,
            subject: data.subjects.find((s) => s.id === draft.subjectId)?.name,
            availableWeeks: draft.weeks,
            daysPerWeek: draft.daysPerWeek,
            minutesPerDay: draft.minutesPerDay,
          },
          language,
        }),
        signal: controller.signal,
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error ?? "AI түр холбогдсонгүй.");
      const proposal = parsePlanProposal(result.plan);
      if (
        !controller.signal.aborted &&
        store.getSnapshot().namespace === namespace
      ) {
        setInput({ ...draft, ...proposal });
        setPreview(null);
      }
    } catch (error) {
      if (store.getSnapshot().namespace === namespace)
        setError(
          error instanceof Error ? error.message : "Санал гаргаж чадсангүй.",
        );
    } finally {
      clearTimeout(timeout);
      setBusy(false);
    }
  };
  const patch = (p: Partial<PlanInput>) => {
    setInput((i) => (i ? { ...i, ...p } : i));
    setPreview(null);
  };
  return (
    <Modal title="Бондооктой төлөвлөх" onClose={onClose}>
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
            disabled={!text.trim() || busy}
            onClick={() => void propose()}
          >
            {busy ? "Санал бэлдэж байна…" : "Алхмуудын санал гаргах"}
          </button>
          <label className="check-label">
            <input
              type="checkbox"
              checked={onlineProposal}
              disabled={busy}
              onChange={(e) => setOnlineProposal(e.target.checked)}
            />
            Энэ зорилго, хичээлийн нэр, боломжит цагаа онлайн AI-д илгээж санал
            авах
          </label>
          <p className="tiny muted">
            {onlineProposal
              ? "Гарсан AI саналыг доороос хянаж засаарай. Хадгалах хүртэл төлөвлөгөөнд нэмэхгүй. "
              : "Төхөөрөмж дээрх загвараар санал гаргана. "}
            Бондоок хичээлийн нэр, хугацаанд тулгуурлан хуваарь санал болгоно.
            Үе шатны агуулгыг өөрийн түвшин, сурах материалаар тохируулаарай.
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
                Тайлбар
                <textarea
                  rows={2}
                  maxLength={2000}
                  value={input.description ?? ""}
                  onChange={(e) => patch({ description: e.target.value })}
                  placeholder="Юунд хүрэхээ товч бичээрэй"
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
              <fieldset className="milestone-editor">
                <legend>Үе шатууд — өөрийн агуулгад тааруулж засаарай</legend>
                {(input.milestoneTitles ?? []).map((title, i) => (
                  <div className="milestone-edit-row" key={i}>
                    <label>
                      {i + 1}-р үе шат
                      <input
                        maxLength={120}
                        value={title}
                        onChange={(e) =>
                          patch({
                            milestoneTitles: input.milestoneTitles?.map(
                              (t, j) => (i === j ? e.target.value : t),
                            ),
                          })
                        }
                      />
                    </label>
                    <button
                      className="icon-button"
                      aria-label={`${i + 1}-р үе шат хасах`}
                      disabled={(input.milestoneTitles?.length ?? 0) <= 1}
                      onClick={() =>
                        patch({
                          milestoneTitles: input.milestoneTitles?.filter(
                            (_, j) => j !== i,
                          ),
                        })
                      }
                    >
                      <Icon name="close" size={16} />
                    </button>
                  </div>
                ))}
                <button
                  className="button small"
                  disabled={(input.milestoneTitles?.length ?? 0) >= 12}
                  onClick={() =>
                    patch({
                      milestoneTitles: [
                        ...(input.milestoneTitles ?? []),
                        "Шинэ үе шат",
                      ],
                    })
                  }
                >
                  Үе шат нэмэх
                </button>
              </fieldset>
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
