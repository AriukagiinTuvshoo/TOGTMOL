"use client";
import { useState } from "react";
import { useStudy } from "@/hooks/use-study";
import { actions } from "@/lib/persistence/actions";
import { goalDetails } from "@/lib/world/milestones";
import type { DailyTask } from "@/types/study";
import { Empty, Modal, SubjectSelect } from "@/components/ui/common";

export function TaskForm({
  date,
  task,
  onClose,
}: {
  date: string;
  task?: DailyTask;
  onClose: () => void;
}) {
  const { data, store, run, navigate } = useStudy();
  const [initial] = useState(task);
  const [subject, setSubject] = useState(
    task?.subjectId ??
      data.subjects.find((s) => !s.deletedAt && !s.archived)?.id ??
      "",
  );
  const [title, setTitle] = useState(task?.title ?? ""),
    [minutes, setMinutes] = useState(task?.minutes ?? 25),
    [day, setDay] = useState(task?.date ?? date),
    [startTime, setTime] = useState(task?.startTime ?? ""),
    [goalId, setGoal] = useState(task?.goalId ?? ""),
    [milestoneId, setMilestone] = useState(
      typeof task?.extras.milestoneId === "string"
        ? task.extras.milestoneId
        : "",
    ),
    [busy, setBusy] = useState(false);
  const goals = data.studyGoals.filter(
    (g) => !g.deletedAt && g.subjectId === subject,
  );
  const goal = goals.find((g) => g.id === goalId);
  const milestones = goal ? goalDetails(goal).milestones : [];
  return (
    <Modal
      title={task ? "Алхам засах" : "Жижиг алхам төлөвлөх"}
      onClose={onClose}
    >
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
            const patch = {
              title,
              date: day,
              minutes,
              startTime: startTime || null,
              milestoneId: milestoneId || null,
            };
            if (
              await run(
                () =>
                  store.mutate(
                    initial
                      ? actions.editTask(initial.id, initial.updatedAt, patch)
                      : actions.addTask({
                          ...patch,
                          subjectId: subject,
                          goalId: goalId || null,
                        }),
                  ),
                initial ? "Алхам шинэчлэгдлээ." : "Төлөвлөгөө нэмэгдлээ.",
              )
            )
              onClose();
            setBusy(false);
          }}
        >
          {!task && (
            <label>
              Хичээл
              <SubjectSelect
                value={subject}
                onChange={(id) => {
                  setSubject(id);
                  setGoal("");
                  setMilestone("");
                }}
                required
              />
            </label>
          )}
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
              Өдөр
              <input
                type="date"
                required
                value={day}
                onChange={(e) => setDay(e.target.value)}
              />
            </label>
            <label>
              Минут
              <input
                type="number"
                min={1}
                max={1440}
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
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
          {!task && goals.length > 0 && (
            <label>
              Зорилготой холбох
              <select
                value={goalId}
                onChange={(e) => {
                  setGoal(e.target.value);
                  setMilestone("");
                }}
              >
                <option value="">Бие даасан алхам</option>
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          {milestones.length > 0 && (
            <label>
              Үе шат
              <select
                value={milestoneId}
                onChange={(e) => setMilestone(e.target.value)}
              >
                <option value="">Үе шат сонгохгүй</option>
                {milestones.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button className="button primary" disabled={busy}>
            {task ? "Алхам хадгалах" : "Төлөвлөх"}
          </button>
        </form>
      )}
    </Modal>
  );
}
