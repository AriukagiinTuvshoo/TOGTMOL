"use client";
import { useState } from "react";
import { Modal, SubjectSelect } from "@/components/ui/common";
import { useStudy } from "@/hooks/use-study";
import { actions } from "@/lib/persistence/actions";
import { formatTime } from "@/lib/calculations/dates";

const DAYS = [
  ["1", "Да"],
  ["2", "Мя"],
  ["3", "Лх"],
  ["4", "Пү"],
  ["5", "Ба"],
  ["6", "Бя"],
  ["0", "Ня"],
] as const;

export function CalendarPlanner({
  date,
  onClose,
}: {
  date: string;
  onClose: () => void;
}) {
  const { data, store, run } = useStudy();
  const defaultSubject =
    data.subjects.find((s) => !s.deletedAt && !s.archived)?.id ??
    data.subjects.find((s) => !s.deletedAt)?.id ??
    "";
  const [kind, setKind] = useState<"plan" | "deadline">("plan");
  const [subject, setSubject] = useState(defaultSubject);
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState(date);
  const [endDate, setEndDate] = useState(date);
  const [startTime, setStartTime] = useState("19:00");
  const [minutes, setMinutes] = useState(25);
  const [repeat, setRepeat] = useState(false);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!subject) return;
    setBusy(true);
    const ok = await run(
      () =>
        store.mutate(
          kind === "deadline"
            ? actions.addDeadline({
                title,
                subjectId: subject,
                date: startDate,
                time: startTime,
                notes,
              })
            : repeat
              ? actions.addRecurringTasks({
                  subjectId: subject,
                  title,
                  startDate,
                  endDate,
                  weekdays,
                  startTime: startTime || null,
                  minutes,
                })
              : actions.addTask({
                  subjectId: subject,
                  title,
                  date: startDate,
                  minutes,
                  startTime: startTime || null,
                }),
        ),
      kind === "deadline"
        ? "Deadline нэмэгдлээ."
        : repeat
          ? "Давтагдах хуваарь нэмэгдлээ."
          : "Төлөвлөгөө нэмэгдлээ.",
    );
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Modal
      title={
        kind === "deadline"
          ? "Шалгалт / deadline нэмэх"
          : "Суралцах төлөвлөгөө нэмэх"
      }
      onClose={onClose}
    >
      <form className="form-stack calendar-planner-form" onSubmit={submit}>
        <div className="segmented">
          <button
            type="button"
            aria-pressed={kind === "plan"}
            onClick={() => setKind("plan")}
          >
            📚 Суралцах
          </button>
          <button
            type="button"
            aria-pressed={kind === "deadline"}
            onClick={() => setKind("deadline")}
          >
            🎯 Deadline
          </button>
        </div>
        <label>
          Хичээл
          <SubjectSelect value={subject} onChange={setSubject} required />
        </label>
        <label>
          Гарчиг
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            required
          />
        </label>
        {kind === "deadline" ? (
          <>
            <div className="form-grid">
              <label>
                Огноо
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </label>
              <label>
                Цаг
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
              </label>
            </div>
            <label>
              Тэмдэглэл
              <textarea
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={2000}
                placeholder="Шалгалтын өрөө, бүлэг, холбоос..."
              />
            </label>
          </>
        ) : (
          <>
            <div className="form-grid">
              <label>
                Эхлэх өдөр
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </label>
              <label>
                Дуусах өдөр
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
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
                Эхлэх цаг
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </label>
            </div>
            <label className="check-label">
              <input
                type="checkbox"
                checked={repeat}
                onChange={(e) => setRepeat(e.target.checked)}
              />
              Давтагдах хуваарь болгох
            </label>
            {repeat && (
              <fieldset>
                <legend>Давтагдах өдрүүд</legend>
                <div className="calendar-weekday-picker">
                  {DAYS.map(([value, label]) => {
                    const day = Number(value);
                    return (
                      <label className="calendar-weekday-toggle" key={value}>
                        <input
                          type="checkbox"
                          checked={weekdays.includes(day)}
                          onChange={(e) =>
                            setWeekdays((current) =>
                              e.target.checked
                                ? [...current, day]
                                : current.filter((d) => d !== day),
                            )
                          }
                        />
                        <span>{label}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="tiny muted">
                  {weekdays.length
                    ? `${weekdays.length} өдөр · ${formatTime(
                        minutes * 60,
                      )} / удаа`
                    : "Жишээ: Даваа + Мягмар · 19:00"}
                </p>
              </fieldset>
            )}
          </>
        )}
        <button className="button primary" disabled={busy || !subject}>
          {busy
            ? "Хадгалж байна…"
            : kind === "deadline"
              ? "Deadline хадгалах"
              : repeat
                ? "Хуваарь хадгалах"
                : "Төлөвлөх"}
        </button>
      </form>
    </Modal>
  );
}
