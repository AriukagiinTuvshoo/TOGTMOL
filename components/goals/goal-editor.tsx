"use client";
import { useState } from "react";
import { useStudy } from "@/hooks/use-study";
import { uid } from "@/lib/constants";
import { editGoalDetails, goalDetails } from "@/lib/world/milestones";
import { Modal } from "@/components/ui/common";

export function GoalEditor({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const { data, store, run } = useStudy();
  const [goal] = useState(() => data.studyGoals.find((g) => g.id === id)!);
  const [value, setValue] = useState(() => ({
    title: goal.title,
    weeklyMinutes: goal.weeklyMinutes,
    targetMinutes: goal.targetMinutes,
    endsOn: goal.endsOn,
    ...goalDetails(goal),
  }));
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Зорилго засах" onClose={onClose}>
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          if (
            await run(
              () => store.mutate(editGoalDetails(id, goal.updatedAt, value)),
              "Зорилго шинэчлэгдлээ.",
            )
          )
            onClose();
          setBusy(false);
        }}
      >
        <label>
          Зорилгын нэр
          <input
            required
            maxLength={200}
            value={value.title}
            onChange={(e) => setValue({ ...value, title: e.target.value })}
          />
        </label>
        <label>
          Тайлбар
          <textarea
            rows={3}
            maxLength={2000}
            value={value.description}
            onChange={(e) =>
              setValue({ ...value, description: e.target.value })
            }
            placeholder="Энэ зорилго танд яагаад хэрэгтэй вэ?"
          />
        </label>
        <div className="form-grid">
          <label>
            Долоо хоногт (минут)
            <input
              type="number"
              required
              min={5}
              max={10080}
              value={value.weeklyMinutes}
              onChange={(e) =>
                setValue({ ...value, weeklyMinutes: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Долоо хоногт өдөр
            <input
              type="number"
              required
              min={1}
              max={7}
              value={value.weeklyDays}
              onChange={(e) =>
                setValue({ ...value, weeklyDays: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Нийт зорилтот минут
            <input
              type="number"
              required
              min={5}
              max={120960}
              value={value.targetMinutes}
              onChange={(e) =>
                setValue({ ...value, targetMinutes: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Дуусах өдөр
            <input
              type="date"
              required
              min={goal.startsOn}
              value={value.endsOn}
              onChange={(e) => setValue({ ...value, endsOn: e.target.value })}
            />
          </label>
        </div>
        <fieldset className="milestone-editor">
          <legend>Зорилгын үе шатууд</legend>
          {value.milestones.map((m, i) => (
            <label key={m.id}>
              {i + 1}-р үе шат
              <input
                required
                maxLength={120}
                value={m.title}
                onChange={(e) =>
                  setValue({
                    ...value,
                    milestones: value.milestones.map((n) =>
                      n.id === m.id ? { ...n, title: e.target.value } : n,
                    ),
                  })
                }
              />
            </label>
          ))}
          <button
            type="button"
            className="button small"
            disabled={value.milestones.length >= 12}
            onClick={() =>
              setValue({
                ...value,
                milestones: [
                  ...value.milestones,
                  { id: uid("milestone"), title: "Шинэ үе шат" },
                ],
              })
            }
          >
            Үе шат нэмэх
          </button>
        </fieldset>
        <p className="tiny muted">
          Хуваарь, түүхийг автоматаар дахин бичихгүй. Алхам бүрийн засах товчоор
          өдөр болон үе шатыг нь сонгоорой.
        </p>
        <button className="button primary" disabled={busy}>
          Өөрчлөлт хадгалах
        </button>
      </form>
    </Modal>
  );
}
